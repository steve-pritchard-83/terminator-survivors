import * as THREE from 'three';
import { ballPart, bakePart, boxPart, limbBetween, mergeParts, type Vec3 } from './geometryUtils';

/**
 * T-800 endoskeleton geometry (Cyberdyne Systems Model 101, as seen in the future-war scenes):
 * polished steel skull with deep round eye sockets and exposed teeth, curved ribcage around a
 * stacked-vertebrae spine, hydraulic pistons on every limb, ball joints, flat steel feet.
 *
 * Frame: +z forward, +y up, feet at y = 0. Legs are built around the hip (y = 0 at the hip,
 * which sits at y = 0.68 in the world) so the batch can swing them with rotation.x.
 */

// Neutral polished steel: the endoskeleton is silver chrome, not blue
const CHROME = 0xd6dadf;
const CHROME_MID = 0xa0a6ad;
const STEEL = 0x6e747b;
const GUNMETAL = 0x2b2f35;
const SOCKET = 0x07090c;
const TEETH = 0xdedcd4;

type V3 = Vec3;
const limb = limbBetween;
const ball = ballPart;
const box = boxPart;

/** One rib: a 270 degree arc around the spine, open at the back, squashed front to back. */
function rib(y: number, radius: number, color: number): THREE.BufferGeometry {
  return bakePart(
    new THREE.TorusGeometry(radius, 0.013, 4, 10, Math.PI * 1.5),
    0,
    y,
    0.01,
    Math.PI / 2,
    0,
    -Math.PI / 4,
    color,
    1,
    0.72,
    1
  );
}

function buildSkull(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [
    // Cranium (slightly elongated) and occipital plate
    bakePart(new THREE.SphereGeometry(0.17, 12, 9), 0, 1.78, -0.03, 0, 0, 0, CHROME_MID, 0.95, 1.08, 1.12),
    ball(0, 1.71, -0.115, 0.11, CHROME_MID, 1, 0.9, 0.8),
    // Tapered face plate: wide at the brow, narrow at the jaw
    bakePart(new THREE.CylinderGeometry(0.15, 0.085, 0.24, 8), 0, 1.64, 0.055, 0, Math.PI / 8, 0, CHROME, 1, 1, 0.78),
    // Heavy brow ridge
    box(0.29, 0.04, 0.11, 0, 1.745, 0.11, CHROME, 0.18),
    box(0.1, 0.035, 0.1, -0.085, 1.76, 0.115, CHROME, 0.18, 0, 0.18),
    box(0.1, 0.035, 0.1, 0.085, 1.76, 0.115, CHROME, 0.18, 0, -0.18),
    // Deep round eye sockets
    bakePart(new THREE.CylinderGeometry(0.052, 0.058, 0.09, 14), -0.072, 1.7, 0.115, Math.PI / 2, 0, 0, SOCKET),
    bakePart(new THREE.CylinderGeometry(0.052, 0.058, 0.09, 14), 0.072, 1.7, 0.115, Math.PI / 2, 0, 0, SOCKET),
    // Inverted triangular nasal cavity
    bakePart(new THREE.ConeGeometry(0.03, 0.075, 3), 0, 1.635, 0.155, Math.PI, 0, 0, SOCKET),
    // Cheekbones
    box(0.045, 0.07, 0.12, -0.125, 1.645, 0.085, CHROME, 0, 0.35, 0),
    box(0.045, 0.07, 0.12, 0.125, 1.645, 0.085, CHROME, 0, -0.35, 0),
    // Maxilla, mouth cavity
    box(0.13, 0.04, 0.1, 0, 1.6, 0.115, CHROME_MID),
    box(0.12, 0.035, 0.09, 0, 1.558, 0.115, SOCKET),
    // Lower jaw and chin
    box(0.15, 0.05, 0.14, 0, 1.505, 0.095, CHROME, 0.12),
    box(0.07, 0.04, 0.05, 0, 1.47, 0.17, CHROME_MID)
  ];

  // Upper and lower tooth rows
  for (let i = 0; i < 6; i++) {
    parts.push(box(0.016, 0.03, 0.02, -0.055 + i * 0.022, 1.582, 0.158, TEETH));
  }
  for (let i = 0; i < 4; i++) {
    parts.push(box(0.016, 0.024, 0.02, -0.033 + i * 0.022, 1.535, 0.15, TEETH));
  }

  // Cheek hydraulics
  parts.push(limb([-0.115, 1.6, 0.0], [-0.09, 1.52, 0.04], 0.012, 0.012, STEEL, 6));
  parts.push(limb([0.115, 1.6, 0.0], [0.09, 1.52, 0.04], 0.012, 0.012, STEEL, 6));
  return parts;
}

