import type { StageId } from '../core/types';
import { buildWaveTimeline, type WaveMinuteEntry } from './waves';

export type StageUnlockCondition =
  | { type: 'none' }
  | { type: 'survive_time'; stageId: StageId; seconds: number; description: string }
  | { type: 'defeat_boss'; bossArchetype: string; description: string }
  | { type: 'reach_level'; level: number; description: string };

export interface StageDefinition {
  id: StageId;
  name: string;
  subtitle: string;
  description: string;
  fogColor: number;
  fogDensity: number;
  skyZenith: number;
  skyHorizon: number;
  ambientLightColor: number;
  directionalLightColor: number;
  waveTimeline: WaveMinuteEntry[];
  unlockCondition: StageUnlockCondition;
}

export const STAGES: Record<StageId, StageDefinition> = {
  la_2029_wasteland: {
    id: 'la_2029_wasteland',
    name: 'Los Angeles, 2029 AD',
    subtitle: 'THE RUINS OF JUDGMENT DAY',
    description:
      'Crushed skull carpets, shattered highway overpasses, and roaming Hunter-Killer patrols across the nuclear night.',
    fogColor: 0x081a33,
    fogDensity: 0.016,
    skyZenith: 0x040b18,
    skyHorizon: 0x0f294a,
    ambientLightColor: 0x162d4c,
    directionalLightColor: 0x4a88d9,
    waveTimeline: buildWaveTimeline(),
    unlockCondition: { type: 'none' }
  },
  cyberdyne_factory: {
    id: 'cyberdyne_factory',
    name: 'Cyberdyne Systems HQ (1995)',
    subtitle: 'AUTOMATED ASSEMBLY FACILITY',
    description:
      'Indoor factory grid with conveyor belts and industrial machinery. T-1000 infiltrates the facility early.',
    fogColor: 0x1a1208,
    fogDensity: 0.018,
    skyZenith: 0x120a04,
    skyHorizon: 0x2e1808,
    ambientLightColor: 0x3d2817,
    directionalLightColor: 0xffaa44,
    waveTimeline: buildWaveTimeline({
      bossOrder: {
        2: { boss: 't1000_prototype', alertBanner: 'TACTICAL ANOMALY // LIQUID METAL PROTOTYPE T-1000 INFILTRATION' },
        4: { boss: 'infiltrator_csm101', alertBanner: 'WARNING // INFILTRATOR UNIT CSM-101 DETECTED' },
        6: { boss: 't1_minigun_tracked', alertBanner: 'WARNING // CYBERDYNE SECURITY PROTOCOL ENGAGED' },
        8: { boss: 't1000_prototype', alertBanner: 'TACTICAL ANOMALY // T-1000 LIQUID SURGE PHASE' },
        10: { boss: 'hk_tank_goliath', alertBanner: 'HEAVY ARMORED BREACH // HK TANK GOLIATH' }
      },
      poolWeights: {
        t1_minigun_tracked: 6,
        plasma_turret: 5,
        t600_minigunner: 5
      }
    }),
    unlockCondition: {
      type: 'survive_time',
      stageId: 'la_2029_wasteland',
      seconds: 300,
      description: 'Survive 5 minutes in LA 2029 Wasteland'
    }
  },
  tech_noir_1984: {
    id: 'tech_noir_1984',
    name: 'Tech Noir, LA 1984',
    subtitle: 'PICO BOULEVARD RAIN-SLICKED NIGHT',
    description:
      'City streets glowing with neon signs and LAPD cruisers. Infiltrator CSM-101 stalks Reese relentlessly.',
    fogColor: 0x100820,
    fogDensity: 0.015,
    skyZenith: 0x0a0418,
    skyHorizon: 0x280e40,
    ambientLightColor: 0x2d174d,
    directionalLightColor: 0xff0088,
    waveTimeline: buildWaveTimeline({
      bossOrder: {
        3: { boss: 't600_rusted', alertBanner: 'SECURITY ALERT // EARLY T-600 INFILTRATOR IN ALLEYWAY' },
        5: { boss: 'infiltrator_csm101', alertBanner: 'STALKER DETECTED // CSM-101 GAINING GROUND' },
        8: { boss: 'infiltrator_csm101', alertBanner: 'SHOWDOWN // CSM-101 VULNERABLE // DESTROY THE INFILTRATOR' },
        10: { boss: 'infiltrator_csm101', alertBanner: 'FINAL PROTOCOL // CSM-101 ENDOSKELETON STAND' }
      },
      poolWeights: {
        skynet_crab_drone: 8,
        t600_rusted: 6
      }
    }),
    unlockCondition: {
      type: 'survive_time',
      stageId: 'cyberdyne_factory',
      seconds: 420,
      description: 'Survive 7 minutes in Cyberdyne Factory'
    }
  },
  skynet_central_tde: {
    id: 'skynet_central_tde',
    name: 'Skynet Central TDE',
    subtitle: 'TIME DISPLACEMENT FACILITY',
    description:
      'The quantum heart of Skynet. Armored pylons, temporal nova emitters, and concentrated machine shock troops.',
    fogColor: 0x021820,
    fogDensity: 0.02,
    skyZenith: 0x010d14,
    skyHorizon: 0x063344,
    ambientLightColor: 0x083c50,
    directionalLightColor: 0x00f0ff,
    waveTimeline: buildWaveTimeline({
      bossOrder: {
        2: { boss: 'hk_aerial_squadron_leader', alertBanner: 'PERIMETER AIRSPACE BREACHED // HK-AERIAL COMMAND' },
        4: { boss: 'hk_tank_goliath', alertBanner: 'HEAVY GOLIATH ARMOR ENROUTE' },
        6: { boss: 't1000_prototype', alertBanner: 'T-1000 DEFENSE PROTOCOL ACTIVE' },
        8: { boss: 'hk_tank_goliath', alertBanner: 'TDE PERIMETER DIVISION' },
        10: { boss: 'skynet_tde_core', alertBanner: 'FINAL OBJECTIVE // SKYNET TIME DISPLACEMENT CORE BREACHED' }
      },
      poolWeights: {
        t800_endoskeleton: 8,
        moto_terminator: 6,
        hk_aerial_patrol: 6
      }
    }),
    unlockCondition: {
      type: 'defeat_boss',
      bossArchetype: 'skynet_tde_core',
      description: 'Defeat Skynet TDE Core once'
    }
  },
  century_city_bunker: {
    id: 'century_city_bunker',
    name: 'Century City Bunker',
    subtitle: 'LAST RESISTANCE REDOUBT',
    description:
      'Stand your ground and protect the bunker entrance against continuous Hunter-Killer siege waves.',
    fogColor: 0x141818,
    fogDensity: 0.017,
    skyZenith: 0x0a0e10,
    skyHorizon: 0x18262a,
    ambientLightColor: 0x22363a,
    directionalLightColor: 0x88ccdd,
    waveTimeline: buildWaveTimeline({
      bossOrder: {
        2: { boss: 'hk_tank_goliath', alertBanner: 'BUNKER SIEGE // HK TANK ADVANCING ON ENTRANCE' },
        5: { boss: 'hk_aerial_squadron_leader', alertBanner: 'AIR STRIKE INCOMING ON BUNKER PERIMETER' },
        7: { boss: 'hk_tank_goliath', alertBanner: 'HEAVY SIEGE BARRAGE ON BUNKER ENTRANCE' },
        10: { boss: 'hk_tank_goliath', alertBanner: 'FINAL SIEGE DIVISION ASSAULT' }
      },
      poolWeights: {
        hydrobot_swarm: 6,
        t600_minigunner: 5,
        t1_minigun_tracked: 5
      }
    }),
    unlockCondition: {
      type: 'reach_level',
      level: 20,
      description: 'Reach Level 20 in any stage'
    }
  }
};

export function isStageUnlocked(stageId: StageId, save: {
  bestTimeSeconds?: number;
  stageBestTimes?: Partial<Record<StageId, number>>;
  bestiaryKills?: Record<string, number>;
  runHistory?: Array<{ levelReached?: number }>;
}): boolean {
  const stage = STAGES[stageId];
  if (!stage) return false;
  const cond = stage.unlockCondition;
  if (!cond || cond.type === 'none') return true;

  if (cond.type === 'survive_time') {
    const stageTime = save.stageBestTimes?.[cond.stageId] ?? (cond.stageId === 'la_2029_wasteland' ? (save.bestTimeSeconds ?? 0) : 0);
    return stageTime >= cond.seconds;
  }

  if (cond.type === 'defeat_boss') {
    return (save.bestiaryKills?.[cond.bossArchetype] ?? 0) > 0;
  }

  if (cond.type === 'reach_level') {
    const maxLevel = save.runHistory?.reduce((max, r) => Math.max(max, r.levelReached ?? 0), 0) ?? 0;
    return maxLevel >= cond.level;
  }

  return true;
}
