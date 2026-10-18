import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import { META_UPGRADES } from '../../src/data/upgrades';

describe('SaveManager and Bunker Persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads clean default data when storage is empty', () => {
    const sm = new SaveManager();
    const data = sm.getData();
    expect(data.version).toBe(SaveManager.CURRENT_VERSION);
    expect(data.alloyScrap).toBe(0);
    expect(data.selectedLoadout).toBe('reese_2029');
    expect(data.unlockedLoadouts).toContain('reese_2029');
    expect(data.upgrades.armor_vest).toBe(0);
  });

  it('handles upgrade purchase transactions and scrap deductions', () => {
    const sm = new SaveManager();
    sm.addRunResults(10, 60, 500, false);
    expect(sm.getData().alloyScrap).toBe(500);

    const cost = sm.getUpgradeCost('armor_vest');
    expect(cost).toBe(100);

    const success = sm.purchaseUpgrade('armor_vest');
    expect(success).toBe(true);
    expect(sm.getData().alloyScrap).toBe(400);
    expect(sm.getData().upgrades.armor_vest).toBe(1);

    // Save and reload verification
    const sm2 = new SaveManager();
    expect(sm2.getData().upgrades.armor_vest).toBe(1);
    expect(sm2.getData().alloyScrap).toBe(400);
  });

  it('rejects purchase if scrap is insufficient', () => {
    const sm = new SaveManager();
    const success = sm.purchaseUpgrade('defibrillator'); // Cost 1000
    expect(success).toBe(false);
    expect(sm.getData().upgrades.defibrillator).toBe(0);
  });

  it('recovers safely from malformed JSON in localStorage', () => {
    window.localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', '{ INVALID_CORRUPT_JSON... ');
    const sm = new SaveManager();
    expect(sm.getData().alloyScrap).toBe(0);
    expect(sm.getData().selectedLoadout).toBe('reese_2029');
  });

  it('auto-unlocks loadouts upon reaching milestones in addRunResults', () => {
    const sm = new SaveManager();
    expect(sm.getData().unlockedLoadouts).toEqual(['reese_2029']);

    // Run 1: survived 250s (> 4 minutes) -> unlocks reese_1984
    sm.addRunResults(50, 250, 100, false, 0);
    expect(sm.getData().unlockedLoadouts).toContain('reese_1984');
    expect(sm.getData().unlockedLoadouts).not.toContain('techcom_sapper');
    expect(sm.getData().unlockedLoadouts).not.toContain('john_connor');

    // Run 2: destroyed 1 boss -> unlocks techcom_sapper
    sm.addRunResults(100, 150, 200, false, 1);
    expect(sm.getData().unlockedLoadouts).toContain('techcom_sapper');

    // Run 3: victory -> unlocks john_connor
    sm.addRunResults(300, 600, 500, true, 2);
    expect(sm.getData().unlockedLoadouts).toContain('john_connor');
  });

  describe('P3-07 Schema versioning, migrations and import/export', () => {
    it('migrates a v1 save to v2 and preserves progress', () => {
      const v1Save = {
        version: 1,
        alloyScrap: 350,
        totalKills: 120,
        bestTimeSeconds: 420,
        victories: 1,
        unlockedLoadouts: ['reese_2029', 'reese_1984'],
        selectedLoadout: 'reese_1984',
        upgrades: {
          armor_vest: 2,
          combat_stims: 1
        }
      };
      window.localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', JSON.stringify(v1Save));

      const sm = new SaveManager();
      const data = sm.getData();
      expect(data.version).toBe(3);
      expect(data.alloyScrap).toBe(350);
      expect(data.totalKills).toBe(120);
      expect(data.bestTimeSeconds).toBe(420);
      expect(data.selectedLoadout).toBe('reese_1984');
      expect(data.upgrades.armor_vest).toBe(2);
      expect(data.upgrades.combat_stims).toBe(1);
    });

    it('clamps corrupted upgrade values to [0, maxLevel] and restores locked selectedLoadout', () => {
      const corruptedSave = {
        version: 2,
        alloyScrap: -500,
        unlockedLoadouts: ['reese_2029'],
        selectedLoadout: 'locked_or_nonexistent_loadout',
        upgrades: {
          armor_vest: 999999, // Exceeds maxLevel (5)
          combat_stims: -10, // Below 0
          plasma_overclock: NaN
        }
      };
      window.localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', JSON.stringify(corruptedSave));

      const sm = new SaveManager();
      const data = sm.getData();

      // Scrap cannot be negative
      expect(data.alloyScrap).toBe(0);

      // Selected loadout must be among unlocked loadouts
      expect(data.selectedLoadout).toBe('reese_2029');

      // Upgrades clamped to maxLevel and 0
      expect(data.upgrades.armor_vest).toBe(META_UPGRADES.armor_vest.maxLevel);
      expect(data.upgrades.combat_stims).toBe(0);
      expect(data.upgrades.plasma_overclock).toBe(0);
    });

    it('round-trips exportSave and importSave via base64 encoded JSON', () => {
      const sm1 = new SaveManager();
      sm1.addRunResults(75, 300, 850, true, 1);
      sm1.purchaseUpgrade('armor_vest');
      sm1.selectLoadout('reese_1984');

      const exportedString = sm1.exportSave();
      expect(typeof exportedString).toBe('string');
      expect(exportedString.length).toBeGreaterThan(20);

      // New SaveManager on a different instance / storage
      window.localStorage.clear();
      const sm2 = new SaveManager();
      expect(sm2.getData().alloyScrap).toBe(0);

      const success = sm2.importSave(exportedString);
      expect(success).toBe(true);

      const data1 = sm1.getData();
      const data2 = sm2.getData();
      expect(data2).toEqual(data1);
      expect(data2.alloyScrap).toBe(data1.alloyScrap);
      expect(data2.selectedLoadout).toBe('reese_1984');
    });

    it('rejects malformed or invalid strings during importSave', () => {
      const sm = new SaveManager();
      expect(sm.importSave('')).toBe(false);
      expect(sm.importSave('!!!not_base_64!!!')).toBe(false);
      expect(sm.importSave(Buffer.from('not json at all').toString('base64'))).toBe(false);
    });
  });
});
