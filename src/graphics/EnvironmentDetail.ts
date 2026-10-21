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

/** Burnt-out 1980s sedan: rust under soot, gutted cabin, chrome trim, tyres. */
export function buildCarWreckGeometry(): THREE.BufferGeometry {
  const bodyPaint = 0x4e3a2c; // rust under soot
  const bodyScorched = 0x24211f;
  const cabinInterior = 0x232a33;
  const chromeTrim = 0x5c6c7c;
  const tireRubber = 0x14181e;

  const carParts: THREE.BufferGeometry[] = [
    bakePart(new THREE.BoxGeometry(1.96, 0.52, 4.3), 0, 0.46, 0, 0, 0, 0, bodyPaint),
    bakePart(new THREE.BoxGeometry(1.86, 0.18, 1.35), 0, 0.74, 1.38, 0.08, 0, 0.03, bodyScorched),
    bakePart(new THREE.BoxGeometry(1.7, 0.24, 1.15), 0, 0.64, 1.4, 0, 0, 0, cabinInterior),
    bakePart(new THREE.BoxGeometry(1.88, 0.2, 1.05), 0, 0.74, -1.55, -0.05, 0, 0, bodyPaint),
    bakePart(new THREE.BoxGeometry(2.06, 0.2, 0.22), 0, 0.34, 2.18, 0, 0, 0, chromeTrim),
    bakePart(new THREE.BoxGeometry(2.06, 0.2, 0.22), 0, 0.34, -2.18, 0, 0, 0, chromeTrim),
    bakePart(new THREE.BoxGeometry(1.4, 0.24, 0.12), 0, 0.56, 2.14, 0, 0, 0, cabinInterior),
    bakePart(new THREE.BoxGeometry(0.28, 0.16, 0.12), -0.72, 0.58, 2.14, 0, 0, 0, chromeTrim),
    bakePart(new THREE.BoxGeometry(0.28, 0.16, 0.12), 0.72, 0.58, 2.14, 0, 0, 0, chromeTrim),
    bakePart(new THREE.BoxGeometry(1.56, 0.48, 1.72), 0, 0.94, -0.12, 0, 0, 0, cabinInterior),
    bakePart(new THREE.BoxGeometry(1.62, 0.1, 1.65), 0, 1.22, -0.15, 0.04, 0, -0.04, bodyPaint),
    bakePart(new THREE.BoxGeometry(0.1, 0.56, 0.12), -0.78, 0.96, 0.68, -0.45, 0, 0.1, bodyPaint),
    bakePart(new THREE.BoxGeometry(0.1, 0.56, 0.12), 0.78, 0.96, 0.68, -0.45, 0, -0.1, bodyPaint),
    bakePart(new THREE.BoxGeometry(0.1, 0.52, 0.14), -0.8, 0.96, -0.12, 0, 0, 0.08, bodyScorched),
    bakePart(new THREE.BoxGeometry(0.1, 0.52, 0.14), 0.8, 0.96, -0.12, 0, 0, -0.08, bodyScorched),
    bakePart(
      new THREE.BoxGeometry(0.12, 0.56, 0.22),
      -0.78,
      0.96,
      -0.92,
      0.42,
      0,
      0.1,
      bodyPaint
    ),
    bakePart(
      new THREE.BoxGeometry(0.12, 0.56, 0.22),
      0.78,
      0.96,
      -0.92,
      0.42,
      0,
      -0.1,
      bodyPaint
    ),
    bakePart(
      new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
      -0.98,
      0.36,
      1.32,
      0,
      0,
      Math.PI / 2,
      tireRubber
    ),
    bakePart(
      new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
      -0.98,
      0.36,
      1.32,
      0,
      0,
      Math.PI / 2,
      chromeTrim
    ),
    bakePart(
      new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
      0.98,
      0.36,
      1.32,
      0,
      0,
      Math.PI / 2,
      tireRubber
    ),
    bakePart(
      new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
      0.98,
      0.36,
      1.32,
      0,
      0,
      Math.PI / 2,
      chromeTrim
    ),
    bakePart(
      new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
      -0.98,
      0.36,
      -1.32,
      0,
      0,
      Math.PI / 2,
      tireRubber
    ),
    bakePart(
      new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
      -0.98,
      0.36,
      -1.32,
      0,
      0,
      Math.PI / 2,
      chromeTrim
    ),
    bakePart(
      new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
      0.98,
      0.36,
      -1.32,
      0,
      0,
      Math.PI / 2,
      tireRubber
    ),
    bakePart(
      new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
      0.98,
      0.36,
      -1.32,
      0,
      0,
      Math.PI / 2,
      chromeTrim
    )
  ];
  return mergeParts(carParts);
}

export function createCarWreckMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.28, roughness: 0.68 });
}

/**
 * Broken section of a building wall, about 5 m long along local x: piers with blown-out window
 * openings, a jagged top, exposed rebar and rubble at its foot.
 */
export function buildRuinWallGeometry(): THREE.BufferGeometry {
  const concrete = 0x55514c;
  const concreteDark = 0x34312e;
  const rebar = 0x3e2a22;
  const box = (w: number, h: number, x: number, y: number, color = concrete, rz = 0) =>
    bakePart(new THREE.BoxGeometry(w, h, 0.36), x, y, 0, 0, 0, rz, color);
  const rod = (x: number, y: number, h: number, tilt: number) =>
    bakePart(new THREE.CylinderGeometry(0.025, 0.025, h, 5), x, y + h / 2, 0, 0, 0, tilt, rebar);
  return mergeParts([
    box(5.0, 0.6, 0, 0.3, concreteDark),
    // Piers between the window openings, each broken off at a different height
    box(0.42, 3.2, -2.3, 1.6),
    box(0.5, 2.6, -0.75, 1.3),
    box(0.5, 2.9, 0.9, 1.45),
    box(0.4, 1.5, 2.3, 0.75, concreteDark),
    // Sills and a surviving lintel
    box(1.1, 0.4, -1.52, 0.8),
    box(1.15, 0.4, 0.07, 0.8),
    box(1.1, 0.38, -1.52, 2.4, concrete, 0.04),
    box(0.95, 0.8, 1.62, 1.0, concreteDark),
    // Exposed rebar where the wall snapped
    rod(-0.85, 2.6, 0.7, 0.25),
    rod(-0.62, 2.6, 0.5, -0.35),
    rod(0.98, 2.9, 0.6, 0.15),
    rod(2.25, 1.5, 0.8, -0.4),
    // Fallen chunks at the foot
    bakePart(new THREE.BoxGeometry(0.7, 0.35, 0.6), 0.4, 0.18, 0.7, 0.2, 0.6, 0.1, concreteDark),
    bakePart(new THREE.BoxGeometry(0.5, 0.3, 0.5), -1.6, 0.15, 0.65, -0.2, 0.3, 0.15, concrete),
    bakePart(new THREE.BoxGeometry(0.9, 0.28, 0.5), 1.9, 0.14, -0.6, 0.1, -0.4, 0, concreteDark)
  ]);
}