function buildTorso(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [
    // Neck: stacked vertebrae and two hydraulic rods
    bakePart(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 8), 0, 1.44, -0.02, 0, 0, 0, CHROME_MID),
    bakePart(new THREE.CylinderGeometry(0.048, 0.052, 0.03, 8), 0, 1.41, -0.02, 0, 0, 0, STEEL),
    bakePart(new THREE.CylinderGeometry(0.046, 0.05, 0.03, 8), 0, 1.38, -0.02, 0, 0, 0, CHROME_MID),
    limb([-0.06, 1.37, 0.03], [-0.04, 1.47, 0.03], 0.012, 0.012, CHROME, 6),
    limb([0.06, 1.37, 0.03], [0.04, 1.47, 0.03], 0.012, 0.012, CHROME, 6),

    // Clavicle yoke and shoulder ball joints
    bakePart(new THREE.CylinderGeometry(0.028, 0.028, 0.64, 8), 0, 1.35, 0, 0, 0, Math.PI / 2, CHROME),
    box(0.3, 0.05, 0.15, 0, 1.33, -0.01, CHROME_MID),
    ball(-0.35, 1.33, 0, 0.085, CHROME_MID),
    ball(0.35, 1.33, 0, 0.085, CHROME_MID),
    ball(-0.35, 1.33, 0, 0.1, STEEL, 0.55, 1, 1),
    ball(0.35, 1.33, 0, 0.1, STEEL, 0.55, 1, 1),

    // Sternum
    box(0.045, 0.3, 0.05, 0, 1.15, 0.12, CHROME),
    // Dark chest cavity gives the ribs depth
    bakePart(new THREE.CylinderGeometry(0.12, 0.09, 0.4, 8), 0, 1.13, 0, 0, 0, 0, SOCKET, 1, 1, 0.8)
  ];

  // Ribcage: five curved ribs getting smaller toward the waist
  const ribs: Array<[number, number]> = [
    [1.28, 0.165],
    [1.2, 0.18],
    [1.12, 0.18],
    [1.04, 0.16],
    [0.96, 0.14]
  ];
  ribs.forEach(([y, r], i) => parts.push(rib(y, r, i % 2 === 0 ? CHROME : CHROME_MID)));

  // Spine: stacked vertebrae running behind the ribs, with spinous processes
  for (let i = 0; i < 7; i++) {
    const y = 0.8 + i * 0.075;
    parts.push(bakePart(new THREE.CylinderGeometry(0.034, 0.036, 0.055, 6), 0, y, -0.085, 0, 0, 0, i % 2 ? STEEL : CHROME_MID));
    parts.push(box(0.02, 0.02, 0.05, 0, y, -0.13, GUNMETAL));
  }
  // Lumbar hydraulic struts
  parts.push(limb([-0.07, 0.8, 0.0], [-0.06, 0.96, 0.02], 0.016, 0.016, STEEL, 6));
  parts.push(limb([0.07, 0.8, 0.0], [0.06, 0.96, 0.02], 0.016, 0.016, STEEL, 6));

  // Pelvis and hip sockets
  parts.push(box(0.34, 0.1, 0.2, 0, 0.74, 0, CHROME));
  parts.push(box(0.12, 0.16, 0.22, 0, 0.7, 0, STEEL));
  parts.push(ball(-0.15, 0.69, 0, 0.075, CHROME_MID));
  parts.push(ball(0.15, 0.69, 0, 0.075, CHROME_MID));
  return parts;
}

