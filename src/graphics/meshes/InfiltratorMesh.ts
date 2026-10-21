import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import { ModelLibrary } from '../ModelLibrary';
import { HumanoidAnimator, findBones } from '../HumanoidAnimator';

// Rig bone names of the sculpted infiltrator (game-style skeleton)
const INFILTRATOR_BONES = {
  hips: 'root hips',
  chest: 'spine upper',
  upperArmL: 'arm left shoulder 2',
  foreArmL: 'arm left elbow',
  handL: 'arm left wrist',
  upperArmR: 'arm right shoulder 2',
  foreArmR: 'arm right elbow',
  handR: 'arm right wrist',
  thighL: 'leg left thigh',
  shinL: 'leg left knee',
  footL: 'leg left foot',
  toeL: 'leg left toe',
  thighR: 'leg right thigh',
  shinR: 'leg right knee',
  footR: 'leg right foot',
  toeR: 'leg right toe'
};

export class InfiltratorMesh {
  public readonly group = new THREE.Group();
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly torsoGroup: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly plasmaRifle: THREE.Group;
  private readonly redOptic: THREE.Mesh;
  private readonly opticLight: THREE.PointLight;

  private walkCycle = 0;

  // Sculpted, rigged figure (when loaded): animated by the rig instead of the procedural limbs
  private rig: HumanoidAnimator | null = null;
  private model: THREE.Object3D | null = null;
  private rifleMesh: THREE.Mesh | null = null;
  private readonly rifleGrip = new THREE.Vector3();
  private rightX = -1;
  private readonly gripR = new THREE.Vector3();
  private readonly gripL = new THREE.Vector3();

