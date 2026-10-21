import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import { bakePart, mergeParts } from './geometryUtils';
import { buildEndoChassis, buildEndoLeg, buildEndoOptics } from './EndoskeletonGeometry';
import type { ActiveEnemy } from '../../core/types';
import { ProceduralTextures } from '../ProceduralTextures';
import { ELITE_AFFIXES } from '../../data/enemies';
import { DEATH_ANIMATION_SECONDS } from '../../data/balance';
import { ENDO_VISUAL_SCALE, PALETTE } from '../../data/artDirection';
import type { EndoModel } from '../EndoModel';
import { ModelLibrary } from '../ModelLibrary';

/** One walking body drawn with instancing: chassis, two swinging legs, glowing eyes, held weapon. */
interface WalkerSet {
  chassis: THREE.InstancedMesh;
  leftLeg: THREE.InstancedMesh;
  rightLeg: THREE.InstancedMesh;
  optics: THREE.InstancedMesh;
  weapon: THREE.InstancedMesh | null;
  hipHeight: number;
  /** Instances written this frame */
  index: number;
}

export class EndoskeletonBatch {
  public readonly group = new THREE.Group();
  public readonly chassisInstancedMesh: THREE.InstancedMesh;
  public readonly leftLegInstancedMesh: THREE.InstancedMesh;
  public readonly rightLegInstancedMesh: THREE.InstancedMesh;
  public readonly opticsInstancedMesh: THREE.InstancedMesh;
  public readonly crabChassisInstancedMesh: THREE.InstancedMesh;
  public readonly crabOpticsInstancedMesh: THREE.InstancedMesh;
  private readonly maxCount: number;

  private readonly dummy = new THREE.Object3D();
  private readonly legDummy = new THREE.Object3D();
  private readonly dummyColor = new THREE.Color();
  private readonly legQuat = new THREE.Quaternion();
  private readonly swingQuat = new THREE.Quaternion();
  private readonly hipOffset = new THREE.Vector3();
  private readonly chassisMat: THREE.MeshStandardMaterial;
  // Rifle carried by the sculpted model (the procedural chassis has its rifle built in)
  private rifleInstancedMesh: THREE.InstancedMesh | null = null;
  // The T-800 / T-700 body (and the T-600 until it has its own), plus the sculpted T-600 once loaded
  private readonly mainSet: WalkerSet;
  private t600Set: WalkerSet | null = null;
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private lastTime = 0;
  private readonly deadColor = new THREE.Color(0x3a3d42);
  private readonly xAxis = new THREE.Vector3(1, 0, 0);
  private readonly corpses: Array<{
    x: number;
    z: number;
    facing: number;
    id: number;
    crab: boolean;
    scale: number;
    archetype: string;
    age: number;
  }> = [];

