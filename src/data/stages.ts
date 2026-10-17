import type { StageId } from '../core/types';
import { WAVE_TIMELINE, type WaveMinuteEntry } from './waves';

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
  unlockCondition?: string;
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
    waveTimeline: WAVE_TIMELINE
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
    waveTimeline: WAVE_TIMELINE,
    unlockCondition: 'Survive 5 minutes in LA 2029 Wasteland'
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
    waveTimeline: WAVE_TIMELINE,
    unlockCondition: 'Survive 7 minutes in Cyberdyne Factory'
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
    waveTimeline: WAVE_TIMELINE,
    unlockCondition: 'Defeat Skynet TDE Core once'
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
    waveTimeline: WAVE_TIMELINE,
    unlockCondition: 'Reach Level 20 in any stage'
  }
};
