import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import { bakePart, mergeParts } from './geometryUtils';
import type { ActiveEnemy } from '../../core/types';
import { ProceduralTextures } from '../ProceduralTextures';
import { ELITE_AFFIXES } from '../../data/enemies';
import { DEATH_ANIMATION_SECONDS } from '../../data/balance';
import { ENDO_VISUAL_SCALE, PALETTE } from '../../data/artDirection';
import type { EndoModel } from '../EndoModel';
import { ModelLibrary } from '../ModelLibrary';

/** One walking body drawn with instancing: chassis, two jointed legs, glowing eyes, held weapon. */
interface WalkerSet {
  chassis: THREE.InstancedMesh;
  /** Thighs (the whole leg for the procedural stand-in) */
  leftLeg: THREE.InstancedMesh;
  rightLeg: THREE.InstancedMesh;
  /** Shins hanging from the knees; null when the legs are one piece */
  leftShin: THREE.InstancedMesh | null;
  rightShin: THREE.InstancedMesh | null;
  kneeL: THREE.Vector3;
  kneeR: THREE.Vector3;
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
  private readonly maxCount: number;

  private readonly dummy = new THREE.Object3D();
  private readonly legDummy = new THREE.Object3D();
  private readonly dummyColor = new THREE.Color();
  private readonly legQuat = new THREE.Quaternion();
  private readonly swingQuat = new THREE.Quaternion();
  private readonly hipOffset = new THREE.Vector3();
  private readonly hipPos = new THREE.Vector3();
  private readonly kneePos = new THREE.Vector3();
  private readonly shinQuat = new THREE.Quaternion();
  // Walk cycle per enemy, advanced by the ground it actually covers so feet don't skate
  private readonly gaits = new Map<number, { x: number; z: number; phase: number; amp: number; stamp: number; moved: number }>();
  private gaitStamp = 0;
  private readonly chassisMat: THREE.MeshStandardMaterial;
  // Rifle carried by the sculpted model (the procedural chassis has its rifle built in)
  private rifleInstancedMesh: THREE.InstancedMesh | null = null;
  // The T-800 / T-700 body (and the T-600 until it has its own), plus the sculpted T-600 once loaded
  private readonly mainSet: WalkerSet;
  private t600Set: WalkerSet | null = null;
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private lastTime = 0;
  private lastGaitTime = 0;
  private readonly deadColor = new THREE.Color(0x3a3d42);
  private readonly xAxis = new THREE.Vector3(1, 0, 0);
  private readonly corpses: Array<{
    x: number;
    z: number;
    facing: number;
    id: number;
    scale: number;
    archetype: string;
    age: number;
  }> = [];

  constructor(maxCount = 650) {
    this.maxCount = maxCount;

    // Placeholder body until the sculpted T-800 loads (the title screen holds Deploy until then)
    const steel = 0x8a9098;
    const chassisGeo = mergeParts([bakePart(new THREE.BoxGeometry(0.5, 0.95, 0.3), 0, 1.3, 0, 0, 0, 0, steel)]);
    const leftLegGeo = bakePart(new THREE.BoxGeometry(0.14, 0.8, 0.14), -0.15, -0.4, 0, 0, 0, 0, steel);
    const rightLegGeo = bakePart(new THREE.BoxGeometry(0.14, 0.8, 0.14), 0.15, -0.4, 0, 0, 0, 0, steel);

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

    // Glowing red optics
    const opticsGeo = mergeParts([
      bakePart(new THREE.SphereGeometry(0.035, 6, 6), -0.06, 1.72, 0.16, 0, 0, 0, 0xff2020),
      bakePart(new THREE.SphereGeometry(0.035, 6, 6), 0.06, 1.72, 0.16, 0, 0, 0, 0xff2020)
    ]);

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

    this.mainSet = {
      chassis: this.chassisInstancedMesh,
      leftLeg: this.leftLegInstancedMesh,
      rightLeg: this.rightLegInstancedMesh,
      leftShin: null,
      rightShin: null,
      kneeL: new THREE.Vector3(),
      kneeR: new THREE.Vector3(),
      optics: this.opticsInstancedMesh,
      weapon: null,
      hipHeight: 0.68, // procedural stand-in; the sculpted model sets its own
      index: 0
    };
    // Pitch and roll about the body's own axes after it turns to face its target
    this.dummy.rotation.order = 'YXZ';

    this.group.add(
      this.chassisInstancedMesh,
      this.leftLegInstancedMesh,
      this.rightLegInstancedMesh,
      this.opticsInstancedMesh
    );
  }

