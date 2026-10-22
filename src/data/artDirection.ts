// Art direction for the 2029 future war, matched to the films' night battle scenes:
// cold moonlit blue against hot orange fire, chrome machines lit from behind, red optics,
// white-blue searchlights through haze, pink-violet Resistance plasma and red Skynet plasma.

export const PALETTE = {
  // Night
  sky: 0x05080d,
  fog: 0x111c28,
  moon: 0xa8c4e6,
  // Fire
  fire: 0xff7a1e,
  ember: 0xff3b0a,
  fireBounce: 0x5a2e14,
  // Machines
  skynetRed: 0xff1a0a,
  searchlight: 0xd6e8ff,
  // Plasma (Resistance pink-violet, Skynet red), cores are near-white
  plasmaResistance: 0xd04cff,
  plasmaResistanceCore: 0xffe6ff,
  plasmaSkynet: 0xff2440,
  plasmaSkynetCore: 0xffe0e0,
  // Pickups
  // Smoke and ash
  smoke: 0x2a3440,
  ash: 0x9a9690
};

/** Endoskeletons are drawn a little larger than their hitbox so the silhouette reads from the top-down camera. */
export const ENDO_VISUAL_SCALE = 1.15;

export const LIGHTING = {
  exposure: 0.95,
  // Hemisphere: cold sky above, fire bounce from below
  hemiSky: 0x3a4c66,
  hemiGround: PALETTE.fireBounce,
  hemiIntensity: 0.5,
  ambient: 0x141f2c,
  ambientIntensity: 0.3,
  // Moon key comes from behind the action (camera looks towards -z), so machines get bright rims
  moonIntensity: 1.7,
  moonPosition: [-10, 26, -28] as const,
  // Low warm fill from the burning horizon in front of the camera
  fireFill: 0xff8a3c,
  fireFillIntensity: 0.45,
  fireFillPosition: [14, 4, 18] as const,
  envIntensity: 0.85,
  fogNear: 20,
  fogFar: 58
};

export const GRADE = {
  bloomStrength: 0.7,
  bloomRadius: 0.32,
  bloomThreshold: 0.92,
  grain: 0.045,
  vignette: 0.32,
  // Split toning: shadows pushed to steel blue, highlights to warm amber
  shadowTint: [0.02, 0.07, 0.13] as const,
  highlightTint: [1.06, 0.98, 0.9] as const,
  saturation: 0.86
};

/** Soft contact shadow under every enemy, so machines read against the ground in a crowd. */
export const ENEMY_SHADOW = {
  opacity: 0.85,
  /** Shadow radius as a multiple of the enemy's collision radius */
  radiusScale: 1.5,
  minRadius: 0.45,
  /** Fliers cast a wider, softer patch */
  flyingScale: 1.3,
  segments: 10,
  maxCount: 650
};

/** The sculpted ash-and-bone field: its bones as scattered patches, its dirt as the ground's fine detail */
export const GROUND_TILE = {
  /** Width of one bone patch in metres (sets the bones' size: skulls come out about 0.4 m) */
  size: 6,
  /** Bone pile height (1 keeps the sculpted proportions; at patch size the piles are very flat, so they are raised) */
  heightScale: 3.5,
  /** Each cluster is a few patches this far apart, so the bone fields have irregular outlines */
  clusterMin: 2,
  clusterMax: 5,
  clusterSpread: 3.2,
  /** Patch edge: bones are full height inside this fraction of the radius and sunk into the ash past the outer one */
  edgeInner: 0.45,
  edgeOuter: 0.95,
  /** Bones read as pale bone against the darker dirt: their colour is muted toward grey by this much, then brightened */
  boneDesaturate: 0.55,
  boneBrightness: 1.9,
  /** Replaces the source's glossy roughness map (it glitters white under the moonlight) */
  roughness: 0.93,
  envMapIntensity: 0.15,
  normalScale: 0.6,
  /** The dirt texture repeats this many times across a 75 m ground chunk (mirrored, so no seams) */
  detailRepeat: 14,
  /** The ground takes the dirt's colour, muted toward grey (0 = grey, 1 = the texture's own brown) and brightened */
  detailSaturation: 0.5,
  detailGain: 2.0,
  /** A second, wider sample of the dirt gives broad light and dark areas: its repeat as a fraction of the fine one */
  macroScale: 0.21,
  /** Surface relief of the dirt's normal map */
  detailNormalScale: 0.9,
  /** Scattered loose skulls (fraction of the full carpet); skulls mostly gather in the bone patches now */
  skullCarpet: 0.25
};
