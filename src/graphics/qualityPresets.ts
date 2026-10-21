import type { QualityPreset } from '../core/types';

export interface QualityProfile {
  preset: QualityPreset;
  pixelRatio: number;
  minPixelRatio: number;
  maxPixelRatio: number;
  bloom: boolean;
  shadows: boolean;
  particleCap: number;
  debrisCap: number;
  dynamicLights: boolean;
  atmosphere: boolean;
}

export const QUALITY_PROFILES: Record<QualityPreset, QualityProfile> = {
  low: {
    preset: 'low',
    pixelRatio: 1.0,
    minPixelRatio: 0.75,
    maxPixelRatio: 1.0,
    bloom: false,
    shadows: false,
    particleCap: 30,
    debrisCap: 12,
    dynamicLights: false,
    atmosphere: false
  },
  medium: {
    preset: 'medium',
    pixelRatio: 1.25,
    minPixelRatio: 0.8,
    maxPixelRatio: 1.25,
    bloom: true,
    shadows: false,
    particleCap: 60,
    debrisCap: 24,
    dynamicLights: true,
    atmosphere: true
  },
  high: {
    preset: 'high',
    pixelRatio: 1.5,
    minPixelRatio: 1.0,
    maxPixelRatio: 1.5,
    bloom: true,
    shadows: true,
    particleCap: 100,
    debrisCap: 48,
    dynamicLights: true,
    atmosphere: true
  },
  ultra: {
    preset: 'ultra',
    pixelRatio: 2.0,
    minPixelRatio: 1.25,
    maxPixelRatio: 2.0,
    bloom: true,
    shadows: true,
    particleCap: 160,
    debrisCap: 72,
    dynamicLights: true,
    atmosphere: true
  },
  auto: {
    preset: 'auto',
    pixelRatio: 1.0,
    minPixelRatio: 1.0,
    maxPixelRatio: 1.5,
    bloom: true,
    shadows: true,
    particleCap: 100,
    debrisCap: 48,
    dynamicLights: true,
    atmosphere: true
  }
};

export function getQualityProfile(preset: QualityPreset): QualityProfile {
  return QUALITY_PROFILES[preset] ?? QUALITY_PROFILES.high;
}

const PRESET_ORDER: QualityPreset[] = ['low', 'medium', 'high', 'ultra'];

/** Picks a preset from the opening seconds' frame rate, never above the device's ceiling. */
export function detectPresetFromFps(avgFps: number, deviceRatio = 1, ceiling: QualityPreset = 'ultra'): QualityPreset {
  let preset: QualityPreset;
  if (avgFps >= 58) {
    preset = deviceRatio >= 2 ? 'ultra' : 'high';
  } else if (avgFps >= 45) {
    preset = 'medium';
  } else {
    preset = 'low';
  }
  return PRESET_ORDER[Math.min(PRESET_ORDER.indexOf(preset), PRESET_ORDER.indexOf(ceiling))];
}
