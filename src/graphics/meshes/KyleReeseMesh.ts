import * as THREE from 'three';
import { disposeObject3D } from '../dispose';

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
      color: 0x3b4856, // Combat slate trousers
      roughness: 0.78,
      metalness: 0.12
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x1c2026,
      roughness: 0.65,
      metalness: 0.25
    });

    const coatMat = new THREE.MeshStandardMaterial({
      color: 0x5c584c, // Weathered olive-charcoal trenchcoat
      roughness: 0.82,
      metalness: 0.1
    });

    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x2c353e, // Tactical under-vest & shoulder armor
      roughness: 0.6,
      metalness: 0.35
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a383,
      roughness: 0.55,
      metalness: 0.0
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x3a2b20,
      roughness: 0.85,
      metalness: 0.05
    });

    const bandolierMat = new THREE.MeshStandardMaterial({
      color: 0x4a3322,
      roughness: 0.6,
      metalness: 0.2
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25
    });

    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x556474,
      metalness: 0.8,
      roughness: 0.25
    });

    // Subtle Tactical Ground Ring & Soft Rim Light (never blows out bloom)
    const ringGeo = new THREE.RingGeometry(0.56, 0.64, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00b8e6,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide
    });
    const groundRing = new THREE.Mesh(ringGeo, ringMat);
    groundRing.position.y = 0.03;
    this.group.add(groundRing);

    const playerLight = new THREE.PointLight(0x70a8e8, 1.15, 14, 1.4);
    playerLight.position.set(0, 3.6, 0);
    this.group.add(playerLight);

    // 1. Articulated Legs (Thigh, Knee Pad, Shin, Combat Boot)
    const createLeg = (xOffset: number): THREE.Group => {
      const leg = new THREE.Group();
      leg.position.set(xOffset, 0.76, 0);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.38, 10), trouserMat);
      thigh.position.y = -0.18;

      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.14), vestMat);
      kneePad.position.set(0, -0.36, 0.03);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.32, 10), trouserMat);
      shin.position.y = -0.48;

      const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.24, 10), bootMat);
      bootShaft.position.y = -0.58;

      const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.26), bootMat);
      bootFoot.position.set(0, -0.69, 0.05);

      leg.add(thigh, kneePad, shin, bootShaft, bootFoot);
      return leg;
    };

    this.leftLeg = createLeg(-0.16);
    this.rightLeg = createLeg(0.16);
    this.group.add(this.leftLeg, this.rightLeg);

    // 2. Torso, Duster Coat, Shoulder Epaulettes & Ammo Bandolier
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.85, 0);

    // Inner tactical vest & outer open duster coat panels
    const vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.25), vestMat);
    vestMesh.position.y = 0.28;

    const coatBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.14), coatMat);
    coatBack.position.set(0, 0.28, -0.07);

    const coatSideL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.28), coatMat);
    coatSideL.position.set(-0.18, 0.28, 0.01);

    const coatSideR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.28), coatMat);
    coatSideR.position.set(0.18, 0.28, 0.01);

    // Upturned Trenchcoat Collar & Shoulder Pads
    const collarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.21, 0.14, 10, 1, true, 0.8, 4.7),
      coatMat
    );
    collarMesh.position.set(0, 0.57, -0.01);

    const shoulderPadL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), vestMat);
    shoulderPadL.position.set(-0.27, 0.53, 0);
    shoulderPadL.rotation.z = 0.18;

    const shoulderPadR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), vestMat);
    shoulderPadR.position.set(0.27, 0.53, 0);
    shoulderPadR.rotation.z = -0.18;

    // Cross-body ammo bandolier strap with 12-gauge brass shells
    const bandolierGroup = new THREE.Group();
    bandolierGroup.position.set(0, 0.29, 0);
    bandolierGroup.rotation.z = -0.52;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.3), bandolierMat);
    bandolierGroup.add(strap);
    for (let s = -2; s <= 2; s++) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 6), brassMat);
      shell.position.set(s * 0.075, 0.01, 0.155);
      bandolierGroup.add(shell);
    }

    // Utility Belt & Ammo Pouches
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.08, 0.29), bandolierMat);
    belt.position.set(0, 0.02, 0);

    // Tech-Com shoulder comms beacon
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b8e6,
      emissiveIntensity: 1.4
    });
    const shoulderBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.09), beaconMat);
    shoulderBeacon.position.set(-0.26, 0.58, 0.02);

    // Flaring Trenchcoat Tails (segmented)
    const coatTailGeo = new THREE.BoxGeometry(0.5, 0.44, 0.08);
    coatTailGeo.translate(0, -0.22, -0.12);
    this.coatTails = new THREE.Mesh(coatTailGeo, coatMat);
    this.coatTails.position.set(0, 0.1, 0);

    this.torsoGroup.add(
      vestMesh,
      coatBack,
      coatSideL,
      coatSideR,
      collarMesh,
      shoulderPadL,
      shoulderPadR,
      bandolierGroup,
      belt,
      shoulderBeacon,
      this.coatTails
    );

    // 3. Sculpted Head, Hair & Tech-Com Tactical Headband
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0.02);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 8), skinMat);
    neckMesh.position.y = -0.08;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), skinMat);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), skinMat);
    jawMesh.position.set(0, -0.04, 0.03);
    const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.045, 12), vestMat);
    headband.position.set(0, 0.04, 0);
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), hairMat);
    hairTop.position.set(0, 0.05, -0.02);
    hairTop.scale.set(1.0, 0.85, 1.08);
    headGroup.add(neckMesh, headMesh, jawMesh, headband, hairTop);
    this.torsoGroup.add(headGroup);

    // 4. Two-Handed Arms & Detailed Tech-Com Weapon Assembly
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0, 0.34, 0.1);

    // Right trigger arm (shoulder + forearm)
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.4, 8), coatMat);
    rightArm.rotation.x = Math.PI / 2.4;
    rightArm.rotation.z = -0.15;
    rightArm.position.set(0.22, 0.02, 0.12);

    // Left support arm reaching forward to pump/handguard
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.44, 8), coatMat);
    leftArm.rotation.x = Math.PI / 2.2;
    leftArm.rotation.z = 0.42;
    leftArm.position.set(-0.08, 0.01, 0.22);

    // Detailed Rifle/Shotgun Receiver, Stock, Pump Handguard, Barrel & Cooling Shroud
    const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.52), gunMat);
    gunReceiver.position.set(0.12, 0.02, 0.3);

    const gunHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.09, 0.28), bandolierMat);
    gunHandguard.position.set(0.12, -0.01, 0.48);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.48, 10), gunMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.12, 0.04, 0.66);

    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 8), gunMat);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0.12, -0.01, 0.62);

    // Underbarrel Tactical Flashlight Housing & Glowing Lens
    const flashlightBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.022, 0.14, 8),
      gunMat
    );
    flashlightBody.rotation.x = Math.PI / 2;
    flashlightBody.position.set(0.12, -0.04, 0.72);

    const flashlightLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8f6ff })
    );
    flashlightLens.position.set(0.12, -0.04, 0.79);

    // Real Dynamic Three.js SpotLight cutting through the nocturnal fog
    const flashlightSpot = new THREE.SpotLight(0xe0f2ff, 15.0, 32, Math.PI / 3.8, 0.78, 0.95);
    flashlightSpot.position.set(0.12, 0.35, 0.75);
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0.12, -0.85, 14.5);
    this.weaponGroup.add(flashlightTarget);
    flashlightSpot.target = flashlightTarget;

    // Soft ambient fill around Kyle so his immediate surroundings are always readable
    const playerAuraLight = new THREE.PointLight(0x7aa8d8, 2.2, 11);
    playerAuraLight.position.set(0, 1.2, 0);
    this.torsoGroup.add(playerAuraLight);

    // Subtle Volumetric Flashlight Cone (kept above ground plane so it never creates a hard oval slice on the floor)
    const beamConeGeo = new THREE.ConeGeometry(1.15, 11.5, 24, 1, true);
    beamConeGeo.rotateX(-Math.PI / 2);
    beamConeGeo.translate(0.12, 0.02, 6.55);
    const beamConeMat = new THREE.MeshBasicMaterial({
      color: 0xb8dcff,
      transparent: true,
      opacity: 0.042,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    const beamConeMesh = new THREE.Mesh(beamConeGeo, beamConeMat);

    // Crisp Tactical Laser Sight Line (shows exact mouse aim center)
    const laserSightGeo = new THREE.CylinderGeometry(0.008, 0.008, 11.0, 6);
    laserSightGeo.rotateX(Math.PI / 2);
    laserSightGeo.translate(0.12, 0.04, 6.4);
    const laserSightMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const laserSightMesh = new THREE.Mesh(laserSightGeo, laserSightMat);

    // Dynamic Muzzle Flash PointLight
    this.muzzleLight = new THREE.PointLight(0xffa500, 0, 10);
    this.muzzleLight.position.set(0.12, 0.04, 0.95);

    this.weaponGroup.add(
      rightArm,
      leftArm,
      gunReceiver,
      gunHandguard,
      gunBarrel,
      magTube,
      flashlightBody,
      flashlightLens,
      flashlightSpot,
      beamConeMesh,
      laserSightMesh,
      this.muzzleLight
    );
    this.torsoGroup.add(this.weaponGroup);

    this.group.add(this.torsoGroup);
  }

  public pulseMuzzleFlash(color = 0xffaa00): void {
    this.muzzleLight.color.setHex(color);
    this.muzzleLight.intensity = 2.8;
  }

  public updateAnimation(dt: number, speed: number, aimAngle: number, isDashing: boolean): void {
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 22);
    }

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

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
