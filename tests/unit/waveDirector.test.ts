import { describe, it, expect } from 'vitest';
import { WAVE_TIMELINE } from '../../src/data/waves';

describe('Wave Timeline and Boss Director', () => {
  it('contains exactly 31 wave schedule entries (0 through 30 minutes)', () => {
    expect(WAVE_TIMELINE).toHaveLength(31);
    WAVE_TIMELINE.forEach((entry, idx) => {
      expect(entry.minute).toBe(idx);
      expect(entry.spawnInterval).toBeGreaterThan(0.05);
      expect(entry.minEnemies).toBeGreaterThan(0);
      expect(entry.pool.length).toBeGreaterThan(0);
    });
  });

  it('demonstrates monotonically increasing HP difficulty scaling', () => {
    for (let i = 1; i < WAVE_TIMELINE.length; i++) {
      expect(WAVE_TIMELINE[i].hpMultiplier).toBeGreaterThanOrEqual(WAVE_TIMELINE[i - 1].hpMultiplier);
      expect(WAVE_TIMELINE[i].damageMultiplier).toBeGreaterThanOrEqual(
        WAVE_TIMELINE[i - 1].damageMultiplier
      );
    }
  });

  it('triggers scripted bosses at expected future war milestones', () => {
    expect(WAVE_TIMELINE[5].boss).toBe('infiltrator_csm101');
    expect(WAVE_TIMELINE[10].boss).toBe('hk_tank_goliath');
    expect(WAVE_TIMELINE[15].boss).toBe('infiltrator_csm101');
    expect(WAVE_TIMELINE[20].boss).toBe('hk_aerial_squadron_leader');
    expect(WAVE_TIMELINE[25].boss).toBe('hk_tank_goliath');
    expect(WAVE_TIMELINE[28].boss).toBe('t1000_prototype');
    expect(WAVE_TIMELINE[30].boss).toBe('skynet_tde_core');
  });
});
