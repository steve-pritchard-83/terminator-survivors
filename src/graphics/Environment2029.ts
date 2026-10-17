import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures';
import { bakePart, mergeParts } from './meshes/geometryUtils';
import type { IEnvironment } from './environments/IEnvironment';
import { disposeObject3D } from './dispose';

interface Chunk {
  x: number;
  z: number;
  group: THREE.Group;
}

export class Environment2029 implements IEnvironment {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private readonly chunkSize = 75;
  private readonly chunks: Chunk[] = [];
  private readonly groundGeo: THREE.PlaneGeometry;
  private readonly groundMat: THREE.MeshStandardMaterial;

  private readonly skullInstancedMesh: THREE.InstancedMesh;
  private readonly rebarInstancedMesh: THREE.InstancedMesh;
  private readonly carInstancedMesh: THREE.InstancedMesh;
  private readonly hedgehogInstancedMesh: THREE.InstancedMesh;
  private readonly rubbleInstancedMesh: THREE.InstancedMesh;
  private readonly craterInstancedMesh: THREE.InstancedMesh;
  private readonly skylineRing: THREE.Group;
  private readonly horizonBeams: THREE.Mesh[] = [];
  private readonly fogMistGroup: THREE.Group;
  private readonly fogPatches: Array<{
    mesh: THREE.Mesh;
    ox: number;
    oz: number;
    speed: number;
    phase: number;
  }> = [];
  private fogTime = 0;

