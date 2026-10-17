import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { VaultJackpotModal } from '../../src/ui/VaultJackpotModal';
import { globalEvents } from '../../src/core/EventBus';

describe('P1-07 boss vault shows a real choice', () => {
  it('does not auto-apply choices on vault pickup and shows 3 REQUISITIONS AUTHORISED in modal', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    const audio = new AudioEngine();
    const pickupSystem = new PickupSystem(runState, audio);

    // Initial state: only starting weapon at level 1, no passives
    expect(runState.weapons.size).toBe(1);
    expect(runState.passives.size).toBe(0);

    let vaultEventReceived: {
      upgradesAwarded: number;
      evolvedWeapon?: string;
      alloyBonus: number;
    } | null = null;

    const unsub = globalEvents.on('vault:opened', (data) => {
      vaultEventReceived = data;
    });

    // Spawn and collect a boss vault at player pos (0, 0)
    pickupSystem.spawnBossVault(0, 0);
    expect(pickupSystem.pickups).toHaveLength(1);

    pickupSystem.update(0.016);
    expect(pickupSystem.pickups).toHaveLength(0);

    // Vault was opened
    expect(vaultEventReceived).not.toBeNull();
    expect(vaultEventReceived!.evolvedWeapon).toBeUndefined();
    expect(vaultEventReceived!.upgradesAwarded).toBe(3);

    // Critical assertion: weapons and passives were NOT auto-applied behind the player's back!
    expect(runState.weapons.get('ithaca_37')?.level).toBe(1);
    expect(runState.passives.size).toBe(0);

    // Test VaultJackpotModal rendering
    const modalRoot = document.createElement('div');
    const vaultModal = new VaultJackpotModal(modalRoot);
    vaultModal.show(
      vaultEventReceived!.upgradesAwarded,
      undefined,
      vaultEventReceived!.alloyBonus,
      () => {}
    );

    expect(modalRoot.textContent).toContain('3 REQUISITIONS AUTHORISED');
    expect(modalRoot.textContent).not.toContain('TACTICAL ADVANCEMENTS GRANTED');

    unsub();
  });

  it('generates real weapon and passive choices without medkit or scrap when the pool is not empty', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});

    // Generate choices for vault flow
    const choices = runState.generateUpgradeChoices();
    expect(choices.length).toBeGreaterThanOrEqual(3);

    // With a fresh run, no medkit or scrap should appear
    for (const choice of choices) {
      expect(choice.kind).not.toBe('heal');
      expect(choice.kind).not.toBe('scrap');
      expect(['weapon', 'passive']).toContain(choice.kind);
    }
  });

  it('chains 3 requisitions sequentially until pendingLevelUps reaches 0', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});

    // Simulating Game.ts vault close callback when !evolvedWeapon:
    runState.pendingLevelUps += 3;
    expect(runState.pendingLevelUps).toBe(3);

    // 1st requisition
    runState.pendingLevelUps--;
    let choices = runState.generateUpgradeChoices();
    expect(choices.length).toBeGreaterThanOrEqual(3);
    runState.applyUpgrade(choices[0]);
    expect(runState.pendingLevelUps).toBe(2);

    // 2nd requisition
    runState.pendingLevelUps--;
    choices = runState.generateUpgradeChoices();
    runState.applyUpgrade(choices[0]);
    expect(runState.pendingLevelUps).toBe(1);

    // 3rd requisition
    runState.pendingLevelUps--;
    choices = runState.generateUpgradeChoices();
    runState.applyUpgrade(choices[0]);
    expect(runState.pendingLevelUps).toBe(0);
  });
});
