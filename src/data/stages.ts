import { RUN_DURATION_MINUTES } from './waves';
import { LIGHTING, PALETTE } from './artDirection';

export interface StageDefinition {
  name: string;
  subtitle: string;
  description: string;
  fogColor: number;
  fogDensity: number;
  skyZenith: number;
  skyHorizon: number;
  ambientLightColor: number;
  directionalLightColor: number;
  durationMinutes: number;
}

/** The only stage: Los Angeles, 2029 AD. */
export const WASTELAND_STAGE: StageDefinition = {
  name: 'Los Angeles, 2029 AD',
  subtitle: 'THE RUINS OF JUDGMENT DAY',
  description:
    'Crushed skull carpets, shattered highway overpasses, and roaming Hunter-Killer patrols across the nuclear night.',
  fogColor: PALETTE.fog,
  fogDensity: 1 / LIGHTING.fogFar,
  skyZenith: PALETTE.sky,
  skyHorizon: PALETTE.fog,
  ambientLightColor: LIGHTING.ambient,
  directionalLightColor: PALETTE.moon,
  durationMinutes: RUN_DURATION_MINUTES
};
