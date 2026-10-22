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
export const BOSS_FIGHT_SPAWN = { enemyCapMultiplier: 0.75, intervalMultiplier: 1.25 };

// Stationary emplacements are never relocated by the leash; they despawn silently once left far behind.
export const LEASH_EXEMPT_ARCHETYPES: ReadonlySet<string> = new Set(['plasma_turret']);
export const EMPLACEMENT_DESPAWN_DISTANCE = 60;
export const EMPLACEMENT_SPAWN_MIN_DIST = 15;
export const EMPLACEMENT_SPAWN_MAX_DIST = 25;

// Minute 9 has no boss: a surge of elites before the final objective instead.
export const FINAL_SURGE = { minute: 9, eliteChance: 0.5 };
export const ENEMY_RELOCATE_MIN_DIST = 22;
export const ENEMY_RELOCATE_MAX_DIST = 28;

const HEAVY_INFANTRY_FIRST_MINUTE = 3;

// The first minutes spawn more slowly, so the lone starting rifle kills faster than machines arrive
export const EARLY_SPAWN_EASE = { untilMinute: 2, intervalScale: 1.3 };

// Bosses arrive this far from the player, tougher than the wave's own scaling
export const BOSS_SPAWN = { distance: 24, hpMultiplier: 1.25, damageMultiplier: 1.2 };

export interface BuildWaveTimelineParams {
  bossOrder?: Record<number, { boss: EnemyArchetypeId; alertBanner: string }>;
  poolWeights?: Partial<Record<EnemyArchetypeId, number>>;
}

export function buildWaveTimeline(params: BuildWaveTimelineParams = {}): WaveMinuteEntry[] {
  return Array.from({ length: RUN_DURATION_MINUTES + 1 }, (_, minute) => {
    // Gentle at the start: the T-600 that fills the early waves is slow and tough, so it needs room to be killed
    const ease = minute < EARLY_SPAWN_EASE.untilMinute ? EARLY_SPAWN_EASE.intervalScale : 1;
    const spawnInterval = Math.max(0.14, Number((1.05 * ease * Math.pow(0.82, minute)).toFixed(3)));
    const minEnemies = Math.min(320, Math.floor(24 + minute * 28));
    const hpMultiplier = Number((1 + minute * 0.32 + Math.pow(minute, 1.35) * 0.08).toFixed(2));
    const damageMultiplier = Number((1 + minute * 0.14).toFixed(2));
    const eliteChance =
      minute === FINAL_SURGE.minute ? FINAL_SURGE.eliteChance : Math.min(0.35, Number((0.02 + minute * 0.03).toFixed(3)));

    let pool: Array<{ archetype: EnemyArchetypeId; weight: number }> = [];

    if (minute < 2) {
      pool = [
        { archetype: 't600_rusted', weight: 6 },
        { archetype: 't800_endoskeleton', weight: 2 }
      ];
    } else if (minute < 4) {
      pool = [
        { archetype: 't600_rusted', weight: 5 },
        { archetype: 't800_endoskeleton', weight: 3 },
        { archetype: 'plasma_turret', weight: 2 },
        { archetype: 't1_minigun_tracked', weight: 2 },
        { archetype: 'moto_terminator', weight: 2 }
      ];
    } else if (minute < 6) {
      pool = [
        { archetype: 't800_endoskeleton', weight: 4 },
        { archetype: 't1_minigun_tracked', weight: 3 },
        { archetype: 'moto_terminator', weight: 3 },
        { archetype: 't600_rusted', weight: 3 },
        { archetype: 'hk_aerial_patrol', weight: 2 },
        { archetype: 'plasma_turret', weight: 2 }
      ];
    } else if (minute < 8) {
      pool = [
        { archetype: 't800_endoskeleton', weight: 5 },
        { archetype: 'moto_terminator', weight: 4 },
        { archetype: 't1_minigun_tracked', weight: 3 },
        { archetype: 't600_rusted', weight: 4 },
        { archetype: 'hk_aerial_patrol', weight: 3 },
        { archetype: 'plasma_turret', weight: 2 }
      ];
    } else {
      pool = [
        { archetype: 't800_endoskeleton', weight: 6 },
        { archetype: 'moto_terminator', weight: 4 },
        { archetype: 't1_minigun_tracked', weight: 4 },
        { archetype: 't600_rusted', weight: 4 },
        { archetype: 'hk_aerial_patrol', weight: 4 },
        { archetype: 'plasma_turret', weight: 2 }
      ];
    }

    // The T-800 joins at minute 1; the T-1 and the Moto-Terminator at minute 3.
    pool = pool.filter((p) => {
      if (p.archetype === 't800_endoskeleton') return minute >= 1;
      if (p.archetype === 't1_minigun_tracked' || p.archetype === 'moto_terminator') return minute >= HEAVY_INFANTRY_FIRST_MINUTE;
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
        alertBanner = 'INFILTRATOR CSM-101';
      } else if (minute === 4) {
        boss = 'hk_tank_goliath';
        alertBanner = 'HK TANK GOLIATH';
      } else if (minute === 6) {
        boss = 'hk_aerial_squadron_leader';
        alertBanner = 'HK AERIAL COMMAND';
      } else if (minute === 8) {
        boss = 't1000_prototype';
        alertBanner = 'T-1000';
      } else if (minute === 10) {
        boss = 'skynet_tde_core';
        alertBanner = 'SKYNET CORE';
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

// Fodder arrives in packs that grow through the run, so the horde actually fills the screen. Packs start
// after the opening, so the lone starting rifle can build early levels first.
export const PACK_SPAWN = {
  startSeconds: 90,
  /** Largest pack per archetype; anything not listed spawns alone */
  max: { t600_rusted: 7, t800_endoskeleton: 4 } as Partial<Record<EnemyArchetypeId, number>>,
  perMinute: 0.9,
  spread: 2.2
};

// Between bosses a data vault is dropped some way off, guarded by elites: a detour that pays an
// evolution (or three upgrades). An arrow at the screen edge points to it.
export const SUPPLY_DROP = {
  atSeconds: [200, 320, 440],
  distance: 18,
  guards: 4,
  guardArchetype: 't800_endoskeleton' as EnemyArchetypeId,
  guardSpread: 3.5
};

// Threat levels: unlocked one at a time by winning at the highest one reached. Each step makes the
// machines tougher and pays more scrap.
export const MAX_THREAT = 5;
export const THREAT_STEP = { hp: 0.3, damage: 0.15, scrap: 0.25 };
export const threatMultipliers = (threat: number) => ({
  hp: 1 + threat * THREAT_STEP.hp,
  damage: 1 + threat * THREAT_STEP.damage,
  scrap: 1 + threat * THREAT_STEP.scrap
});