  constructor() {
    this.groundGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 24, 24);
    this.groundGeo.rotateX(-Math.PI / 2);

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x485e78,
      map: ProceduralTextures.getWastelandGroundAlbedo(),
      bumpMap: ProceduralTextures.getWastelandGroundBump(),
      bumpScale: 0.2,
      roughness: 0.88,
      metalness: 0.08
    });

    // 1. Build dark, earthy half-buried skull remnants (blends into soil, never looks like XP drops)
    const boneWeathered = 0x524a42;
    const boneShadow = 0x3b352f;
    const socketVoid = 0x0c0e12;

    const skullParts: THREE.BufferGeometry[] = [
      // Cranium vault
      bakePart(new THREE.SphereGeometry(0.14, 10, 8), 0, 0.12, -0.02, 0, 0, 0, boneWeathered),
      // Brow ridge & cheekbones
      bakePart(new THREE.BoxGeometry(0.2, 0.05, 0.12), 0, 0.14, 0.07, 0.1, 0, 0, boneWeathered),
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
      bakePart(
        new THREE.CylinderGeometry(1.15, 1.35, 0.55, 8),
        0,
        0.27,
        0,
        0,
        Math.PI / 8,
        0,
        concreteDark
      ),
      bakePart(
        new THREE.BoxGeometry(1.8, 0.32, 1.4),
        0.25,
        0.16,
        -0.2,
        0.12,
        0.4,
        -0.08,
        concreteMid
      ),
      bakePart(
        new THREE.BoxGeometry(1.4, 0.28, 1.6),
        -0.3,
        0.14,
        0.25,
        -0.1,
        -0.3,
        0.12,
        concreteDark
      ),
      bakePart(new THREE.CylinderGeometry(0.78, 0.92, 2.2, 8), 0, 1.5, 0, 0, 0, 0, concreteMid),
      bakePart(new THREE.BoxGeometry(1.42, 2.0, 0.36), 0, 1.5, 0, 0, 0, 0, concreteLight),
      bakePart(new THREE.BoxGeometry(0.36, 2.0, 1.42), 0, 1.5, 0, 0, 0, 0, concreteLight),
      bakePart(
        new THREE.BoxGeometry(1.15, 1.1, 1.05),
        -0.08,
        2.95,
        0.05,
        0.06,
        0.2,
        -0.05,
        concreteMid
      ),
      bakePart(
        new THREE.BoxGeometry(0.85, 0.85, 0.8),
        0.12,
        3.65,
        -0.08,
        -0.12,
        0.5,
        0.08,
        concreteDark
      ),
      bakePart(new THREE.BoxGeometry(0.32, 2.6, 0.32), 0, 3.3, 0, 0.04, 0, 0.03, rustedSteel),
      bakePart(
        new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6),
        -0.32,
        4.2,
        -0.22,
        0.22,
        0,
        0.28,
        rustedSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6),
        0.28,
        4.4,
        0.22,
        -0.28,
        0,
        -0.18,
        rustedSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6),
        0.05,
        4.1,
        0.32,
        0.38,
        0,
        0.12,
        rustedSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6),
        -0.22,
        4.0,
        0.26,
        -0.18,
        0,
        0.35,
        rustedSteel
      )
    ];
    const rebarGeo = mergeParts(rebarParts);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.1
    });

    // 3. Build detailed 1980s Burnt-Out Sedan Wreckage (matte scorched steel, no harsh glints)
    const bodyPaint = 0x384758;
    const bodyScorched = 0x242e3a;
    const cabinInterior = 0x0c1016;
    const chromeTrim = 0x5c6c7c;
    const tireRubber = 0x14181e;

    const carParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.BoxGeometry(1.96, 0.52, 4.3), 0, 0.46, 0, 0, 0, 0, bodyPaint),
      bakePart(new THREE.BoxGeometry(1.86, 0.18, 1.35), 0, 0.74, 1.38, 0.08, 0, 0.03, bodyScorched),
      bakePart(new THREE.BoxGeometry(1.7, 0.24, 1.15), 0, 0.64, 1.4, 0, 0, 0, cabinInterior),
      bakePart(new THREE.BoxGeometry(1.88, 0.2, 1.05), 0, 0.74, -1.55, -0.05, 0, 0, bodyPaint),
      bakePart(new THREE.BoxGeometry(2.06, 0.2, 0.22), 0, 0.34, 2.18, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(2.06, 0.2, 0.22), 0, 0.34, -2.18, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(1.4, 0.24, 0.12), 0, 0.56, 2.14, 0, 0, 0, cabinInterior),
      bakePart(new THREE.BoxGeometry(0.28, 0.16, 0.12), -0.72, 0.58, 2.14, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(0.28, 0.16, 0.12), 0.72, 0.58, 2.14, 0, 0, 0, chromeTrim),
      bakePart(new THREE.BoxGeometry(1.56, 0.48, 1.72), 0, 0.94, -0.12, 0, 0, 0, cabinInterior),
      bakePart(new THREE.BoxGeometry(1.62, 0.1, 1.65), 0, 1.22, -0.15, 0.04, 0, -0.04, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.1, 0.56, 0.12), -0.78, 0.96, 0.68, -0.45, 0, 0.1, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.1, 0.56, 0.12), 0.78, 0.96, 0.68, -0.45, 0, -0.1, bodyPaint),
      bakePart(new THREE.BoxGeometry(0.1, 0.52, 0.14), -0.8, 0.96, -0.12, 0, 0, 0.08, bodyScorched),
      bakePart(new THREE.BoxGeometry(0.1, 0.52, 0.14), 0.8, 0.96, -0.12, 0, 0, -0.08, bodyScorched),
      bakePart(
        new THREE.BoxGeometry(0.12, 0.56, 0.22),
        -0.78,
        0.96,
        -0.92,
        0.42,
        0,
        0.1,
        bodyPaint
      ),
      bakePart(
        new THREE.BoxGeometry(0.12, 0.56, 0.22),
        0.78,
        0.96,
        -0.92,
        0.42,
        0,
        -0.1,
        bodyPaint
      ),
      bakePart(
        new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
        -0.98,
        0.36,
        1.32,
        0,
        0,
        Math.PI / 2,
        tireRubber
      ),
      bakePart(
        new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
        -0.98,
        0.36,
        1.32,
        0,
        0,
        Math.PI / 2,
        chromeTrim
      ),
      bakePart(
        new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
        0.98,
        0.36,
        1.32,
        0,
        0,
        Math.PI / 2,
        tireRubber
      ),
      bakePart(
        new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
        0.98,
        0.36,
        1.32,
        0,
        0,
        Math.PI / 2,
        chromeTrim
      ),
      bakePart(
        new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
        -0.98,
        0.36,
        -1.32,
        0,
        0,
        Math.PI / 2,
        tireRubber
      ),
      bakePart(
        new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
        -0.98,
        0.36,
        -1.32,
        0,
        0,
        Math.PI / 2,
        chromeTrim
      ),
      bakePart(
        new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12),
        0.98,
        0.36,
        -1.32,
        0,
        0,
        Math.PI / 2,
        tireRubber
      ),
      bakePart(
        new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
        0.98,
        0.36,
        -1.32,
        0,
        0,
        Math.PI / 2,
        chromeTrim
      )
    ];
    const carGeo = mergeParts(carParts);
    const carMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.28,
      roughness: 0.68
    });

    // 4. Build Anti-Tank Czech Hedgehogs (welded rusted steel I-beams)
    const ironRusted = 0x3d302a;
    const ironDark = 0x241d1a;
    const ironEdge = 0x4e3e36;
    const hedgehogParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.BoxGeometry(0.16, 0.16, 2.2), 0, 0.65, 0, 0.62, 0.45, 0, ironRusted),
      bakePart(new THREE.BoxGeometry(0.24, 0.04, 2.18), 0, 0.65, 0, 0.62, 0.45, 0, ironEdge),
      bakePart(new THREE.BoxGeometry(0.16, 0.16, 2.2), 0, 0.65, 0, -0.62, -0.45, 0, ironRusted),
      bakePart(new THREE.BoxGeometry(0.24, 0.04, 2.18), 0, 0.65, 0, -0.62, -0.45, 0, ironEdge),
      bakePart(new THREE.BoxGeometry(0.16, 2.2, 0.16), 0, 0.65, 0, 0, 0.78, 0.55, ironDark),
      bakePart(new THREE.BoxGeometry(0.36, 0.36, 0.36), 0, 0.65, 0, 0, 0.3, 0, ironDark)
    ];
    const hedgehogGeo = mergeParts(hedgehogParts);
    const hedgehogMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.78,
      roughness: 0.42
    });

    // 5. Build Shattered Concrete Foundation Ruins & Rubble Slabs with rebar
    const slabDark = 0x28333e;
    const slabMid = 0x3e4e5e;
    const slabCracked = 0x323f4c;
    const rebarRust = 0x3e2a22;
    const rubbleParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.BoxGeometry(2.4, 0.38, 1.8), 0, 0.28, 0, 0.22, 0.35, -0.12, slabMid),
      bakePart(new THREE.BoxGeometry(1.5, 0.45, 1.3), 0.75, 0.22, 0.45, -0.15, 0.6, 0.2, slabDark),
      bakePart(
        new THREE.BoxGeometry(0.75, 0.28, 0.65),
        -0.85,
        0.14,
        -0.65,
        0.3,
        -0.2,
        0.4,
        slabCracked
      ),
      bakePart(
        new THREE.BoxGeometry(0.55, 0.22, 0.55),
        0.3,
        0.11,
        -0.8,
        -0.2,
        0.5,
        -0.3,
        slabCracked
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6),
        -0.75,
        0.7,
        0.3,
        0.4,
        0,
        0.5,
        rebarRust
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6),
        0.55,
        0.75,
        -0.4,
        -0.5,
        0.3,
        -0.3,
        rebarRust
      )
    ];
    const rubbleGeo = mergeParts(rubbleParts);
    const rubbleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.12
    });

    // 6. Build Scorched Blast Craters with glowing ember core
    const ashBlack = 0x12171e;
    const scorchDark = 0x1a212a;
    const emberRed = 0xff3b11;
    const emberAmber = 0xff8800;
    const craterParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.CylinderGeometry(2.1, 2.45, 0.14, 12), 0, 0.07, 0, 0, 0, 0, scorchDark),
      bakePart(new THREE.CylinderGeometry(1.5, 1.95, 0.1, 12), 0, 0.04, 0, 0, 0, 0, ashBlack),
      bakePart(new THREE.CylinderGeometry(0.65, 0.95, 0.05, 10), 0, 0.02, 0, 0, 0, 0, emberRed),
      bakePart(new THREE.BoxGeometry(0.42, 0.05, 0.42), 0, 0.03, 0, 0, 0.5, 0, emberAmber)
    ];
    const craterGeo = mergeParts(craterParts);
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.15
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

    const totalHedgehogs = 60;
    this.hedgehogInstancedMesh = new THREE.InstancedMesh(hedgehogGeo, hedgehogMat, totalHedgehogs);
    this.hedgehogInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.hedgehogInstancedMesh.frustumCulled = false;

    const totalRubble = 65;
    this.rubbleInstancedMesh = new THREE.InstancedMesh(rubbleGeo, rubbleMat, totalRubble);
    this.rubbleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rubbleInstancedMesh.frustumCulled = false;

    const totalCraters = 50;
    this.craterInstancedMesh = new THREE.InstancedMesh(craterGeo, craterMat, totalCraters);
    this.craterInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.craterInstancedMesh.frustumCulled = false;

    this.group.add(
      this.skullInstancedMesh,
      this.rebarInstancedMesh,
      this.carInstancedMesh,
      this.hedgehogInstancedMesh,
      this.rubbleInstancedMesh,
      this.craterInstancedMesh
    );

    // 7. Drifting Volumetric Low-Lying Ground Fog / Smoke Layers (moonlit blue-gray mist)
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

    // 8. Distant Ruined Wasteland Skyline Ring with searchlights
    this.skylineRing = new THREE.Group();
    const refineryMat = new THREE.MeshBasicMaterial({ color: 0x050b16 });
    const ruinedSteelMat = new THREE.MeshBasicMaterial({ color: 0x0a1422 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });

    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2;
      const dist = 115 + (i % 3) * 8;
      const height = 14 + (i % 7) * 4.5 + Math.random() * 8;
      const width = 4 + (i % 4) * 3;
      const depth = 4 + (i % 3) * 2;

      const towerGroup = new THREE.Group();
      towerGroup.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);

      const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), refineryMat);
      towerGroup.add(tower);

      if (height > 22) {
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.12, 6, 6),
          ruinedSteelMat
        );
        antenna.position.set(0, height / 2 + 3, 0);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), beaconMat);
        beacon.position.set(0, height / 2 + 6, 0);
        towerGroup.add(antenna, beacon);
      } else if (i % 3 === 0) {
        const roofSlab = new THREE.Mesh(
          new THREE.BoxGeometry(width * 1.1, 0.6, depth * 1.1),
          ruinedSteelMat
        );
        roofSlab.position.set(0, height / 2 + 0.2, 0);
        roofSlab.rotation.z = (Math.random() - 0.5) * 0.35;
        towerGroup.add(roofSlab);
      }

      this.skylineRing.add(towerGroup);
    }

    // Distant sweeping Sky-Searchlights scanning cloud horizon
    const beamGeo = new THREE.CylinderGeometry(0.6, 5.0, 95, 8);
    beamGeo.rotateX(Math.PI / 2.7);
    const searchBeamMat = new THREE.MeshBasicMaterial({
      color: 0x3d78b8,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    for (let s = 0; s < 2; s++) {
      const beam = new THREE.Mesh(beamGeo, searchBeamMat);
      const angle = s * Math.PI + 0.7;
      beam.position.set(Math.cos(angle) * 110, 22, Math.sin(angle) * 110);
      this.skylineRing.add(beam);
      this.horizonBeams.push(beam);
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
    let hedgehogIdx = 0;
    let rubbleIdx = 0;
    let craterIdx = 0;

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

      // 4. Anti-Tank Czech Hedgehogs (Obstacles)
      for (let h = 0; h < 6; h++) {
        if (hedgehogIdx >= 60) break;
        const hx = originX + (rng(h * 5 + 70) - 0.5) * (this.chunkSize - 16);
        const hz = originZ + (rng(h * 5 + 71) - 0.5) * (this.chunkSize - 16);

        dummy.position.set(hx, 0, hz);
        dummy.rotation.set(0, rng(h * 3) * Math.PI * 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.hedgehogInstancedMesh.setMatrixAt(hedgehogIdx++, dummy.matrix);
        this.obstacleColliders.push({ x: hx, z: hz, radius: 1.15 });
      }

      // 5. Shattered Concrete Foundation Rubble Slabs (Obstacles)
      for (let rb = 0; rb < 7; rb++) {
        if (rubbleIdx >= 65) break;
        const rbx = originX + (rng(rb * 7 + 85) - 0.5) * (this.chunkSize - 14);
        const rbz = originZ + (rng(rb * 7 + 86) - 0.5) * (this.chunkSize - 14);

        dummy.position.set(rbx, 0, rbz);
        dummy.rotation.set(0, rng(rb * 4) * Math.PI * 2, (rng(rb) - 0.5) * 0.1);
        const sc = 0.85 + rng(rb * 2) * 0.35;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        this.rubbleInstancedMesh.setMatrixAt(rubbleIdx++, dummy.matrix);
        this.obstacleColliders.push({ x: rbx, z: rbz, radius: 1.35 * sc });
      }

      // 6. Smoldering Blast Craters & Ember Pits (Detailed terrain relief)
      for (let cr = 0; cr < 5; cr++) {
        if (craterIdx >= 50) break;
        const crx = originX + (rng(cr * 8 + 110) - 0.5) * (this.chunkSize - 12);
        const crz = originZ + (rng(cr * 8 + 111) - 0.5) * (this.chunkSize - 12);

        dummy.position.set(crx, 0, crz);
        dummy.rotation.set(0, rng(cr * 5) * Math.PI * 2, 0);
        const sc = 0.8 + rng(cr * 3) * 0.45;
        dummy.scale.set(sc, 1, sc);
        dummy.updateMatrix();
        this.craterInstancedMesh.setMatrixAt(craterIdx++, dummy.matrix);
      }
    }

    this.skullInstancedMesh.count = skullIdx;
    this.rebarInstancedMesh.count = rebarIdx;
    this.carInstancedMesh.count = carIdx;
    this.hedgehogInstancedMesh.count = hedgehogIdx;
    this.rubbleInstancedMesh.count = rubbleIdx;
    this.craterInstancedMesh.count = craterIdx;
    this.skullInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rebarInstancedMesh.instanceMatrix.needsUpdate = true;
    this.carInstancedMesh.instanceMatrix.needsUpdate = true;
    this.hedgehogInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rubbleInstancedMesh.instanceMatrix.needsUpdate = true;
    this.craterInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  public update(playerX: number, playerZ: number): void {
    this.fogTime += 0.016;
    const curChunkX = Math.round(playerX / this.chunkSize);
    const curChunkZ = Math.round(playerZ / this.chunkSize);

    // Follow skyline ring and animate drifting ground fog and sweeping horizon searchlights
    this.skylineRing.position.set(playerX, 0, playerZ);
    this.fogMistGroup.position.set(playerX, 0, playerZ);
    for (let i = 0; i < this.fogPatches.length; i++) {
      const p = this.fogPatches[i];
      p.mesh.position.x = p.ox + Math.sin(this.fogTime * p.speed + p.phase) * 3.5;
      p.mesh.position.z = p.oz + Math.cos(this.fogTime * p.speed * 0.8 + p.phase) * 3.5;
    }
    for (let b = 0; b < this.horizonBeams.length; b++) {
      this.horizonBeams[b].rotation.y = Math.sin(this.fogTime * 0.35 + b * 2.2) * 0.5;
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

  public dispose(): void {
    disposeObject3D(this.group);
    this.obstacleColliders.length = 0;
    this.chunks.length = 0;
  }
}
