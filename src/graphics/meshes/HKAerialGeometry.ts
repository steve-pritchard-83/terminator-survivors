import * as THREE from 'three';
import { ballPart, bakePart, barrelPart, boxPart, mergeParts } from './geometryUtils';

/**
 * Hunter-Killer Aerial: a flat, wide, matte-black flying wing with ducted turbine nacelles on
 * either side, a sensor canopy with a red visor and a chin-mounted twin plasma cannon.
 * +z is forward. Units are metres before the group scale (1.1x patrol, 1.55x squadron leader).
 */

const HULL = 0x3e454e;
const HULL_DARK = 0x242a31;
const HULL_LIGHT = 0x5d6670;
const FAN = 0x14171b;
const RED = 0xff1a1a;
const THRUST = 0x3a2a24; // dark exhaust ducts: the HK reads by its searchlights, not glowing engines

/** Fuselage, wings, canopy, chin cannon mount (static, hull space). */
export function buildAerialHull(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Fuselage: flat body, tapering nose, dorsal spine and tail block
    boxPart(1.5, 0.46, 3.0, 0, 0, 0, HULL),
    bakePart(new THREE.CylinderGeometry(0.16, 0.72, 2.0, 8), 0, -0.02, 1.9, Math.PI / 2, 0, 0, HULL, 1, 1, 0.5),
    boxPart(0.5, 0.3, 2.4, 0, 0.32, -0.1, HULL_DARK),
    boxPart(1.2, 0.34, 0.8, 0, 0.05, -1.7, HULL_DARK),
    // Sensor canopy dome
    ballPart(0, 0.3, 0.95, 0.4, HULL_DARK, 1, 0.55, 1.3),
    // Wing roots and swept wings with a thicker leading edge
    boxPart(6.3, 0.1, 1.15, 0, 0.1, -0.35, HULL),
    boxPart(6.3, 0.12, 0.2, 0, 0.12, 0.28, HULL_LIGHT),
    boxPart(1.4, 0.2, 1.4, -1.6, 0.1, -0.2, HULL_DARK),
    boxPart(1.4, 0.2, 1.4, 1.6, 0.1, -0.2, HULL_DARK),
    // Underside armour ribs
    ...[-1.4, -0.7, 0.7, 1.4].map((x) => boxPart(0.08, 0.1, 1.9, x, -0.27, 0.1, HULL_LIGHT)),
    // Chin turret ball and mount
    ballPart(0, -0.35, 1.45, 0.24, HULL_DARK),
    boxPart(0.3, 0.2, 0.5, 0, -0.22, 1.2, HULL)
  ];
  // Wingtip fins angled down
  for (const side of [-1, 1]) {
    parts.push(boxPart(0.1, 0.5, 0.8, side * 3.2, -0.1, -0.35, HULL_DARK, 0, 0, side * 0.25));
  }
  return mergeParts(parts);
}

/** Visor, lenses and nav lights (emissive, hull space). */
export function buildAerialGlow(): THREE.BufferGeometry {
  return mergeParts([
    boxPart(0.7, 0.1, 0.1, 0, 0.22, 1.5, RED),
    ballPart(-0.28, 0.2, 1.38, 0.05, RED),
    ballPart(0.28, 0.2, 1.38, 0.05, RED),
    // Chin cannon emitters
    ballPart(-0.18, -0.35, 2.75, 0.06, THRUST),
    ballPart(0.18, -0.35, 2.75, 0.06, THRUST)
  ]);
}

/** One turbine nacelle: ducted fan with intake ring, inner blades, nozzle (local space, +z forward). */
export function buildAerialNacelle(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    barrelPart(0, 0, 0, 0.5, 1.5, HULL, 14),
    // Intake lip and exhaust ring
    bakePart(new THREE.TorusGeometry(0.52, 0.07, 6, 18), 0, 0, 0.75, 0, 0, 0, HULL_LIGHT),
    bakePart(new THREE.TorusGeometry(0.46, 0.06, 6, 18), 0, 0, -0.78, 0, 0, 0, HULL_DARK),
    // Dark intake with fan hub and blades
    bakePart(new THREE.CircleGeometry(0.46, 14), 0, 0, 0.7, 0, 0, 0, FAN),
    ballPart(0, 0, 0.72, 0.1, HULL_LIGHT),
    // Pylon joining the nacelle to the wing
    boxPart(0.3, 0.2, 0.9, 0, 0.0, -0.1, HULL_DARK)
  ];
  for (let i = 0; i < 6; i++) {
    parts.push(boxPart(0.78, 0.05, 0.12, 0, 0, 0.7, HULL_LIGHT, 0, 0, (i * Math.PI) / 6));
  }
  return mergeParts(parts);
}

/** Glowing thrust cone for the nacelle exhaust. */
export function buildAerialThrust(): THREE.BufferGeometry {
  return mergeParts([
    bakePart(new THREE.CylinderGeometry(0.36, 0.1, 0.5, 12), 0, 0, -1.05, Math.PI / 2, 0, 0, THRUST)
  ]);
}

/** Twin chin cannons with muzzle rings (local to the plasmaBarrels group). */
export function buildAerialCannons(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.18, 0.18]) {
    parts.push(
      barrelPart(x, 0, 0.6, 0.06, 1.3, HULL_LIGHT, 8),
      barrelPart(x, 0, 1.28, 0.1, 0.16, HULL_DARK, 8),
      barrelPart(x, 0, 0.2, 0.1, 0.4, HULL_DARK, 8)
    );
  }
  return mergeParts(parts);
}
