import * as THREE from 'three';
import type { HumanoidRig } from './HumanoidAnimator';

/**
 * Rigs an unrigged humanoid mesh in an A-pose (standing, facing +z, feet on y = 0) so the
 * HumanoidAnimator can run it. Joint positions are measured from the mesh itself (leg centres,
 * hands as the furthest points out to each side) or taken from standard proportions, and each
 * vertex is weighted to its two nearest bones. Limb bones only bind vertices on their own side.
 */
export interface AutoRigged {
  root: THREE.Group;
  rig: HumanoidRig;
}

interface Segment {
  bone: number;
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** -1 left only, +1 right only, 0 either side (sides relative to the body centre x) */
  side: number;
}

const tmp = new THREE.Vector3();
const ab = new THREE.Vector3();

function distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  ab.subVectors(b, a);
  const t = THREE.MathUtils.clamp(tmp.subVectors(p, a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
  return tmp.copy(a).addScaledVector(ab, t).distanceTo(p);
}

export function autoRigHumanoid(source: THREE.Object3D): AutoRigged | null {
  let found: THREE.Mesh | null = null;
  source.updateMatrixWorld(true);
  source.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  const mesh = found as THREE.Mesh | null;
  if (!mesh) return null;
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const pos = geometry.getAttribute('position');
  const count = pos.count;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  let height = 0;
  for (const p of pts) height = Math.max(height, p.y);
  const H = height;

  const band = (y0: number, y1: number) => pts.filter((p) => p.y >= y0 * H && p.y <= y1 * H);
  const mean = (list: THREE.Vector3[]) =>
    list.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, list.length));

  // Body centre from the pelvis band; the legs from the shin band, split left/right of the centre
  const cx = mean(band(0.47, 0.55)).x;
  const shins = band(0.15, 0.3);
  const rightSide = -1; // a model facing +z has its right side at -x
  const legR = mean(shins.filter((p) => Math.sign(p.x - cx) === rightSide));
  const legL = mean(shins.filter((p) => Math.sign(p.x - cx) === -rightSide));
  const hipY = 0.52 * H;
  const kneeY = 0.28 * H;
  const ankleY = 0.055 * H;
  const toeOf = (x: number) => {
    const feet = pts.filter((p) => p.y < 0.06 * H && Math.abs(p.x - x) < 0.12 * H);
    let front = feet[0] ?? new THREE.Vector3(x, 0, 0.1);
    for (const p of feet) if (p.z > front.z) front = p;
    return new THREE.Vector3(x, 0.02 * H, front.z);
  };
  const furthest = (side: number) => {
    let best = new THREE.Vector3(cx + side * 0.3 * H, 0.5 * H, 0);
    for (const p of pts) if ((p.x - cx) * side > (best.x - cx) * side && p.y > 0.3 * H) best = p.clone();
    return best;
  };

  const shoulderY = 0.81 * H;
  const shoulderX = 0.11 * H;
  const joints = {
    hips: new THREE.Vector3(cx, hipY, legR.z * 0.5 + legL.z * 0.5),
    chest: new THREE.Vector3(cx, 0.72 * H, 0),
    neck: new THREE.Vector3(cx, 0.86 * H, 0),
    headTop: new THREE.Vector3(cx, H, 0),
    shoulderR: new THREE.Vector3(cx + rightSide * shoulderX, shoulderY, 0),
    shoulderL: new THREE.Vector3(cx - rightSide * shoulderX, shoulderY, 0),
    tipR: furthest(rightSide),
    tipL: furthest(-rightSide),
    thighR: new THREE.Vector3(legR.x, hipY, legR.z),
    thighL: new THREE.Vector3(legL.x, hipY, legL.z),
    kneeR: new THREE.Vector3(legR.x, kneeY, legR.z),
    kneeL: new THREE.Vector3(legL.x, kneeY, legL.z),
    ankleR: new THREE.Vector3(legR.x, ankleY, legR.z),
    ankleL: new THREE.Vector3(legL.x, ankleY, legL.z),
    toeR: toeOf(legR.x),
    toeL: toeOf(legL.x)
  };
  // Wrist a hand's length back from the fingertips; elbow halfway along the arm
  const wrist = (shoulder: THREE.Vector3, tip: THREE.Vector3) =>
    tip.clone().add(shoulder.clone().sub(tip).normalize().multiplyScalar(0.1 * H));
  const wristR = wrist(joints.shoulderR, joints.tipR);
  const wristL = wrist(joints.shoulderL, joints.tipL);
  const elbowR = joints.shoulderR.clone().lerp(wristR, 0.5);
  const elbowL = joints.shoulderL.clone().lerp(wristL, 0.5);

  // Bones (positions relative to their parent; all rest rotations are identity)
  const bones: THREE.Bone[] = [];
  const world: THREE.Vector3[] = [];
  const add = (name: string, at: THREE.Vector3, parent: number): number => {
    const bone = new THREE.Bone();
    bone.name = name;
    if (parent >= 0) {
      bone.position.subVectors(at, world[parent]);
      bones[parent].add(bone);
    } else {
      bone.position.copy(at);
    }
    bones.push(bone);
    world.push(at.clone());
    return bones.length - 1;
  };
  const hips = add('hips', joints.hips, -1);
  const chest = add('chest', joints.chest, hips);
  const neck = add('neck', joints.neck, chest);
  // Tip bones give the head and hands a child to aim at
  add('headTop', joints.headTop, neck);
  const upperArmR = add('upperArmR', joints.shoulderR, chest);
  const foreArmR = add('foreArmR', elbowR, upperArmR);
  const handR = add('handR', wristR, foreArmR);
  add('tipR', joints.tipR, handR);
  const upperArmL = add('upperArmL', joints.shoulderL, chest);
  const foreArmL = add('foreArmL', elbowL, upperArmL);
  const handL = add('handL', wristL, foreArmL);
  add('tipL', joints.tipL, handL);
  const thighR = add('thighR', joints.thighR, hips);
  const shinR = add('shinR', joints.kneeR, thighR);
  const footR = add('footR', joints.ankleR, shinR);
  const toeR = add('toeR', joints.toeR, footR);
  const thighL = add('thighL', joints.thighL, hips);
  const shinL = add('shinL', joints.kneeL, thighL);
  const footL = add('footL', joints.ankleL, shinL);
  const toeL = add('toeL', joints.toeL, footL);

  const R = rightSide;
  const segments: Segment[] = [
    { bone: hips, a: joints.hips, b: joints.chest, side: 0 },
    { bone: chest, a: joints.chest, b: joints.neck, side: 0 },
    { bone: neck, a: joints.neck, b: joints.headTop, side: 0 },
    { bone: upperArmR, a: joints.shoulderR, b: elbowR, side: R },
    { bone: foreArmR, a: elbowR, b: wristR, side: R },
    { bone: handR, a: wristR, b: joints.tipR, side: R },
    { bone: upperArmL, a: joints.shoulderL, b: elbowL, side: -R },
    { bone: foreArmL, a: elbowL, b: wristL, side: -R },
    { bone: handL, a: wristL, b: joints.tipL, side: -R },
    { bone: thighR, a: joints.thighR, b: joints.kneeR, side: R },
    { bone: shinR, a: joints.kneeR, b: joints.ankleR, side: R },
    { bone: footR, a: joints.ankleR, b: joints.toeR, side: R },
    { bone: thighL, a: joints.thighL, b: joints.kneeL, side: -R },
    { bone: shinL, a: joints.kneeL, b: joints.ankleL, side: -R },
    { bone: footL, a: joints.ankleL, b: joints.toeL, side: -R }
  ];

  // Two nearest bones per vertex, weighted 1/d^4
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const p = pts[i];
    const side = Math.sign(p.x - cx);
    let best = [-1, -1];
    let bestD = [Infinity, Infinity];
    for (const s of segments) {
      if (s.side !== 0 && s.side !== side) continue;
      const d = distanceToSegment(p, s.a, s.b);
      if (d < bestD[0]) {
        best = [s.bone, best[0]];
        bestD = [d, bestD[0]];
      } else if (d < bestD[1] && s.bone !== best[0]) {
        best[1] = s.bone;
        bestD[1] = d;
      }
    }
    const w0 = 1 / Math.pow(bestD[0] + 1e-3, 4);
    const w1 = best[1] >= 0 ? 1 / Math.pow(bestD[1] + 1e-3, 4) : 0;
    skinIndex[i * 4] = best[0];
    skinIndex[i * 4 + 1] = Math.max(0, best[1]);
    skinWeight[i * 4] = w0 / (w0 + w1);
    skinWeight[i * 4 + 1] = w1 / (w0 + w1);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const skinned = new THREE.SkinnedMesh(geometry, mesh.material);
  skinned.frustumCulled = false;
  const root = new THREE.Group();
  root.add(skinned, bones[hips]);
  root.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));

  return {
    root,
    rig: {
      hips: bones[hips],
      chest: bones[chest],
      upperArmL: bones[upperArmL],
      foreArmL: bones[foreArmL],
      handL: bones[handL],
      upperArmR: bones[upperArmR],
      foreArmR: bones[foreArmR],
      handR: bones[handR],
      thighL: bones[thighL],
      shinL: bones[shinL],
      footL: bones[footL],
      toeL: bones[toeL],
      thighR: bones[thighR],
      shinR: bones[shinR],
      footR: bones[footR],
      toeR: bones[toeR]
    }
  };
}
