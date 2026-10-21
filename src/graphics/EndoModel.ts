import * as THREE from 'three';
import { bakePart, mergeParts } from './meshes/geometryUtils';
import { aimBone, findBones, type HumanoidRig } from './HumanoidAnimator';
import type { AutoRigged } from './AutoRig';

/**
 * Turns the rigged T-800 model (public/models/t800.glb, an A-pose) into the pieces the instanced
 * EndoskeletonBatch draws: the arms are posed into a two-handed rifle carry, the skinning is baked
 * into static geometry, and the legs are cut away at the hips (by skin weight) so they can swing.
 */
export interface EndoModel {
  /** Body, arms and head; origin on the ground between the feet, facing +z */
  chassis: THREE.BufferGeometry;
  /** Each leg with its origin at the hip joint height */
  /** Thighs, with their origin at the hip joint height */
  leftLeg: THREE.BufferGeometry;
  rightLeg: THREE.BufferGeometry;
  /** Shins and feet, each with its origin at the knee, so the knees can bend */
  leftShin: THREE.BufferGeometry;
  rightShin: THREE.BufferGeometry;
  /** Knee joint positions relative to the hip origin (0, hipHeight, 0) */
  kneeL: THREE.Vector3;
  kneeR: THREE.Vector3;
  material: THREE.Material;
  /** Height of the hip joints above the ground */
  hipHeight: number;
  /** Two glowing eye beads in the skull's sockets */
  eyes: THREE.BufferGeometry;
  /** Plasma rifle held in the hands (simple stand-in until the sculpted rifle loads) */
  rifle: THREE.BufferGeometry;
  /** Where the right hand grips the rifle */
  rifleGrip: THREE.Vector3;
}

const ENDO_HEIGHT = 1.85;

const v1 = new THREE.Vector3();

/** Plasma rifle along +z with the pistol grip at the origin (vertex-coloured, for the batch material). */
function buildRifle(): THREE.BufferGeometry {
  const gun = 0x2b2e33;
  const accent = 0x464b52;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) =>
    bakePart(new THREE.BoxGeometry(w, h, d), x, y, z, 0, 0, 0, c);
  const tube = (r: number, len: number, z: number, c: number) =>
    bakePart(new THREE.CylinderGeometry(r, r, len, 10), 0, 0.1, z, Math.PI / 2, 0, 0, c);
  return mergeParts([
    box(0.05, 0.12, 0.26, 0, 0.08, -0.24, gun), // stock
    box(0.08, 0.13, 0.46, 0, 0.1, 0.1, gun), // receiver
    box(0.04, 0.12, 0.06, 0, 0.0, 0.0, gun), // grip
    box(0.06, 0.15, 0.09, 0, -0.01, 0.18, accent), // power cell
    box(0.035, 0.05, 0.24, 0, 0.19, 0.08, accent), // sight rail
    tube(0.047, 0.38, 0.52, gun), // shroud
    tube(0.051, 0.014, 0.42, accent),
    tube(0.051, 0.014, 0.52, accent),
    tube(0.051, 0.014, 0.62, accent),
    tube(0.022, 0.14, 0.77, accent), // emitter
    box(0.082, 0.024, 0.12, 0, 0.17, 0.2, 0xb0261a) // plasma chamber window
  ]);
}

function findSkinned(scene: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  return found;
}

/** The rigged T-800 (Mixamo-style bone names). */
export function bakeEndoModel(scene: THREE.Object3D): EndoModel | null {
  const mesh = findSkinned(scene);
  const rig = mesh
    ? findBones(scene, {
        hips: 'Hips',
        upperArmL: 'LeftArm',
        foreArmL: 'LeftForeArm',
        handL: 'LeftHand',
        upperArmR: 'RightArm',
        foreArmR: 'RightForeArm',
        handR: 'RightHand',
        thighL: 'LeftUpLeg',
        shinL: 'LeftLeg',
        footL: 'LeftFoot',
        toeL: 'LeftToeBase',
        thighR: 'RightUpLeg',
        shinR: 'RightLeg',
        footR: 'RightFoot',
        toeR: 'RightToeBase'
      })
    : null;
  return mesh && rig ? bakeWalker(scene, mesh, rig) : null;
}

/** Any humanoid rigged by AutoRig (e.g. the T-600). */
export function bakeAutoRigged(rigged: AutoRigged): EndoModel | null {
  const mesh = findSkinned(rigged.root);
  return mesh ? bakeWalker(rigged.root, mesh, rigged.rig) : null;
}

