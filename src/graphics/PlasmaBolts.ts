import * as THREE from 'three';
import { bakePart, mergeParts } from './meshes/geometryUtils';

/**
 * Plasma bolts as in the films: long thin streaks with a white-hot core inside a coloured glow.
 * Geometry points along +Z. Colours are pushed above 1.0 by the material so the bloom picks them up.
 */
export function buildBoltGeometry(
  length: number,
  coreRadius: number,
  glowRadius: number,
  coreColor: number,
  glowColor: number
): THREE.BufferGeometry {
  return mergeParts([
    bakePart(new THREE.CylinderGeometry(coreRadius, coreRadius * 0.6, length, 6), 0, 0, 0, Math.PI / 2, 0, 0, coreColor),
    bakePart(new THREE.CylinderGeometry(glowRadius, glowRadius * 0.35, length * 0.92, 8), 0, 0, -length * 0.03, Math.PI / 2, 0, 0, glowColor)
  ]);
}

/** Additive, unlit, HDR-bright material for bolt geometry built above. */
export function createBoltMaterial(brightness = 2.6): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  mat.color.setScalar(brightness);
  return mat;
}
