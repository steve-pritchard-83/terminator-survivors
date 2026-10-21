import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import { MAX_THREAT, threatMultipliers } from '../../src/data/waves';

describe('threat levels', () => {
  beforeEach(() => localStorage.clear());

  it('unlock one at a time by winning at the highest level reached', () => {
    const sm = new SaveManager();
    expect(sm.getData().threatUnlocked).toBe(0);
    sm.recordThreatVictory(0);
    expect(sm.getData().threatUnlocked).toBe(1);
    // A win below the highest level opens nothing new
    sm.recordThreatVictory(0);
    expect(sm.getData().threatUnlocked).toBe(1);
    for (let t = 1; t < MAX_THREAT + 3; t++) sm.recordThreatVictory(t);
    expect(sm.getData().threatUnlocked).toBe(MAX_THREAT);
    sm.dispose();
  });

  it('only lets an unlocked level be chosen, and clamps corrupt saves', () => {
    const sm = new SaveManager();
    sm.recordThreatVictory(0);
    sm.selectThreat(4);
    expect(sm.getData().selectedThreat).toBe(1);
    const data = sm.sanitizeAndMigrate({ version: 4, threatUnlocked: 99, selectedThreat: -3 });
    expect(data.threatUnlocked).toBe(MAX_THREAT);
    expect(data.selectedThreat).toBe(0);
    sm.dispose();
  });

  it('makes machines tougher and pays more scrap at each step', () => {
    const t0 = threatMultipliers(0);
    const t3 = threatMultipliers(3);
    expect(t0).toEqual({ hp: 1, damage: 1, scrap: 1 });
    expect(t3.hp).toBeGreaterThan(t0.hp);
    expect(t3.damage).toBeGreaterThan(t0.damage);
    expect(t3.scrap).toBeGreaterThan(t0.scrap);
  });
});
