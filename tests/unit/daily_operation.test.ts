import { describe, it, expect, beforeEach } from 'vitest';
import { dailyKey, dailySeed } from '../../src/core/daily';
import { SaveManager } from '../../src/state/SaveManager';

describe('daily operation', () => {
  beforeEach(() => localStorage.clear());

  it('gives every player the same seed on a day and a new one the next day', () => {
    const key = dailyKey(new Date(2026, 9, 22, 8, 30));
    expect(key).toBe('2026-10-22');
    expect(dailySeed(key)).toBe(dailySeed(dailyKey(new Date(2026, 9, 22, 23, 59))));
    expect(dailySeed(key)).not.toBe(dailySeed(dailyKey(new Date(2026, 9, 23, 0, 1))));
    expect(Number.isInteger(dailySeed(key)) && dailySeed(key) >= 0).toBe(true);
  });

  it('keeps the best result for the day and starts afresh on a new day', () => {
    const sm = new SaveManager();
    sm.recordDaily('2026-10-22', 300, 900, false);
    sm.recordDaily('2026-10-22', 200, 1200, false);
    expect(sm.getData().daily).toEqual({ date: '2026-10-22', bestSeconds: 300, bestKills: 1200, won: false });
    sm.recordDaily('2026-10-22', 650, 3000, true);
    sm.recordDaily('2026-10-22', 100, 50, false);
    expect(sm.getData().daily?.won).toBe(true);
    sm.recordDaily('2026-10-23', 90, 40, false);
    expect(sm.getData().daily).toEqual({ date: '2026-10-23', bestSeconds: 90, bestKills: 40, won: false });
    sm.dispose();
  });

  it('drops a corrupt daily record when loading', () => {
    const sm = new SaveManager();
    expect(sm.sanitizeAndMigrate({ version: 4, daily: { date: 5 } }).daily).toBeUndefined();
    expect(sm.sanitizeAndMigrate({ version: 4, daily: { date: '2026-10-22', bestSeconds: -4, bestKills: 'x' } }).daily).toEqual({
      date: '2026-10-22',
      bestSeconds: 0,
      bestKills: 0,
      won: false
    });
    sm.dispose();
  });
});
