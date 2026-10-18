import { describe, it, expect, beforeEach } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { AudioEngine } from '../../src/audio/AudioEngine';

describe('P11-03 Dead player cannot be revived via pickups or stat recalculation', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let pickupSystem: PickupSystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    audio = new AudioEngine();
    pickupSystem = new PickupSystem(runState, audio);
  });

  it('preserves 0 HP and dead status when updating pickups and recalculating stats', () => {
    runState.playerPos = { x: 0, z: 0 };
    pickupSystem.spawnSupplyCrate(0, 0);
    pickupSystem.spawnBossVault(0, 0);
    expect(pickupSystem.pickups.length).toBe(2);

    // Lethal damage with 0 revivals
    runState.revivalsLeft = 0;
    runState.takeDamage(10000);

    expect(runState.hp).toBe(0);
    expect(runState.isDead).toBe(true);

    // PickupSystem update should early-return without collecting or healing
    pickupSystem.update(0.1);
    expect(pickupSystem.pickups.length).toBe(2);
    expect(runState.hp).toBe(0);
    expect(runState.isDead).toBe(true);

    // Direct heal call should be a no-op
    const healed = runState.heal(50);
    expect(healed).toBe(0);
    expect(runState.hp).toBe(0);
    expect(runState.isDead).toBe(true);

    // recalculateStats should never reset 0 HP to 1+
    runState.recalculateStats();
    expect(runState.hp).toBe(0);
    expect(runState.isDead).toBe(true);
  });
});