function buildArmsAndRifle(): THREE.BufferGeometry[] {
  // Right arm: shoulder -> elbow -> wrist on the rifle grip. Left arm crosses to the handguard.
  const shoulderR: V3 = [0.35, 1.31, 0.0];
  const elbowR: V3 = [0.33, 1.04, 0.12];
  const wristR: V3 = [0.2, 1.0, 0.34];
  const shoulderL: V3 = [-0.35, 1.31, 0.0];
  const elbowL: V3 = [-0.33, 1.04, 0.12];
  const wristL: V3 = [0.16, 1.02, 0.56];

  const parts: THREE.BufferGeometry[] = [
    limb(shoulderR, elbowR, 0.045, 0.038, CHROME),
    limb(shoulderL, elbowL, 0.045, 0.038, CHROME),
    // Parallel hydraulic rods along the upper arms
    limb([0.39, 1.29, 0.0], [0.37, 1.06, 0.1], 0.012, 0.012, STEEL, 6),
    limb([-0.39, 1.29, 0.0], [-0.37, 1.06, 0.1], 0.012, 0.012, STEEL, 6),
    ball(elbowR[0], elbowR[1], elbowR[2], 0.055, STEEL),
    ball(elbowL[0], elbowL[1], elbowL[2], 0.055, STEEL),
    limb(elbowR, wristR, 0.038, 0.03, CHROME_MID),
    limb(elbowL, wristL, 0.038, 0.03, CHROME_MID),
    limb([elbowR[0] - 0.03, elbowR[1] + 0.02, elbowR[2] + 0.02], [wristR[0] - 0.03, wristR[1] + 0.03, wristR[2] - 0.02], 0.01, 0.01, STEEL, 6),
    limb([elbowL[0] + 0.03, elbowL[1] + 0.02, elbowL[2] + 0.02], [wristL[0] + 0.03, wristL[1] + 0.03, wristL[2] - 0.02], 0.01, 0.01, STEEL, 6),
    // Hands: palm plate and finger bars wrapped on the rifle
    box(0.07, 0.05, 0.07, wristR[0], wristR[1], wristR[2], CHROME_MID),
    box(0.07, 0.05, 0.07, wristL[0], wristL[1], wristL[2], CHROME_MID),
    box(0.012, 0.012, 0.06, wristR[0] + 0.03, wristR[1] - 0.04, wristR[2] + 0.02, CHROME),
    box(0.012, 0.012, 0.06, wristR[0] - 0.03, wristR[1] - 0.04, wristR[2] + 0.02, CHROME),
    box(0.012, 0.012, 0.06, wristL[0] + 0.03, wristL[1] - 0.04, wristL[2] + 0.02, CHROME),
    box(0.012, 0.012, 0.06, wristL[0] - 0.03, wristL[1] - 0.04, wristL[2] + 0.02, CHROME),

    // Westinghouse M-25 40W phased plasma rifle: receiver, cooling shroud with rings, barrel, stock, magazine
    box(0.09, 0.13, 0.56, 0.18, 1.0, 0.38, GUNMETAL, 0, -0.08, 0),
    box(0.05, 0.03, 0.4, 0.18, 1.08, 0.4, STEEL, 0, -0.08, 0),
    bakePart(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), 0.17, 1.03, 0.62, Math.PI / 2, 0, 0, CHROME_MID),
    bakePart(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), 0.17, 1.03, 0.84, Math.PI / 2, 0, 0, STEEL),
    box(0.07, 0.11, 0.18, 0.2, 0.99, 0.08, GUNMETAL, 0, -0.08, 0),
    box(0.06, 0.15, 0.09, 0.18, 0.89, 0.42, SOCKET, 0.2, -0.08, 0)
  ];
  for (let i = 0; i < 4; i++) {
    parts.push(bakePart(new THREE.CylinderGeometry(0.036, 0.036, 0.018, 8), 0.17, 1.03, 0.5 + i * 0.075, Math.PI / 2, 0, 0, STEEL));
  }
  return parts;
}

/** Skull, torso, arms and rifle (static part of the model). */
export function buildEndoChassis(): THREE.BufferGeometry {
  return mergeParts([...buildSkull(), ...buildTorso(), ...buildArmsAndRifle()]);
}

/** One leg, built around the hip so rotation.x swings it. side is the x offset (-0.15 / 0.15). */
export function buildEndoLeg(side: number): THREE.BufferGeometry {
  const s = side;
  return mergeParts([
    ball(s, 0, 0, 0.07, CHROME_MID),
    // Thigh with parallel piston and cable
    limb([s, -0.02, 0], [s, -0.34, 0.02], 0.062, 0.05, CHROME),
    limb([s, -0.05, -0.065], [s, -0.31, -0.05], 0.014, 0.014, STEEL, 6),
    limb([s + (s < 0 ? -0.045 : 0.045), -0.05, 0.03], [s + (s < 0 ? -0.04 : 0.04), -0.3, 0.04], 0.008, 0.008, GUNMETAL, 5),
    // Knee: joint drum and kneecap plate
    ball(s, -0.35, 0.015, 0.068, CHROME_MID),
    box(0.075, 0.075, 0.035, s, -0.35, 0.075, CHROME, -0.15),
    // Shin with rear piston
    limb([s, -0.36, 0.01], [s, -0.6, 0.0], 0.048, 0.036, CHROME),
    limb([s, -0.38, -0.06], [s, -0.6, -0.05], 0.013, 0.013, STEEL, 6),
    // Ankle and foot: flat steel plate, toe wedge, heel spur
    ball(s, -0.615, 0.0, 0.042, STEEL),
    box(0.1, 0.035, 0.2, s, -0.655, 0.05, CHROME_MID),
    box(0.08, 0.03, 0.06, s, -0.66, 0.17, CHROME, 0.2),
    box(0.05, 0.05, 0.05, s, -0.63, -0.07, GUNMETAL)
  ]);
}

/** Glowing red optics and the plasma chamber strip (emissive). */
export function buildEndoOptics(): THREE.BufferGeometry {
  return mergeParts([
    bakePart(new THREE.SphereGeometry(0.024, 10, 8), -0.072, 1.7, 0.135, 0, 0, 0, 0xff0000),
    bakePart(new THREE.SphereGeometry(0.024, 10, 8), 0.072, 1.7, 0.135, 0, 0, 0, 0xff0000),
    // Faint glow bars inside the sockets so the eyes read from far away
    bakePart(new THREE.BoxGeometry(0.04, 0.012, 0.012), -0.072, 1.7, 0.158, 0, 0, 0, 0xff3030),
    bakePart(new THREE.BoxGeometry(0.04, 0.012, 0.012), 0.072, 1.7, 0.158, 0, 0, 0, 0xff3030),
    // M-25 plasma chamber strip
    bakePart(new THREE.BoxGeometry(0.098, 0.035, 0.2), 0.18, 1.065, 0.46, 0, -0.08, 0, 0xd400ff)
  ]);
}