  constructor() {
    // Materials
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x28292d, // Black biker leather
      roughness: 0.5,
      metalness: 0.25
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e0, // Exposed T-800 hyperalloy endoskeleton
      metalness: 0.95,
      roughness: 0.18
    });

    const trouserMat = new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.85,
      metalness: 0.1
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x101012,
      roughness: 0.7,
      metalness: 0.2
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xc8987b,
      roughness: 0.6,
      metalness: 0.05
    });

    const opticMat = new THREE.MeshBasicMaterial({
      color: 0xff0022
    });

    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x2b3038,
      roughness: 0.45,
      metalness: 0.75
    });

    const hairMat = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.9, metalness: 0.05 });
    const shadesMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.12, metalness: 0.8 });

    // 1. Legs: black jeans over heavy boots
    const buildLeg = (x: number): THREE.Group => {
      const leg = new THREE.Group();
      leg.position.set(x, 0.9, 0);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.52, 10), trouserMat);
      thigh.position.y = -0.24;
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.125, 8, 6), trouserMat);
      knee.position.y = -0.5;
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.46, 10), trouserMat);
      shin.position.y = -0.66;
      const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.2, 10), bootMat);
      bootShaft.position.y = -0.84;
      const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.4), bootMat);
      bootFoot.position.set(0, -0.93, 0.07);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.42), shadesMat);
      sole.position.set(0, -0.99, 0.07);
      leg.add(thigh, knee, shin, bootShaft, bootFoot, sole);
      return leg;
    };
    this.leftLeg = buildLeg(-0.25);
    this.rightLeg = buildLeg(0.25);
    this.group.add(this.leftLeg, this.rightLeg);

    // 2. Torso: tapered leather biker jacket with lapels, collar, zip, belt and a torn chrome rib plate
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.9, 0);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.7, 14), leatherMat);
    torso.position.y = 0.38;
    torso.scale.set(1, 1, 0.66);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.07, 14), leatherMat);
    hem.position.y = 0.03;
    hem.scale.set(1, 1, 0.68);
    const ribPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.04), chromeMat);
    ribPlate.position.set(-0.14, 0.4, 0.235);
    ribPlate.rotation.y = 0.15;
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.3, 0.05), leatherMat);
    lapelL.position.set(-0.13, 0.62, 0.23);
    lapelL.rotation.set(0, 0.3, 0.32);
    const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.3, 0.05), leatherMat);
    lapelR.position.set(0.13, 0.62, 0.23);
    lapelR.rotation.set(0, -0.3, -0.32);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 14), leatherMat);
    collar.position.set(0, 0.74, -0.01);
    collar.rotation.x = Math.PI / 2;
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), chromeMat);
    zip.position.set(0, 0.34, 0.235);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.07, 14), bootMat);
    belt.position.y = 0.0;
    belt.scale.set(1, 1, 0.68);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), chromeMat);
    buckle.position.set(0, 0.0, 0.235);
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), leatherMat);
    shoulderL.position.set(-0.45, 0.66, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.45;

    this.torsoGroup.add(torso, hem, ribPlate, lapelL, lapelR, collar, zip, belt, buckle, shoulderL, shoulderR);

    // 3. Head: flesh with hair and sunglasses on the left, exposed chrome skull and crimson optic on the right
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.88, 0);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 8), skinMat);
    neck.position.y = -0.1;
    const headFlesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skinMat);
    headFlesh.scale.set(0.94, 1.1, 1.02);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.18), skinMat);
    jaw.position.set(0, -0.1, 0.05);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.06), skinMat);
    nose.position.set(0, -0.01, 0.17);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.178, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), hairMat);
    hair.position.set(0, 0.03, -0.01);
    hair.scale.set(0.96, 1.05, 1.05);
    // Sunglasses over the intact eye
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), shadesMat);
    shades.position.set(-0.07, 0.03, 0.165);
    const shadesBridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.012), shadesMat);
    shadesBridge.position.set(0, 0.04, 0.16);

    // Chrome half-skull over the right side of the face (x >= 0)
    const skullPlate = new THREE.Mesh(
      new THREE.SphereGeometry(0.176, 14, 12, Math.PI / 2, Math.PI, 0, Math.PI),
      chromeMat
    );
    skullPlate.scale.set(0.94, 1.1, 1.02);
    const skullJaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.17), chromeMat);
    skullJaw.position.set(0.06, -0.1, 0.05);

    // Iconic glowing crimson sensor eye in a dark socket
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 12), shadesMat);
    socket.rotation.x = Math.PI / 2;
    socket.position.set(0.075, 0.03, 0.15);
    this.redOptic = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), opticMat);
    this.redOptic.position.set(0.075, 0.03, 0.165);

    this.opticLight = new THREE.PointLight(0xff0022, 0.8, 3.5);
    this.opticLight.position.set(0.075, 0.03, 0.24);

    headGroup.add(neck, headFlesh, jaw, nose, hair, shades, shadesBridge, skullPlate, skullJaw, socket, this.redOptic, this.opticLight);
    this.torsoGroup.add(headGroup);

    // 4. Arms: leather sleeves with elbow joints; left hand is exposed chrome
    const buildSleeve = (): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.58, 10), leatherMat);
      m.position.y = -0.26;
      return m;
    };
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.5, 0.64, 0);
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.13), chromeMat);
    leftHand.position.y = -0.6;
    this.leftArm.add(buildSleeve(), leftHand);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.5, 0.64, 0);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.13), skinMat);
    rightHand.position.y = -0.6;

    // Westinghouse M-27 Phased Plasma Rifle
    this.plasmaRifle = new THREE.Group();
    this.plasmaRifle.position.set(0, -0.55, 0.3);

    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.85), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), chromeMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.04, 0.5);

    const muzzleSight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), opticMat);
    muzzleSight.position.set(0, 0.11, 0.68);

    this.plasmaRifle.add(gunBody, barrel, muzzleSight);
    this.rightArm.add(buildSleeve(), rightHand, this.plasmaRifle);

    this.torsoGroup.add(this.leftArm, this.rightArm);
    this.group.add(this.torsoGroup);

    // Scale up slightly for imposing boss presence
    this.group.scale.set(1.22, 1.22, 1.22);
    this.applyModel();
  }

  /** Replaces the procedural figure with the sculpted, rigged infiltrator when it has loaded. */
  private applyModel(): void {
    const model = ModelLibrary.get('infiltrator');
    const bones = model ? findBones(model, INFILTRATOR_BONES) : null;
    if (!model || !bones) return;
    // Own materials, so the phase-3 chrome change stays on this boss
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = (mesh.material as THREE.Material).clone();
      (mesh.material as THREE.Material).userData = {};
    });
    this.redOptic.removeFromParent();
    this.opticLight.removeFromParent();
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      disposeObject3D(child);
    }
    this.group.add(model);
    this.model = model;
    this.rig = new HumanoidAnimator(model, bones, 3.0);
    this.rightX = Math.sign(model.worldToLocal(bones.upperArmR.getWorldPosition(new THREE.Vector3())).x) || -1;

    const rifle = ModelLibrary.getMeshData('plasma_rifle');
    if (rifle) {
      this.rifleMesh = new THREE.Mesh(rifle.geometry, rifle.material);
      this.rifleGrip.copy(ModelLibrary.gripPoint(rifle.geometry));
      model.add(this.rifleMesh);
    }

    // The red optic shows through the torn face; it rides on the head bone
    const head = findBones(model, { head: 'head neck upper' })?.head;
    model.add(this.redOptic, this.opticLight);
    this.redOptic.position.set(this.rightX * 0.035, 1.79, 0.1);
    this.opticLight.position.set(this.rightX * 0.035, 1.79, 0.2);
    head?.attach(this.redOptic);
    head?.attach(this.opticLight);
  }

  public updateAnimation(dt: number, speed: number, facing: number, isFiring = false): void {
    this.group.rotation.y = facing;

    if (this.rig && this.model) {
      // Rifle at the hip when advancing, raised to the shoulder when firing
      this.gripR.set(this.rightX * 0.13, isFiring ? 1.32 : 1.05, isFiring ? 0.28 : 0.3);
      this.gripL.set(this.rightX * 0.1, this.gripR.y + 0.05, this.gripR.z + 0.33);
      this.rifleMesh?.position.copy(this.gripR).sub(this.rifleGrip);
      this.rig.update(dt, speed, this.gripR, this.gripL);
      this.model.position.y = this.rig.bob;
      this.opticLight.intensity = 0.8 * (1.0 + Math.sin(Date.now() * 0.008) * 0.35);
      return;
    }

    if (speed > 0.1) {
      this.walkCycle += dt * 6.5;
      const legAngle = Math.sin(this.walkCycle) * 0.45;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;
      this.leftArm.rotation.x = -legAngle * 0.5;
    } else {
      this.walkCycle = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
    }

    // Aim rifle forward
    if (isFiring) {
      this.rightArm.rotation.x = -Math.PI / 2.3 + Math.sin(Date.now() * 0.03) * 0.05;
      this.torsoGroup.rotation.y = 0.12;
    } else {
      this.rightArm.rotation.x = -Math.PI / 3.2;
      this.torsoGroup.rotation.y = 0;
    }

    // Pulsing cybernetic optic
    const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.35;
    this.opticLight.intensity = 0.8 * pulse;
  }

  public setPhase3Endoskeleton(): void {
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.color && mat.color.getHex() !== 0xff0022) {
          mat.color.setHex(0xb0bcc8);
          mat.metalness = 0.95;
          mat.roughness = 0.2;
        }
      }
    });
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}
