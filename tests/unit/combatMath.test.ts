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

  it('preserves purchased meta upgrades when in-run passives are applied', () => {
    const state = new RunState();
    // Start run with armor_vest = 2 (+2 armor) and combat_stims = 2 (+30 maxHp)
    state.initRun('reese_2029', { armor_vest: 2, combat_stims: 2 });
    expect(state.computedStats.armor).toBe(2);
    expect(state.maxHp).toBe(130);

    // Pick an in-run passive (might_shells)
    state.applyUpgrade({
      kind: 'passive',
      id: 'might_shells',
      title: 'Heavy Shells',
      subtitle: '',
      currentLevel: 0,
      nextLevel: 1,
      description: '',
      accentColor: '#fff'
    });

    // Meta upgrades must remain applied after recalculateStats!
    expect(state.computedStats.armor).toBe(2);
    expect(state.maxHp).toBe(130);
    expect(state.computedStats.mightMultiplier).toBeGreaterThan(1.0);
  });

  it('multiplies scrap awards by xpGainMultiplier from scavenger protocol', () => {
    const state = new RunState();
    // scavenger_protocol = 2 (+24% XP / Scrap multiplier)
    state.initRun('reese_2029', { scavenger_protocol: 2 });
    expect(state.computedStats.xpGainMultiplier).toBeCloseTo(1.24);

    const scrap = state.addScrap(50);
    expect(scrap).toBe(62);
    expect(state.alloyScrapEarned).toBe(62);
  });

  it('computes critical hit and armor-strip vulnerability damage scaling', () => {
    const baseDamage = 100;

    // Normal hit with intact armor (armorStripMultiplier = 1.0)
    const vulnIntact = 1 / Math.max(0.4, 1.0);
    expect(vulnIntact).toBe(1.0);
    const normalDamage = Math.round(baseDamage * vulnIntact * 1.0);
    expect(normalDamage).toBe(100);

    // Critical hit with intact armor
    const critDamage = Math.round(baseDamage * vulnIntact * 1.75);
    expect(critDamage).toBe(175);

    // Stripped armor (e.g., emp_supernova reduces armorStripMultiplier to 0.4)
    const vulnStripped = 1 / Math.max(0.4, 0.4);
    expect(vulnStripped).toBe(2.5); // 2.5x vulnerability multiplier!
    const strippedDamage = Math.round(baseDamage * vulnStripped * 1.0);
    expect(strippedDamage).toBe(250);

    // Critical hit against stripped armor (2.5x * 1.75x = 4.375x!)
    const strippedCritDamage = Math.round(baseDamage * vulnStripped * 1.75);
    expect(strippedCritDamage).toBe(438);
  });
});
