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
  reese_1984: {
    outer: 'trench',
    outerColor: 0x4d4e44,
    topColor: 0x80878d,
    trouserColor: 0x3a4b6c,
    bootColor: 0x131519,
    skinColor: 0xd4a383,
    hairColor: 0x2a1f18,
    hairStyle: 'short',
    sleeves: 'outer',
    headgear: 'none',
    headgearColor: 0x000000,
    armor: false,
    armorColor: 0x000000,
    scarfColor: null,
    scar: false,
    shades: false,
    scale: 1.0
  },
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
  techcom_sapper: {
    outer: 'jacket',
    outerColor: 0x2f3b4a,
    topColor: 0x20262e,
    trouserColor: 0x242c38,
    bootColor: 0x101216,
    skinColor: 0xcf9f80,
    hairColor: 0x20170f,
    hairStyle: 'short',
    sleeves: 'outer',
    headgear: 'helmet',
    headgearColor: 0x3a444f,
    armor: true,
    armorColor: 0x4a5663,
    scarfColor: null,
    scar: false,
    shades: false,
    scale: 1.08
  },
  // The Resistance leader: brown leather jacket, red scarf, a scar across the cheek
  john_connor: {
    outer: 'jacket',
    outerColor: 0x5e3f2a,
    topColor: 0x59616a,
    trouserColor: 0x2b3242,
    bootColor: 0x16130f,
    skinColor: 0xd9aa8a,
    hairColor: 0x261a12,
    hairStyle: 'short',
    sleeves: 'outer',
    headgear: 'none',
    headgearColor: 0x000000,
    armor: false,
    armorColor: 0x000000,
    scarfColor: 0xa83a2c,
    scar: true,
    shades: false,
    scale: 1.0
  },
  // Sarah Connor (T2): olive tank top, bare arms, cargo pants, ponytail and a black headband
  sarah_connor: {
    outer: 'none',
    outerColor: 0x000000,
    topColor: 0x56604a,
    trouserColor: 0x4b503c,
    bootColor: 0x15130f,
    skinColor: 0xd8a98a,
    hairColor: 0x2b1e17,
    hairStyle: 'ponytail',
    sleeves: 'skin',
    headgear: 'bandana',
    headgearColor: 0x1b1d20,
    armor: false,
    armorColor: 0x000000,
    scarfColor: null,
    scar: false,
    shades: false,
    scale: 0.97
  },
  // Reprogrammed T-800: bigger, black leather jacket, sunglasses
  reprogrammed_t800: {
    outer: 'jacket',
    outerColor: 0x25262a,
    topColor: 0x1a1b1e,
    trouserColor: 0x1c1e22,
    bootColor: 0x0f1012,
    skinColor: 0xc8987b,
    hairColor: 0x15110e,
    hairStyle: 'short',
    sleeves: 'outer',
    headgear: 'none',
    headgearColor: 0x000000,
    armor: false,
    armorColor: 0x000000,
    scarfColor: null,
    scar: false,
    shades: true,
    scale: 1.16
  }
};