  /** True for the archetypes this batch draws (and so can animate dying). */
  public handles(archetype: string): boolean {
    return (
      archetype === 't800_endoskeleton' ||
      archetype === 't600_rusted'
    );
  }

  /** Keeps a destroyed enemy on screen for a short collapse animation instead of removing it instantly. */
  public addCorpse(enemy: ActiveEnemy, playerX: number, playerZ: number): void {
    if (!this.handles(enemy.archetype) || this.corpses.length >= 48) return;
    let scale = ENDO_VISUAL_SCALE;
    if (enemy.archetype === 't600_rusted') scale *= 1.25;
    if (enemy.isElite) scale *= enemy.scale ?? 1.4;
    this.corpses.push({
      x: enemy.x,
      z: enemy.z,
      facing: Math.atan2(playerX - enemy.x, playerZ - enemy.z),
      id: enemy.id,
      scale,
      archetype: enemy.archetype,
      age: 0
    });
  }

  public clearCorpses(): void {
    this.corpses.length = 0;
  }

  /** Draws the collapsing corpses after the live enemies (shares the instance buffers). */
  private renderCorpses(timeSeconds: number): void {
    const dt = Math.max(0, Math.min(0.1, timeSeconds - this.lastTime));
    this.lastTime = timeSeconds;

    for (let c = this.corpses.length - 1; c >= 0; c--) {
      const corpse = this.corpses[c];
      corpse.age += dt;
      if (corpse.age >= DEATH_ANIMATION_SECONDS) {
        this.corpses.splice(c, 1);
        continue;
      }
      const p = corpse.age / DEATH_ANIMATION_SECONDS;
      const ease = 1 - (1 - p) * (1 - p);

      const set = this.setFor(corpse.archetype);
      if (set.index >= this.maxCount) continue;
      // Falls backward about its feet, knees buckling; eyes flicker then go dark
      const phase = corpse.age * 7.5;
      this.dummy.position.set(corpse.x, -0.06 * ease, corpse.z);
      this.dummy.rotation.set(-1.45 * ease, corpse.facing, 0.15 * Math.sin(phase) * (1 - ease));
      this.dummy.scale.setScalar(corpse.scale);
      this.dummy.updateMatrix();
      set.chassis.setMatrixAt(set.index, this.dummy.matrix);
      set.weapon?.setMatrixAt(set.index, this.dummy.matrix);
      const eyesOn = p < 0.3 && Math.sin(corpse.age * 70) > 0;
      set.optics.setMatrixAt(set.index, eyesOn ? this.dummy.matrix : this.zeroMatrix);

      // Legs hang off the hips as the body tips over, one kicking up, both knees buckling
      this.writeLegs(set, corpse.scale, -0.7 * ease, 0.9 * ease, 0.35 * ease, 0.5 * ease);

      // Fades from chrome to scorched grey
      this.dummyColor.setHex(this.tintFor(corpse.archetype)).lerp(this.deadColor, p);
      this.colorSet(set);
      set.index++;
    }
  }

  /** The T-600s get their own body once the sculpted T-600 has loaded. */
  private setFor(archetype: string): WalkerSet {
    return archetype === 't600_rusted' && this.t600Set ? this.t600Set : this.mainSet;
  }

  /** Tint that tells the variants apart (the sculpted T-600 only needs light weathering). */
  private tintFor(archetype: string): number {
    if (archetype === 't600_rusted') return this.t600Set ? 0xe0d4c4 : 0xd2b08c;
    return 0xffffff;
  }

