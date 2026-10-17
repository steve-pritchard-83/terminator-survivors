import * as THREE from 'three';
import type { IEnvironment } from './IEnvironment';
import { disposeObject3D } from '../dispose';
import { globalEvents } from '../../core/EventBus';

export class BunkerEnvironment implements IEnvironment {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private bunkerHp = 1500;
  private readonly bunkerMaxHp = 1500;
  private isBreached = false;

  private readonly beaconLight: THREE.PointLight;
  private readonly doorMesh: THREE.Mesh;
  private animTime = 0;

  constructor() {
    // 1. Reinforced Concrete Floor
    const floorGeo = new THREE.PlaneGeometry(160, 160, 16, 16);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x272c2f,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    // 2. Blast Door Structure (centered at x=0, z=-14)
    const doorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x181c20,
      metalness: 0.7,
      roughness: 0.4
    });
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(16, 6.0, 3.0), doorFrameMat);
    doorFrame.position.set(0, 3.0, -14);
    this.group.add(doorFrame);
    this.obstacleColliders.push(
      { x: -5, z: -14, radius: 2.5 },
      { x: 5, z: -14, radius: 2.5 }
    );

    // Blast Door Leaf
    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: 0x4a4f54,
      metalness: 0.85,
      roughness: 0.35
    });
    this.doorMesh = new THREE.Mesh(new THREE.BoxGeometry(7.0, 5.0, 1.2), doorLeafMat);
    this.doorMesh.position.set(0, 2.5, -14);
    this.group.add(this.doorMesh);
    this.obstacleColliders.push({ x: 0, z: -14, radius: 2.2 });

    // 3. Sandbag revetments and concrete defensive parapets
    const sandbagMat = new THREE.MeshStandardMaterial({
      color: 0x544c3d,
      roughness: 0.95,
      metalness: 0.05
    });

    const barricadeConfigs = [
      { x: -9, z: -6, w: 6.0, h: 1.2, d: 1.5 },
      { x: 9, z: -6, w: 6.0, h: 1.2, d: 1.5 },
      { x: -14, z: 4, w: 1.5, h: 1.2, d: 8.0 },
      { x: 14, z: 4, w: 1.5, h: 1.2, d: 8.0 }
    ];

    for (const bc of barricadeConfigs) {
      const barricade = new THREE.Mesh(new THREE.BoxGeometry(bc.w, bc.h, bc.d), sandbagMat);
      barricade.position.set(bc.x, bc.h / 2, bc.z);
      this.group.add(barricade);
      this.obstacleColliders.push({ x: bc.x, z: bc.z, radius: Math.max(bc.w, bc.d) / 2 });
    }

    // 4. Emergency Amber Alarm Beacon
    this.beaconLight = new THREE.PointLight(0xff9900, 1.8, 22);
    this.beaconLight.position.set(0, 6.2, -13.5);
    this.group.add(this.beaconLight);
  }

  public update(_px: number, _pz: number, dt = 0.016): void {
    this.animTime += dt;
    // Amber rotating beacon pulse
    this.beaconLight.intensity = 1.0 + Math.sin(this.animTime * 6.0) * 0.9;
  }

  public getBunkerHealth(): { current: number; max: number } | null {
    return { current: this.bunkerHp, max: this.bunkerMaxHp };
  }

  public damageBunker(amount: number): void {
    if (this.isBreached) return;
    this.bunkerHp = Math.max(0, this.bunkerHp - amount);
    if (this.bunkerHp <= 0) {
      this.isBreached = true;
      // Breach effect: blow open the blast doors
      this.doorMesh.position.y = -10; // collapse/remove
      globalEvents.emit('camera:shake', { trauma: 0.75 });
    }
  }

  public dispose(): void {
    disposeObject3D(this.group);
    this.obstacleColliders.length = 0;
  }
}
