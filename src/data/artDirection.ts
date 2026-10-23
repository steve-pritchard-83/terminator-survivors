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

/** The sculpted ash-and-bone field: its bones as scattered patches, its dirt as the ground's colour */
export const GROUND_TILE = {
  /** Width of one bone patch in metres (sets the bones' size: skulls come out about 0.4 m) */
  size: 6,
  /** Bone pile height (1 keeps the sculpted proportions; a little extra so the piles catch the light) */
  heightScale: 2,
  /** Each cluster is a few patches this far apart, so the bone fields have irregular outlines */
  clusterMin: 1,
  clusterMax: 3,
  clusterSpread: 3.2,
  /** Patch edge: bones are full height inside this fraction of the radius and sunk into the ground past the outer one */
  edgeInner: 0.42,
  edgeOuter: 0.9,
  /** Bones read as weathered bone against the darker dirt: their colour is muted toward grey by this much, then brightened */
  boneDesaturate: 0.65,
  boneBrightness: 1.6,
  /** Replaces the source's glossy roughness map (it glitters white under the moonlight) */
  roughness: 0.93,
  envMapIntensity: 0.15,
  normalScale: 0.6,
  /** One repeat of the dirt texture covers this many metres (laid without visible repetition) */
  detailTileMetres: 5,
  /** The ground takes the dirt's colour, muted toward grey (0 = grey, 1 = the texture's own brown) and brightened */
  detailSaturation: 0.45,
  detailGain: 1.9,
  /** How much of the dirt's light and dark mottling shows (1 = all of it; less reads calmer on small screens) */
  detailContrast: 0.7,
  /** Broad light and dark areas over the ground: how large (cycles per metre) and how dark or light they get */
  macroFrequency: 0.045,
  macroDark: 0.62,
  macroLight: 1.2,
  /** Scattered loose skulls (fraction of the full carpet); skulls mostly gather in the bone patches now */
  skullCarpet: 0.25
};

/** The VR viewpoint over the battlefield (Quest). */
export const XR_VIEW = {
  /** Head position above and behind Kyle, in metres, and the downward tilt (radians) */
  height: 8.5,
  back: 7.5,
  pitch: -0.6,
  /**
   * The viewer is this many times life size, so the battlefield reads as a tabletop diorama: stereo depth
   * and head-movement parallax grow with it (1 = life scale, which looks flat from this distance)
   */
  viewerScale: 2.6,
  /** Headset render cost: per-eye resolution (1 = native), foveation (0 none to 1 strongest edge saving), target refresh */
  resolutionScale: 0.85,
  foveation: 1,
  frameRate: 72
};
