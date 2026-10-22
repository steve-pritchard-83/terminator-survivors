import type { LoadoutId } from '../core/types';

/**
 * How Kyle looks in the field: the colours of the built figure shown until the sculpted model loads.
 * Colours are hex; KyleReeseMesh.applyLoadout applies them.
 */
export interface PlayerLook {
  /** none = sleeveless/no outer layer, jacket = waist-length, trench = long coat to the knees */
  outer: 'none' | 'jacket' | 'trench';
  outerColor: number;
  /** Colour of the top worn under (or instead of) the outer layer */
  topColor: number;
  trouserColor: number;
  bootColor: number;
  skinColor: number;
  hairColor: number;
  /** Arms show skin (tank top) or the outer layer's sleeves */
  sleeves: 'outer' | 'skin';
  headgearColor: number;
  scale: number;
}

export const PLAYER_LOOKS: Record<LoadoutId, PlayerLook> = {
  // Kyle Reese in 2029: Tech-Com field jacket and a faded red headband
  reese_2029: {
    outer: 'jacket',
    outerColor: 0x3d4535,
    topColor: 0x2c3036,
    trouserColor: 0x2e3529,
    bootColor: 0x15171a,
    skinColor: 0xd4a383,
    hairColor: 0x2a1f18,
    sleeves: 'outer',
    headgearColor: 0x8a2e24,
    scale: 1.0
  }
};
