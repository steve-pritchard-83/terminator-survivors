import * as THREE from 'three';
import { ballPart, bakePart, barrelPart, boxPart, mergeParts, wheelPart } from './geometryUtils';

/**
 * Hunter-Killer Tank (Skynet ground HK): a low, wide, tracked gunmetal hull with a hammerhead
 * command pod on a neck tower and a pair of heavy plasma cannons. Units are metres before the
 * 2.2x group scale. +z is forward. Lower hull origin is the ground, the turret origin is the neck base.
 */

const STEEL_MID = 0x4f5862;
const STEEL_DARK = 0x2c3239;
const STEEL_LIGHT = 0x6d7782;
const RUBBER = 0x15181c;
const HATCH = 0x39414a;
const RED = 0xff1a1a;
const PLASMA_CYAN = 0x5fe8ff;
const PLASMA_VIOLET = 0xb66bff;

function buildTrack(side: number): THREE.BufferGeometry[] {
  const x = side * 1.85;
  const outer = side * 2.36;
  const parts: THREE.BufferGeometry[] = [
    // Track block and upper armour skirt
    boxPart(1.0, 0.86, 5.5, x, 0.5, 0, RUBBER),
    boxPart(1.22, 0.2, 5.0, x, 1.04, 0, STEEL_MID),
    boxPart(1.22, 0.08, 4.4, x, 1.17, 0, STEEL_DARK),
    // Front sprocket and rear idler (bigger than the road wheels)
    wheelPart(outer, 0.52, 2.55, 0.52, 0.12, STEEL_LIGHT, 16),
    wheelPart(outer, 0.46, -2.55, 0.46, 0.12, STEEL_LIGHT, 16),
    wheelPart(outer + side * 0.05, 0.52, 2.55, 0.2, 0.12, STEEL_DARK, 10),
    wheelPart(outer + side * 0.05, 0.46, -2.55, 0.18, 0.12, STEEL_DARK, 10)
  ];
  // Six road wheels with hub caps
  for (let i = 0; i < 6; i++) {
    const z = -2.05 + i * 0.82;
    parts.push(wheelPart(outer, 0.36, z, 0.34, 0.12, STEEL_MID, 14));
    parts.push(wheelPart(outer + side * 0.05, 0.36, z, 0.14, 0.12, STEEL_DARK, 8));
  }
  // Track link ridges along the outer face
  for (let i = 0; i < 26; i++) {
    parts.push(boxPart(0.05, 0.84, 0.09, side * 2.33, 0.5, -2.6 + i * 0.208, STEEL_DARK));
  }
  // Fender with front lamp
  parts.push(boxPart(0.3, 0.1, 5.2, side * 2.5, 1.2, 0, STEEL_LIGHT));
  return parts;
}

/** Static lower hull and tracks, in ground space. */
export function buildTankLower(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Main hull plus sloped glacis and rear deck
    boxPart(3.0, 0.7, 4.8, 0, 0.92, 0, STEEL_MID),
    boxPart(3.0, 0.14, 1.7, 0, 1.14, 2.55, STEEL_LIGHT, -0.5),
    boxPart(2.6, 0.45, 1.5, 0, 1.45, -1.7, STEEL_DARK),
    // Engine vents and exhausts
    ...[0, 1, 2, 3, 4].map((i) => boxPart(2.2, 0.03, 0.06, 0, 1.69, -2.2 + i * 0.28, STEEL_LIGHT)),
    bakePart(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8), -0.9, 1.9, -2.2, 0.25, 0, 0, STEEL_DARK),
    bakePart(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8), 0.9, 1.9, -2.2, 0.25, 0, 0, STEEL_DARK),
    // Hatches, antenna and hull lights
    boxPart(0.7, 0.08, 0.7, -0.7, 1.31, 0.6, HATCH),
    boxPart(0.7, 0.08, 0.7, 0.7, 1.31, 0.6, HATCH),
    bakePart(new THREE.CylinderGeometry(0.015, 0.02, 1.6, 5), 1.2, 2.3, -1.4, 0, 0, 0.08, STEEL_DARK),
    // Belly skid plate
    boxPart(2.6, 0.12, 4.2, 0, 0.5, 0, STEEL_DARK),
    ...buildTrack(-1),
    ...buildTrack(1)
  ];
  return mergeParts(parts);
}

