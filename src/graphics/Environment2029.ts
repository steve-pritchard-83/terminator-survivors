import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures';
import { bakePart, mergeParts } from './meshes/geometryUtils';

interface Chunk {
  x: number;
  z: number;
  group: THREE.Group;
}

export class Environment2029 {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private readonly chunkSize = 75;
  private readonly chunks: Chunk[] = [];
  private readonly groundGeo: THREE.PlaneGeometry;
  private readonly groundMat: THREE.MeshStandardMaterial;

  private readonly skullInstancedMesh: THREE.InstancedMesh;
  private readonly rebarInstancedMesh: THREE.InstancedMesh;
  private readonly carInstancedMesh: THREE.InstancedMesh;
  private readonly skylineRing: THREE.Group;

  constructor() {
    this.groundGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 12, 12);
    this.groundGeo.rotateX(-Math.PI / 2);

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x3b5272,
      map: ProceduralTextures.getWastelandGroundAlbedo(),
      bumpMap: ProceduralTextures.getWastelandGroundBump(),
      bumpScale: 0.14,
      roughness: 0.78,
      metalness: 0.12
    });

    // 1. Build composite skull geometry
    const skullParts: THREE.BufferGeometry[] = [
      // Cranium dome
      bakePart(new THREE.SphereGeometry(0.16, 8, 6), 0, 0.16, 0),
      // Maxilla / teeth
      bakePart(new THREE.BoxGeometry(0.14, 0.1, 0.14), 0, 0.06, 0.08),
      // Recessed dark orbital indent
      bakePart(new THREE.BoxGeometry(0.18, 0.06, 0.08), 0, 0.16, 0.12)
    ];
    const skullGeo = mergeParts(skullParts);
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0xd8e4f0, // Bright moonlit bone white
      emissive: 0x162436,
      emissiveIntensity: 0.35,
      roughness: 0.65,
      metalness: 0.12
    });

    // 2. Build composite twisted rebar & concrete pillar geometry
    const rebarParts: THREE.BufferGeometry[] = [
      // Concrete pillar core
      bakePart(new THREE.BoxGeometry(1.2, 3.8, 1.2), 0, 1.9, 0),
      // Twisted steel rebar rods extending upward
      bakePart(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), -0.3, 4.4, -0.2, 0.2, 0, 0.3),
      bakePart(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), 0.2, 4.6, 0.2, -0.3, 0, -0.2),
      bakePart(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), 0.0, 4.2, 0.3, 0.4, 0, 0.1)
    ];
    const rebarGeo = mergeParts(rebarParts);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x4e627a, // Moonlit ruined concrete
      emissive: 0x121d2b,
      emissiveIntensity: 0.4,
      roughness: 0.75,
      metalness: 0.25
    });

    // 3. Build burnt-out car wreckage geometry
    const carParts: THREE.BufferGeometry[] = [
      // Crushed sedan chassis
      bakePart(new THREE.BoxGeometry(2.0, 0.7, 4.2), 0, 0.45, 0),
      // Crushed roof cabin
      bakePart(new THREE.BoxGeometry(1.6, 0.65, 2.0), 0, 1.05, -0.2),
      // Wheel hubs
      bakePart(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), -1.0, 0.35, 1.2, 0, 0, Math.PI / 2),
      bakePart(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), 1.0, 0.35, 1.2, 0, 0, Math.PI / 2),
      bakePart(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), -1.0, 0.35, -1.2, 0, 0, Math.PI / 2),
      bakePart(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), 1.0, 0.35, -1.2, 0, 0, Math.PI / 2)
    ];
    const carGeo = mergeParts(carParts);
    const carMat = new THREE.MeshStandardMaterial({
      color: 0x46586e, // Scorched steel chassis catching moonlight
      emissive: 0x101a28,
      emissiveIntensity: 0.35,
      metalness: 0.65,
      roughness: 0.38
    });

    // Instanced props across 3x3 active grid
    const totalSkulls = 2200;
    this.skullInstancedMesh = new THREE.InstancedMesh(skullGeo, skullMat, totalSkulls);
    this.skullInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const totalRebar = 90;
    this.rebarInstancedMesh = new THREE.InstancedMesh(rebarGeo, concreteMat, totalRebar);
    this.rebarInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const totalCars = 45;
    this.carInstancedMesh = new THREE.InstancedMesh(carGeo, carMat, totalCars);
    this.carInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.group.add(this.skullInstancedMesh, this.rebarInstancedMesh, this.carInstancedMesh);

    // 4. Distant Wasteland Skyline Ring
    this.skylineRing = new THREE.Group();
    const refineryMat = new THREE.MeshBasicMaterial({ color: 0x050c18 });
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const dist = 115;
      const height = 12 + Math.random() * 18;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(4 + Math.random() * 5, height, 4), refineryMat);
      tower.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
      this.skylineRing.add(tower);
    }
    this.group.add(this.skylineRing);

    // Initial 3x3 chunks
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        const chunkGroup = new THREE.Group();
        const ground = new THREE.Mesh(this.groundGeo, this.groundMat);
        chunkGroup.add(ground);
        chunkGroup.position.set(cx * this.chunkSize, 0, cz * this.chunkSize);
        this.group.add(chunkGroup);
        this.chunks.push({ x: cx, z: cz, group: chunkGroup });
      }
    }

    this.repopulateProps(0, 0);
  }

  private repopulateProps(centerChunkX: number, centerChunkZ: number): void {
    const dummy = new THREE.Object3D();
    this.obstacleColliders.length = 0;

    let skullIdx = 0;
    let rebarIdx = 0;
    let carIdx = 0;

    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const originX = c.x * this.chunkSize;
      const originZ = c.z * this.chunkSize;

      // Deterministic pseudo-random seed per chunk coordinate
      const seed = Math.sin(c.x * 12.9898 + c.z * 78.233) * 43758.5453;
      const rng = (s: number) => {
        const val = Math.sin(seed + s * 17.13) * 10000;
        return val - Math.floor(val);
      };

      // 1. Skull mounds in clusters
      for (let m = 0; m < 5; m++) {
        const moundX = originX + (rng(m * 10 + 1) - 0.5) * (this.chunkSize - 12);
        const moundZ = originZ + (rng(m * 10 + 2) - 0.5) * (this.chunkSize - 12);
        for (let s = 0; s < 45; s++) {
          if (skullIdx >= 2200) break;
          const r = rng(s * 3) * 4.5;
          const theta = rng(s * 5) * Math.PI * 2;
          const sx = moundX + Math.cos(theta) * r;
          const sz = moundZ + Math.sin(theta) * r;
          const sy = (1 - r / 4.5) * 0.45;

          dummy.position.set(sx, sy, sz);
          dummy.rotation.set(rng(s * 7) * 0.4, rng(s * 9) * Math.PI * 2, rng(s * 11) * 0.4);
          const sc = 0.85 + rng(s) * 0.35;
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          this.skullInstancedMesh.setMatrixAt(skullIdx++, dummy.matrix);
        }
      }

      // 2. Concrete Rebar Pillars (Obstacles)
      for (let r = 0; r < 8; r++) {
        if (rebarIdx >= 90) break;
        const rx = originX + (rng(r * 4 + 20) - 0.5) * (this.chunkSize - 14);
        const rz = originZ + (rng(r * 4 + 21) - 0.5) * (this.chunkSize - 14);

        dummy.position.set(rx, 0, rz);
        dummy.rotation.set(0, rng(r) * Math.PI * 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.rebarInstancedMesh.setMatrixAt(rebarIdx++, dummy.matrix);
        this.obstacleColliders.push({ x: rx, z: rz, radius: 1.1 });
      }

      // 3. Burnt-out 1980s Cars (Obstacles)
      for (let cr = 0; cr < 4; cr++) {
        if (carIdx >= 45) break;
        const cx = originX + (rng(cr * 6 + 50) - 0.5) * (this.chunkSize - 18);
        const cz = originZ + (rng(cr * 6 + 51) - 0.5) * (this.chunkSize - 18);

        dummy.position.set(cx, 0, cz);
        dummy.rotation.set(0, rng(cr * 2) * Math.PI * 2, rng(cr) * 0.1);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.carInstancedMesh.setMatrixAt(carIdx++, dummy.matrix);
        this.obstacleColliders.push({ x: cx, z: cz, radius: 1.8 });
      }
    }

    this.skullInstancedMesh.count = skullIdx;
    this.rebarInstancedMesh.count = rebarIdx;
    this.carInstancedMesh.count = carIdx;
    this.skullInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rebarInstancedMesh.instanceMatrix.needsUpdate = true;
    this.carInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  public update(playerX: number, playerZ: number): void {
    const curChunkX = Math.round(playerX / this.chunkSize);
    const curChunkZ = Math.round(playerZ / this.chunkSize);

    // Follow skyline ring with camera
    this.skylineRing.position.set(playerX, 0, playerZ);

    let needsRepopulate = false;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      let dx = c.x - curChunkX;
      let dz = c.z - curChunkZ;

      if (Math.abs(dx) > 1) {
        c.x -= Math.sign(dx) * 3;
        c.group.position.x = c.x * this.chunkSize;
        needsRepopulate = true;
      }
      if (Math.abs(dz) > 1) {
        c.z -= Math.sign(dz) * 3;
        c.group.position.z = c.z * this.chunkSize;
        needsRepopulate = true;
      }
    }

    if (needsRepopulate) {
      this.repopulateProps(curChunkX, curChunkZ);
    }
  }
}
