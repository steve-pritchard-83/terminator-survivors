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
  private readonly fogMistGroup: THREE.Group;
  private readonly fogPatches: Array<{ mesh: THREE.Mesh; ox: number; oz: number; speed: number; phase: number }> = [];
  private fogTime = 0;

  constructor() {
    this.groundGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 12, 12);
    this.groundGeo.rotateX(-Math.PI / 2);

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x485e78,
      map: ProceduralTextures.getWastelandGroundAlbedo(),
      bumpMap: ProceduralTextures.getWastelandGroundBump(),
      bumpScale: 0.12,
      roughness: 0.92,
      metalness: 0.04
    });

    // 1. Build dark, earthy half-buried skull remnants (blends into soil, never looks like XP drops)
    const boneWeathered = 0x524a42;
    const boneShadow = 0x3b352f;
    const socketVoid = 0x0c0e12;

    const skullParts: THREE.BufferGeometry[] = [
      // Cranium vault
      bakePart(new THREE.SphereGeometry(0.14, 10, 8), 0, 0.12, -0.02, 0, 0, 0, boneWeathered),
      // Brow ridge & cheekbones
      bakePart(new THREE.BoxGeometry(0.20, 0.05, 0.12), 0, 0.14, 0.07, 0.1, 0, 0, boneWeathered),
      // Deep dark eye sockets L/R
      bakePart(new THREE.SphereGeometry(0.042, 6, 6), -0.052, 0.115, 0.105, 0, 0, 0, socketVoid),
      bakePart(new THREE.SphereGeometry(0.042, 6, 6), 0.052, 0.115, 0.105, 0, 0, 0, socketVoid),
      // Dark nasal cavity
      bakePart(new THREE.BoxGeometry(0.036, 0.05, 0.06), 0, 0.08, 0.12, 0, 0, 0, socketVoid),
      // Upper maxilla & jaw
      bakePart(new THREE.BoxGeometry(0.12, 0.06, 0.12), 0, 0.04, 0.06, 0, 0, 0, boneShadow)
    ];
    const skullGeo = mergeParts(skullParts);
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0
    });

    // 2. Build detailed shattered Highway Overpass Column & Rubble Base (matte concrete)
    const concreteMid = 0x3d4b5a;
    const concreteDark = 0x26303a;
    const concreteLight = 0x4d5d70;
    const rustedSteel = 0x3d2e28;

    const rebarParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.CylinderGeometry(1.15, 1.35, 0.55, 8), 0, 0.27, 0, 0, Math.PI / 8, 0, concreteDark),
      bakePart(new THREE.BoxGeometry(1.8, 0.32, 1.4), 0.25, 0.16, -0.2, 0.12, 0.4, -0.08, concreteMid),
      bakePart(new THREE.BoxGeometry(1.4, 0.28, 1.6), -0.3, 0.14, 0.25, -0.1, -0.3, 0.12, concreteDark),
      bakePart(new THREE.CylinderGeometry(0.78, 0.92, 2.2, 8), 0, 1.5, 0, 0, 0, 0, concreteMid),
      bakePart(new THREE.BoxGeometry(1.42, 2.0, 0.36), 0, 1.5, 0, 0, 0, 0, concreteLight),
      bakePart(new THREE.BoxGeometry(0.36, 2.0, 1.42), 0, 1.5, 0, 0, 0, 0, concreteLight),
      bakePart(new THREE.BoxGeometry(1.15, 1.1, 1.05), -0.08, 2.95, 0.05, 0.06, 0.2, -0.05, concreteMid),
      bakePart(new THREE.BoxGeometry(0.85, 0.85, 0.80), 0.12, 3.65, -0.08, -0.12, 0.5, 0.08, concreteDark),
      bakePart(new THREE.BoxGeometry(0.32, 2.6, 0.32), 0, 3.3, 0, 0.04, 0, 0.03, rustedSteel),
      bakePart(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6), -0.32, 4.2, -0.22, 0.22, 0, 0.28, rustedSteel),
      bakePart(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6), 0.28, 4.4, 0.22, -0.28, 0, -0.18, rustedSteel),
      bakePart(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), 0.05, 4.1, 0.32, 0.38, 0, 0.12, rustedSteel),
      bakePart(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), -0.22, 4.0, 0.26, -0.18, 0, 0.35, rustedSteel)
    ];
    const rebarGeo = mergeParts(rebarParts);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.10
    });

    // 3. Build detailed 1980s Burnt-Out Sedan Wreckage (matte scorched steel, no harsh glints)
    const bodyPaint = 0x384758;
    const bodyScorched = 0x242e3a;
    const cabinInterior = 0x0c1016;
    const chromeTrim = 0x5c6c7c;
    const tireRubber = 0x14181e;

    const carParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.BoxGeometry(1.96, 0.52, 4.30), 0, 0.46, 0, 0, 0, 0, bodyPaint),
      bakePart(new THREE.BoxGeometry(1.86, 0.18, 1.35), 0, 0.74, 1.38, 0.08, 0, 0.03, bodyScorched),
      bakePart(new THREE.BoxGeometry(1.70, 0.24, 1.15), 0, 0.64, 1.40, 0, 0, 0, cabinInterior),
      bakePart(new THREE.BoxGeometry(1.88, 0.20, 1.05), 0, 0.74, -1.55, -0.05, 0, 0, bodyPaint),
      bakePart(new THREE.BoxGeometry(2.06, 0.20, 0.22), 0, 0.34, 2.18, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(2.06, 0.20, 0.22), 0, 0.34, -2.18, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(1.40, 0.24, 0.12), 0, 0.56, 2.14, 0, 0, 0, cabinInterior),
      bakePart(new THREE.BoxGeometry(0.28, 0.16, 0.12), -0.72, 0.58, 2.14, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(0.28, 0.16, 0.12), 0.72, 0.58, 2.14, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(1.56, 0.48, 1.72), 0, 0.94, -0.12, 0, 0, 0, cabinInterior),
      bakePart(new THREE.BoxGeometry(1.62, 0.10, 1.65), 0, 1.22, -0.15, 0.04, 0, -0.04, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.10, 0.56, 0.12), -0.78, 0.96, 0.68, -0.45, 0, 0.1, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.10, 0.56, 0.12), 0.78, 0.96, 0.68, -0.45, 0, -0.1, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.10, 0.52, 0.14), -0.80, 0.96, -0.12, 0, 0, 0.08, bodyScorched),
      bakePart(new THREE.BoxGeometry(0.10, 0.52, 0.14), 0.80, 0.96, -0.12, 0, 0, -0.08, bodyScorched),
      bakePart(new THREE.BoxGeometry(0.12, 0.56, 0.22), -0.78, 0.96, -0.92, 0.42, 0, 0.1, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.12, 0.56, 0.22), 0.78, 0.96, -0.92, 0.42, 0, -0.1, bodyPaint),
      bakePart(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12), -0.98, 0.36, 1.32, 0, 0, Math.PI / 2, tireRubber),
      bakePart(new THREE.CylinderGeometry(0.20, 0.20, 0.28, 8), -0.98, 0.36, 1.32, 0, 0, Math.PI / 2, chromeTrim),
      bakePart(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12), 0.98, 0.36, 1.32, 0, 0, Math.PI / 2, tireRubber),
      bakePart(new THREE.CylinderGeometry(0.20, 0.20, 0.28, 8), 0.98, 0.36, 1.32, 0, 0, Math.PI / 2, chromeTrim),
      bakePart(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12), -0.98, 0.36, -1.32, 0, 0, Math.PI / 2, tireRubber),
      bakePart(new THREE.CylinderGeometry(0.20, 0.20, 0.28, 8), -0.98, 0.36, -1.32, 0, 0, Math.PI / 2, chromeTrim),
      bakePart(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12), 0.98, 0.36, -1.32, 0, 0, Math.PI / 2, tireRubber),
      bakePart(new THREE.CylinderGeometry(0.20, 0.20, 0.28, 8), 0.98, 0.36, -1.32, 0, 0, Math.PI / 2, chromeTrim)
    ];
    const carGeo = mergeParts(carParts);
    const carMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.28,
      roughness: 0.68
    });

    const totalSkulls = 650;
    this.skullInstancedMesh = new THREE.InstancedMesh(skullGeo, skullMat, totalSkulls);
    this.skullInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skullInstancedMesh.frustumCulled = false;

    const totalRebar = 90;
    this.rebarInstancedMesh = new THREE.InstancedMesh(rebarGeo, concreteMat, totalRebar);
    this.rebarInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rebarInstancedMesh.frustumCulled = false;

    const totalCars = 45;
    this.carInstancedMesh = new THREE.InstancedMesh(carGeo, carMat, totalCars);
    this.carInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.carInstancedMesh.frustumCulled = false;

    this.group.add(this.skullInstancedMesh, this.rebarInstancedMesh, this.carInstancedMesh);

    // 4. Drifting Volumetric Low-Lying Ground Fog / Smoke Layers (moonlit blue-gray mist)
    this.fogMistGroup = new THREE.Group();
    const mistGeo = new THREE.PlaneGeometry(16, 16);
    mistGeo.rotateX(-Math.PI / 2);
    const mistMat = new THREE.MeshBasicMaterial({
      map: ProceduralTextures.getSoftGlowSprite(),
      color: 0x4a6e96,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    for (let m = 0; m < 28; m++) {
      const mistMesh = new THREE.Mesh(mistGeo, mistMat);
      const angle = (m / 28) * Math.PI * 2;
      const dist = 6 + (m % 4) * 6.5;
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;
      mistMesh.position.set(ox, 0.35 + (m % 3) * 0.25, oz);
      const s = 0.85 + (m % 3) * 0.35;
      mistMesh.scale.set(s, 1, s);
      this.fogMistGroup.add(mistMesh);
      this.fogPatches.push({
        mesh: mistMesh,
        ox,
        oz,
        speed: 0.6 + (m % 5) * 0.25,
        phase: m * 1.1
      });
    }
    this.group.add(this.fogMistGroup);

    // 5. Distant Wasteland Skyline Ring
    this.skylineRing = new THREE.Group();
    const refineryMat = new THREE.MeshBasicMaterial({ color: 0x050b16 });
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

  private repopulateProps(_centerChunkX: number, _centerChunkZ: number): void {
    const dummy = new THREE.Object3D();
    this.obstacleColliders.length = 0;

    let skullIdx = 0;
    let rebarIdx = 0;
    let carIdx = 0;

    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const originX = c.x * this.chunkSize;
      const originZ = c.z * this.chunkSize;

      const seed = Math.sin(c.x * 12.9898 + c.z * 78.233) * 43758.5453;
      const rng = (s: number) => {
        const val = Math.sin(seed + s * 17.13) * 10000;
        return val - Math.floor(val);
      };

      // 1. Half-buried earthy skulls embedded low in the ash (subtle terrain detail)
      for (let s = 0; s < 55; s++) {
        if (skullIdx >= 650) break;
        const sx = originX + (rng(s * 3 + 1) - 0.5) * (this.chunkSize - 6);
        const sz = originZ + (rng(s * 5 + 2) - 0.5) * (this.chunkSize - 6);
        const sy = -0.04 + rng(s * 7) * 0.02;

        dummy.position.set(sx, sy, sz);
        dummy.rotation.set(
          (rng(s * 11) - 0.5) * 0.45,
          rng(s * 13) * Math.PI * 2,
          (rng(s * 17) - 0.5) * 0.45
        );
        const sc = 0.65 + rng(s * 19) * 0.22;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        this.skullInstancedMesh.setMatrixAt(skullIdx++, dummy.matrix);
      }

      // 2. Shattered Highway Overpass Columns (Obstacles)
      for (let r = 0; r < 7; r++) {
        if (rebarIdx >= 90) break;
        const rx = originX + (rng(r * 4 + 20) - 0.5) * (this.chunkSize - 14);
        const rz = originZ + (rng(r * 4 + 21) - 0.5) * (this.chunkSize - 14);

        dummy.position.set(rx, 0, rz);
        dummy.rotation.set(0, rng(r) * Math.PI * 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.rebarInstancedMesh.setMatrixAt(rebarIdx++, dummy.matrix);
        this.obstacleColliders.push({ x: rx, z: rz, radius: 1.25 });
      }

      // 3. Burnt-out 1980s Cars (Obstacles)
      for (let cr = 0; cr < 4; cr++) {
        if (carIdx >= 45) break;
        const cx = originX + (rng(cr * 6 + 50) - 0.5) * (this.chunkSize - 18);
        const cz = originZ + (rng(cr * 6 + 51) - 0.5) * (this.chunkSize - 18);

        dummy.position.set(cx, 0, cz);
        dummy.rotation.set(0, rng(cr * 2) * Math.PI * 2, (rng(cr) - 0.5) * 0.08);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.carInstancedMesh.setMatrixAt(carIdx++, dummy.matrix);
        this.obstacleColliders.push({ x: cx, z: cz, radius: 1.85 });
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
    this.fogTime += 0.016;
    const curChunkX = Math.round(playerX / this.chunkSize);
    const curChunkZ = Math.round(playerZ / this.chunkSize);

    // Follow skyline ring and animate drifting ground fog around player
    this.skylineRing.position.set(playerX, 0, playerZ);
    this.fogMistGroup.position.set(playerX, 0, playerZ);
    for (let i = 0; i < this.fogPatches.length; i++) {
      const p = this.fogPatches[i];
      p.mesh.position.x = p.ox + Math.sin(this.fogTime * p.speed + p.phase) * 3.5;
      p.mesh.position.z = p.oz + Math.cos(this.fogTime * p.speed * 0.8 + p.phase) * 3.5;
    }

    let needsRepopulate = false;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const dx = c.x - curChunkX;
      const dz = c.z - curChunkZ;

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
