import * as THREE from 'three';
import { bakePart, mergeParts } from './meshes/geometryUtils';

/**
 * Geometry for the 2029 wasteland dressing, modelled on the future-war scenes of the films:
 * ground carpeted with human skulls and bones, wreckage burning in the dark.
 * Kept low-poly because thousands of these are instanced.
 */

const BONE = 0xc4b79a; // warm bone, so it does not read as blue stone under the night lighting
const BONE_SHADOW = 0x8a7f6c;
const VOID = 0x07090c;

/** Human skull lying on the ground: cranium, brow, cheeks, sockets, nasal cavity, jaw. */
export function buildSkullGeometry(): THREE.BufferGeometry {
  return mergeParts([
    bakePart(new THREE.SphereGeometry(0.15, 7, 5), 0, 0.14, -0.02, 0, 0, 0, BONE, 1, 0.92, 1.08),
    bakePart(new THREE.BoxGeometry(0.2, 0.04, 0.1), 0, 0.15, 0.1, 0.12, 0, 0, BONE),
    bakePart(new THREE.BoxGeometry(0.05, 0.06, 0.08), -0.095, 0.1, 0.08, 0, 0.3, 0, BONE_SHADOW),
    bakePart(new THREE.BoxGeometry(0.05, 0.06, 0.08), 0.095, 0.1, 0.08, 0, -0.3, 0, BONE_SHADOW),
    bakePart(new THREE.SphereGeometry(0.045, 5, 4), -0.055, 0.125, 0.115, 0, 0, 0, VOID),
    bakePart(new THREE.SphereGeometry(0.045, 5, 4), 0.055, 0.125, 0.115, 0, 0, 0, VOID),
    bakePart(new THREE.ConeGeometry(0.022, 0.05, 3), 0, 0.085, 0.14, Math.PI, 0, 0, VOID),
    bakePart(new THREE.BoxGeometry(0.13, 0.05, 0.11), 0, 0.045, 0.075, 0, 0, 0, BONE_SHADOW),
    bakePart(new THREE.BoxGeometry(0.1, 0.02, 0.03), 0, 0.045, 0.125, 0, 0, 0, BONE)
  ]);
}

/** A long bone (femur-like) with knobbed ends, lying along local x. */
export function buildBoneGeometry(): THREE.BufferGeometry {
  return mergeParts([
    bakePart(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 5), 0, 0.03, 0, 0, 0, Math.PI / 2, BONE),
    bakePart(new THREE.SphereGeometry(0.04, 4, 3), -0.24, 0.03, 0.012, 0, 0, 0, BONE),
    bakePart(new THREE.SphereGeometry(0.04, 4, 3), -0.24, 0.03, -0.018, 0, 0, 0, BONE),
    bakePart(new THREE.SphereGeometry(0.042, 4, 3), 0.24, 0.03, 0.0, 0, 0, 0, BONE),
    // Rib fragment
    bakePart(new THREE.TorusGeometry(0.1, 0.012, 3, 6, Math.PI), 0.02, 0.0, 0.1, 0, 0, 0, BONE_SHADOW)
  ]);
}

/** Flickering flame: a tall core and two tongues, hot yellow at the base fading to red at the tips. */
export function buildFlameGeometry(): THREE.BufferGeometry {
  const tongue = (r: number, h: number, x: number, z: number, tilt: number, color: number) =>
    bakePart(new THREE.ConeGeometry(r, h, 6, 1, true), x, h / 2, z, tilt, 0, tilt * 0.6, color);
  return mergeParts([
    tongue(0.34, 1.7, 0, 0, 0, 0xff7a1a),
    tongue(0.24, 1.1, 0.22, 0.1, 0.18, 0xff5a10),
    tongue(0.22, 0.95, -0.2, -0.12, -0.16, 0xff4a0c),
    tongue(0.14, 1.0, 0, 0, 0, 0xffa030)
  ]);
}

/** Flat soft-edged glow disc laid on the ground under a fire. */
export function buildGlowGeometry(size = 7): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  return g;
}
