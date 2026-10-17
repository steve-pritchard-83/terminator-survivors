import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';

describe('P1-03 multi-level XP', () => {
  it('returns > 5 levels gained and leaves xp < xpToNext when granted 10,000 XP at level 1', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    expect(runState.level).toBe(1);
    expect(runState.xp).toBe(0);

    const levelsGained = runState.addXp(10_000);
    expect(levelsGained).toBeGreaterThan(5);
    expect(runState.level).toBe(1 + levelsGained);
    expect(runState.xp).toBeLessThan(runState.xpToNext);
    expect(runState.xp).toBeGreaterThanOrEqual(0);
  });

  it('resets pendingLevelUps to 0 upon initRun', () => {
    const runState = new RunState();
    runState.pendingLevelUps = 5;
    runState.initRun('reese_2029', {});
    expect(runState.pendingLevelUps).toBe(0);
  });

  it('accumulates exact levels when crossing single or multiple level thresholds', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    const initialNeeded = runState.xpToNext;

    // Add just enough for 1 level plus 5 extra XP
    const firstGain = runState.addXp(initialNeeded + 5);
    expect(firstGain).toBe(1);
    expect(runState.level).toBe(2);
    expect(runState.xp).toBe(5);
    expect(runState.xp).toBeLessThan(runState.xpToNext);
  });
});
