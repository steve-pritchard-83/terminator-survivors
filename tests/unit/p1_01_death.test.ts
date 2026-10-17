import { describe, it, expect, vi } from 'vitest';
import { RunState } from '../../src/state/RunState';

describe('P1-01 single guarded death', () => {
  it('returns 0 damage when player is already dead or not in playing mode', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    expect(runState.hp).toBe(100);

    // Lethal hit
    const firstHit = runState.takeDamage(100);
    expect(firstHit).toBe(100);
    expect(runState.hp).toBe(0);

    // Subsequent hits in the same frame on a dead player must return 0
    const secondHit = runState.takeDamage(50);
    expect(secondHit).toBe(0);
    expect(runState.hp).toBe(0);

    // When mode is not 'playing' (e.g. gameover or paused), takeDamage returns 0
    runState.hp = 100;
    runState.mode = 'gameover';
    expect(runState.takeDamage(50)).toBe(0);
    expect(runState.hp).toBe(100);
  });

  it('correctly handles lethal damage resolution and revival replenishment', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', { defibrillator: 1 });
    expect(runState.revivalsLeft).toBe(1);

    // Alive check
    expect(runState.resolveLethalDamage()).toBe('alive');

    // Take lethal damage
    runState.takeDamage(999);
    expect(runState.hp).toBe(0);

    // First lethal resolution uses revival
    const firstResolution = runState.resolveLethalDamage();
    expect(firstResolution).toBe('revived');
    expect(runState.hp).toBe(Math.round(runState.maxHp * 0.5));
    expect(runState.revivalsLeft).toBe(0);

    // Take second lethal damage with 0 revivals left
    runState.takeDamage(999);
    expect(runState.hp).toBe(0);
    const secondResolution = runState.resolveLethalDamage();
    expect(secondResolution).toBe('dead');
  });

  it('guards multiple lethal hits so only one death resolution occurs', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    const onDeadSpy = vi.fn();

    // Simulate 5 swarm attacks in a single tick hitting the player for 999 damage each
    for (let i = 0; i < 5; i++) {
      runState.takeDamage(999);
    }

    // Tick end resolves lethal damage
    const status = runState.resolveLethalDamage();
    if (status === 'dead') {
      onDeadSpy();
    }

    expect(onDeadSpy).toHaveBeenCalledTimes(1);

    // Next tick on dead player does not trigger death resolution again
    expect(runState.resolveLethalDamage()).toBe('dead');
  });
});