  /** Tracks how far an enemy moved since last frame and how strongly it is walking (0 standing, 1 striding). */
  private gaitFor(enemy: ActiveEnemy, dt: number) {
    let g = this.gaits.get(enemy.id);
    if (!g) {
      g = { x: enemy.x, z: enemy.z, phase: enemy.id * 1.3, amp: 1, stamp: 0, moved: 0 };
      this.gaits.set(enemy.id, g);
    }
    // Ignore teleports (spawns, wraps) so the legs don't spin
    const moved = Math.min(Math.hypot(enemy.x - g.x, enemy.z - g.z), 0.5);
    g.x = enemy.x;
    g.z = enemy.z;
    g.moved = moved;
    g.stamp = this.gaitStamp;
    const target = dt > 0 ? Math.min(1, moved / dt / 0.8) : g.amp;
    g.amp += (target - g.amp) * Math.min(1, dt * 6);
    return g;
  }

  /** Thighs from the hips of the body in this.dummy, shins from the knees. Angles are radians; negative thigh = forward. */
  private writeLegs(set: WalkerSet, scale: number, thighL: number, kneeL: number, thighR: number, kneeR: number): void {
    this.hipOffset.set(0, set.hipHeight * scale, 0).applyQuaternion(this.dummy.quaternion);
    this.hipPos.copy(this.dummy.position).add(this.hipOffset);
    this.legDummy.scale.setScalar(scale);
    const leg = (thighMesh: THREE.InstancedMesh, shinMesh: THREE.InstancedMesh | null, knee: THREE.Vector3, thigh: number, bend: number) => {
      this.swingQuat.setFromAxisAngle(this.xAxis, thigh);
      this.legQuat.copy(this.dummy.quaternion).multiply(this.swingQuat);
      this.legDummy.position.copy(this.hipPos);
      this.legDummy.quaternion.copy(this.legQuat);
      this.legDummy.updateMatrix();
      thighMesh.setMatrixAt(set.index, this.legDummy.matrix);
      if (!shinMesh) return;
      this.kneePos.copy(knee).multiplyScalar(scale).applyQuaternion(this.legQuat).add(this.hipPos);
      this.swingQuat.setFromAxisAngle(this.xAxis, bend);
      this.shinQuat.copy(this.legQuat).multiply(this.swingQuat);
      this.legDummy.position.copy(this.kneePos);
      this.legDummy.quaternion.copy(this.shinQuat);
      this.legDummy.updateMatrix();
      shinMesh.setMatrixAt(set.index, this.legDummy.matrix);
    };
    leg(set.leftLeg, set.leftShin, set.kneeL, thighL, kneeL);
    leg(set.rightLeg, set.rightShin, set.kneeR, thighR, kneeR);
  }

  /** Writes this.dummyColor to every tinted part of the current instance. */
  private colorSet(set: WalkerSet): void {
    for (const mesh of [set.chassis, set.leftLeg, set.rightLeg, set.leftShin, set.rightShin]) {
      mesh?.setColorAt(set.index, this.dummyColor);
    }
  }

