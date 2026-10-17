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

export const RUN_DURATION_MINUTES = 10;

export const WAVE_TIMELINE: WaveMinuteEntry[] = Array.from({ length: RUN_DURATION_MINUTES + 1 }, (_, minute) => {
  // Fast, high-intensity 10-minute escalation curve
  const spawnInterval = Math.max(0.14, Number((0.88 * Math.pow(0.84, minute)).toFixed(3)));
  const minEnemies = Math.min(320, Math.floor(24 + minute * 28));
  const hpMultiplier = Number((1 + minute * 0.32 + Math.pow(minute, 1.35) * 0.08).toFixed(2));
  const damageMultiplier = Number((1 + minute * 0.14).toFixed(2));

  let pool: Array<{ archetype: EnemyArchetypeId; weight: number }> = [];
  let boss: EnemyArchetypeId | undefined;
  let alertBanner: string | undefined;

  if (minute < 2) {
    pool = [
      { archetype: 'skynet_crab_drone', weight: 7 },
      { archetype: 't600_rusted', weight: 3 }
    ];
  } else if (minute < 4) {
    pool = [
      { archetype: 'skynet_crab_drone', weight: 4 },
      { archetype: 't600_rusted', weight: 4 },
      { archetype: 't700_scout', weight: 4 }
    ];
  } else if (minute < 6) {
    pool = [
      { archetype: 't600_rusted', weight: 3 },
      { archetype: 't700_scout', weight: 4 },
      { archetype: 't800_endoskeleton', weight: 5 },
      { archetype: 'hk_aerial_patrol', weight: 2 }
    ];
  } else if (minute < 8) {
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

  // Condensed 10-Minute Scripted Boss Milestones (Boss every 2 minutes + Final Siege)
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
