import { describe, it, expect } from 'vitest';
import { getXpForNextLevel, computeMitigatedDamage, RunState } from '../../src/state/RunState';

describe('Combat and Leveling Mathematics', () => {
  it('calculates monotonically increasing XP requirements for levels', () => {
    let lastXp = 0;
    for (let lv = 1; lv <= 25; lv++) {
      const needed = getXpForNextLevel(lv);
      expect(needed).toBeGreaterThan(lastXp);
      lastXp = needed;
    }
    expect(getXpForNextLevel(1)).toBe(20);
    expect(getXpForNextLevel(2)).toBe(33);
  });

  it('computes diminishing return armor mitigation accurately', () => {
    const raw = 50;
    expect(computeMitigatedDamage(raw, 0)).toBe(50);
    expect(computeMitigatedDamage(raw, 2)).toBeLessThan(50);
    expect(computeMitigatedDamage(raw, 5)).toBeLessThan(computeMitigatedDamage(raw, 2));
    expect(computeMitigatedDamage(raw, 100)).toBeGreaterThanOrEqual(1); // Never deals 0 damage
  });

  it('verifies combat dive invulnerability window', () => {
    const state = new RunState();
    state.initRun('reese_2029', {});

    expect(state.isDashing).toBe(false);
    expect(state.hp).toBe(100);

    const dashed = state.triggerDash();
    expect(dashed).toBe(true);
    expect(state.isDashing).toBe(true);

    // Damage taken during dash is 0 (i-frames)
    const dmg = state.takeDamage(40);
    expect(dmg).toBe(0);
    expect(state.hp).toBe(100);

    // After dash duration expires, damage applies normally
    state.updateTimers(0.3);
    expect(state.isDashing).toBe(false);
    const normalDmg = state.takeDamage(40);
    expect(normalDmg).toBe(40);
    expect(state.hp).toBe(60);
  });
});
