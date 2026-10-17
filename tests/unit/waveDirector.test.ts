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

  it('batches both skynet_crab_drone and t800_endoskeleton into InstancedMeshes facing the player', async () => {
    const { EndoskeletonBatch } = await import('../../src/graphics/meshes/EndoskeletonBatch');
    const batch = new EndoskeletonBatch(32);
    batch.updateBatch(
      [
        {
          id: 1,
          type: 'enemy',
          archetype: 'skynet_crab_drone',
          x: -5,
          z: -5,
          radius: 0.5,
          hp: 18,
          maxHp: 18,
          speed: 4.8,
          damage: 8,
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
    expect(batch.crabChassisInstancedMesh.count).toBe(1);
    expect(batch.crabOpticsInstancedMesh.count).toBe(1);
    expect(batch.chassisInstancedMesh.count).toBe(1);
    expect(batch.opticsInstancedMesh.count).toBe(1);
  });
});
