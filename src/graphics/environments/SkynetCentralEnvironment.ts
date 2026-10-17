import * as THREE from 'three';
import type { IEnvironment } from './IEnvironment';
import { disposeObject3D } from '../dispose';

export class SkynetCentralEnvironment implements IEnvironment {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private readonly laserMat: THREE.MeshStandardMaterial;
  private readonly coreRingMat: THREE.MeshStandardMaterial;
  private readonly coreMesh: THREE.Mesh;
  private animTime = 0;
  private isLaserActive = true;

  private readonly pylons = [
    { x: -16, z: -16 },
    { x: 16, z: -16 },
    { x: 16, z: 16 },
    { x: -16, z: 16 }
  ];

  constructor() {
    // 1. Cyber-Metallic Reactor Floor
    const floorGeo = new THREE.PlaneGeometry(160, 160, 16, 16);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050e18,
      roughness: 0.25,
      metalness: 0.85
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    // 2. Central Quantum TDE Rings
    const ringGeo = new THREE.TorusGeometry(6.5, 0.35, 12, 36);
    this.coreRingMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d2ff,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.9
    });
    this.coreMesh = new THREE.Mesh(ringGeo, this.coreRingMat);
    this.coreMesh.rotation.x = Math.PI / 2;
    this.coreMesh.position.y = 1.2;
    this.group.add(this.coreMesh);

    // Central core reactor pillar
    const corePillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.8, 4.0, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a1c2a, metalness: 0.9, roughness: 0.3 })
    );
    corePillar.position.y = 2.0;
    this.group.add(corePillar);
    this.obstacleColliders.push({ x: 0, z: 0, radius: 2.8 });

    // 3. Temporal Pylons
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x132433,
      metalness: 0.8,
      roughness: 0.4
    });

    for (const p of this.pylons) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 8.0, 12), pylonMat);
      pylon.position.set(p.x, 4.0, p.z);
      this.group.add(pylon);
      this.obstacleColliders.push({ x: p.x, z: p.z, radius: 1.8 });
    }

    // 4. Laser Grid Meshes (between pylons)
    this.laserMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.85
    });

    // 4 perimeter laser beams connecting pylons: (0->1, 1->2, 2->3, 3->0)
    for (let i = 0; i < 4; i++) {
      const p1 = this.pylons[i];
      const p2 = this.pylons[(i + 1) % 4];
      const mx = (p1.x + p2.x) / 2;
      const mz = (p1.z + p2.z) / 2;
      const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, len, 8);
      const beam = new THREE.Mesh(beamGeo, this.laserMat);
      beam.position.set(mx, 1.5, mz);
      // Align rotation
      if (Math.abs(p2.x - p1.x) > Math.abs(p2.z - p1.z)) {
        beam.rotation.z = Math.PI / 2;
      } else {
        beam.rotation.x = Math.PI / 2;
      }
      this.group.add(beam);
    }
  }

  public update(_px: number, _pz: number, dt = 0.016): void {
    this.animTime += dt;
    this.coreMesh.rotation.z += dt * 0.8;
    this.coreMesh.rotation.y += dt * 0.4;

    // Laser grid oscillates on/off in 6s cycles: 3.5s active, 2.5s charge/inactive
    const cycle = this.animTime % 6.0;
    this.isLaserActive = cycle < 3.5;
    this.laserMat.opacity = this.isLaserActive ? 0.85 + Math.sin(this.animTime * 20) * 0.15 : 0.15;
    this.laserMat.emissiveIntensity = this.isLaserActive ? 2.0 : 0.3;
  }

  public getHazardDamage(x: number, z: number, dt: number, _isPlayer: boolean): number {
    if (!this.isLaserActive) return 0;

    // Laser barrier lines at |x| = 16 or |z| = 16 within [-16, 16]
    const onXBarrier = Math.abs(Math.abs(x) - 16) < 0.9 && Math.abs(z) <= 16;
    const onZBarrier = Math.abs(Math.abs(z) - 16) < 0.9 && Math.abs(x) <= 16;

    if (onXBarrier || onZBarrier) {
      return 45 * dt; // Rapid laser burn
    }
    return 0;
  }

  public dispose(): void {
    disposeObject3D(this.group);
    this.obstacleColliders.length = 0;
  }
}