function bakeWalker(scene: THREE.Object3D, mesh: THREE.SkinnedMesh, rig: HumanoidRig): EndoModel {
  scene.updateMatrixWorld(true);

  // 1. Pose: rifle carried low in both hands, muzzle forward (+z). Sides come from the rig itself.
  const hipsX = rig.hips.getWorldPosition(new THREE.Vector3()).x;
  const sR = Math.sign(rig.upperArmR.getWorldPosition(v1).x - hipsX) || -1;
  const sL = -sR;
  aimBone(rig.upperArmR, rig.foreArmR, new THREE.Vector3(sR * 0.3, -0.85, 0.42));
  aimBone(rig.foreArmR, rig.handR, new THREE.Vector3(-sR * 0.2, -0.12, 0.97));
  aimBone(rig.upperArmL, rig.foreArmL, new THREE.Vector3(sL * 0.12, -0.72, 0.68));
  aimBone(rig.foreArmL, rig.handL, new THREE.Vector3(-sL * 0.55, -0.02, 0.84));
  scene.updateMatrixWorld(true);
  mesh.skeleton.update();

  // 2. Bake the skinning (positions, normals, tangents) into world space
  const src = mesh.geometry;
  const pos = src.getAttribute('position');
  const nrm = src.getAttribute('normal');
  const tan = src.getAttribute('tangent');
  const skinIndex = src.getAttribute('skinIndex');
  const skinWeight = src.getAttribute('skinWeight');
  const boneMatrices = mesh.skeleton.boneMatrices!;
  const count = pos.count;
  const outPos = new Float32Array(count * 3);
  const outNrm = new Float32Array(count * 3);
  const outTan = tan ? new Float32Array(count * 4) : null;
  const legL = new Float32Array(count);
  const legR = new Float32Array(count);
  // Thigh-bone share of each vertex's leg weight, to cut the leg at the knee
  const thighL = new Float32Array(count);
  const thighR = new Float32Array(count);
  const thighLId = mesh.skeleton.bones.indexOf(rig.thighL as THREE.Bone);
  const thighRId = mesh.skeleton.bones.indexOf(rig.thighR as THREE.Bone);
  const boneIds = (list: Array<THREE.Object3D | undefined>) =>
    new Set(list.map((b) => (b ? mesh.skeleton.bones.indexOf(b as THREE.Bone) : -1)).filter((i) => i >= 0));
  const leftIds = boneIds([rig.thighL, rig.shinL, rig.footL, rig.toeL]);
  const rightIds = boneIds([rig.thighR, rig.shinR, rig.footR, rig.toeR]);

  const blend = new THREE.Matrix4();
  const boneM = new THREE.Matrix4();
  const skinM = new THREE.Matrix4();
  const normalM = new THREE.Matrix3();
  const dirM = new THREE.Matrix3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    blend.elements.fill(0);
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w === 0) continue;
      const bi = skinIndex.getComponent(i, k);
      boneM.fromArray(boneMatrices, bi * 16);
      for (let e = 0; e < 16; e++) blend.elements[e] += boneM.elements[e] * w;
      if (leftIds.has(bi)) legL[i] += w;
      if (rightIds.has(bi)) legR[i] += w;
      if (bi === thighLId) thighL[i] += w;
      if (bi === thighRId) thighR[i] += w;
    }
    skinM.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse).multiply(blend).multiply(mesh.bindMatrix);
    p.fromBufferAttribute(pos, i).applyMatrix4(skinM);
    outPos.set([p.x, p.y, p.z], i * 3);
    n.fromBufferAttribute(nrm, i).applyMatrix3(normalM.getNormalMatrix(skinM)).normalize();
    outNrm.set([n.x, n.y, n.z], i * 3);
    if (tan && outTan) {
      n.set(tan.getX(i), tan.getY(i), tan.getZ(i)).applyMatrix3(dirM.setFromMatrix4(skinM)).normalize();
      outTan.set([n.x, n.y, n.z, tan.getW(i)], i * 4);
    }
  }

  // 3. Normalise: 1.85 m tall, feet on y = 0, centred between the hip joints
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    minY = Math.min(minY, outPos[i * 3 + 1]);
    maxY = Math.max(maxY, outPos[i * 3 + 1]);
  }
  const scale = ENDO_HEIGHT / (maxY - minY);
  const hip = rig.thighL.getWorldPosition(new THREE.Vector3()).add(rig.thighR.getWorldPosition(v1)).multiplyScalar(0.5);
  for (let i = 0; i < count; i++) {
    outPos[i * 3] = (outPos[i * 3] - hip.x) * scale;
    outPos[i * 3 + 1] = (outPos[i * 3 + 1] - minY) * scale;
    outPos[i * 3 + 2] = (outPos[i * 3 + 2] - hip.z) * scale;
  }
  const hipHeight = (hip.y - minY) * scale;
  const toModel = (bone: THREE.Object3D) => {
    const w = bone.getWorldPosition(new THREE.Vector3());
    return w.set((w.x - hip.x) * scale, (w.y - minY) * scale, (w.z - hip.z) * scale);
  };
  const rightHand = toModel(rig.handR);
  const kneeLAt = toModel(rig.shinL);
  const kneeRAt = toModel(rig.shinR);

  // 4. Split triangles into body and legs by skin weight
  const index = src.getIndex();
  const triCount = index ? index.count / 3 : count / 3;
  const body: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  const leftShin: number[] = [];
  const rightShin: number[] = [];
  const avg = (a: Float32Array, ids: number[]) => (a[ids[0]] + a[ids[1]] + a[ids[2]]) / 3;
  for (let t = 0; t < triCount; t++) {
    const ids = [0, 1, 2].map((k) => (index ? index.getX(t * 3 + k) : t * 3 + k));
    const l = avg(legL, ids);
    const r = avg(legR, ids);
    // Leg triangles mostly bound to the thigh bone stay with the thigh; the rest belong to the shin
    if (l > 0.5) (avg(thighL, ids) > l * 0.5 ? left : leftShin).push(...ids);
    else if (r > 0.5) (avg(thighR, ids) > r * 0.5 ? right : rightShin).push(...ids);
    else body.push(...ids);
  }
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  base.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
  if (outTan) base.setAttribute('tangent', new THREE.BufferAttribute(outTan, 4));
  const uv = src.getAttribute('uv');
  if (uv) base.setAttribute('uv', uv);
  const part = (indices: number[], origin = new THREE.Vector3()): THREE.BufferGeometry => {
    const g = base.clone();
    g.setIndex(indices);
    g.translate(-origin.x, -origin.y, -origin.z);
    g.computeBoundingSphere();
    return g;
  };
  const hipOrigin = new THREE.Vector3(0, hipHeight, 0);

  // 5. Eyes: two beads in the sockets, found as the front of the face just below the brow
  const top = ENDO_HEIGHT;
  const eyeY = top - 0.115;
  let faceZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = outPos[i * 3 + 1];
    if (Math.abs(y - eyeY) < 0.03 && Math.abs(outPos[i * 3]) < 0.06) faceZ = Math.max(faceZ, outPos[i * 3 + 2]);
  }
  const eyeZ = (Number.isFinite(faceZ) ? faceZ : 0.1) - 0.024; // set back into the sockets
  const eyes = mergeParts([
    bakePart(new THREE.SphereGeometry(0.012, 10, 8), -0.03, eyeY, eyeZ, 0, 0, 0, 0xff0000),
    bakePart(new THREE.SphereGeometry(0.012, 10, 8), 0.03, eyeY, eyeZ, 0, 0, 0, 0xff0000)
  ]);

  const rifle = buildRifle();
  rifle.scale(0.9, 0.9, 0.9);
  rifle.translate(rightHand.x, rightHand.y, rightHand.z);

  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return {
    chassis: part(body),
    leftLeg: part(left, hipOrigin),
    rightLeg: part(right, hipOrigin),
    leftShin: part(leftShin, kneeLAt),
    rightShin: part(rightShin, kneeRAt),
    kneeL: kneeLAt.clone().sub(hipOrigin),
    kneeR: kneeRAt.clone().sub(hipOrigin),
    material,
    hipHeight,
    eyes,
    rifle,
    rifleGrip: rightHand
  };
}

