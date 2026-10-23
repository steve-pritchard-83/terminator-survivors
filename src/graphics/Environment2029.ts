import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures';
import { ModelLibrary } from './ModelLibrary';
import { RENDER_BUDGET } from '../data/performance';
import { GROUND_TILE } from '../data/artDirection';
import { bakePart, mergeParts } from './meshes/geometryUtils';
import type { IEnvironment } from './environments/IEnvironment';
import { disposeObject3D } from './dispose';
import {
  buildBoneGeometry,
  buildCarWreckGeometry,
  buildFlameGeometry,
  buildGlowGeometry,
  buildRuinWallGeometry,
  buildSkullGeometry,
  createCarWreckMaterial
} from './EnvironmentDetail';

const SKULL_CAPACITY = 6000;
const BONE_CAPACITY = 2600;
const FIRE_CAPACITY = 80;
const RUIN_CAPACITY = 60;
const PUDDLE_CAPACITY = 60;
const FIRE_LIGHT_COUNT = RENDER_BUDGET.fireLights;
const FIRE_LIGHT_DISTANCE = 14;
const FIRE_LIGHT_RANGE = 30; // fires farther than this from the player get no light
const FIRE_LIGHT_INTENSITY = 9;

interface Chunk {
  x: number;
  z: number;
  group: THREE.Group;
  ground: THREE.Mesh;
}

function createBonePatchMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const mat = source.clone();
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.roughness = GROUND_TILE.roughness;
  mat.metalness = 0;
  mat.envMapIntensity = GROUND_TILE.envMapIntensity;
  mat.normalScale.setScalar(GROUND_TILE.normalScale);
  // The flattest bones lie on the ground plane itself: always draw them over it
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -4;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPatchRadius = { value: GROUND_TILE.size / 2 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPatchRadius;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 patchOrigin = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float patchAngle = atan(transformed.z, transformed.x);
        float wobble = 0.16 * sin(patchAngle * 3.0 + patchOrigin.x * 0.37) + 0.1 * sin(patchAngle * 5.0 + patchOrigin.y * 0.53)
          + 0.06 * sin(patchAngle * 9.0 + patchOrigin.x * 0.11 + patchOrigin.y * 0.7);
        float patchR = length(transformed.xz) / uPatchRadius;
        float patchEdge = smoothstep(${GROUND_TILE.edgeInner.toFixed(2)} + wobble, ${GROUND_TILE.edgeOuter.toFixed(2)} + wobble, patchR);
        transformed.y = transformed.y * (1.0 - patchEdge) - patchEdge * 0.4;`
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float boneLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(boneLuma), ${GROUND_TILE.boneDesaturate.toFixed(2)}) * ${GROUND_TILE.boneBrightness.toFixed(2)};`
    );
  };
  mat.customProgramCacheKey = () => 'bone-patch';
  return mat;
}

export class Environment2029 implements IEnvironment {
  public readonly group = new THREE.Group();
  public readonly obstacleColliders: Array<{ x: number; z: number; radius: number }> = [];

  private readonly chunkSize = 75;
  private readonly chunks: Chunk[] = [];
  private readonly groundGeo: THREE.PlaneGeometry;
  private readonly groundMat: THREE.MeshStandardMaterial;

  private readonly skullInstancedMesh: THREE.InstancedMesh;
  private readonly boneInstancedMesh: THREE.InstancedMesh;
  private readonly flameInstancedMesh: THREE.InstancedMesh;
  private readonly fireGlowInstancedMesh: THREE.InstancedMesh;
  private readonly fires: Array<{ x: number; z: number; scale: number; phase: number }> = [];
  private readonly rebarInstancedMesh: THREE.InstancedMesh;
  private readonly carInstancedMesh: THREE.InstancedMesh;
  private disposed = false;
  private readonly hedgehogInstancedMesh: THREE.InstancedMesh;
  private readonly rubbleInstancedMesh: THREE.InstancedMesh;
  private readonly craterInstancedMesh: THREE.InstancedMesh;
  private readonly ruinInstancedMesh: THREE.InstancedMesh;
  private readonly puddleInstancedMesh: THREE.InstancedMesh;
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
  private readonly fireDummy = new THREE.Object3D();
  private readonly fireLights: THREE.PointLight[] = [];
  private fireLightsEnabled = true;
  private lastPlayerX = 0;
  private lastPlayerZ = 0;
  private groundTileActive = false;
  /** Sculpted bone patches, one batch per ground chunk (so batches off screen are skipped), once the model has loaded */
  private readonly bonePatches: THREE.InstancedMesh[] = [];

