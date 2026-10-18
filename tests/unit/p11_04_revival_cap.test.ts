import { describe, it, expect, beforeEach } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { MAX_REVIVAL_CHANCE, REVIVE_INVULNERABILITY_SECONDS } from '../../src/data/balance';

describe('P11-04 Revival chance cap and revive invulnerability', () => {
  let runState: RunState;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
  });

  it('clamps revival chance at MAX_REVIVAL_CHANCE (0.5) when stacking passives and meta upgrades', () => {
    // dog_tags level 5 gives 5 * 0.15 = 0.75 revivalChance
    runState.passives.set('dog_tags', 5);
    runState.recalculateStats();

    expect(runState.computedStats.revivalChance).toBe(MAX_REVIVAL_CHANCE);
    expect(runState.computedStats.revivalChance).toBe(0.5);
  });

  it('grants at least 2.0 seconds of invulnerability immediately on fixed revive', () => {
    runState.revivalsLeft = 1;
    runState.hp = 0;

    const outcome = runState.resolveLethalDamage();
    expect(outcome).toBe('revived');
    expect(runState.hp).toBeGreaterThan(0);
    expect(runState.invulnerabilityTimer).toBeGreaterThanOrEqual(REVIVE_INVULNERABILITY_SECONDS);
    expect(runState.invulnerabilityTimer).toBe(2.0);
    expect(runState.isDead).toBe(false);
  });

  it('grants at least 2.0 seconds of invulnerability immediately on chance-based revive', () => {
    runState.revivalsLeft = 0;
    // Set revival chance to max
    runState.computedStats.revivalChance = 1.0;
    runState.hp = 0;

    const outcome = runState.resolveLethalDamage();
    expect(outcome).toBe('revived');
    expect(runState.hp).toBeGreaterThan(0);
    expect(runState.invulnerabilityTimer).toBeGreaterThanOrEqual(REVIVE_INVULNERABILITY_SECONDS);
    expect(runState.invulnerabilityTimer).toBe(2.0);
    expect(runState.isDead).toBe(false);
  });
});
