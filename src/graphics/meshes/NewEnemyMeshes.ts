import * as THREE from 'three';
import { bakePart, mergeParts } from './geometryUtils';
import { disposeObject3D } from '../dispose';

export class T1MinigunMesh {
  public readonly group = new THREE.Group();

  constructor() {
    const trackSteel = 0x22262c;
    const armorGreen = 0x4a5246;
    const gunSteel = 0x181a1e;
    const redOptic = 0xff1744;

    const parts: THREE.BufferGeometry[] = [
      // Left tread
      bakePart(new THREE.BoxGeometry(0.35, 0.45, 1.4), -0.55, 0.22, 0, 0, 0, 0, trackSteel),
      // Right tread
      bakePart(new THREE.BoxGeometry(0.35, 0.45, 1.4), 0.55, 0.22, 0, 0, 0, 0, trackSteel),
      // Center hull
      bakePart(new THREE.BoxGeometry(0.75, 0.38, 1.1), 0, 0.35, 0, 0, 0, 0, armorGreen),
      // Turret head
      bakePart(new THREE.BoxGeometry(0.65, 0.35, 0.65), 0, 0.72, 0.05, 0, 0, 0, armorGreen),
      // Left minigun barrel
      bakePart(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), -0.42, 0.72, 0.55, Math.PI / 2, 0, 0, gunSteel),
      // Right minigun barrel
      bakePart(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), 0.42, 0.72, 0.55, Math.PI / 2, 0, 0, gunSteel),
      // Central red sensor visor
      bakePart(new THREE.BoxGeometry(0.3, 0.08, 0.06), 0, 0.74, 0.38, 0, 0, 0, redOptic)
    ];

    const geom = mergeParts(parts);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.8,
      roughness: 0.35
    });

    const mesh = new THREE.Mesh(geom, mat);
    this.group.add(mesh);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class MotoTerminatorMesh {
  public readonly group = new THREE.Group();

  constructor() {
    const tireMat = 0x141618;
    const frameRed = 0xb71c1c;
    const chrome = 0xa0acb8;
    const opticRed = 0xff0033;

    const parts: THREE.BufferGeometry[] = [
      // Front wheel
      bakePart(new THREE.CylinderGeometry(0.35, 0.35, 0.16, 12), 0, 0.35, 0.65, 0, 0, Math.PI / 2, tireMat),
      // Rear wheel
      bakePart(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 12), 0, 0.35, -0.65, 0, 0, Math.PI / 2, tireMat),
      // Main sleek frame
      bakePart(new THREE.BoxGeometry(0.32, 0.38, 1.2), 0, 0.52, 0, 0, 0, 0, frameRed),
      // Exposed hyperalloy engine
      bakePart(new THREE.BoxGeometry(0.36, 0.28, 0.5), 0, 0.38, 0, 0, 0, 0, chrome),
      // Headlight cowl
      bakePart(new THREE.ConeGeometry(0.24, 0.4, 8), 0, 0.62, 0.68, Math.PI / 2, 0, 0, frameRed),
      // Red twin sensor eyes
      bakePart(new THREE.BoxGeometry(0.18, 0.06, 0.08), 0, 0.62, 0.86, 0, 0, 0, opticRed)
    ];

    const geom = mergeParts(parts);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.85,
      roughness: 0.25
    });

    const mesh = new THREE.Mesh(geom, mat);
    this.group.add(mesh);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class HydrobotMesh {
  public readonly group = new THREE.Group();

  constructor() {
    const bodySteel = 0x3d4852;
    const jawChrome = 0x90a0b0;
    const blueSensor = 0x00e5ff;

    const parts: THREE.BufferGeometry[] = [
      // Head
      bakePart(new THREE.ConeGeometry(0.14, 0.45, 8), 0, 0.2, 0.3, Math.PI / 2, 0, 0, bodySteel),
      // Upper clamp jaw
      bakePart(new THREE.BoxGeometry(0.04, 0.04, 0.28), -0.06, 0.24, 0.5, 0, 0.2, 0, jawChrome),
      bakePart(new THREE.BoxGeometry(0.04, 0.04, 0.28), 0.06, 0.24, 0.5, 0, -0.2, 0, jawChrome),
      // Segment 1
      bakePart(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 8), 0, 0.2, 0, Math.PI / 2, 0, 0, bodySteel),
      // Segment 2
      bakePart(new THREE.CylinderGeometry(0.09, 0.12, 0.35, 8), 0, 0.2, -0.3, Math.PI / 2, 0, 0, bodySteel),
      // Tail fin
      bakePart(new THREE.BoxGeometry(0.03, 0.16, 0.25), 0, 0.2, -0.58, 0, 0, 0, jawChrome),
      // Glowing blue optic
      bakePart(new THREE.SphereGeometry(0.05, 8, 8), 0, 0.28, 0.32, 0, 0, 0, blueSensor)
    ];

    const geom = mergeParts(parts);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.9,
      roughness: 0.2
    });

    const mesh = new THREE.Mesh(geom, mat);
    this.group.add(mesh);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class AerostatMesh {
  public readonly group = new THREE.Group();

  constructor() {
    const droneWhite = 0x94a8b8;
    const thrusterDark = 0x1e242c;
    const sensorCyan = 0x00e5ff;

    const parts: THREE.BufferGeometry[] = [
      // Spherical central hull
      bakePart(new THREE.SphereGeometry(0.42, 12, 10), 0, 0, 0, 0, 0, 0, droneWhite),
      // Left fin
      bakePart(new THREE.BoxGeometry(0.35, 0.05, 0.3), -0.45, 0, 0, 0, 0, 0.3, thrusterDark),
      // Right fin
      bakePart(new THREE.BoxGeometry(0.35, 0.05, 0.3), 0.45, 0, 0, 0, 0, -0.3, thrusterDark),
      // Ventral sensor scanner
      bakePart(new THREE.CylinderGeometry(0.2, 0.24, 0.15, 10), 0, -0.38, 0, 0, 0, 0, sensorCyan),
      // Antenna
      bakePart(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), 0, 0.5, 0, 0, 0, 0, thrusterDark)
    ];

    const geom = mergeParts(parts);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.7,
      roughness: 0.3
    });

    const mesh = new THREE.Mesh(geom, mat);
    this.group.add(mesh);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class PlasmaTurretMesh {
  public readonly group = new THREE.Group();
  public readonly barrelGroup = new THREE.Group();

  constructor() {
    const bunkerConcrete = 0x3e444c;
    const turretSteel = 0x22262d;
    const plasmaCoil = 0x00e5ff;

    const baseParts: THREE.BufferGeometry[] = [
      // Hexagonal concrete bunker foundation
      bakePart(new THREE.CylinderGeometry(1.1, 1.3, 0.6, 6), 0, 0.3, 0, 0, 0, 0, bunkerConcrete),
      // Armored ring mount
      bakePart(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 12), 0, 0.65, 0, 0, 0, 0, turretSteel)
    ];

    const baseMesh = new THREE.Mesh(
      mergeParts(baseParts),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.7 })
    );
    this.group.add(baseMesh);

    const barrelParts: THREE.BufferGeometry[] = [
      // Swivel housing
      bakePart(new THREE.BoxGeometry(0.7, 0.5, 0.8), 0, 0.95, 0, 0, 0, 0, turretSteel),
      // Left barrel
      bakePart(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 8), -0.22, 0.95, 0.85, Math.PI / 2, 0, 0, turretSteel),
      // Right barrel
      bakePart(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 8), 0.22, 0.95, 0.85, Math.PI / 2, 0, 0, turretSteel),
      // Left coil glow
      bakePart(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), -0.22, 0.95, 0.7, Math.PI / 2, 0, 0, plasmaCoil),
      // Right coil glow
      bakePart(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), 0.22, 0.95, 0.7, Math.PI / 2, 0, 0, plasmaCoil)
    ];

    const barrelMesh = new THREE.Mesh(
      mergeParts(barrelParts),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.25 })
    );
    this.barrelGroup.add(barrelMesh);
    this.group.add(this.barrelGroup);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class T600MinigunnerMesh {
  public readonly group = new THREE.Group();

  constructor() {
    const rustedIron = 0x4e463e;
    const darkSteel = 0x1a1e22;
    const redOptic = 0xff0022;

    const parts: THREE.BufferGeometry[] = [
      // Heavy torso
      bakePart(new THREE.BoxGeometry(0.58, 0.7, 0.35), 0, 1.35, 0, 0, 0, 0, rustedIron),
      // Broad shoulders
      bakePart(new THREE.BoxGeometry(0.85, 0.18, 0.35), 0, 1.65, 0, 0, 0, 0, rustedIron),
      // Heavy cranium
      bakePart(new THREE.BoxGeometry(0.28, 0.3, 0.28), 0, 1.88, 0.05, 0, 0, 0, rustedIron),
      // Red optic eye
      bakePart(new THREE.BoxGeometry(0.15, 0.06, 0.06), 0, 1.88, 0.2, 0, 0, 0, redOptic),
      // Left arm support
      bakePart(new THREE.BoxGeometry(0.15, 0.6, 0.15), -0.42, 1.35, 0.1, 0.4, 0, 0, rustedIron),
      // Right arm holding minigun
      bakePart(new THREE.BoxGeometry(0.15, 0.6, 0.15), 0.42, 1.35, 0.2, -0.6, 0, 0, rustedIron),
      // Heavy rotary minigun
      bakePart(new THREE.CylinderGeometry(0.12, 0.14, 1.2, 8), 0.35, 1.15, 0.85, Math.PI / 2, 0, 0, darkSteel),
      // Ammo backpack hopper
      bakePart(new THREE.BoxGeometry(0.45, 0.5, 0.28), 0, 1.35, -0.28, 0, 0, 0, darkSteel)
    ];

    const geom = mergeParts(parts);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.75,
      roughness: 0.4
    });

    const mesh = new THREE.Mesh(geom, mat);
    this.group.add(mesh);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
