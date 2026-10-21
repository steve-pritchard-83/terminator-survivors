import type { EnemyArchetypeId } from '../core/types';

export interface WaveMinuteEntry {
  minute: number;
  spawnInterval: number;
  minEnemies: number;
  hpMultiplier: number;
  damageMultiplier: number;
  eliteChance: number;
  pool: Array<{ archetype: EnemyArchetypeId; weight: number }>;
  boss?: EnemyArchetypeId;
  alertBanner?: string;
}

export const RUN_DURATION_MINUTES = 10;
export const ENEMY_LEASH_DISTANCE = 40;

// While a boss is alive, regular waves are thinned so telegraphs and the player stay readable.
export const BOSS_FIGHT_SPAWN = { enemyCapMultiplier: 0.4, intervalMultiplier: 1.8 };

// Stationary emplacements are never relocated by the leash; they despawn silently once left far behind.
export const LEASH_EXEMPT_ARCHETYPES: ReadonlySet<string> = new Set(['plasma_turret']);
export const EMPLACEMENT_DESPAWN_DISTANCE = 60;
export const EMPLACEMENT_SPAWN_MIN_DIST = 15;
export const EMPLACEMENT_SPAWN_MAX_DIST = 25;

// Hydrobots arrive as a tight formation instead of one at a time.
export const HYDROBOT_FORMATION = { count: 6, spread: 2.5 };

// Aerostat mark: enemies near a marked player move faster for a short time.
export const AEROSTAT_MARK = { radius: 8, speedMultiplier: 1.2, durationSeconds: 4 };
export const ENEMY_RELOCATE_MIN_DIST = 22;
export const ENEMY_RELOCATE_MAX_DIST = 28;

const HYDROBOT_FIRST_MINUTE = 1;
const HEAVY_INFANTRY_FIRST_MINUTE = 3;

export interface BuildWaveTimelineParams {
  bossOrder?: Record<number, { boss: EnemyArchetypeId; alertBanner: string }>;
  poolWeights?: Partial<Record<EnemyArchetypeId, number>>;
}

export function buildWaveTimeline(params: BuildWaveTimelineParams = {}): WaveMinuteEntry[] {
  return Array.from({ length: RUN_DURATION_MINUTES + 1 }, (_, minute) => {
    const spawnInterval = Math.max(0.14, Number((0.88 * Math.pow(0.84, minute)).toFixed(3)));
    const minEnemies = Math.min(320, Math.floor(24 + minute * 28));
    const hpMultiplier = Number((1 + minute * 0.32 + Math.pow(minute, 1.35) * 0.08).toFixed(2));
    const damageMultiplier = Number((1 + minute * 0.14).toFixed(2));
    const eliteChance = Math.min(0.35, Number((0.02 + minute * 0.03).toFixed(3)));

    let pool: Array<{ archetype: EnemyArchetypeId; weight: number }> = [];

    if (minute < 2) {
      pool = [
        { archetype: 'skynet_crab_drone', weight: 6 },
        { archetype: 't600_rusted', weight: 3 },
        { archetype: 'hydrobot_swarm', weight: 2 }
      ];
    } else if (minute < 4) {
      pool = [
        { archetype: 'skynet_crab_drone', weight: 3 },
        { archetype: 't600_rusted', weight: 3 },
        { archetype: 't700_scout', weight: 3 },
        { archetype: 'hydrobot_swarm', weight: 3 },
        { archetype: 'plasma_turret', weight: 2 },
        { archetype: 't1_minigun_tracked', weight: 2 },
        { archetype: 'aerostat_scout', weight: 2 },
        { archetype: 't600_minigunner', weight: 2 }
      ];
    } else if (minute < 6) {
      pool = [
        { archetype: 't700_scout', weight: 3 },
        { archetype: 't800_endoskeleton', weight: 4 },
        { archetype: 't1_minigun_tracked', weight: 3 },
        { archetype: 'moto_terminator', weight: 3 },
        { archetype: 't600_minigunner', weight: 2 },
        { archetype: 'hk_aerial_patrol', weight: 2 },
        { archetype: 'plasma_turret', weight: 2 },
        { archetype: 'aerostat_scout', weight: 2 }
      ];
    } else if (minute < 8) {
      pool = [
        { archetype: 't800_endoskeleton', weight: 5 },
        { archetype: 'moto_terminator', weight: 4 },
        { archetype: 't1_minigun_tracked', weight: 3 },
        { archetype: 't600_minigunner', weight: 3 },
        { archetype: 'hk_aerial_patrol', weight: 3 },
        { archetype: 'plasma_turret', weight: 2 },
        { archetype: 'hydrobot_swarm', weight: 2 }
      ];
    } else {
      pool = [
        { archetype: 't800_endoskeleton', weight: 6 },
        { archetype: 'moto_terminator', weight: 4 },
        { archetype: 't1_minigun_tracked', weight: 4 },
        { archetype: 't600_minigunner', weight: 3 },
        { archetype: 'hk_aerial_patrol', weight: 4 },
        { archetype: 'plasma_turret', weight: 2 },
        { archetype: 'aerostat_scout', weight: 2 }
      ];
    }

    // Hydrobot swarms start at minute 1; T-1 and T-600 Minigunner start at minute 3.
    pool = pool.filter((p) => {
      if (p.archetype === 'hydrobot_swarm') return minute >= HYDROBOT_FIRST_MINUTE;
      if (p.archetype === 't1_minigun_tracked' || p.archetype === 't600_minigunner') {
        return minute >= HEAVY_INFANTRY_FIRST_MINUTE;
      }
      return true;
    });

    if (params.poolWeights) {
      pool = pool.map((p) => ({
        archetype: p.archetype,
        weight: params.poolWeights![p.archetype] !== undefined ? params.poolWeights![p.archetype]! : p.weight
      }));
    }

    let boss: EnemyArchetypeId | undefined;
    let alertBanner: string | undefined;

    if (params.bossOrder && params.bossOrder[minute]) {
      boss = params.bossOrder[minute].boss;
      alertBanner = params.bossOrder[minute].alertBanner;
    } else if (!params.bossOrder) {
      if (minute === 2) {
        boss = 'infiltrator_csm101';
        alertBanner = 'WARNING // INFILTRATOR UNIT CSM-101 DETECTED';
      } else if (minute === 4) {
        boss = 'hk_tank_goliath';
        alertBanner = 'CRITICAL ALERT // HUNTER-KILLER TANK GOLIATH APPROACHING';
      } else if (minute === 6) {
        boss = 'hk_aerial_squadron_leader';
        alertBanner = 'AIR DEFENSE ALERT // HK-AERIAL COMMAND SQUADRON INBOUND';
      } else if (minute === 8) {
        boss = 't1000_prototype';
        alertBanner = 'TACTICAL ANOMALY // LIQUID METAL PROTOTYPE T-1000 RELEASED';
      } else if (minute === 9) {
        boss = 'hk_tank_goliath';
        alertBanner = 'RED ALERT // TDE PERIMETER ARMORED DIVISION';
      } else if (minute === 10) {
        boss = 'skynet_tde_core';
        alertBanner = 'FINAL OBJECTIVE // SKYNET TIME DISPLACEMENT CORE BREACHED';
      }
    }

    return {
      minute,
      spawnInterval,
      minEnemies,
      hpMultiplier,
      damageMultiplier,
      eliteChance,
      pool,
      boss,
      alertBanner
    };
  });
}

export const WAVE_TIMELINE: WaveMinuteEntry[] = buildWaveTimeline();
