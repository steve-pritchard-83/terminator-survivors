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
