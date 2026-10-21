import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import type { LoadoutId } from '../../core/types';
import { PLAYER_LOOKS } from '../../data/playerLooks';

export class KyleReeseMesh {
  public readonly group = new THREE.Group();
  public readonly leftLeg: THREE.Group;
  public readonly rightLeg: THREE.Group;
  public readonly coatTails: THREE.Mesh;
  public readonly torsoGroup: THREE.Group;
  public readonly weaponGroup: THREE.Group;
  public readonly muzzleLight: THREE.PointLight;

  // Pieces the loadout look switches on and off or recolours (see applyLoadout)
  private readonly mats: Record<
    'trouser' | 'boot' | 'outer' | 'sleeve' | 'top' | 'skin' | 'hair' | 'headgear' | 'armor' | 'scarf',
    THREE.MeshStandardMaterial
  >;
  private readonly outerPanels: THREE.Object3D[] = [];
  private readonly hairParts: THREE.Object3D[] = [];
  private readonly accessories: Record<
    'ponytail' | 'bandana' | 'helmet' | 'armor' | 'scarf' | 'scar' | 'shades',
    THREE.Object3D
  >;

  private animTimer = 0;
  private recoilOffset = 0;
  private recoilPitch = 0;

  public get recoil(): { offset: number; pitch: number } {
    return { offset: this.recoilOffset, pitch: this.recoilPitch };
  }

