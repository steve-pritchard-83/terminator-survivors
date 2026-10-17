import * as THREE from 'three';
import type { IEnvironment, ConveyorZone, EnvironmentalHazard } from './IEnvironment';
import { disposeObject3D } from '../dispose';

export class CyberdyneEnvironment implements IEnvironment {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private readonly conveyorZones: ConveyorZone[] = [
    { x: -15, z: 0, halfWidth: 2.2, halfLength: 28, vx: 0, vz: 3.5 },
    { x: 15, z: 0, halfWidth: 2.2, halfLength: 28, vx: 0, vz: -3.5 },
    { x: 0, z: -15, halfWidth: 28, halfLength: 2.2, vx: 3.5, vz: 0 },
    { x: 0, z: 15, halfWidth: 28, halfLength: 2.2, vx: -3.5, vz: 0 }
  ];

  private readonly moltenVats: EnvironmentalHazard[] = [
    { x: -22, z: -22, radius: 4.5, damagePerSec: 35, type: 'molten_steel' },
    { x: 22, z: -22, radius: 4.5, damagePerSec: 35, type: 'molten_steel' },
    { x: -22, z: 22, radius: 4.5, damagePerSec: 35, type: 'molten_steel' },
    { x: 22, z: 22, radius: 4.5, damagePerSec: 35, type: 'molten_steel' }
  ];

  private vatMaterial: THREE.MeshStandardMaterial;
  private animTime = 0;

  constructor() {
    // 1. Factory Concrete Floor
    const floorGeo = new THREE.PlaneGeometry(160, 160, 16, 16);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 0.7,
      metalness: 0.25
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    // 2. Conveyor visual tracks
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.5,
      metalness: 0.6
    });

    for (const c of this.conveyorZones) {
      const beltGeo = new THREE.BoxGeometry(c.halfWidth * 2, 0.15, c.halfLength * 2);
      const beltMesh = new THREE.Mesh(beltGeo, beltMat);
      beltMesh.position.set(c.x, 0.08, c.z);
      this.group.add(beltMesh);
    }

    // 3. Molten Steel Vats
    this.vatMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.1
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1f2228,
      roughness: 0.8,
      metalness: 0.5
    });

    for (const v of this.moltenVats) {
      const vatGeo = new THREE.CylinderGeometry(v.radius, v.radius, 0.2, 24);
      const vatMesh = new THREE.Mesh(vatGeo, this.vatMaterial);
      vatMesh.position.set(v.x, 0.1, v.z);
      this.group.add(vatMesh);

      const rimGeo = new THREE.TorusGeometry(v.radius + 0.2, 0.25, 8, 24);
      rimGeo.rotateX(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.set(v.x, 0.2, v.z);
      this.group.add(rimMesh);
    }

    // 4. Industrial pillars and stamping presses (Obstacles)
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x4a505b,
      roughness: 0.6,
      metalness: 0.7
    });

    const pillarCoords = [
      { x: -8, z: -8 }, { x: 8, z: -8 }, { x: -8, z: 8 }, { x: 8, z: 8 },
      { x: -30, z: 0 }, { x: 30, z: 0 }, { x: 0, z: -30 }, { x: 0, z: 30 }
    ];

    for (const pt of pillarCoords) {
      const pillarGeo = new THREE.BoxGeometry(2.4, 7.0, 2.4);
      const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
      pillarMesh.position.set(pt.x, 3.5, pt.z);
      this.group.add(pillarMesh);
      this.obstacleColliders.push({ x: pt.x, z: pt.z, radius: 1.6 });
    }
  }

  public update(_px: number, _pz: number, dt = 0.016): void {
    this.animTime += dt;
    this.vatMaterial.emissiveIntensity = 0.75 + Math.sin(this.animTime * 3.5) * 0.2;
  }

  public getConveyorVelocity(x: number, z: number): { vx: number; vz: number } | null {
    for (let i = 0; i < this.conveyorZones.length; i++) {
      const c = this.conveyorZones[i];
      if (
        Math.abs(x - c.x) <= c.halfWidth &&
        Math.abs(z - c.z) <= c.halfLength
      ) {
        return { vx: c.vx, vz: c.vz };
      }
    }
    return null;
  }

  public getHazardDamage(x: number, z: number, dt: number, isPlayer: boolean): number {
    for (let i = 0; i < this.moltenVats.length; i++) {
      const v = this.moltenVats[i];
      const dx = x - v.x;
      const dz = z - v.z;
      if (dx * dx + dz * dz <= v.radius * v.radius) {
        // Player takes slightly mitigated damage, enemies take full vat heat
        const rate = isPlayer ? v.damagePerSec * 0.5 : v.damagePerSec;
        return rate * dt;
      }
    }
    return 0;
  }

  public dispose(): void {
    disposeObject3D(this.group);
    this.obstacleColliders.length = 0;
  }
}
