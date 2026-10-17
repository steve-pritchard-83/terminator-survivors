import { describe, it, expect } from 'vitest';
import { RunState, getXpForNextLevel } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { globalEvents } from '../../src/core/EventBus';

describe('P1-04 freeze pickups while modal is open', () => {
  it('collects two cores in one tick leaving pendingLevelUps === 1 and freezes further pickups while modal is open', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    const audio = new AudioEngine();
    const pickupSystem = new PickupSystem(runState, audio);

    // Player is at (0, 0)
    runState.playerPos = { x: 0, z: 0 };

    // Set up two cores right on player, each with enough XP for 1 level
    const xpNeededL1 = getXpForNextLevel(1);
    const xpNeededL2 = getXpForNextLevel(2);
    pickupSystem.spawnDataCore(0, 0, xpNeededL1);
    pickupSystem.spawnDataCore(0, 0, xpNeededL2);
    expect(pickupSystem.pickups.length).toBe(2);

    // Track levelup:triggered events
    let modalOpenedCount = 0;
    const unsub = globalEvents.on('levelup:triggered', () => {
      modalOpenedCount++;
      runState.mode = 'levelup';
    });

    // Run tick 1: PickupSystem collects both cores
    pickupSystem.update(0.016);
    expect(pickupSystem.pickups.length).toBe(0);
    // Two levels gained: pendingLevelUps is 2
    expect(runState.pendingLevelUps).toBe(2);

    // Game tick resolves queued level up:
    if (runState.mode === 'playing' && runState.pendingLevelUps > 0) {
      runState.pendingLevelUps--;
      const choices = runState.generateUpgradeChoices();
      globalEvents.emit('levelup:triggered', { level: runState.level, choices });
    }

    // Exactly one modal opened, pendingLevelUps === 1, mode is levelup
    expect(modalOpenedCount).toBe(1);
    expect(runState.pendingLevelUps).toBe(1);
    expect(runState.mode).toBe('levelup');

    // Spawn a third core while modal is open
    pickupSystem.spawnDataCore(0, 0, 50);
    expect(pickupSystem.pickups.length).toBe(1);

    // Run tick 2 while in 'levelup' mode: pickups must freeze and not be collected!
    pickupSystem.update(0.016);
    expect(pickupSystem.pickups.length).toBe(1);
    expect(runState.pendingLevelUps).toBe(1);

    unsub();
  });
});
