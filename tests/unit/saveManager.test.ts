import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';

describe('SaveManager and Bunker Persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads clean default data when storage is empty', () => {
    const sm = new SaveManager();
    const data = sm.getData();
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
});
