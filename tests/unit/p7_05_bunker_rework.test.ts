import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import { META_UPGRADES } from '../../src/data/upgrades';
import { RunState } from '../../src/state/RunState';
import type { MetaUpgradeId } from '../../src/core/types';

describe('P7-05 Bunker Upgrades Rework & Refund Mechanics', () => {
  let saveManager: SaveManager;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager();
  });

  it('defines all 18 meta upgrades with valid configs', () => {
    const keys = Object.keys(META_UPGRADES) as MetaUpgradeId[];
    expect(keys.length).toBe(18);

    const expectedKeys: MetaUpgradeId[] = [
      'armor_vest',
      'combat_stims',
      'plasma_overclock',
      'servo_greaves',
      'salvage_magnet',
      'phase_capacitor',
      'scavenger_protocol',
      'defibrillator',
      'crit_core',
      'high_caliber',
      'blast_dampeners',
      'extended_capacitors',
      'plasma_accelerator',
      'tactical_relay',
      'reroll_protocol',
      'banish_protocol',
      'skip_protocol',
      'veteran_resilience'
    ];

    for (const key of expectedKeys) {
      expect(META_UPGRADES[key]).toBeDefined();
      expect(META_UPGRADES[key].maxLevel).toBeGreaterThan(0);
      expect(META_UPGRADES[key].baseCost).toBeGreaterThan(0);
      expect(META_UPGRADES[key].statPerLevel).toBeDefined();
    }
  });

  it('initializes default save data with all 18 upgrades at 0', () => {
    const data = saveManager.getData();
    expect(Object.keys(data.upgrades).length).toBe(18);
    for (const v of Object.values(data.upgrades)) {
      expect(v).toBe(0);
    }
  });

  it('purchases upgrades and deducts scrap per exponential cost curve', () => {
    // Add scrap
    saveManager.addRunResults(0, 0, 2000, false);
    expect(saveManager.getData().alloyScrap).toBe(2000);

    const cost0 = saveManager.getUpgradeCost('crit_core');
    expect(cost0).toBe(META_UPGRADES.crit_core.baseCost); // 160

    expect(saveManager.purchaseUpgrade('crit_core')).toBe(true);
    expect(saveManager.getData().upgrades.crit_core).toBe(1);
    expect(saveManager.getData().alloyScrap).toBe(2000 - cost0);

    const cost1 = saveManager.getUpgradeCost('crit_core');
    expect(cost1).toBe(Math.round(160 * 1.6));
    expect(saveManager.purchaseUpgrade('crit_core')).toBe(true);
    expect(saveManager.getData().upgrades.crit_core).toBe(2);
    expect(saveManager.getData().alloyScrap).toBe(2000 - cost0 - cost1);
  });

  it('refunds all upgrades and returns the full scrap amount spent', () => {
    saveManager.addRunResults(0, 0, 5000, false);
    const startScrap = saveManager.getData().alloyScrap;

    // Buy 3 levels of armor_vest and 2 levels of reroll_protocol
    saveManager.purchaseUpgrade('armor_vest');
    saveManager.purchaseUpgrade('armor_vest');
    saveManager.purchaseUpgrade('armor_vest');
    saveManager.purchaseUpgrade('reroll_protocol');
    saveManager.purchaseUpgrade('reroll_protocol');

    const spent = startScrap - saveManager.getData().alloyScrap;
    expect(spent).toBeGreaterThan(0);

    const refunded = saveManager.refundAllUpgrades();
    expect(refunded).toBe(spent);
    expect(saveManager.getData().alloyScrap).toBe(startScrap);

    // Verify all upgrades are 0
    for (const v of Object.values(saveManager.getData().upgrades)) {
      expect(v).toBe(0);
    }

    // Calling refund again when 0 should return 0
    expect(saveManager.refundAllUpgrades()).toBe(0);
  });

  it('applies the new meta upgrade stats to RunState recalculateStats', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {
      crit_core: 2, // 2 * 0.03 = 0.06 critChance, 2 * 0.15 = 0.30 critMultiplier
      blast_dampeners: 3, // 3 * 1 = 3 armor, 3 * 10 = 30 maxHp
      reroll_protocol: 2 // 2 rerolls
    });

    // Base Reese 2029: maxHp 100, armor 0, critChance 0.05, critMultiplier 1.75
    expect(runState.computedStats.maxHp).toBe(130);
    expect(runState.computedStats.armor).toBe(3);
    expect(runState.computedStats.critChance).toBeCloseTo(0.11, 4);
    expect(runState.computedStats.critMultiplier).toBeCloseTo(2.05, 4);
    expect(runState.computedStats.rerolls).toBe(2);
  });
});