  constructor(maxCount = 650) {
    this.maxCount = maxCount;

    // Neutral polished steel (the endoskeleton is silver chrome, not blue)
    const chromeBright = 0xd6dadf;
    const chromeMid = 0xa0a6ad;
    const darkSocket = 0x07090c;
    const pistonSteel = 0x6e747b;
    const gunmetal = 0x2b2f35;
    const teethIvory = 0xdedcd4;

    // 1. T-800 endoskeleton geometry (skull, torso, arms, M-25 rifle) and the two animated legs
    const chassisGeo = buildEndoChassis();
    const leftLegGeo = buildEndoLeg(-0.15);
    const rightLegGeo = buildEndoLeg(0.15);

    const chassisMat = (this.chassisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x000000,
      emissiveIntensity: 0,
      metalness: 0.95,
      roughness: 0.36,
      envMapIntensity: 1.5,
      normalMap: ProceduralTextures.getBrushedMetalNormal(),
      roughnessMap: ProceduralTextures.getBrushedMetalRoughness()
    }));

    this.chassisInstancedMesh = new THREE.InstancedMesh(chassisGeo, chassisMat, maxCount);
    this.chassisInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chassisInstancedMesh.frustumCulled = false;

    this.leftLegInstancedMesh = new THREE.InstancedMesh(leftLegGeo, chassisMat, maxCount);
    this.leftLegInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.leftLegInstancedMesh.frustumCulled = false;

    this.rightLegInstancedMesh = new THREE.InstancedMesh(rightLegGeo, chassisMat, maxCount);
    this.rightLegInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rightLegInstancedMesh.frustumCulled = false;

    // 3. Glowing red optics and rifle plasma chamber
    const opticsGeo = buildEndoOptics();

    const opticsMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: PALETTE.skynetRed,
      emissiveIntensity: 4,
      roughness: 0.2,
      metalness: 0.1
    });

    this.opticsInstancedMesh = new THREE.InstancedMesh(opticsGeo, opticsMat, maxCount);
    this.opticsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.opticsInstancedMesh.frustumCulled = false;

    // 4. Build Detailed 6-Legged Cyberdyne Recon Crab-Walker (spider-tank scuttler)
    const crabParts: THREE.BufferGeometry[] = [
      // Main sloped octagonal armored carapace
      bakePart(
        new THREE.CylinderGeometry(0.28, 0.44, 0.2, 8),
        0,
        0.34,
        0,
        0,
        Math.PI / 8,
        0,
        chromeBright
      ),
      // Dorsal reactor cooling dome & spine vents
      bakePart(
        new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8),
        0,
        0.46,
        -0.04,
        0,
        0,
        0,
        pistonSteel
      ),
      bakePart(new THREE.BoxGeometry(0.24, 0.08, 0.28), 0, 0.42, -0.1, -0.15, 0, 0, gunmetal),
      // Dark recessed front optical visor bay
      bakePart(new THREE.BoxGeometry(0.34, 0.12, 0.2), 0, 0.31, 0.28, 0, 0, 0, darkSocket),
      // Twin forward plasma pincer barrels
      bakePart(
        new THREE.CylinderGeometry(0.028, 0.028, 0.32, 6),
        -0.14,
        0.24,
        0.4,
        Math.PI / 2,
        0,
        -0.12,
        chromeMid
      ),
      bakePart(
        new THREE.CylinderGeometry(0.028, 0.028, 0.32, 6),
        0.14,
        0.24,
        0.4,
        Math.PI / 2,
        0,
        0.12,
        chromeMid
      ),
      // 6 Multi-jointed Arachnid Scuttle Legs (Upper Femur + Angled Lower Tibia)
      // Front Pair
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        -0.38,
        0.32,
        0.22,
        0,
        -0.45,
        0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        -0.54,
        0.16,
        0.32,
        0.2,
        0,
        0.35,
        chromeBright
      ),
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        0.38,
        0.32,
        0.22,
        0,
        0.45,
        -0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        0.54,
        0.16,
        0.32,
        0.2,
        0,
        -0.35,
        chromeBright
      ),
      // Mid Pair
      bakePart(new THREE.BoxGeometry(0.36, 0.055, 0.06), -0.44, 0.32, 0.0, 0, 0, 0.25, pistonSteel),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        -0.62,
        0.16,
        0.0,
        0,
        0,
        0.38,
        chromeBright
      ),
      bakePart(new THREE.BoxGeometry(0.36, 0.055, 0.06), 0.44, 0.32, 0.0, 0, 0, -0.25, pistonSteel),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        0.62,
        0.16,
        0.0,
        0,
        0,
        -0.38,
        chromeBright
      ),
      // Rear Pair
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        -0.38,
        0.32,
        -0.22,
        0,
        0.45,
        0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        -0.54,
        0.16,
        -0.32,
        -0.2,
        0,
        0.35,
        chromeBright
      ),
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        0.38,
        0.32,
        -0.22,
        0,
        -0.45,
        -0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        0.54,
        0.16,
        -0.32,
        -0.2,
        0,
        -0.35,
        chromeBright
      )
    ];
    const crabGeo = mergeParts(crabParts);
    this.crabChassisInstancedMesh = new THREE.InstancedMesh(crabGeo, chassisMat, maxCount);
    this.crabChassisInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crabChassisInstancedMesh.frustumCulled = false;

    const crabOpticsGeo = mergeParts([
      bakePart(new THREE.BoxGeometry(0.22, 0.045, 0.06), 0, 0.32, 0.37, 0, 0, 0, 0xff0000),
      bakePart(new THREE.SphereGeometry(0.03, 8, 8), -0.07, 0.32, 0.38, 0, 0, 0, 0xff4444),
      bakePart(new THREE.SphereGeometry(0.03, 8, 8), 0.07, 0.32, 0.38, 0, 0, 0, 0xff4444)
    ]);
    this.crabOpticsInstancedMesh = new THREE.InstancedMesh(crabOpticsGeo, opticsMat, maxCount);
    this.crabOpticsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crabOpticsInstancedMesh.frustumCulled = false;

    this.mainSet = {
      chassis: this.chassisInstancedMesh,
      leftLeg: this.leftLegInstancedMesh,
      rightLeg: this.rightLegInstancedMesh,
      optics: this.opticsInstancedMesh,
      weapon: null,
      hipHeight: 0.68, // procedural stand-in; the sculpted model sets its own
      index: 0
    };

    this.group.add(
      this.chassisInstancedMesh,
      this.leftLegInstancedMesh,
      this.rightLegInstancedMesh,
      this.opticsInstancedMesh,
      this.crabChassisInstancedMesh,
      this.crabOpticsInstancedMesh
    );
  }

  /** True for the archetypes this batch draws (and so can animate dying). */
  public handles(archetype: string): boolean {
    return (
      archetype === 'skynet_crab_drone' ||
      archetype === 't800_endoskeleton' ||
      archetype === 't600_rusted' ||
      archetype === 't700_scout'
    );
  }

  /** Keeps a destroyed enemy on screen for a short collapse animation instead of removing it instantly. */
  public addCorpse(enemy: ActiveEnemy, playerX: number, playerZ: number): void {
    if (!this.handles(enemy.archetype) || this.corpses.length >= 48) return;
    let scale = ENDO_VISUAL_SCALE;
    if (enemy.archetype === 't600_rusted') scale *= 1.25;
    else if (enemy.archetype === 't700_scout') scale *= 0.94;
    if (enemy.isElite) scale *= enemy.scale ?? 1.4;
    this.corpses.push({
      x: enemy.x,
      z: enemy.z,
      facing: Math.atan2(playerX - enemy.x, playerZ - enemy.z),
      id: enemy.id,
      crab: enemy.archetype === 'skynet_crab_drone',
      scale,
      archetype: enemy.archetype,
      age: 0
    });
  }

  public clearCorpses(): void {
    this.corpses.length = 0;
  }

  /** Draws the collapsing corpses after the live enemies (shares the instance buffers). */
  private renderCorpses(timeSeconds: number, startCrab: number): number {
    const dt = Math.max(0, Math.min(0.1, timeSeconds - this.lastTime));
    this.lastTime = timeSeconds;
    let crabIndex = startCrab;

    for (let c = this.corpses.length - 1; c >= 0; c--) {
      const corpse = this.corpses[c];
      corpse.age += dt;
      if (corpse.age >= DEATH_ANIMATION_SECONDS) {
        this.corpses.splice(c, 1);
        continue;
      }
      const p = corpse.age / DEATH_ANIMATION_SECONDS;
      const ease = 1 - (1 - p) * (1 - p);

      if (corpse.crab) {
        if (crabIndex >= this.maxCount) continue;
        // Hops, flips onto its back and its optics die
        const hop = Math.sin(p * Math.PI) * 0.3;
        this.dummy.rotation.order = 'XYZ';
        this.dummy.position.set(corpse.x, hop, corpse.z);
        this.dummy.rotation.set(0, corpse.facing, Math.PI * ease);
        this.dummy.scale.setScalar(corpse.scale);
        this.dummy.updateMatrix();
        this.crabChassisInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);
        this.crabOpticsInstancedMesh.setMatrixAt(crabIndex, p < 0.15 ? this.dummy.matrix : this.zeroMatrix);
        this.dummyColor.setHex(0x9fb2c4).lerp(this.deadColor, p);
        this.crabChassisInstancedMesh.setColorAt(crabIndex, this.dummyColor);
        crabIndex++;
        continue;
      }

      const set = this.setFor(corpse.archetype);
      if (set.index >= this.maxCount) continue;
      // Falls backward about its feet, knees buckling; eyes flicker then go dark
      const phase = corpse.age * 7.5;
      this.dummy.rotation.order = 'YXZ';
      this.dummy.position.set(corpse.x, -0.06 * ease, corpse.z);
      this.dummy.rotation.set(-1.45 * ease, corpse.facing, 0.15 * Math.sin(phase) * (1 - ease));
      this.dummy.scale.setScalar(corpse.scale);
      this.dummy.updateMatrix();
      set.chassis.setMatrixAt(set.index, this.dummy.matrix);
      set.weapon?.setMatrixAt(set.index, this.dummy.matrix);
      const eyesOn = p < 0.3 && Math.sin(corpse.age * 70) > 0;
      set.optics.setMatrixAt(set.index, eyesOn ? this.dummy.matrix : this.zeroMatrix);

      // Legs hang off the hips, which move as the body tips over
      this.hipOffset.set(0, set.hipHeight * corpse.scale, 0).applyQuaternion(this.dummy.quaternion);
      this.legDummy.position.set(
        corpse.x + this.hipOffset.x,
        this.dummy.position.y + this.hipOffset.y,
        corpse.z + this.hipOffset.z
      );
      this.legDummy.scale.setScalar(corpse.scale);
      this.swingQuat.setFromAxisAngle(this.xAxis, 0.7 * ease);
      this.legQuat.copy(this.dummy.quaternion).multiply(this.swingQuat);
      this.legDummy.quaternion.copy(this.legQuat);
      this.legDummy.updateMatrix();
      set.leftLeg.setMatrixAt(set.index, this.legDummy.matrix);
      this.swingQuat.setFromAxisAngle(this.xAxis, -0.35 * ease);
      this.legQuat.copy(this.dummy.quaternion).multiply(this.swingQuat);
      this.legDummy.quaternion.copy(this.legQuat);
      this.legDummy.updateMatrix();
      set.rightLeg.setMatrixAt(set.index, this.legDummy.matrix);

      // Fades from chrome to scorched grey
      this.dummyColor.setHex(this.tintFor(corpse.archetype)).lerp(this.deadColor, p);
      set.chassis.setColorAt(set.index, this.dummyColor);
      set.leftLeg.setColorAt(set.index, this.dummyColor);
      set.rightLeg.setColorAt(set.index, this.dummyColor);
      set.index++;
    }

    this.dummy.rotation.order = 'XYZ';
    return crabIndex;
  }

  /** The T-600s get their own body once the sculpted T-600 has loaded. */
  private setFor(archetype: string): WalkerSet {
    return archetype === 't600_rusted' && this.t600Set ? this.t600Set : this.mainSet;
  }

  /** Tint that tells the variants apart (the sculpted T-600 only needs light weathering). */
  private tintFor(archetype: string): number {
    if (archetype === 't600_rusted') return this.t600Set ? 0xe0d4c4 : 0xd2b08c;
    if (archetype === 't700_scout') return 0xaeb4bb;
    return 0xffffff;
  }

  public updateBatch(enemies: ActiveEnemy[], timeSeconds: number, playerX = 0, playerZ = 0): void {
    let crabIndex = 0;
    this.mainSet.index = 0;
    if (this.t600Set) this.t600Set.index = 0;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const facingAngle = Math.atan2(playerX - enemy.x, playerZ - enemy.z);

      if (enemy.archetype === 'skynet_crab_drone') {
        if (crabIndex >= this.maxCount) continue;
        const scuttleBob = Math.abs(Math.sin(timeSeconds * 18 + enemy.id)) * 0.045;
        const scuttleTilt = Math.sin(timeSeconds * 18 + enemy.id) * 0.09;

        const eliteScale = enemy.isElite ? (enemy.scale ?? 1.4) : 1.0;
        const crabY = scuttleBob;
        let crabTilt = scuttleTilt;
        let crabPitch = 0;
        let crabX = enemy.x;
        let crabZ = enemy.z;

        if (enemy.hitFlashTimer > 0) {
          const stagger = Math.min(1.0, enemy.hitFlashTimer / 0.15);
          crabPitch = -0.18 * stagger;
          crabTilt += (Math.sin(enemy.id * 10) > 0 ? 0.15 : -0.15) * stagger;
          crabX -= Math.sin(facingAngle) * 0.08 * stagger;
          crabZ -= Math.cos(facingAngle) * 0.08 * stagger;
        }

        this.dummy.position.set(crabX, crabY, crabZ);
        this.dummy.rotation.set(crabPitch, facingAngle, crabTilt);
        this.dummy.scale.set(eliteScale, eliteScale, eliteScale);
        this.dummy.updateMatrix();

        this.crabChassisInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);
        this.crabOpticsInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);

        if (enemy.hitFlashTimer > 0) {
          this.dummyColor.setHex(0xffffff);
        } else if (enemy.isElite && enemy.affix) {
          this.dummyColor.setHex(ELITE_AFFIXES[enemy.affix]?.tintColor ?? 0xffab00);
        } else {
          this.dummyColor.setHex(0x9fb2c4);
        }
        this.crabChassisInstancedMesh.setColorAt(crabIndex, this.dummyColor);
        crabIndex++;
        continue;
      }

      // Only render humanoid endoskeletons in the primary instanced batch
      if (
        enemy.archetype !== 't800_endoskeleton' &&
        enemy.archetype !== 't600_rusted' &&
        enemy.archetype !== 't700_scout'
      ) {
        continue;
      }
      const set = this.setFor(enemy.archetype);
      if (set.index >= this.maxCount) continue;

      // Scale variation for T-600 heavy vs T-700 runner
      let scale = ENDO_VISUAL_SCALE;
      if (enemy.archetype === 't600_rusted') scale *= 1.25;
      else if (enemy.archetype === 't700_scout') scale *= 0.94;
      if (enemy.isElite) scale *= (enemy.scale ?? 1.4);

      // Animatronic mechanical gait & stride
      const phase = timeSeconds * 7.5 + enemy.id * 1.3;
      let bobY = Math.abs(Math.sin(phase)) * 0.06;
      let rollZ = Math.sin(phase) * 0.055;
      let legStride = Math.sin(phase) * 0.52;
      let pitchX = 0;
      let posX = enemy.x;
      let posZ = enemy.z;

      // Stagger backward on hit
      if (enemy.hitFlashTimer > 0) {
        const stagger = Math.min(1.0, enemy.hitFlashTimer / 0.15);
        pitchX = -0.22 * stagger;
        rollZ += ((enemy.id % 2 === 0 ? 1 : -1) * 0.12) * stagger;
        bobY -= 0.04 * stagger;
        legStride *= (1 - stagger * 0.5);
        posX -= Math.sin(facingAngle) * 0.12 * stagger;
        posZ -= Math.cos(facingAngle) * 0.12 * stagger;
      }

      this.dummy.position.set(posX, bobY, posZ);
      this.dummy.rotation.set(pitchX, facingAngle, rollZ);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();

      set.chassis.setMatrixAt(set.index, this.dummy.matrix);
      set.weapon?.setMatrixAt(set.index, this.dummy.matrix);
      set.optics.setMatrixAt(set.index, this.dummy.matrix);

      // Left Leg articulated matrix
      this.legDummy.position.set(posX, bobY + set.hipHeight * scale, posZ);
      this.legDummy.rotation.set(legStride + pitchX * 0.4, facingAngle, rollZ);
      this.legDummy.scale.set(scale, scale, scale);
      this.legDummy.updateMatrix();
      set.leftLeg.setMatrixAt(set.index, this.legDummy.matrix);

      // Right Leg articulated matrix
      this.legDummy.rotation.set(-legStride + pitchX * 0.4, facingAngle, rollZ);
      this.legDummy.updateMatrix();
      set.rightLeg.setMatrixAt(set.index, this.legDummy.matrix);

      // Color tint & hit flash
      if (enemy.hitFlashTimer > 0) {
        this.dummyColor.setHex(0xffffff);
      } else if (enemy.isElite && enemy.affix) {
        this.dummyColor.setHex(ELITE_AFFIXES[enemy.affix]?.tintColor ?? 0xffab00);
      } else {
        this.dummyColor.setHex(this.tintFor(enemy.archetype));
      }
      set.chassis.setColorAt(set.index, this.dummyColor);
      set.leftLeg.setColorAt(set.index, this.dummyColor);
      set.rightLeg.setColorAt(set.index, this.dummyColor);

      set.index++;
    }

    crabIndex = this.renderCorpses(timeSeconds, crabIndex);
    this.finishSet(this.mainSet);
    if (this.t600Set) this.finishSet(this.t600Set);

    this.crabChassisInstancedMesh.count = crabIndex;
    this.crabOpticsInstancedMesh.count = crabIndex;
    this.crabChassisInstancedMesh.instanceMatrix.needsUpdate = true;
    this.crabOpticsInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.crabChassisInstancedMesh.instanceColor) {
      this.crabChassisInstancedMesh.instanceColor.needsUpdate = true;
    }
  }

  private finishSet(set: WalkerSet): void {
    for (const mesh of [set.chassis, set.leftLeg, set.rightLeg, set.optics, set.weapon]) {
      if (!mesh) continue;
      mesh.count = set.index;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Swaps the procedural endoskeleton for the sculpted T-800 (all walking archetypes share it;
   * the per-instance tint still tells the T-600 and T-700 apart). Called once the model has loaded.
   */
  public applySculptedModel(
    model: EndoModel,
    rifle?: { geometry: THREE.BufferGeometry; material: THREE.Material } | null
  ): void {
    if (this.rifleInstancedMesh) return;
    const swap = (mesh: THREE.InstancedMesh, geometry: THREE.BufferGeometry, material?: THREE.Material) => {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      if (material) mesh.material = material;
    };
    swap(this.chassisInstancedMesh, model.chassis, model.material);
    swap(this.leftLegInstancedMesh, model.leftLeg, model.material);
    swap(this.rightLegInstancedMesh, model.rightLeg, model.material);
    swap(this.opticsInstancedMesh, model.eyes);
    this.mainSet.hipHeight = model.hipHeight;
    // The sculpted rifle sits with its pistol grip in the right hand
    let rifleGeo = model.rifle;
    if (rifle) {
      const grip = ModelLibrary.gripPoint(rifle.geometry);
      rifleGeo = rifle.geometry.clone().translate(
        model.rifleGrip.x - grip.x,
        model.rifleGrip.y - grip.y,
        model.rifleGrip.z - grip.z
      );
    }
    this.rifleInstancedMesh = new THREE.InstancedMesh(rifleGeo, rifle?.material ?? this.chassisMat, this.maxCount);
    this.rifleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rifleInstancedMesh.frustumCulled = false;
    this.rifleInstancedMesh.count = 0;
    this.group.add(this.rifleInstancedMesh);
    this.mainSet.weapon = this.rifleInstancedMesh;
  }

  /** Gives the T-600s their own sculpted body (otherwise they share the T-800's with a bronze tint). */
  public applyT600Model(model: EndoModel, rifle: { geometry: THREE.BufferGeometry; material: THREE.Material } | null): void {
    if (this.t600Set) return;
    // Same plasma rifle as the T-800, gripped in this body's right hand
    let weapon: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null;
    if (rifle) {
      const grip = ModelLibrary.gripPoint(rifle.geometry);
      weapon = {
        geometry: rifle.geometry.clone().translate(model.rifleGrip.x - grip.x, model.rifleGrip.y - grip.y, model.rifleGrip.z - grip.z),
        material: rifle.material
      };
    }
    const make = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      const mesh = new THREE.InstancedMesh(geometry, material, this.maxCount);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
      return mesh;
    };
    this.t600Set = {
      chassis: make(model.chassis, model.material),
      leftLeg: make(model.leftLeg, model.material),
      rightLeg: make(model.rightLeg, model.material),
      optics: make(model.eyes, this.opticsInstancedMesh.material as THREE.Material),
      weapon: weapon ? make(weapon.geometry, weapon.material) : null,
      hipHeight: model.hipHeight,
      index: 0
    };
  }

  /** Swaps the procedural crab drone for the sculpted spider drone, with two eye beads on its front. */
  public applyCrabModel(crab: { geometry: THREE.BufferGeometry; material: THREE.Material }): void {
    this.crabChassisInstancedMesh.geometry.dispose();
    this.crabChassisInstancedMesh.geometry = crab.geometry;
    this.crabChassisInstancedMesh.material = crab.material;
    crab.geometry.computeBoundingBox();
    const box = crab.geometry.boundingBox!;
    // Eyes on the front of the body sphere, which sits above the middle of the leg spread
    const centre = box.getCenter(new THREE.Vector3());
    const y = box.min.y + (box.max.y - box.min.y) * 0.62;
    const z = centre.z + (box.max.z - centre.z) * 0.22;
    this.crabOpticsInstancedMesh.geometry.dispose();
    this.crabOpticsInstancedMesh.geometry = mergeParts([
      bakePart(new THREE.SphereGeometry(0.025, 8, 8), centre.x - 0.05, y, z, 0, 0, 0, 0xff2020),
      bakePart(new THREE.SphereGeometry(0.025, 8, 8), centre.x + 0.05, y, z, 0, 0, 0, 0xff2020)
    ]);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
