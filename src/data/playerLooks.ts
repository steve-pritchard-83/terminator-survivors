import type { LoadoutId } from '../core/types';

/**
 * How each playable character looks in the field. Colours are hex; the mesh applies them when
 * a run starts (KyleReeseMesh.applyLoadout), so adding a character is a data change.
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
  hairStyle: 'short' | 'ponytail';
  /** Arms show skin (tank top) or the outer layer's sleeves */
  sleeves: 'outer' | 'skin';
  headgear: 'none' | 'bandana' | 'helmet';
  headgearColor: number;
  /** Chest plate, shoulder pads and a glowing backpack */
  armor: boolean;
  armorColor: number;
  scarfColor: number | null;
  scar: boolean;
  shades: boolean;
  scale: number;
}

export const PLAYER_LOOKS: Record<LoadoutId, PlayerLook> = {
  // Kyle Reese in 1984: long dark coat, grey tee, jeans
  // Kyle Reese in 2029: Tech-Com field jacket and a faded red headband
  reese_2029: {
    outer: 'jacket',
    outerColor: 0x3d4535,
    topColor: 0x2c3036,
    trouserColor: 0x2e3529,
    bootColor: 0x15171a,
    skinColor: 0xd4a383,
    hairColor: 0x2a1f18,
    hairStyle: 'short',
    sleeves: 'outer',
    headgear: 'bandana',
    headgearColor: 0x8a2e24,
    armor: false,
    armorColor: 0x000000,
    scarfColor: null,
    scar: false,
    shades: false,
    scale: 1.0
  },
  // Heavy plasma corps: helmet with a cyan visor, armour plate, power-cell backpack
  // The Resistance leader: brown leather jacket, red scarf, a scar across the cheek
  // Sarah Connor (T2): olive tank top, bare arms, cargo pants, ponytail and a black headband
  // Reprogrammed T-800: bigger, black leather jacket, sunglasses
};
