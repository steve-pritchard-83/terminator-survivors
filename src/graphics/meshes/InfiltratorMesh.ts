import * as THREE from 'three';
import { disposeObject3D } from '../dispose';

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

  constructor() {
    // Materials
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x181818, // Matte black biker leather
      roughness: 0.82,
      metalness: 0.18
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

    // 1. Legs & Boots
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.28, 0.9, 0);
    const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.26), trouserMat);
    leftThigh.position.y = -0.22;
    const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.24), trouserMat);
    leftShin.position.y = -0.62;
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.24, 0.36), bootMat);
    leftBoot.position.set(0, -0.85, 0.05);
    this.leftLeg.add(leftThigh, leftShin, leftBoot);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.28, 0.9, 0);
    const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.26), trouserMat);
    rightThigh.position.y = -0.22;
    const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.24), trouserMat);
    rightShin.position.y = -0.62;
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.24, 0.36), bootMat);
    rightBoot.position.set(0, -0.85, 0.05);
    this.rightLeg.add(rightThigh, rightShin, rightBoot);

    this.group.add(this.leftLeg, this.rightLeg);

    // 2. Torso with heavy biker jacket
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.9, 0);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.65, 0.42), leatherMat);
    torso.position.y = 0.35;

    // Exposed chrome endo rib plate on battle-torn left torso
    const ribPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.04), chromeMat);
    ribPlate.position.set(-0.16, 0.35, 0.215);

    // Collar / lapels
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.25, 0.1), leatherMat);
    lapel.position.set(0, 0.6, 0.18);

    // Belt and chrome buckle
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.4), bootMat);
    belt.position.y = 0.04;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.04), chromeMat);
    buckle.position.set(0, 0.04, 0.21);

    this.torsoGroup.add(torso, ribPlate, lapel, belt, buckle);

    // 3. Head: sculpted jaw, partially sheared flesh revealing chrome skull & crimson optic
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.8, 0);

    const headFlesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skinMat);
    headFlesh.position.set(-0.04, 0, 0);

    // Chrome skull temple & jaw visible on right side
    const skullPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.28), chromeMat);
    skullPlate.position.set(0.12, 0, 0);

    // Iconic glowing crimson sensor eye
    this.redOptic = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), opticMat);
    this.redOptic.position.set(0.09, 0.04, 0.16);

    this.opticLight = new THREE.PointLight(0xff0022, 0.8, 3.5);
    this.opticLight.position.set(0.09, 0.04, 0.22);

    headGroup.add(headFlesh, skullPlate, this.redOptic, this.opticLight);
    this.torsoGroup.add(headGroup);

    // 4. Arms
    // Left arm (jacket sleeve with chrome hand)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.46, 0.62, 0);
    const leftSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.2), leatherMat);
    leftSleeve.position.y = -0.24;
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), chromeMat);
    leftHand.position.y = -0.58;
    this.leftArm.add(leftSleeve, leftHand);

    // Right arm (holding plasma rifle)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.46, 0.62, 0);
    const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.2), leatherMat);
    rightSleeve.position.y = -0.24;
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), chromeMat);
    rightHand.position.y = -0.58;

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
    this.rightArm.add(rightSleeve, rightHand, this.plasmaRifle);

    this.torsoGroup.add(this.leftArm, this.rightArm);
    this.group.add(this.torsoGroup);

    // Scale up slightly for imposing boss presence
    this.group.scale.set(1.22, 1.22, 1.22);
  }

  public updateAnimation(dt: number, speed: number, facing: number, isFiring = false): void {
    this.group.rotation.y = facing;

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