  public updateBatch(enemies: ActiveEnemy[], timeSeconds: number, playerX = 0, playerZ = 0): void {
    const dt = Math.max(0, Math.min(0.1, timeSeconds - this.lastGaitTime));
    this.lastGaitTime = timeSeconds;
    this.gaitStamp++;
    this.mainSet.index = 0;
    if (this.t600Set) this.t600Set.index = 0;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const facingAngle = Math.atan2(playerX - enemy.x, playerZ - enemy.z);

      // Only render humanoid endoskeletons in the primary instanced batch
      if (
        enemy.archetype !== 't800_endoskeleton' &&
        enemy.archetype !== 't600_rusted'
      ) {
        continue;
      }
      const set = this.setFor(enemy.archetype);
      if (set.index >= this.maxCount) continue;

      // Scale variation for T-600 heavy vs T-700 runner
      let scale = ENDO_VISUAL_SCALE;
      if (enemy.archetype === 't600_rusted') scale *= 1.25;
      if (enemy.isElite) scale *= (enemy.scale ?? 1.4);

      // Heavy, deliberate stride: one step per ~0.8 m of ground covered, settling still when stopped
      const g = this.gaitFor(enemy, dt);
      const strideLength = 1.6 * scale;
      g.phase += (g.moved / strideLength) * Math.PI * 2;
      const p = g.phase;
      const amp = g.amp;
      let thighL = -Math.sin(p) * 0.5 * amp;
      let thighR = -thighL;
      // Knee folds while a leg swings through, nearly straight while it carries the weight
      let kneeL = (0.1 + 0.7 * Math.pow(Math.max(0, Math.cos(p)), 1.4)) * amp;
      let kneeR = (0.1 + 0.7 * Math.pow(Math.max(0, -Math.cos(p)), 1.4)) * amp;
      // Hips drop as the legs open so the planted foot stays on the ground; the weight shifts over it
      let bobY = -(1 - Math.cos(thighL)) * set.hipHeight * scale - 0.012 * amp * scale;
      let rollZ = Math.sin(p) * 0.02 * amp;
      let pitchX = 0.07 * amp; // leans into the walk
      let posX = enemy.x;
      let posZ = enemy.z;

      // Stagger backward on hit, knees giving a little
      if (enemy.hitFlashTimer > 0) {
        const stagger = Math.min(1.0, enemy.hitFlashTimer / 0.15);
        pitchX -= 0.25 * stagger;
        rollZ += ((enemy.id % 2 === 0 ? 1 : -1) * 0.08) * stagger;
        bobY -= 0.04 * stagger;
        thighL = thighL * (1 - stagger * 0.5) - 0.15 * stagger;
        thighR = thighR * (1 - stagger * 0.5) - 0.15 * stagger;
        kneeL += 0.3 * stagger;
        kneeR += 0.3 * stagger;
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
      // Legs stay upright under the lean so the feet land flat
      this.dummy.rotation.set(pitchX * 0.3, facingAngle, rollZ);
      this.dummy.updateMatrix();
      this.writeLegs(set, scale, thighL, kneeL, thighR, kneeR);

      // Color tint & hit flash
      if (enemy.hitFlashTimer > 0) {
        this.dummyColor.setHex(0xffffff);
      } else if (enemy.isElite && enemy.affix) {
        this.dummyColor.setHex(ELITE_AFFIXES[enemy.affix]?.tintColor ?? 0xffab00);
      } else {
        this.dummyColor.setHex(this.tintFor(enemy.archetype));
      }
      this.colorSet(set);

      set.index++;
    }

    // Forget the walk cycles of enemies that are gone
    for (const [id, g] of this.gaits) if (g.stamp !== this.gaitStamp) this.gaits.delete(id);

    this.renderCorpses(timeSeconds);
    this.finishSet(this.mainSet);
    if (this.t600Set) this.finishSet(this.t600Set);

  }

  private finishSet(set: WalkerSet): void {
    for (const mesh of [set.chassis, set.leftLeg, set.rightLeg, set.leftShin, set.rightShin, set.optics, set.weapon]) {
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
    this.mainSet.leftShin = this.addInstanced(model.leftShin, model.material);
    this.mainSet.rightShin = this.addInstanced(model.rightShin, model.material);
    this.mainSet.kneeL.copy(model.kneeL);
    this.mainSet.kneeR.copy(model.kneeR);
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
    const make = (geometry: THREE.BufferGeometry, material: THREE.Material) => this.addInstanced(geometry, material);
    this.t600Set = {
      chassis: make(model.chassis, model.material),
      leftLeg: make(model.leftLeg, model.material),
      rightLeg: make(model.rightLeg, model.material),
      leftShin: make(model.leftShin, model.material),
      rightShin: make(model.rightShin, model.material),
      kneeL: model.kneeL.clone(),
      kneeR: model.kneeR.clone(),
      optics: make(model.eyes, this.opticsInstancedMesh.material as THREE.Material),
      weapon: weapon ? make(weapon.geometry, weapon.material) : null,
      hipHeight: model.hipHeight,
      index: 0
    };
  }

  private addInstanced(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.maxCount);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.group.add(mesh);
    return mesh;
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
