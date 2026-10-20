import type { StageId } from '../core/types';
import { buildWaveTimeline, type WaveMinuteEntry } from './waves';

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
    waveTimeline: buildWaveTimeline()
  }
};
