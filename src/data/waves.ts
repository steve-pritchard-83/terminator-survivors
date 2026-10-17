import type { EnemyArchetypeId } from '../core/types';

export interface WaveMinuteEntry {
  minute: number;
  spawnInterval: number;
  minEnemies: number;
  hpMultiplier: number;
  damageMultiplier: number;
  pool: Array<{ archetype: EnemyArchetypeId; weight: number }>;
  boss?: EnemyArchetypeId;
  alertBanner?: string;
}

export const WAVE_TIMELINE: WaveMinuteEntry[] = Array.from({ length: 31 }, (_, minute) => {
  const spawnInterval = Math.max(0.12, Number((1.15 * Math.pow(0.925, minute)).toFixed(3)));
  const minEnemies = Math.min(480, Math.floor(18 + minute * 14));
  const hpMultiplier = Number((1 + minute * 0.28 + Math.pow(minute, 1.45) * 0.06).toFixed(2));
  const damageMultiplier = Number((1 + minute * 0.12).toFixed(2));

  let pool: Array<{ archetype: EnemyArchetypeId; weight: number }> = [];
  let boss: EnemyArchetypeId | undefined;
  let alertBanner: string | undefined;

  if (minute < 3) {
    pool = [{ archetype: 'skynet_crab_drone', weight: 8 }, { archetype: 't600_rusted', weight: 2 }];
  } else if (minute < 6) {
    pool = [
      { archetype: 'skynet_crab_drone', weight: 5 },
      { archetype: 't600_rusted', weight: 4 },
      { archetype: 't700_scout', weight: 3 }
    ];
  } else if (minute < 11) {
    pool = [
      { archetype: 't600_rusted', weight: 3 },
      { archetype: 't700_scout', weight: 4 },
      { archetype: 't800_endoskeleton', weight: 4 },
      { archetype: 'hk_aerial_patrol', weight: 1 }
    ];
  } else if (minute < 20) {
    pool = [
      { archetype: 't700_scout', weight: 3 },
      { archetype: 't800_endoskeleton', weight: 6 },
      { archetype: 'hk_aerial_patrol', weight: 3 },
      { archetype: 'skynet_crab_drone', weight: 2 }
    ];
  } else {
    pool = [
      { archetype: 't800_endoskeleton', weight: 8 },
      { archetype: 'hk_aerial_patrol', weight: 4 },
      { archetype: 't700_scout', weight: 3 }
    ];
  }

  // Scripted Boss Spawns
  if (minute === 5) {
    boss = 'infiltrator_csm101';
    alertBanner = 'WARNING // INFILTRATOR UNIT CSM-101 DETECTED';
  } else if (minute === 10) {
    boss = 'hk_tank_goliath';
    alertBanner = 'CRITICAL ALERT // HUNTER-KILLER TANK GOLIATH APPROACHING';
  } else if (minute === 15) {
    boss = 'infiltrator_csm101';
    alertBanner = 'WARNING // TWIN CSM-101 INFILTRATOR AMBUSH';
  } else if (minute === 20) {
    boss = 'hk_aerial_squadron_leader';
    alertBanner = 'AIR DEFENSE ALERT // HK-AERIAL COMMAND SQUADRON INBOUND';
  } else if (minute === 25) {
    boss = 'hk_tank_goliath';
    alertBanner = 'RED ALERT // HEAVY ARMORED HK-TANK DIVISION';
  } else if (minute === 28) {
    boss = 't1000_prototype';
    alertBanner = 'TACTICAL ANOMALY // LIQUID METAL PROTOTYPE T-1000 RELEASED';
  } else if (minute === 30) {
    boss = 'skynet_tde_core';
    alertBanner = 'FINAL OBJECTIVE // SKYNET TIME DISPLACEMENT CORE BREACHED';
  }

  return {
    minute,
    spawnInterval,
    minEnemies,
    hpMultiplier,
    damageMultiplier,
    pool,
    boss,
    alertBanner
  };
});
