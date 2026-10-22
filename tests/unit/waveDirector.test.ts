import { describe, it, expect } from 'vitest';
import { WAVE_TIMELINE } from '../../src/data/waves';

describe('Wave Timeline and Boss Director', () => {
  it('contains exactly 11 wave schedule entries (0 through 10 minutes)', () => {
    expect(WAVE_TIMELINE).toHaveLength(11);
    WAVE_TIMELINE.forEach((entry, idx) => {
      expect(entry.minute).toBe(idx);
      expect(entry.spawnInterval).toBeGreaterThan(0.05);
      expect(entry.minEnemies).toBeGreaterThan(0);
      expect(entry.pool.length).toBeGreaterThan(0);
    });
  });

  it('demonstrates monotonically increasing HP difficulty scaling', () => {
    for (let i = 1; i < WAVE_TIMELINE.length; i++) {
      expect(WAVE_TIMELINE[i].hpMultiplier).toBeGreaterThanOrEqual(
        WAVE_TIMELINE[i - 1].hpMultiplier
      );
      expect(WAVE_TIMELINE[i].damageMultiplier).toBeGreaterThanOrEqual(
        WAVE_TIMELINE[i - 1].damageMultiplier
      );
    }
  });

  it('triggers scripted bosses at expected 10-minute future war milestones', () => {
    expect(WAVE_TIMELINE[2].boss).toBe('infiltrator_csm101');
    expect(WAVE_TIMELINE[4].boss).toBe('hk_tank_goliath');
    expect(WAVE_TIMELINE[6].boss).toBe('hk_aerial_squadron_leader');
    expect(WAVE_TIMELINE[8].boss).toBe('t1000_prototype');
    expect(WAVE_TIMELINE[10].boss).toBe('skynet_tde_core');
  });

  // Imports the renderer and model loader on first use, which is slow while the whole suite runs in parallel
  it('batches both t600_rusted and t800_endoskeleton into InstancedMeshes facing the player', { timeout: 20000 }, async () => {
    const { EndoskeletonBatch } = await import('../../src/graphics/meshes/EndoskeletonBatch');
    const batch = new EndoskeletonBatch(32);
    batch.updateBatch(
      [
        {
          id: 1,
          type: 'enemy',
          archetype: 't600_rusted',
          x: -5,
          z: -5,
          radius: 0.8,
          hp: 44,
          maxHp: 44,
          speed: 2.7,
          damage: 14,
          isBoss: false,
          isFlying: false,
          xpValue: 1,
          hitFlashTimer: 0,
          slowTimer: 0,
          armorStripMultiplier: 1,
          attackCooldown: 0,
          searchlightAngle: 0,
          searchlightAlertTimer: 0,
          phaseState: 0
        },
        {
          id: 2,
          type: 'enemy',
          archetype: 't800_endoskeleton',
          x: 10,
          z: 0,
          radius: 0.75,
          hp: 95,
          maxHp: 95,
          speed: 2.9,
          damage: 22,
          isBoss: false,
          isFlying: false,
          xpValue: 5,
          hitFlashTimer: 0,
          slowTimer: 0,
          armorStripMultiplier: 1,
          attackCooldown: 0,
          searchlightAngle: 0,
          searchlightAlertTimer: 0,
          phaseState: 0
        }
      ],
      1.0,
      20,
      20
    );
    // The T-800 draws in the main set; the T-600 draws in the main set too until its own body has loaded
    expect(batch.chassisInstancedMesh.count).toBe(2);
    expect(batch.opticsInstancedMesh.count).toBe(2);
  });
});