/**
 * A standalone endoskeleton (codex previews): the baked pieces assembled as ordinary meshes.
 * `tint` recolours the chassis for the T-600 / T-700 variants; the geometry stays shared.
 */
export function createEndoPreview(
  model: EndoModel,
  tint = 0xffffff,
  weapon: { geometry: THREE.BufferGeometry; material: THREE.Material; grip: THREE.Vector3 } | null = null
): THREE.Group {
  const group = new THREE.Group();
  const mat = (model.material as THREE.MeshStandardMaterial).clone();
  mat.color.setHex(tint);
  // Thigh at the hip, shin hanging from the knee (named so a walker can swing them)
  const leftLeg = new THREE.Mesh(model.leftLeg, mat);
  const rightLeg = new THREE.Mesh(model.rightLeg, mat);
  leftLeg.name = 'thighL';
  rightLeg.name = 'thighR';
  leftLeg.position.y = model.hipHeight;
  rightLeg.position.y = model.hipHeight;
  const leftShin = new THREE.Mesh(model.leftShin, mat);
  const rightShin = new THREE.Mesh(model.rightShin, mat);
  leftShin.name = 'shinL';
  rightShin.name = 'shinR';
  leftShin.position.copy(model.kneeL);
  rightShin.position.copy(model.kneeR);
  leftLeg.add(leftShin);
  rightLeg.add(rightShin);
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  eyeMat.color.setScalar(4);
  const rifleMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.4 });
  group.add(new THREE.Mesh(model.chassis, mat), leftLeg, rightLeg, new THREE.Mesh(model.eyes, eyeMat));
  if (weapon) {
    const gun = new THREE.Mesh(weapon.geometry, weapon.material);
    gun.position.copy(model.rifleGrip).sub(weapon.grip);
    group.add(gun);
    rifleMat.dispose();
  } else {
    group.add(new THREE.Mesh(model.rifle, rifleMat));
  }
  return group;
}

/** Flags the baked geometry (and source material) as shared so disposing a preview never frees it. */
export function markEndoShared(model: EndoModel): void {
  for (const g of [model.chassis, model.leftLeg, model.rightLeg, model.leftShin, model.rightShin, model.eyes, model.rifle]) {
    g.userData.shared = true;
  }
  model.material.userData.shared = true;
}
