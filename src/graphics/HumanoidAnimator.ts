import * as THREE from 'three';

/** The bones a humanoid rig needs for the run cycle and the two-handed rifle hold. */
export interface HumanoidRig {
  hips: THREE.Object3D;
  chest?: THREE.Object3D;
  upperArmL: THREE.Object3D;
  foreArmL: THREE.Object3D;
  handL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  foreArmR: THREE.Object3D;
  handR: THREE.Object3D;
  thighL: THREE.Object3D;
  shinL: THREE.Object3D;
  footL: THREE.Object3D;
  toeL?: THREE.Object3D;
  thighR: THREE.Object3D;
  shinR: THREE.Object3D;
  footR: THREE.Object3D;
  toeR?: THREE.Object3D;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();

/**
 * Rotates a bone so the direction to its child points along `dir` in world space. Works on any rig
 * regardless of how its bones' local axes are set up.
 */
export function aimBone(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3): void {
  bone.updateWorldMatrix(true, true);
  const from = child.getWorldPosition(v1).sub(bone.getWorldPosition(v2)).normalize();
  const to = v2.copy(dir).normalize();
  const delta = q1.setFromUnitVectors(from, to);
  const world = delta.multiply(bone.getWorldQuaternion(q2));
  const parentInv = bone.parent ? bone.parent.getWorldQuaternion(q3).invert() : q3.identity();
  bone.quaternion.copy(parentInv.multiply(world));
  bone.updateWorldMatrix(false, true);
}

/** Finds bones by name, ignoring case, spaces and numeric suffixes ("arm right elbow_011"). */
export function findBones<K extends string>(
  root: THREE.Object3D,
  names: Record<K, string>
): Record<K, THREE.Object3D> | null {
  const byName = new Map<string, THREE.Object3D>();
  const key = (n: string) => n.toLowerCase().replace(/_\d+$/, '').replace(/[\s_]+/g, ' ').trim();
  root.traverse((o) => {
    if (!byName.has(key(o.name))) byName.set(key(o.name), o);
  });
  const out = {} as Record<K, THREE.Object3D>;
  for (const k of Object.keys(names) as K[]) {
    const bone = byName.get(key(names[k]));
    if (!bone) return null;
    out[k] = bone;
  }
  return out;
}

/**
 * Procedural run cycle and rifle hold for a rigged humanoid. The legs follow a running gait
 * (thigh swing, knee fold through the forward swing, flat feet), the hips bob and the body leans
 * into the run, and the arms are solved onto grip points given in the model's own space.
 * The model must face +z.
 */
export class HumanoidAnimator {
  /** Vertical bob to add to the model's position (the hips rise and fall twice per stride). */
  public bob = 0;

  private readonly rest = new Map<THREE.Object3D, THREE.Quaternion>();
  private readonly upperArm: number;
  private readonly foreArm: number;
  /** Which side (model-local x sign) the right arm is on: rigs differ */
  private readonly rightSide: number;
  private phase = 0;
  private gait = 0;
  private time = 0;

  private readonly dir = new THREE.Vector3();
  private readonly shoulder = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly armDir = new THREE.Vector3();
  private readonly reach = new THREE.Vector3();
  private readonly lean = new THREE.Quaternion();
  private readonly xAxis = new THREE.Vector3();

  constructor(
    private readonly root: THREE.Object3D,
    private readonly rig: HumanoidRig,
    private readonly strideLength = 3.2
  ) {
    root.updateMatrixWorld(true);
    for (const bone of Object.values(rig)) if (bone) this.rest.set(bone, bone.quaternion.clone());
    const dist = (a: THREE.Object3D, b: THREE.Object3D) => a.getWorldPosition(v1).distanceTo(b.getWorldPosition(v2));
    this.upperArm = dist(rig.upperArmR, rig.foreArmR);
    this.foreArm = dist(rig.foreArmR, rig.handR);
    this.rightSide = Math.sign(root.worldToLocal(rig.upperArmR.getWorldPosition(v1)).x) || -1;
  }