  constructor() {
    const trouserMat = new THREE.MeshStandardMaterial({
      color: 0x3a4b6c, // Worn blue jeans
      roughness: 0.78,
      metalness: 0.12
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x131519,
      roughness: 0.6,
      metalness: 0.2
    });

    const coatMat = new THREE.MeshStandardMaterial({
      color: 0x4d4e44, // Long dark olive-charcoal trench coat
      roughness: 0.82,
      metalness: 0.1
    });

    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x80878d, // Grey t-shirt under the open coat
      roughness: 0.6,
      metalness: 0.35
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a383,
      roughness: 0.55,
      metalness: 0.0
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x2a1f18,
      roughness: 0.9,
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
      color: 0x2c333b, // Blued steel
      metalness: 0.85,
      roughness: 0.32
    });

    const sleeveMat = coatMat.clone();
    const headgearMat = new THREE.MeshStandardMaterial({ color: 0x3a444f, roughness: 0.55, metalness: 0.5 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x4a5663, roughness: 0.5, metalness: 0.6 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xa83a2c, roughness: 0.9, metalness: 0 });

    const playerLight = new THREE.PointLight(0x70a8e8, 1.15, 14, 1.4);
    playerLight.position.set(0, 3.6, 0);
    this.group.add(playerLight);

    // 1. Articulated Legs (Thigh, Knee Pad, Shin, Combat Boot)
    const createLeg = (xOffset: number): THREE.Group => {
      const leg = new THREE.Group();
      leg.position.set(xOffset, 0.76, 0);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.38, 10), trouserMat);
      thigh.position.y = -0.18;

        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.32, 10), trouserMat);
      shin.position.y = -0.48;

      const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.24, 10), bootMat);
      bootShaft.position.y = -0.58;

      const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.26), bootMat);
      bootFoot.position.set(0, -0.69, 0.05);

      leg.add(thigh, shin, bootShaft, bootFoot);
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
    const coatTailGeo = new THREE.BoxGeometry(0.5, 0.66, 0.08);
    coatTailGeo.translate(0, -0.33, -0.12);
    this.coatTails = new THREE.Mesh(coatTailGeo, coatMat);
    this.coatTails.position.set(0, 0.1, 0);

    this.torsoGroup.add(
      vestMesh,
      coatBack,
      coatSideL,
      coatSideR,
      collarMesh,
      bandolierGroup,
      belt,
      shoulderBeacon,
      this.coatTails
    );

    // 3. Head: visible face, short dark messy hair, brow, nose, ears and stubble
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.7, 0.02);
    const stubbleMat = new THREE.MeshStandardMaterial({ color: 0x9a7a64, roughness: 0.8, metalness: 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.7, metalness: 0 });
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.13, 8), skinMat);
    neckMesh.position.y = -0.09;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skinMat);
    headMesh.scale.set(0.92, 1.05, 1.0);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.14), stubbleMat);
    jawMesh.position.set(0, -0.085, 0.045);
    const browMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.025, 0.05), darkMat);
    browMesh.position.set(0, 0.035, 0.125);
    const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.05), skinMat);
    noseMesh.position.set(0, -0.015, 0.15);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), darkMat);
    eyeL.position.set(-0.05, 0.005, 0.138);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), skinMat);
    earL.position.set(-0.14, -0.01, 0);
    earL.scale.set(0.5, 1, 0.8);
    const earR = earL.clone();
    earR.position.x = 0.14;
    // Short messy hair: a cap over the crown and back of the head, leaving the face clear
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.158, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairTop.position.set(0, 0.025, -0.02);
    hairTop.rotation.x = -0.25;
    hairTop.scale.set(1.0, 1.0, 1.05);
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), hairMat);
    hairBack.position.set(0, -0.01, -0.06);
    hairBack.scale.set(0.95, 0.9, 0.8);
    const sideburnL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.05), hairMat);
    sideburnL.position.set(-0.125, 0.0, 0.07);
    const sideburnR = sideburnL.clone();
    sideburnR.position.x = 0.125;
    headGroup.add(neckMesh, headMesh, jawMesh, browMesh, noseMesh, eyeL, eyeR, earL, earR, hairTop, hairBack, sideburnL, sideburnR);
    this.torsoGroup.add(headGroup);

    // Optional pieces, hidden until a loadout look switches them on
    this.hairParts.push(hairTop, hairBack, sideburnL, sideburnR);
    this.outerPanels.push(coatBack, coatSideL, coatSideR, collarMesh);

    const ponytail = new THREE.Group();
    [[0, -0.02, -0.21, 0.06], [0, -0.09, -0.25, 0.055], [0, -0.17, -0.27, 0.05], [0, -0.25, -0.27, 0.04]].forEach(([x, y, z, r]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), hairMat);
      b.position.set(x, y, z);
      ponytail.add(b);
    });
    const bandana = new THREE.Group();
    const bandBand = new THREE.Mesh(new THREE.CylinderGeometry(0.157, 0.157, 0.045, 14), headgearMat);
    bandBand.position.set(0, 0.06, 0);
    const bandKnot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), headgearMat);
    bandKnot.position.set(0, 0.06, -0.16);
    const bandTail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.012), headgearMat);
    bandTail.position.set(0.03, -0.01, -0.18);
    bandTail.rotation.z = 0.25;
    bandana.add(bandBand, bandKnot, bandTail);
    const helmet = new THREE.Group();
    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), headgearMat);
    helmetShell.position.set(0, 0.03, -0.01);
    const helmetBrim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.06), headgearMat);
    helmetBrim.position.set(0, 0.065, 0.15);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x40e8ff })
    );
    visor.position.set(0, 0.02, 0.15);
    helmet.add(helmetShell, helmetBrim, visor);
    const scar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.012), new THREE.MeshStandardMaterial({ color: 0x9b3b32, roughness: 0.7 }));
    scar.position.set(-0.075, -0.025, 0.14);
    scar.rotation.z = -0.5;
    const shadesMat = new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.15, metalness: 0.8 });
    const shades = new THREE.Group();
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.03), shadesMat);
    lensL.position.set(-0.05, 0.005, 0.14);
    const lensR = lensL.clone();
    lensR.position.x = 0.05;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.012), shadesMat);
    bridge.position.set(0, 0.015, 0.14);
    shades.add(lensL, lensR, bridge);
    headGroup.add(ponytail, bandana, helmet, scar, shades);

    // Torso pieces: chest plate, shoulder pads and glowing backpack; scarf
    const armor = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.07), armorMat);
    plate.position.set(0, 0.34, 0.16);
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), armorMat);
    padL.position.set(-0.29, 0.53, 0);
    padL.rotation.z = 0.2;
    const padR = padL.clone();
    padR.position.x = 0.29;
    padR.rotation.z = -0.2;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.16), armorMat);
    pack.position.set(0, 0.3, -0.27);
    const packCore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.02), new THREE.MeshBasicMaterial({ color: 0x40e8ff }));
    packCore.position.set(0, 0.3, -0.36);
    armor.add(plate, padL, padR, pack, packCore);
    const scarf = new THREE.Group();
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.045, 7, 14), scarfMat);
    scarfRing.position.set(0, 0.58, 0.0);
    scarfRing.rotation.x = Math.PI / 2;
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.025), scarfMat);
    scarfTail.position.set(-0.06, 0.42, 0.13);
    scarfTail.rotation.z = 0.12;
    scarf.add(scarfRing, scarfTail);
    this.torsoGroup.add(armor, scarf);

    this.mats = {
      trouser: trouserMat,
      boot: bootMat,
      outer: coatMat,
      sleeve: sleeveMat,
      top: vestMat,
      skin: skinMat,
      hair: hairMat,
      headgear: headgearMat,
      armor: armorMat,
      scarf: scarfMat
    };
    this.accessories = { ponytail, bandana, helmet, armor, scarf, scar, shades };

    // 4. Two-Handed Arms & Detailed Tech-Com Weapon Assembly
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0, 0.34, 0.1);

    // Right trigger arm (shoulder + forearm)
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.4, 8), sleeveMat);
    rightArm.rotation.x = Math.PI / 2.4;
    rightArm.rotation.z = -0.15;
    rightArm.position.set(0.22, 0.02, 0.12);

    // Left support arm reaching forward to pump/handguard
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.44, 8), sleeveMat);
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

    this.applyLoadout('reese_1984');
  }

  /** Switches the mesh to a character's look (clothes, hair, headgear, armour, size). */
  public applyLoadout(loadoutId: LoadoutId): void {
    const look = PLAYER_LOOKS[loadoutId] ?? PLAYER_LOOKS.reese_1984;
    const m = this.mats;
    m.trouser.color.setHex(look.trouserColor);
    m.boot.color.setHex(look.bootColor);
    m.outer.color.setHex(look.outerColor || 0x4d4e44);
    m.top.color.setHex(look.topColor);
    m.skin.color.setHex(look.skinColor);
    m.hair.color.setHex(look.hairColor);
    m.sleeve.color.setHex(look.sleeves === 'skin' ? look.skinColor : look.outerColor || look.topColor);
    m.headgear.color.setHex(look.headgearColor || 0x3a444f);
    m.armor.color.setHex(look.armorColor || 0x4a5663);
    if (look.scarfColor !== null) m.scarf.color.setHex(look.scarfColor);

    const hasOuter = look.outer !== 'none';
    for (const p of this.outerPanels) p.visible = hasOuter;
    this.coatTails.visible = look.outer === 'trench';

    const helmet = look.headgear === 'helmet';
    for (const h of this.hairParts) h.visible = !helmet;
    this.accessories.ponytail.visible = look.hairStyle === 'ponytail' && !helmet;
    this.accessories.bandana.visible = look.headgear === 'bandana';
    this.accessories.helmet.visible = helmet;
    this.accessories.armor.visible = look.armor;
    this.accessories.scarf.visible = look.scarfColor !== null;
    this.accessories.scar.visible = look.scar;
    this.accessories.shades.visible = look.shades;

    this.group.scale.setScalar(look.scale);
  }

  public triggerRecoil(intensity = 1.0): void {
    this.recoilOffset = Math.min(0.25, this.recoilOffset + 0.12 * intensity);
    this.recoilPitch = Math.max(-0.35, this.recoilPitch - 0.15 * intensity);
    this.weaponGroup.position.z = 0.1 - this.recoilOffset;
    this.weaponGroup.rotation.x = this.recoilPitch;
  }

  public pulseMuzzleFlash(color = 0xffaa00, recoilIntensity?: number): void {
    this.muzzleLight.color.setHex(color);
    this.muzzleLight.intensity = 2.8;
    if (recoilIntensity !== undefined) {
      this.triggerRecoil(recoilIntensity);
    }
  }

  public updateAnimation(dt: number, speed: number, aimAngle: number): void {
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 22);
    }

    // Recover weapon recoil smoothly back towards neutral
    if (this.recoilOffset > 0 || this.recoilPitch < 0) {
      this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, Math.min(1, dt * 16));
      this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, Math.min(1, dt * 16));
      this.weaponGroup.position.z = 0.1 - this.recoilOffset;
      this.weaponGroup.rotation.x = this.recoilPitch;
    }

    this.group.rotation.y = aimAngle;

    this.torsoGroup.position.y = 0.85;
    this.torsoGroup.rotation.x = 0;

    if (speed > 0.1) {
      this.animTimer += dt * speed * 2.2;
      const legStride = Math.sin(this.animTimer) * 0.65;
      this.leftLeg.rotation.x = legStride;
      this.rightLeg.rotation.x = -legStride;
      this.coatTails.rotation.x = 0.45 + Math.sin(this.animTimer * 2) * 0.15;
      this.coatTails.rotation.z = Math.sin(this.animTimer) * 0.05;

      // Hip sway and torso counter-twist
      this.torsoGroup.position.y = 0.85 + Math.abs(Math.sin(this.animTimer)) * 0.05;
      this.torsoGroup.rotation.z = Math.sin(this.animTimer) * 0.04;
      this.torsoGroup.rotation.y = Math.cos(this.animTimer) * 0.05;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, dt * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, dt * 10);
      this.coatTails.rotation.x = THREE.MathUtils.lerp(this.coatTails.rotation.x, 0.1, dt * 8);
      this.coatTails.rotation.z = THREE.MathUtils.lerp(this.coatTails.rotation.z, 0, dt * 8);
      this.torsoGroup.position.y = 0.85;
      this.torsoGroup.rotation.z = THREE.MathUtils.lerp(this.torsoGroup.rotation.z, 0, dt * 10);
      this.torsoGroup.rotation.y = THREE.MathUtils.lerp(this.torsoGroup.rotation.y, 0, dt * 10);
    }
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