/** Neck tower, hammerhead command pod and cannon housings (turret space). */
export function buildTankTurret(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Neck tower with collar rings
    bakePart(new THREE.CylinderGeometry(0.72, 0.95, 1.4, 10), 0, 0.7, 0, 0, 0, 0, STEEL_MID),
    bakePart(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 10), 0, 0.2, 0, 0, 0, 0, STEEL_LIGHT),
    bakePart(new THREE.CylinderGeometry(0.78, 0.78, 0.1, 10), 0, 1.25, 0, 0, 0, 0, STEEL_DARK),

    // Hammerhead command pod: wide body, sloped brow, roof plate and rear block
    boxPart(3.5, 0.95, 2.0, 0, 1.7, 0.3, STEEL_MID),
    boxPart(3.3, 0.45, 0.9, 0, 1.78, 1.45, STEEL_LIGHT, 0.5),
    boxPart(2.6, 0.2, 1.5, 0, 2.28, 0.2, STEEL_DARK),
    boxPart(2.8, 0.7, 0.8, 0, 1.6, -1.0, STEEL_DARK),
    // Dark visor housing for the scanner and sensor lenses
    boxPart(2.1, 0.3, 0.2, 0, 1.76, 1.72, 0x0a0c0f),
    ballPart(-1.25, 1.62, 1.62, 0.14, 0x0a0c0f),
    ballPart(1.25, 1.62, 1.62, 0.14, 0x0a0c0f),
    // Searchlight housings on the brow (the volumetric cones attach here)
    bakePart(new THREE.CylinderGeometry(0.34, 0.4, 0.55, 12), -1.2, 1.55, 1.3, Math.PI / 2, 0, 0, STEEL_DARK),
    bakePart(new THREE.CylinderGeometry(0.34, 0.4, 0.55, 12), 1.2, 1.55, 1.3, Math.PI / 2, 0, 0, STEEL_DARK)
  ];

  // Twin heavy plasma cannons: housing, recoil sleeve, barrel, cooling fins, muzzle brake
  for (const side of [-1, 1]) {
    const x = side * 2.05;
    parts.push(
      boxPart(0.7, 0.65, 1.4, x, 1.55, 0.5, STEEL_MID),
      boxPart(0.5, 0.5, 0.5, x, 1.55, -0.4, STEEL_DARK),
      barrelPart(x, 1.55, 1.1, 0.27, 1.0, STEEL_LIGHT, 12),
      barrelPart(x, 1.55, 2.4, 0.18, 2.4, STEEL_MID, 12),
      barrelPart(x, 1.55, 3.7, 0.27, 0.5, STEEL_DARK, 12),
      barrelPart(x, 1.55, 3.95, 0.14, 0.12, 0x050607, 10)
    );
    for (let i = 0; i < 5; i++) {
      parts.push(barrelPart(x, 1.55, 1.7 + i * 0.4, 0.26, 0.07, STEEL_LIGHT, 12));
    }
    // Strut linking the cannon boom to the pod
    parts.push(boxPart(1.2, 0.18, 0.5, side * 1.4, 1.55, 0.4, STEEL_DARK));
  }
  return mergeParts(parts);
}

/** Emissive details: red scanner and lenses, plasma coils around the cannons (turret space). */
export function buildTankGlow(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    boxPart(1.9, 0.12, 0.08, 0, 1.76, 1.8, RED),
    ballPart(-1.25, 1.62, 1.72, 0.07, RED),
    ballPart(1.25, 1.62, 1.72, 0.07, RED)
  ];
  for (const side of [-1, 1]) {
    const x = side * 2.05;
    for (let i = 0; i < 3; i++) {
      parts.push(
        bakePart(new THREE.TorusGeometry(0.2, 0.035, 6, 14), x, 1.55, 2.0 + i * 0.5, 0, 0, 0, i % 2 ? PLASMA_VIOLET : PLASMA_CYAN)
      );
    }
    parts.push(ballPart(x, 1.55, 4.02, 0.09, PLASMA_CYAN));
  }
  return mergeParts(parts);
}
