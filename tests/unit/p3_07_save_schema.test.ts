import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import { META_UPGRADES } from '../../src/data/upgrades';

describe('P3-07 Save schema versioning and migrations', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('migrates legacy v1 save to v2 maintaining player statistics', () => {
    const v1Save = {
      version: 1,
      alloyScrap: 1250,
      totalKills: 450,
      bestTimeSeconds: 580,
      victories: 2,
      unlockedLoadouts: ['reese_2029', 'techcom_sapper'],
      selectedLoadout: 'techcom_sapper',
      upgrades: {
        armor_vest: 3,
        plasma_overclock: 2
      }
    };
    window.localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', JSON.stringify(v1Save));

    const sm = new SaveManager();
    const data = sm.getData();
    expect(data.version).toBe(3);
    expect(data.alloyScrap).toBe(1250);
    expect(data.totalKills).toBe(450);
    expect(data.bestTimeSeconds).toBe(580);
    expect(data.victories).toBe(2);
    expect(data.unlockedLoadouts).toContain('techcom_sapper');
    expect(data.selectedLoadout).toBe('techcom_sapper');
    expect(data.upgrades.armor_vest).toBe(3);
    expect(data.upgrades.plasma_overclock).toBe(2);
  });

  it('clamps corrupted upgrade values and invalid selectedLoadout', () => {
    const invalidSave = {
      version: 2,
      alloyScrap: -100,
      unlockedLoadouts: ['reese_2029'],
      selectedLoadout: 'unknown_loadout_id',
      upgrades: {
        armor_vest: 9999,
        defibrillator: -5
      }
    };
    window.localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', JSON.stringify(invalidSave));

    const sm = new SaveManager();
    const data = sm.getData();

    expect(data.alloyScrap).toBe(0);
    expect(data.selectedLoadout).toBe('reese_2029');
    expect(data.upgrades.armor_vest).toBe(META_UPGRADES.armor_vest.maxLevel);
    expect(data.upgrades.defibrillator).toBe(0);
  });

  it('exports to base64 JSON string and imports cleanly into a fresh instance', () => {
    const source = new SaveManager();
    source.addRunResults(150, 480, 2000, true, 2);
    source.purchaseUpgrade('armor_vest');
    source.selectLoadout('techcom_sapper');

    const serialized = source.exportSave();
    expect(typeof serialized).toBe('string');
    expect(serialized).not.toContain('{');

    window.localStorage.clear();
    const target = new SaveManager();
    const success = target.importSave(serialized);

    expect(success).toBe(true);
    expect(target.getData()).toEqual(source.getData());
  });

  it('gracefully handles corrupt or non-base64 strings on import', () => {
    const sm = new SaveManager();
    expect(sm.importSave('')).toBe(false);
    expect(sm.importSave('not-a-valid-base64-string!')).toBe(false);
    expect(sm.importSave(Buffer.from('{ broken json').toString('base64'))).toBe(false);
  });
});
