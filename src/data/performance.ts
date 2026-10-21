// Rendering budgets. Phones get far fewer lights (every light in the scene is evaluated for every
// lit pixel, even at zero intensity), lighter models, smaller textures and less ground clutter.

/** True on phones and tablets (touch-first devices), decided once at startup. */
export const IS_MOBILE: boolean = (() => {
  if (typeof navigator === 'undefined') return false;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)) return true;
  // iPadOS reports itself as a Mac
  if (/Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1) return true;
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches === true;
})();

export const RENDER_BUDGET = IS_MOBILE
  ? {
      /** Pooled point lights for explosion, plasma and muzzle flashes */
      flashLights: 3,
      /** Real lights on the burning wrecks nearest the player */
      fireLights: 2,
      /** The belt lamp's soft fill light back onto Kyle (its beam always stays) */
      lampSpill: false,
      /** Share of the skull-and-bone carpet that is placed */
      groundClutter: 0.5,
      /** Bloom renders at this fraction of the screen resolution */
      bloomScale: 0.5,
      /** Highest preset the automatic quality detection may pick */
      maxAutoPreset: 'medium' as const,
      /** Seconds of low frame rate before the resolution is lowered */
      lowFpsSeconds: 1.5,
      /** Load the light model variants (fewer triangles, 512 px textures) */
      modelSuffix: '.m'
    }
  : {
      flashLights: 8,
      fireLights: 4,
      lampSpill: true,
      groundClutter: 1,
      bloomScale: 1,
      maxAutoPreset: 'ultra' as const,
      lowFpsSeconds: 3,
      modelSuffix: ''
    };