  /**
   * @param speed movement speed (0 standing)
   * @param gripR / gripL where the hands hold the rifle, in the model's local space (null: arms at rest)
   * @param legYaw turns the legs towards the direction of travel when it differs from the facing
   * @param backwards run the cycle in reverse (backpedalling)
   */
  public update(
    dt: number,
    speed: number,
    gripR: THREE.Vector3 | null,
    gripL: THREE.Vector3 | null,
    legYaw = 0,
    backwards = false
  ): void {
    this.time += dt;
    const moving = speed > 0.1;
    this.gait += ((moving ? 1 : 0) - this.gait) * Math.min(1, dt * 10);
    const w = this.gait;
    if (moving) this.phase += dt * (speed / this.strideLength) * Math.PI * 2 * (backwards ? -1 : 1);
    const p = this.phase;

    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    this.bob = w * (0.03 * Math.cos(2 * p) - 0.03);
    this.root.updateMatrixWorld(true);

    // Lean into the run (or slightly back when backpedalling), breathe when standing
    const leanAngle = w * (backwards ? -0.05 : 0.14) + Math.sin(this.time * 2.1) * 0.012 * (1 - w);
    const spine = this.rig.chest ?? this.rig.hips;
    this.xAxis.set(1, 0, 0).transformDirection(this.root.matrixWorld);
    this.lean.setFromAxisAngle(this.xAxis, leanAngle);
    spine.getWorldQuaternion(q2);
    q2.premultiply(this.lean);
    const parentInv = spine.parent ? spine.parent.getWorldQuaternion(q3).invert() : q3.identity();
    spine.quaternion.copy(parentInv.multiply(q2));
    spine.updateWorldMatrix(false, true);

    this.poseLeg(this.rig.thighL, this.rig.shinL, this.rig.footL, this.rig.toeL, p, w, legYaw);
    this.poseLeg(this.rig.thighR, this.rig.shinR, this.rig.footR, this.rig.toeR, p + Math.PI, w, legYaw);

    if (gripR) this.solveArm(this.rig.upperArmR, this.rig.foreArmR, this.rig.handR, gripR, this.rightSide);
    if (gripL) this.solveArm(this.rig.upperArmL, this.rig.foreArmL, this.rig.handL, gripL, -this.rightSide);
  }

  /** Model-local direction (rotated by the leg yaw) to world space. */
  private toWorld(x: number, y: number, z: number, yaw: number): THREE.Vector3 {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return this.dir.set(x * c + z * s, y, -x * s + z * c).transformDirection(this.root.matrixWorld);
  }

  private poseLeg(
    thigh: THREE.Object3D,
    shin: THREE.Object3D,
    foot: THREE.Object3D,
    toe: THREE.Object3D | undefined,
    p: number,
    w: number,
    yaw: number
  ): void {
    // Forward swing is +z; the knee folds through the forward swing and straightens for the stance
    const swing = Math.sin(p) * 0.7 * w;
    const knee = (0.08 + 1.15 * Math.pow(Math.max(0, Math.cos(p)), 1.4)) * w + 0.04;
    aimBone(thigh, shin, this.toWorld(0, -Math.cos(swing), Math.sin(swing), yaw));
    aimBone(shin, foot, this.toWorld(0, -Math.cos(swing - knee), Math.sin(swing - knee), yaw));
    if (toe) {
      const toeOff = Math.max(0, -Math.sin(p)) * 0.4 * w;
      aimBone(foot, toe, this.toWorld(0, -0.15 - toeOff, 1, yaw));
    }
  }

  /** Two-bone IK in world space; the elbow bends down and out towards the outward side (model-local x sign). */
  private solveArm(
    upper: THREE.Object3D,
    fore: THREE.Object3D,
    hand: THREE.Object3D,
    gripLocal: THREE.Vector3,
    outward: number
  ): void {
    upper.getWorldPosition(this.shoulder);
    this.target.copy(gripLocal).applyMatrix4(this.root.matrixWorld);
    const toTarget = this.reach.subVectors(this.target, this.shoulder);
    const a = this.upperArm;
    const b = this.foreArm;
    const d = Math.min(Math.max(toTarget.length(), 1e-4), (a + b) * 0.999);
    toTarget.normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    this.pole.set(outward * 0.6, -1, -0.3).transformDirection(this.root.matrixWorld);
    this.pole.addScaledVector(toTarget, -this.pole.dot(toTarget)).normalize();
    this.elbow.copy(this.shoulder).addScaledVector(toTarget, a * cosA).addScaledVector(this.pole, a * sinA);
    aimBone(upper, fore, this.armDir.subVectors(this.elbow, this.shoulder));
    this.target.copy(this.shoulder).addScaledVector(toTarget, d);
    aimBone(fore, hand, this.armDir.subVectors(this.target, this.elbow));
  }
}
