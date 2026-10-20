import { RUN_DURATION_MINUTES } from './waves';

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
  fogColor: 0x081a33,
  fogDensity: 0.016,
  skyZenith: 0x040b18,
  skyHorizon: 0x0f294a,
  ambientLightColor: 0x162d4c,
  directionalLightColor: 0x4a88d9,
  durationMinutes: RUN_DURATION_MINUTES
};
