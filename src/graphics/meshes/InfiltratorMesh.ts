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
  // The crimson optic showing through the torn face
  private readonly redOptic: THREE.Mesh;
  private readonly opticLight: THREE.PointLight;

  // Sculpted, rigged figure, animated through its rig
  private rig: HumanoidAnimator | null = null;
  private model: THREE.Object3D | null = null;
  private rifleMesh: THREE.Mesh | null = null;
  private readonly rifleGrip = new THREE.Vector3();
  private rightX = -1;
  private readonly gripR = new THREE.Vector3();
  private readonly gripL = new THREE.Vector3();

  constructor() {
    this.redOptic = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff0022 }));
    this.opticLight = new THREE.PointLight(0xff0022, 0.8, 3.5);

    // Scale up slightly for imposing boss presence
    this.group.scale.set(1.22, 1.22, 1.22);
    if (!this.applyModel()) {
      // Placeholder (black leather) until the sculpted model has loaded
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 1.2, 4, 10),
        new THREE.MeshStandardMaterial({ color: 0x28292d, roughness: 0.5, metalness: 0.25 })
      );
      body.position.y = 0.9;
      this.redOptic.position.set(0.08, 1.75, 0.27);
      this.opticLight.position.set(0.08, 1.75, 0.35);
      this.group.add(body, this.redOptic, this.opticLight);
    }
  }

  /** Builds the sculpted, rigged infiltrator. False if it has not loaded. */
  private applyModel(): boolean {
    const model = ModelLibrary.get('infiltrator');
    const bones = model ? findBones(model, INFILTRATOR_BONES) : null;
    if (!model || !bones) return false;
    // Own materials, so the phase-3 chrome change stays on this boss
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = (mesh.material as THREE.Material).clone();
      (mesh.material as THREE.Material).userData = {};
    });
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

    // The optic rides on the head bone
    const head = findBones(model, { head: 'head neck upper' })?.head;
    model.add(this.redOptic, this.opticLight);
    this.redOptic.position.set(this.rightX * 0.035, 1.79, 0.1);
    this.opticLight.position.set(this.rightX * 0.035, 1.79, 0.2);
    head?.attach(this.redOptic);
    head?.attach(this.opticLight);
    return true;
  }

  public updateAnimation(dt: number, speed: number, facing: number, isFiring = false): void {
    this.group.rotation.y = facing;
    // Pulsing cybernetic optic
    this.opticLight.intensity = 0.8 * (1.0 + Math.sin(Date.now() * 0.008) * 0.35);
    if (!this.rig || !this.model) return;

    // Rifle at the hip when advancing, raised to the shoulder when firing
    this.gripR.set(this.rightX * 0.13, isFiring ? 1.32 : 1.05, isFiring ? 0.28 : 0.3);
    this.gripL.set(this.rightX * 0.1, this.gripR.y + 0.05, this.gripR.z + 0.33);
    this.rifleMesh?.position.copy(this.gripR).sub(this.rifleGrip);
    this.rig.update(dt, speed, this.gripR, this.gripL);
    this.model.position.y = this.rig.bob;
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