  constructor() {
    this.groundGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 24, 24);
    this.groundGeo.rotateX(-Math.PI / 2);

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a4846, // scorched ash; the moonlight supplies the blue
      map: ProceduralTextures.getWastelandGroundAlbedo(),
      bumpMap: ProceduralTextures.getWastelandGroundBump(),
      bumpScale: 0.2,
      roughness: 0.88,
      metalness: 0.08
    });

    // 1. Human skulls and bones carpet the ground (the iconic future-war image)
    const skullGeo = buildSkullGeometry();
    const boneGeo = buildBoneGeometry();
    // Dimmed so the bone carpet sits in the ground instead of being the brightest thing on screen
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0x8c8780,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0
    });

    // 2. Build detailed shattered Highway Overpass Column & Rubble Base (matte concrete)
    // Neutral, slightly warm concrete: the moonlight adds the blue, so the base colours must not
    const concreteMid = 0x4a4744;
    const concreteDark = 0x2c2a28;
    const concreteLight = 0x5c5854;
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

    // 3. Burnt-out 1980s sedans (shared with the destructible wrecks)
    const carGeo = buildCarWreckGeometry();
    const carMat = createCarWreckMaterial();

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
    const slabDark = 0x2e2c2a;
    const slabMid = 0x4a4642;
    const slabCracked = 0x383532;
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

    // 6. Build Scorched Blast Craters: sunken ring rim with dark ash pit (no stacked boxes)
    const ashBlack = 0x0a0d11;
    const scorchOuter = 0x262422;
    const scorchInner = 0x171615;
    const outerRim = new THREE.RingGeometry(1.45, 2.55, 18);
    outerRim.rotateX(-Math.PI / 2);
    const innerRim = new THREE.RingGeometry(0.85, 1.55, 18);
    innerRim.rotateX(-Math.PI / 2);
    const pitDisc = new THREE.CircleGeometry(0.95, 16);
    pitDisc.rotateX(-Math.PI / 2);
    const craterParts: THREE.BufferGeometry[] = [
      bakePart(outerRim, 0, 0.015, 0, 0, 0, 0, scorchOuter),
      bakePart(innerRim, 0, 0.025, 0, 0, 0, 0, scorchInner),
      bakePart(pitDisc, 0, 0.012, 0, 0, 0, 0, ashBlack),
      // Low broken rim ejecta chunks around the perimeter
      bakePart(new THREE.BoxGeometry(0.48, 0.12, 0.32), 1.85, 0.06, 0.35, 0.1, 0.4, -0.18, scorchOuter),
      bakePart(new THREE.BoxGeometry(0.42, 0.1, 0.28), -1.75, 0.05, -0.45, -0.12, -0.5, 0.15, scorchOuter),
      bakePart(new THREE.BoxGeometry(0.38, 0.11, 0.3), 0.25, 0.055, -1.8, 0.15, 0.2, 0.1, scorchInner)
    ];
    const craterGeo = mergeParts(craterParts);
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });

    const totalSkulls = SKULL_CAPACITY;
    this.skullInstancedMesh = new THREE.InstancedMesh(skullGeo, skullMat, totalSkulls);
    this.skullInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skullInstancedMesh.frustumCulled = false;

    this.boneInstancedMesh = new THREE.InstancedMesh(boneGeo, skullMat, BONE_CAPACITY);
    this.boneInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.boneInstancedMesh.frustumCulled = false;

    // Fires on wrecks and craters: additive flame tongues plus a soft orange glow on the ground
    const flameMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.flameInstancedMesh = new THREE.InstancedMesh(buildFlameGeometry(), flameMat, FIRE_CAPACITY);
    this.flameInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flameInstancedMesh.frustumCulled = false;
    const glowMat = new THREE.MeshBasicMaterial({
      map: ProceduralTextures.getSoftGlowSprite(),
      color: 0xff5a10,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.fireGlowInstancedMesh = new THREE.InstancedMesh(buildGlowGeometry(11), glowMat, FIRE_CAPACITY);
    this.fireGlowInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fireGlowInstancedMesh.frustumCulled = false;

    // Real light for the few fires nearest the player: lights up the skulls, wrecks and enemies around them
    for (let i = 0; i < FIRE_LIGHT_COUNT; i++) {
      const light = new THREE.PointLight(0xff7a2a, 0, FIRE_LIGHT_DISTANCE, 2);
      light.castShadow = false;
      this.group.add(light);
      this.fireLights.push(light);
    }

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

    // Broken building walls, clustered around each chunk's sites
    this.ruinInstancedMesh = new THREE.InstancedMesh(buildRuinWallGeometry(), concreteMat, RUIN_CAPACITY);
    this.ruinInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ruinInstancedMesh.frustumCulled = false;

    // Standing water in the low ground near the ruins: near-black mirrors for the cold sky
    const puddleGeo = new THREE.CircleGeometry(1, 18);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x07090c, metalness: 0.85, roughness: 0.28 });
    this.puddleInstancedMesh = new THREE.InstancedMesh(puddleGeo, puddleMat, PUDDLE_CAPACITY);
    this.puddleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puddleInstancedMesh.frustumCulled = false;

    this.group.add(
      this.puddleInstancedMesh,
      this.ruinInstancedMesh,
      this.skullInstancedMesh,
      this.boneInstancedMesh,
      this.flameInstancedMesh,
      this.fireGlowInstancedMesh,
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
      color: 0x3c4652, // grey battlefield smoke, lit cold by the moon
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    for (let m = 0; m < 28; m++) {
      const mistMesh = new THREE.Mesh(mistGeo, mistMat);
      const angle = (m / 28) * Math.PI * 2;
      const dist = 6 + (m % 4) * 6.5;
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;
      // Most smoke hugs the ground; every fourth patch drifts higher, between the camera and the fight
      mistMesh.position.set(ox, m % 4 === 0 ? 3.5 + (m % 3) : 0.35 + (m % 3) * 0.25, oz);
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
    const refineryMat = new THREE.MeshBasicMaterial({ color: 0x050b16, fog: false });
    const ruinedSteelMat = new THREE.MeshBasicMaterial({ color: 0x0a1422, fog: false });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });

    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2;
      const dist = 85 + (i % 3) * 8;
      const pseudoRand = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const normRand = Math.abs(pseudoRand);
      const height = 14 + (i % 7) * 4.5 + normRand * 8;
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
        roofSlab.rotation.z = (normRand - 0.5) * 0.35;
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
        this.chunks.push({ x: cx, z: cz, group: chunkGroup, ground });
      }
    }

    this.repopulateProps(0, 0);
    void ModelLibrary.preload().then(() => this.applyModels());
  }

  /** Swaps the placeholder wrecks for the sculpted burnt-out car once it has loaded. */
  private applyModels(): void {
    const car = ModelLibrary.getMeshData('burnt_car');
    if (this.disposed || !car) return;
    this.carInstancedMesh.geometry.dispose();
    (this.carInstancedMesh.material as THREE.Material).dispose();
    this.carInstancedMesh.geometry = car.geometry;
    this.carInstancedMesh.material = car.material;
    this.applyGroundTile();
  }

  /**
   * Brings in the sculpted ash-and-bone field: its dirt becomes fine detail on the ash ground, and its bones
   * are scattered as small patches whose edges sink into the ash.
   */
  private applyGroundTile(): void {
    const tile = ModelLibrary.get('ground');
    if (!tile) return;
    tile.updateMatrixWorld(true);
    const bones: THREE.Mesh[] = [];
    const dirt: THREE.MeshStandardMaterial[] = [];
    tile.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.name === 'Bones') bones.push(mesh);
      else dirt.push(mat);
    });
    if (dirt[0]) this.addGroundDetail(dirt[0]);
    if (bones[0]) {
      const geometry = bones[0].geometry.clone().applyMatrix4(bones[0].matrixWorld);
      geometry.scale(1, GROUND_TILE.heightScale, 1);
      geometry.userData.shared = true;
      const material = createBonePatchMaterial(bones[0].material as THREE.MeshStandardMaterial);
      for (let i = 0; i < this.chunks.length; i++) {
        const batch = new THREE.InstancedMesh(geometry, material, RENDER_BUDGET.boneClusters * GROUND_TILE.clusterMax);
        batch.count = 0;
        this.group.add(batch);
        this.bonePatches.push(batch);
      }
    }
    this.groundTileActive = true;
    this.repopulateProps(0, 0);
  }

  /**
   * The dirt's own texture becomes the ground's colour, laid in world space without visible repetition:
   * two copies at random offsets are blended under a smooth noise mask (after Inigo Quilez's texture
   * variation), and broad light and dark areas come from low-frequency noise. The procedural bump stays.
   */
  private addGroundDetail(dirt: THREE.MeshStandardMaterial): void {
    if (!dirt.map) return;
    const detail = dirt.map.clone();
    detail.wrapS = detail.wrapT = THREE.MirroredRepeatWrapping;
    detail.needsUpdate = true;
    const mat = this.groundMat;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDetail = { value: detail };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uDetail;
          varying vec2 vGroundXZ;
          float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float groundNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), u.x), mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          vec3 dirtNoTile(vec2 uv) {
            float k = groundNoise(uv * 0.6) * 8.0;
            float i = floor(k);
            float f = fract(k);
            vec2 offA = sin(vec2(3.0, 7.0) * i);
            vec2 offB = sin(vec2(3.0, 7.0) * (i + 1.0));
            vec2 ddx = dFdx(uv);
            vec2 ddy = dFdy(uv);
            vec3 a = textureGrad(uDetail, uv + offA, ddx, ddy).rgb;
            vec3 b = textureGrad(uDetail, uv + offB, ddx, ddy).rgb;
            return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * dot(a - b, vec3(1.0))));
          }`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 dirt = dirtNoTile(vGroundXZ / ${GROUND_TILE.detailTileMetres.toFixed(2)});
          dirt = mix(vec3(0.18, 0.15, 0.12), dirt, ${GROUND_TILE.detailContrast.toFixed(2)});
          float dirtLuma = dot(dirt, vec3(0.299, 0.587, 0.114));
          vec2 macroP = vGroundXZ * ${GROUND_TILE.macroFrequency.toFixed(3)};
          float macro = groundNoise(macroP) * 0.65 + groundNoise(macroP * 2.7 + 17.0) * 0.35;
          diffuseColor.rgb = mix(vec3(dirtLuma), dirt, ${GROUND_TILE.detailSaturation.toFixed(2)}) * ${GROUND_TILE.detailGain.toFixed(2)}
            * mix(${GROUND_TILE.macroDark.toFixed(2)}, ${GROUND_TILE.macroLight.toFixed(2)}, macro);`
        );
    };
    mat.customProgramCacheKey = () => 'ground-detail';
    mat.needsUpdate = true;
  }

  private repopulateProps(_centerChunkX: number, _centerChunkZ: number): void {
    const dummy = new THREE.Object3D();
    this.obstacleColliders.length = 0;

    let skullIdx = 0;
    let boneIdx = 0;
    this.fires.length = 0;
    let rebarIdx = 0;
    let carIdx = 0;
    let hedgehogIdx = 0;
    let rubbleIdx = 0;
    let craterIdx = 0;
    let ruinIdx = 0;
    let puddleIdx = 0;

    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const originX = c.x * this.chunkSize;
      const originZ = c.z * this.chunkSize;

      const seed = Math.sin(c.x * 12.9898 + c.z * 78.233) * 43758.5453;
      const rng = (s: number) => {
        const val = Math.sin(seed + s * 17.13) * 10000;
        return val - Math.floor(val);
      };

      // 1. Skull piles, stray skulls and bones carpeting the ash
      const placeSkull = (x: number, z: number, y: number, sc: number, salt: number): void => {
        if (skullIdx >= SKULL_CAPACITY) return;
        dummy.position.set(x, y, z);
        dummy.rotation.set((rng(salt + 1) - 0.5) * 0.7, rng(salt + 2) * Math.PI * 2, (rng(salt + 3) - 0.5) * 0.7);
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        this.skullInstancedMesh.setMatrixAt(skullIdx++, dummy.matrix);
      };
      const placeBone = (x: number, z: number, salt: number): void => {
        if (boneIdx >= BONE_CAPACITY) return;
        dummy.position.set(x, 0.0, z);
        dummy.rotation.set(0, rng(salt + 4) * Math.PI * 2, 0);
        const bs = 0.8 + rng(salt + 5) * 0.7;
        dummy.scale.set(bs, bs, bs);
        dummy.updateMatrix();
        this.boneInstancedMesh.setMatrixAt(boneIdx++, dummy.matrix);
      };
      for (let p = 0; p < Math.round(40 * RENDER_BUDGET.groundClutter); p++) {
        const pcx = originX + (rng(p * 31 + 400) - 0.5) * (this.chunkSize - 8);
        const pcz = originZ + (rng(p * 31 + 401) - 0.5) * (this.chunkSize - 8);
        const n = 5 + Math.floor(rng(p * 31 + 402) * 9);
        for (let k = 0; k < n; k++) {
          const salt = p * 97 + k * 7 + 1000;
          const ang = rng(salt) * Math.PI * 2;
          const rad = rng(salt + 6) * 1.5;
          placeSkull(pcx + Math.cos(ang) * rad, pcz + Math.sin(ang) * rad, rng(salt + 7) * 0.16, 1.0 + rng(salt + 8) * 0.5, salt);
        }
        for (let k = 0; k < 4; k++) {
          const salt = p * 53 + k * 11 + 2000;
          placeBone(pcx + (rng(salt) - 0.5) * 3.2, pcz + (rng(salt + 6) - 0.5) * 3.2, salt);
        }
      }
      const carpet = this.groundTileActive ? GROUND_TILE.skullCarpet : 1;
      for (let s = 0; s < Math.round(110 * RENDER_BUDGET.groundClutter * carpet); s++) {
        const sx = originX + (rng(s * 3 + 1) - 0.5) * (this.chunkSize - 6);
        const sz = originZ + (rng(s * 5 + 2) - 0.5) * (this.chunkSize - 6);
        placeSkull(sx, sz, -0.01 + rng(s * 7) * 0.03, 0.95 + rng(s * 19) * 0.4, s * 13);
        if (s % 2 === 0) placeBone(sx + 0.6, sz - 0.4, s * 29);
      }

      // Bone fields: clusters of sculpted patches, turned and sized at random
      const batch = this.bonePatches[i];
      if (batch) {
        let patchIdx = 0;
        for (let k = 0; k < RENDER_BUDGET.boneClusters; k++) {
          const salt = 3000 + k * 41;
          const cx = originX + (rng(salt) - 0.5) * (this.chunkSize - GROUND_TILE.size);
          const cz = originZ + (rng(salt + 1) - 0.5) * (this.chunkSize - GROUND_TILE.size);
          const parts = GROUND_TILE.clusterMin + Math.floor(rng(salt + 2) * (GROUND_TILE.clusterMax - GROUND_TILE.clusterMin + 1));
          for (let j = 0; j < parts; j++) {
            const a = rng(salt + 3 + j) * Math.PI * 2;
            const r = j === 0 ? 0 : GROUND_TILE.clusterSpread * (0.6 + rng(salt + 7 + j) * 0.5);
            const s = 0.8 + rng(salt + 11 + j) * 0.5;
            dummy.position.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
            dummy.rotation.set(0, rng(salt + 15 + j) * Math.PI * 2, 0);
            dummy.scale.set(s, 1, s);
            dummy.updateMatrix();
            batch.setMatrixAt(patchIdx++, dummy.matrix);
          }
        }
        batch.count = patchIdx;
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingSphere();
      }

      // Hand-placed feel: each chunk has a few sites where wrecks, ruins and rubble gather,
      // a collapsed overpass in a straight row and a defensive line of hedgehogs, with open ground between.
      const sites = [0, 1, 2].map((k) => ({
        x: originX + (rng(900 + k * 3) - 0.5) * (this.chunkSize - 24),
        z: originZ + (rng(901 + k * 3) - 0.5) * (this.chunkSize - 24)
      }));
      const nearSite = (salt: number, minR: number, spread: number): [number, number] => {
        const site = sites[Math.floor(rng(salt) * sites.length) % sites.length];
        const a = rng(salt + 1) * Math.PI * 2;
        const r = minR + rng(salt + 2) * spread;
        return [site.x + Math.cos(a) * r, site.z + Math.sin(a) * r];
      };
      const place = (mesh: THREE.InstancedMesh, idx: number, x: number, z: number, rotY: number, sc = 1, tilt = 0): void => {
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, rotY, tilt);
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };

      // 2. Collapsed highway overpass: a row of broken columns
      const rowAngle = rng(20) * Math.PI;
      const rowX = originX + (rng(21) - 0.5) * (this.chunkSize - 30);
      const rowZ = originZ + (rng(22) - 0.5) * (this.chunkSize - 30);
      for (let r = 0; r < 4; r++) {
        if (rebarIdx >= 90) break;
        const along = (r - 1.5) * 9;
        const rx = rowX + Math.cos(rowAngle) * along;
        const rz = rowZ + Math.sin(rowAngle) * along;
        place(this.rebarInstancedMesh, rebarIdx++, rx, rz, rng(r) * Math.PI * 2);
        this.obstacleColliders.push({ x: rx, z: rz, radius: 1.25 });
      }

      // 3. Burnt-out cars at the sites, every one still burning
      for (let cr = 0; cr < 4; cr++) {
        if (carIdx >= 45) break;
        const [cx, cz] = nearSite(cr * 6 + 50, 3, 6);
        place(this.carInstancedMesh, carIdx++, cx, cz, rng(cr * 2) * Math.PI * 2, 1, (rng(cr) - 0.5) * 0.08);
        this.obstacleColliders.push({ x: cx, z: cz, radius: 1.85 });
        this.fires.push({ x: cx, z: cz, scale: 1.3 + rng(cr + 61) * 0.5, phase: rng(cr + 60) * 10 });
      }

      // 4. Anti-tank hedgehogs in a defensive line
      const lineAngle = rng(70) * Math.PI;
      const [lineX, lineZ] = nearSite(71, 8, 6);
      for (let h = 0; h < 6; h++) {
        if (hedgehogIdx >= 60) break;
        const along = (h - 2.5) * 2.8;
        const hx = lineX + Math.cos(lineAngle) * along + (rng(h * 5 + 72) - 0.5) * 0.6;
        const hz = lineZ + Math.sin(lineAngle) * along + (rng(h * 5 + 73) - 0.5) * 0.6;
        place(this.hedgehogInstancedMesh, hedgehogIdx++, hx, hz, rng(h * 3) * Math.PI * 2);
        this.obstacleColliders.push({ x: hx, z: hz, radius: 1.15 });
      }

      // 5. Concrete rubble slabs around the sites
      for (let rb = 0; rb < 7; rb++) {
        if (rubbleIdx >= 65) break;
        const [rbx, rbz] = nearSite(rb * 7 + 85, 2, 9);
        const sc = 0.85 + rng(rb * 2) * 0.35;
        place(this.rubbleInstancedMesh, rubbleIdx++, rbx, rbz, rng(rb * 4) * Math.PI * 2, sc, (rng(rb) - 0.5) * 0.1);
        this.obstacleColliders.push({ x: rbx, z: rbz, radius: 1.35 * sc });
      }

      // 6. Ruined building walls: two per site, at angles to each other like the corner of a room
      for (let w = 0; w < sites.length * 2; w++) {
        if (ruinIdx >= RUIN_CAPACITY) break;
        const site = sites[Math.floor(w / 2)];
        const baseAngle = rng(130 + Math.floor(w / 2)) * Math.PI;
        const angle = baseAngle + (w % 2) * (Math.PI / 2 + (rng(131 + w) - 0.5) * 0.3);
        const wx = site.x + Math.cos(angle) * 2.6;
        const wz = site.z - Math.sin(angle) * 2.6;
        place(this.ruinInstancedMesh, ruinIdx++, wx, wz, angle);
        for (const along of [-1.7, 0, 1.7]) {
          this.obstacleColliders.push({ x: wx + Math.cos(angle) * along, z: wz - Math.sin(angle) * along, radius: 0.8 });
        }
      }

      // Puddles, one or two per site, squashed into irregular ovals
      for (let pd = 0; pd < 5; pd++) {
        if (puddleIdx >= PUDDLE_CAPACITY) break;
        const [pdx, pdz] = nearSite(pd * 9 + 160, 3, 7);
        dummy.position.set(pdx, 0.02, pdz);
        dummy.rotation.set(0, rng(pd * 9 + 163) * Math.PI, 0);
        dummy.scale.set(0.8 + rng(pd * 9 + 164) * 1.4, 1, 0.5 + rng(pd * 9 + 165) * 0.7);
        dummy.updateMatrix();
        this.puddleInstancedMesh.setMatrixAt(puddleIdx++, dummy.matrix);
      }

      // 7. Shell craters are scattered at random (shelling is random); most are still smouldering
      for (let cr = 0; cr < 5; cr++) {
        if (craterIdx >= 50) break;
        const crx = originX + (rng(cr * 8 + 110) - 0.5) * (this.chunkSize - 12);
        const crz = originZ + (rng(cr * 8 + 111) - 0.5) * (this.chunkSize - 12);
        const sc = 0.8 + rng(cr * 3) * 0.45;
        dummy.position.set(crx, 0, crz);
        dummy.rotation.set(0, rng(cr * 5) * Math.PI * 2, 0);
        dummy.scale.set(sc, 1, sc);
        dummy.updateMatrix();
        this.craterInstancedMesh.setMatrixAt(craterIdx++, dummy.matrix);
        if (cr % 3 !== 2) this.fires.push({ x: crx, z: crz, scale: 0.9 + sc * 0.3, phase: rng(cr + 120) * 10 });
      }
    }

    this.skullInstancedMesh.count = skullIdx;
    this.boneInstancedMesh.count = boneIdx;
    this.boneInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rebarInstancedMesh.count = rebarIdx;
    this.carInstancedMesh.count = carIdx;
    this.hedgehogInstancedMesh.count = hedgehogIdx;
    this.rubbleInstancedMesh.count = rubbleIdx;
    this.craterInstancedMesh.count = craterIdx;
    this.ruinInstancedMesh.count = ruinIdx;
    this.puddleInstancedMesh.count = puddleIdx;
    this.puddleInstancedMesh.instanceMatrix.needsUpdate = true;
    this.ruinInstancedMesh.instanceMatrix.needsUpdate = true;
    this.skullInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rebarInstancedMesh.instanceMatrix.needsUpdate = true;
    this.carInstancedMesh.instanceMatrix.needsUpdate = true;
    this.hedgehogInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rubbleInstancedMesh.instanceMatrix.needsUpdate = true;
    this.craterInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  public setFireLightsEnabled(enabled: boolean): void {
    if (enabled === this.fireLightsEnabled) return;
    this.fireLightsEnabled = enabled;
    // Removed rather than dimmed: a light at zero intensity still costs every lit pixel
    for (const light of this.fireLights) {
      if (enabled) this.group.add(light);
      else this.group.remove(light);
    }
  }

  public update(playerX: number, playerZ: number): void {
    this.lastPlayerX = playerX;
    this.lastPlayerZ = playerZ;
    this.fogTime += 0.016;
    this.updateFires();
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

  /** Flicker every fire's flame height and glow each frame. */
  private updateFires(): void {
    const dummy = this.fireDummy;
    const n = Math.min(this.fires.length, FIRE_CAPACITY);
    for (let i = 0; i < n; i++) {
      const f = this.fires[i];
      const t = this.fogTime;
      const flick = 0.85 + 0.2 * Math.sin(t * 9 + f.phase) + 0.1 * Math.sin(t * 17 + f.phase * 1.7);
      dummy.position.set(f.x, 0.1, f.z);
      dummy.rotation.set(0, f.phase + t * 0.4, 0);
      dummy.scale.set(f.scale * (0.9 + 0.12 * Math.sin(t * 7 + f.phase)), f.scale * flick, f.scale);
      dummy.updateMatrix();
      this.flameInstancedMesh.setMatrixAt(i, dummy.matrix);

      // Above the crater lip (0.14) so the glow is not buried inside the crater mesh
      dummy.position.set(f.x, 0.22, f.z);
      dummy.rotation.set(0, 0, 0);
      const g = f.scale * (0.9 + 0.1 * flick);
      dummy.scale.set(g, 1, g);
      dummy.updateMatrix();
      this.fireGlowInstancedMesh.setMatrixAt(i, dummy.matrix);
    }
    this.updateFireLights(n);
    this.flameInstancedMesh.count = n;
    this.fireGlowInstancedMesh.count = n;
    this.flameInstancedMesh.instanceMatrix.needsUpdate = true;
    this.fireGlowInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** Assigns the pooled orange lights to the fires nearest the player and flickers them. */
  private updateFireLights(fireCount: number): void {
    const px = this.lastPlayerX;
    const pz = this.lastPlayerZ;
    const t = this.fogTime;
    const used = new Set<number>();
    for (let l = 0; l < this.fireLights.length; l++) {
      const light = this.fireLights[l];
      let best = -1;
      let bestD = Infinity;
      if (this.fireLightsEnabled) {
        for (let i = 0; i < fireCount; i++) {
          if (used.has(i)) continue;
          const f = this.fires[i];
          const d = (f.x - px) * (f.x - px) + (f.z - pz) * (f.z - pz);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      if (best < 0 || bestD > FIRE_LIGHT_RANGE * FIRE_LIGHT_RANGE) {
        light.intensity = 0;
        continue;
      }
      used.add(best);
      const f = this.fires[best];
      const flick = 0.82 + 0.18 * Math.sin(t * 11 + f.phase) + 0.1 * Math.sin(t * 23 + f.phase * 2.1);
      light.position.set(f.x, 1.3, f.z);
      light.intensity = FIRE_LIGHT_INTENSITY * f.scale * flick;
    }
  }

  public dispose(): void {
    this.disposed = true;
    disposeObject3D(this.group);
    this.obstacleColliders.length = 0;
    this.chunks.length = 0;
  }
}
