import { GRADE } from './artDirection';

// Rendering budgets. Phones get far fewer lights (every light in the scene is evaluated for every
// lit pixel, even at zero intensity), lighter models, smaller textures and less ground clutter.

/** True on phones, tablets and standalone headsets (Quest's browser does not say Mobile), decided once at startup. */
export const IS_MOBILE: boolean = (() => {
  if (typeof navigator === 'undefined') return false;
  if (/iPhone|iPad|iPod|Android|Mobile|OculusBrowser|Quest/i.test(navigator.userAgent)) return true;
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
      /** Share of the skull-and-bone carpet that is placed (halved on every device so machines read against the ground) */
      groundClutter: 0.3,
      /** Bloom renders at this fraction of the screen resolution */
      bloomScale: 0.5,
      /** Highest preset the automatic quality detection may pick */
      maxAutoPreset: 'medium' as const,
      /** Seconds of low frame rate before the resolution is lowered */
      lowFpsSeconds: 1.5,
      /** Load the light model variants (fewer triangles, 512 px textures) */
      modelSuffix: '.m',
      /** Machine metalness is scaled by this: on a small dark screen pure chrome reads as black */
      metalScale: 0.6,
      /** Faint cool self-light on the machines (through their own texture) so they stand off the ground */
      machineLift: 0.22,
      /** Falling ash flakes (the rest of the pool is hidden) and how opaque they are */
      ashParticles: 70,
      ashOpacity: 0.4,
      /** Scorch marks left on the ground by explosions */
      scorchDecals: 20,
      /** Contact shadows under enemies: how many, and how dark */
      shadowMax: 90,
      shadowOpacity: 0.5,
      /** Film grain reads as noise on a small high-density screen */
      grain: 0,
      /** Clusters of sculpted bone patches per ground chunk */
      boneClusters: 10
    }
  : {
      flashLights: 8,
      fireLights: 4,
      lampSpill: true,
      groundClutter: 0.5,
      bloomScale: 1,
      maxAutoPreset: 'ultra' as const,
      lowFpsSeconds: 3,
      modelSuffix: '',
      metalScale: 1,
      machineLift: 0,
      ashParticles: 240,
      ashOpacity: 0.7,
      scorchDecals: 64,
      shadowMax: 650,
      shadowOpacity: 0.8,
      grain: GRADE.grain,
      boneClusters: 16
    };
