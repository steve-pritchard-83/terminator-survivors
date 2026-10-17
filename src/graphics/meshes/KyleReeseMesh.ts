import * as THREE from 'three';

export class KyleReeseMesh {
  public readonly group = new THREE.Group();
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly coatTails: THREE.Mesh;
  private readonly torsoGroup: THREE.Group;
  private readonly weaponGroup: THREE.Group;
  private readonly muzzleLight: THREE.PointLight;

  private animTimer = 0;

  constructor() {
    const trouserMat = new THREE.MeshStandardMaterial({
      color: 0x2e353b, // Dark olive/slate combat trousers
      roughness: 0.85,
      metalness: 0.1
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.7,
      metalness: 0.2
    });

    const coatMat = new THREE.MeshStandardMaterial({
      color: 0x4a473f, // Weathered canvas/trenchcoat grey-brown
      roughness: 0.9,
      metalness: 0.05
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xb58a6d,
      roughness: 0.6,
      metalness: 0.0
    });

    const bandolierMat = new THREE.MeshStandardMaterial({
      color: 0x2b1e16,
      roughness: 0.6,
      metalness: 0.2
    });

    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x1c2128,
      metalness: 0.85,
      roughness: 0.25
    });

    // 1. Legs
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.75, 0);
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), trouserMat);
    leftThigh.position.y = -0.22;
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.24), bootMat);
    leftBoot.position.set(0, -0.58, 0.04);
    this.leftLeg.add(leftThigh, leftBoot);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.75, 0);
    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), trouserMat);
    rightThigh.position.y = -0.22;
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.24), bootMat);
    rightBoot.position.set(0, -0.58, 0.04);
    this.rightLeg.add(rightThigh, rightBoot);

    this.group.add(this.leftLeg, this.rightLeg);

    // 2. Torso & Trenchcoat
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.85, 0);

    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.26), coatMat);
    torsoMesh.position.y = 0.28;

    // Cross-body ammo bandolier strap
    const bandolier = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.28), bandolierMat);
    bandolier.position.set(0, 0.28, 0);
    bandolier.rotation.z = -0.45;

    // Trenchcoat tails that flare when running
    const coatTailGeo = new THREE.BoxGeometry(0.48, 0.42, 0.06);
    coatTailGeo.translate(0, -0.21, -0.12);
    this.coatTails = new THREE.Mesh(coatTailGeo, coatMat);
    this.coatTails.position.set(0, 0.12, 0);

    this.torsoGroup.add(torsoMesh, bandolier, this.coatTails);

    // 3. Head & Hair/Headband
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.65, 0.02);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.24), trouserMat);
    hairMesh.position.set(0, 0.08, -0.02);
    headGroup.add(headMesh, hairMesh);
    this.torsoGroup.add(headGroup);

    // 4. Arms & Weapon Mount
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0.18, 0.35, 0.12);

    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), coatMat);
    armMesh.rotation.x = Math.PI / 3;
    armMesh.position.set(0.08, 0, 0.12);

    // Shotgun / Plasma Rifle receiver & barrel
    const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.48), gunMat);
    gunReceiver.position.set(0, 0.02, 0.32);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 8), gunMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.03, 0.62);

    // Dynamic Muzzle Flash PointLight
    this.muzzleLight = new THREE.PointLight(0xffa500, 0, 8);
    this.muzzleLight.position.set(0, 0.03, 0.85);

    this.weaponGroup.add(armMesh, gunReceiver, gunBarrel, this.muzzleLight);
    this.torsoGroup.add(this.weaponGroup);

    this.group.add(this.torsoGroup);
  }

  public pulseMuzzleFlash(color = 0xffaa00): void {
    this.muzzleLight.color.setHex(color);
    this.muzzleLight.intensity = 4.5;
  }

  public updateAnimation(dt: number, speed: number, aimAngle: number, isDashing: boolean): void {
    // Fade muzzle light
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 25);
    }

    // Aim rotation
    this.group.rotation.y = aimAngle;

    if (isDashing) {
      this.torsoGroup.position.y = 0.55;
      this.torsoGroup.rotation.x = 0.45;
      this.coatTails.rotation.x = 0.8;
      this.leftLeg.rotation.x = -0.5;
      this.rightLeg.rotation.x = 0.6;
      return;
    }

    this.torsoGroup.position.y = 0.85;
    this.torsoGroup.rotation.x = 0;

    if (speed > 0.1) {
      this.animTimer += dt * speed * 2.2;
      const legStride = Math.sin(this.animTimer) * 0.65;
      this.leftLeg.rotation.x = legStride;
      this.rightLeg.rotation.x = -legStride;
      this.coatTails.rotation.x = 0.45 + Math.sin(this.animTimer * 2) * 0.15;
      this.torsoGroup.position.y = 0.85 + Math.abs(Math.sin(this.animTimer)) * 0.06;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, dt * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, dt * 10);
      this.coatTails.rotation.x = THREE.MathUtils.lerp(this.coatTails.rotation.x, 0.1, dt * 8);
      this.torsoGroup.position.y = 0.85;
    }
  }
}
