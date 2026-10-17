import * as THREE from 'three';
import type { IEnvironment } from './IEnvironment';
import { disposeObject3D } from '../dispose';

export class TechNoirEnvironment implements IEnvironment {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private readonly neonMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly cruiserBeacons: THREE.PointLight[] = [];
  private animTime = 0;

  constructor() {
    // 1. Wet Asphalt Street
    const streetGeo = new THREE.PlaneGeometry(160, 160, 16, 16);
    streetGeo.rotateX(-Math.PI / 2);
    const streetMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.15, // Wet slick reflection
      metalness: 0.4
    });
    const street = new THREE.Mesh(streetGeo, streetMat);
    street.receiveShadow = true;
    this.group.add(street);

    // 2. Concrete sidewalks & curbs
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x2b3038,
      roughness: 0.85,
      metalness: 0.1
    });

    const sidewalkConfigs = [
      { x: -18, z: 0, w: 6, l: 150 },
      { x: 18, z: 0, w: 6, l: 150 }
    ];

    for (const sc of sidewalkConfigs) {
      const swGeo = new THREE.BoxGeometry(sc.w, 0.25, sc.l);
      const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
      swMesh.position.set(sc.x, 0.12, sc.z);
      this.group.add(swMesh);
    }

    // 3. Neon Club Signs (Tech Noir cyan & magenta)
    const cyanNeon = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e1ff,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const pinkNeon = new THREE.MeshStandardMaterial({
      color: 0xff0088,
      emissive: 0xff0066,
      emissiveIntensity: 1.8,
      roughness: 0.2
    });
    this.neonMaterials.push(cyanNeon, pinkNeon);

    const signGeo = new THREE.BoxGeometry(8, 2.5, 0.4);
    const cyanSign = new THREE.Mesh(signGeo, cyanNeon);
    cyanSign.position.set(-21, 5, -8);
    this.group.add(cyanSign);

    const pinkSign = new THREE.Mesh(signGeo, pinkNeon);
    pinkSign.position.set(-21, 8, -8);
    this.group.add(pinkSign);

    // 4. Police Cruisers (LAPD) & Light Beacons
    const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.3, metalness: 0.8 });
    const carWhiteMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });

    const cruiserPositions = [
      { x: -9, z: -16, angle: 0.25 },
      { x: 11, z: 12, angle: -0.4 },
      { x: -10, z: 24, angle: 0.15 },
      { x: 12, z: -28, angle: -0.2 }
    ];

    for (const cp of cruiserPositions) {
      const carGroup = new THREE.Group();
      carGroup.position.set(cp.x, 0, cp.z);
      carGroup.rotation.y = cp.angle;

      // Chassis
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 4.8), carBodyMat);
      chassis.position.y = 0.55;
      carGroup.add(chassis);

      // White doors
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.75, 2.0), carWhiteMat);
      doorMesh.position.y = 0.58;
      carGroup.add(doorMesh);

      // Light bar beacon
      const beaconLight = new THREE.PointLight(0xff0022, 1.2, 14);
      beaconLight.position.set(0, 1.4, 0);
      carGroup.add(beaconLight);
      this.cruiserBeacons.push(beaconLight);

      this.group.add(carGroup);
      this.obstacleColliders.push({ x: cp.x, z: cp.z, radius: 2.2 });
    }

    // 5. Street Light Poles and Dumpsters
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x333842, metalness: 0.9, roughness: 0.4 });
    const lampCoords = [
      { x: -16, z: -25 }, { x: -16, z: 0 }, { x: -16, z: 25 },
      { x: 16, z: -25 }, { x: 16, z: 0 }, { x: 16, z: 25 }
    ];

    for (const lc of lampCoords) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6, 8), metalMat);
      pole.position.set(lc.x, 3, lc.z);
      this.group.add(pole);
      this.obstacleColliders.push({ x: lc.x, z: lc.z, radius: 0.6 });
    }
  }

  public update(_px: number, _pz: number, dt = 0.016): void {
    this.animTime += dt;
    // Neon flicker
    const flicker = 1.4 + Math.sin(this.animTime * 18.0) * 0.15 + (Math.sin(this.animTime * 3.5) > 0.8 ? 0.3 : 0);
    for (const mat of this.neonMaterials) {
      mat.emissiveIntensity = flicker;
    }

    // Flashing alternating LAPD red/blue sirens
    const phase = Math.sin(this.animTime * 8.0);
    for (let i = 0; i < this.cruiserBeacons.length; i++) {
      const beacon = this.cruiserBeacons[i];
      const isRed = (i % 2 === 0 ? phase > 0 : phase <= 0);
      beacon.color.setHex(isRed ? 0xff0033 : 0x0055ff);
      beacon.intensity = Math.abs(phase) * 1.5;
    }
  }

  public dispose(): void {
    disposeObject3D(this.group);
    this.obstacleColliders.length = 0;
    this.neonMaterials.length = 0;
    this.cruiserBeacons.length = 0;
  }
}
