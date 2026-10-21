import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import type { LoadoutId } from '../../core/types';
import { PLAYER_LOOKS } from '../../data/playerLooks';
import { PALETTE } from '../../data/artDirection';
import { ProceduralTextures } from '../ProceduralTextures';
import { ModelLibrary } from '../ModelLibrary';
import { HumanoidAnimator } from '../HumanoidAnimator';
import { RENDER_BUDGET } from '../../data/performance';
import type { AutoRigged } from '../AutoRig';

// Body proportions (metres, about 1.8 m tall at scale 1)
const HIP_HEIGHT = 0.95;
const THIGH = 0.44;
const SHIN = 0.44;
const UPPER_ARM = 0.31;
const FOREARM = 0.3;
// Metres covered per full stride cycle (two steps). A sprinting stride: shorter makes the legs blur.
const STRIDE_LENGTH = 4.2;
// Belt lamp: cool white LED
const LAMP_COLOR = 0xe6efff;
const LAMP_BEAM_INTENSITY = 32;
const LAMP_SPILL_INTENSITY = 3;
const SHOULDER_L = new THREE.Vector3(-0.21, 0.44, 0);
const SHOULDER_R = new THREE.Vector3(0.21, 0.44, 0);

// Rifle-local grip points the hands are solved to (see buildRifle)
const GRIP_R = new THREE.Vector3(0.1, -0.12, 0.25);
const GRIP_L = new THREE.Vector3(0.1, -0.09, 0.44);
const MUZZLE = new THREE.Vector3(0.1, 0.0, 0.95);
// Elbows hang down and out
const POLE_R = new THREE.Vector3(0.6, -1, -0.3);
const POLE_L = new THREE.Vector3(-0.8, -1, 0);

const Y_AXIS = new THREE.Vector3(0, 1, 0);

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
}

/** Wraps an angle to [-PI, PI]. */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * The playable character: an articulated figure with a running gait, independent legs and torso
 * (legs follow the movement, torso follows the aim), and arms solved onto the rifle each frame.
 * Characters differ only by data (PLAYER_LOOKS), applied in applyLoadout.
 */
export class KyleReeseMesh {
  public readonly group = new THREE.Group();
  public readonly muzzleLight: THREE.PointLight;

  private readonly pelvis = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly weaponGroup = new THREE.Group();
  private readonly legL: Leg;
  private readonly legR: Leg;
  private readonly coatTails: THREE.Mesh[] = [];
  private readonly lamp = new THREE.Group();
  // Sculpted Kyle 2029 (auto-rigged model) for that loadout, once loaded; the procedural figure otherwise
  private sculpted: {
    root: THREE.Group;
    anim: HumanoidAnimator;
    rifle: THREE.Mesh;
    grip: THREE.Vector3;
    muzzleZ: number;
    hips: THREE.Object3D;
  } | null = null;
  private loadoutId: LoadoutId = 'reese_1984';
  private readonly holdR = new THREE.Vector3();
  private readonly holdL = new THREE.Vector3();
  // Procedural rifle pieces, replaced by the sculpted rifle once it has loaded
  private readonly rifleParts: THREE.Object3D[] = [];
  private readonly muzzleFlash: THREE.Mesh;
  private readonly muzzleFlashMat: THREE.MeshBasicMaterial;

  // Arm segments, placed by the IK solve every frame (in spine space)
  private readonly upperArmL: THREE.Mesh;
  private readonly foreArmL: THREE.Mesh;
  private readonly handL: THREE.Mesh;
  private readonly upperArmR: THREE.Mesh;
  private readonly foreArmR: THREE.Mesh;
  private readonly handR: THREE.Mesh;

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

  // Animation state
  private time = 0;
  private facing = 0;
  private phase = 0;
  private gait = 0; // 0 standing .. 1 full run
  private hipsYaw = 0;
  private backwards = false;
  private recoilOffset = 0;
  private recoilPitch = 0;
  private coatFlap = 0;

  // Scratch
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();

  constructor() {
    const std = (color: number, roughness: number, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    const trouserMat = std(0x3a4b6c, 0.85, 0.05);
    const bootMat = std(0x131519, 0.6, 0.15);
    const outerMat = std(0x4d4e44, 0.88, 0.04);
    const sleeveMat = outerMat.clone();
    const topMat = std(0x80878d, 0.8, 0.02);
    const skinMat = std(0xd4a383, 0.6);
    const hairMat = std(0x2a1f18, 0.92);
    const headgearMat = std(0x3a444f, 0.6, 0.4);
    const armorMat = std(0x4a5663, 0.5, 0.55);
    const scarfMat = std(0xa83a2c, 0.92);
    const gloveMat = std(0x1c1a17, 0.75, 0.05);
    const webbingMat = std(0x3b3326, 0.85, 0.05);
    const gunMat = std(0x26292e, 0.38, 0.8);
    const gunAccentMat = std(0x3c4148, 0.45, 0.7);

    // 1. Pelvis, belt and legs
    this.pelvis.position.y = HIP_HEIGHT;
    this.group.add(this.pelvis);

    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.1, 4, 10), trouserMat);
    hips.rotation.z = Math.PI / 2;
    hips.scale.set(1, 1, 0.75);
    hips.position.y = 0.02;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14), webbingMat);
    belt.scale.z = 0.72;
    belt.position.y = 0.08;
    const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.05), webbingMat);
    pouchL.position.set(-0.15, 0.06, 0.06);
    const pouchR = pouchL.clone();
    pouchR.position.set(0.15, 0.06, 0.06);
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), webbingMat);
    holster.position.set(0.17, -0.04, -0.02);
    this.pelvis.add(hips, belt, pouchL, pouchR, holster);

    this.legL = this.buildLeg(-0.1, trouserMat, bootMat);
    this.legR = this.buildLeg(0.1, trouserMat, bootMat);

    // Jacket hem around the hips; long coat tails that swing with the legs
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.225, 0.14, 14, 1, true, 0.35, Math.PI * 2 - 0.7), outerMat);
    hem.scale.z = 0.78;
    hem.position.y = 0.06;
    hem.material.side = THREE.DoubleSide;
    this.pelvis.add(hem);
    this.outerPanels.push(hem);
    const tailGeo = new THREE.BoxGeometry(0.2, 0.62, 0.025);
    tailGeo.translate(0, -0.31, 0);
    for (const [x, z, yaw] of [
      [-0.1, -0.12, 0.25],
      [0.1, -0.12, -0.25],
      [-0.16, 0.06, -0.5],
      [0.16, 0.06, 0.5]
    ] as const) {
      const tail = new THREE.Mesh(tailGeo, outerMat);
      tail.position.set(x, 0.0, z);
      tail.rotation.y = yaw;
      this.pelvis.add(tail);
      this.coatTails.push(tail);
    }

    // 2. Spine: abdomen, chest, open jacket, webbing
    this.spine.position.y = 0.08;
    this.pelvis.add(this.spine);

    const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.2, 12), topMat);
    abdomen.scale.z = 0.7;
    abdomen.position.y = 0.1;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.3, 12), topMat);
    chest.scale.z = 0.66;
    chest.position.y = 0.32;
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), topMat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.scale.z = 0.9;
    shoulders.position.y = 0.44;
    // Jacket shell, open at the front so the shirt shows through
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.19, 0.48, 14, 1, true, 0.4, Math.PI * 2 - 0.8), outerMat);
    jacket.material.side = THREE.DoubleSide;
    jacket.scale.z = 0.7;
    jacket.position.y = 0.24;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.09, 12, 1, true, 0.5, Math.PI * 2 - 1.0), outerMat);
    collar.position.set(0, 0.5, -0.01);
    const yokeL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.12, 4, 8), outerMat);
    yokeL.rotation.z = Math.PI / 2;
    yokeL.position.set(-0.13, 0.45, 0);
    const yokeR = yokeL.clone();
    yokeR.position.x = 0.13;
    this.outerPanels.push(jacket, collar, yokeL, yokeR);
    // Diagonal webbing strap, right shoulder to left hip
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.02), webbingMat);
    strap.position.set(0.0, 0.27, 0.115);
    strap.rotation.z = -0.55;
    this.spine.add(abdomen, chest, shoulders, jacket, collar, yokeL, yokeR, strap);

    // 3. Head on a neck (built at 1.28x and scaled down so the details stay in proportion)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skinMat);
    neck.position.y = 0.52;
    this.spine.add(neck);
    this.headGroup.position.set(0, 0.64, 0.015);
    this.headGroup.scale.setScalar(0.78);
    this.spine.add(this.headGroup);
    const { ponytail, bandana, helmet, scar, shades } = this.buildHead(skinMat, hairMat, headgearMat);

    // 4. Armour and scarf (torso accessories)
    const armor = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.05), armorMat);
    plate.position.set(0, 0.33, 0.13);
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.18), armorMat);
    padL.position.set(-0.22, 0.48, 0);
    padL.rotation.z = 0.35;
    const padR = padL.clone();
    padR.position.x = 0.22;
    padR.rotation.z = -0.35;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.13), armorMat);
    pack.position.set(0, 0.3, -0.2);
    const packCell = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.plasmaResistance).multiplyScalar(1.6) }));
    packCell.position.set(0, 0.3, -0.27);
    armor.add(plate, padL, padR, pack, packCell);
    const scarf = new THREE.Group();
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.035, 7, 14), scarfMat);
    scarfRing.position.set(0, 0.5, 0.0);
    scarfRing.rotation.x = Math.PI / 2;
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), scarfMat);
    scarfTail.position.set(-0.05, 0.37, 0.11);
    scarfTail.rotation.z = 0.12;
    scarf.add(scarfRing, scarfTail);
    this.spine.add(armor, scarf);

    // 5. Rifle and arms
    this.weaponGroup.position.set(0, 0.36, 0.06);
    this.spine.add(this.weaponGroup);
    this.buildRifle(gunMat, gunAccentMat);

    const upperGeo = new THREE.CapsuleGeometry(0.06, UPPER_ARM - 0.08, 4, 8);
    const foreGeo = new THREE.CapsuleGeometry(0.05, FOREARM - 0.07, 4, 8);
    const handGeo = new THREE.BoxGeometry(0.05, 0.085, 0.06);
    this.upperArmL = new THREE.Mesh(upperGeo, sleeveMat);
    this.foreArmL = new THREE.Mesh(foreGeo, sleeveMat);
    this.handL = new THREE.Mesh(handGeo, gloveMat);
    this.upperArmR = new THREE.Mesh(upperGeo, sleeveMat);
    this.foreArmR = new THREE.Mesh(foreGeo, sleeveMat);
    this.handR = new THREE.Mesh(handGeo, gloveMat);
    this.spine.add(this.upperArmL, this.foreArmL, this.handL, this.upperArmR, this.foreArmR, this.handR);

    // Muzzle flash: a small hot light plus a brief crossed-plane flare at the emitter
    this.muzzleLight = new THREE.PointLight(0xffa500, 0, 10);
    this.muzzleLight.position.copy(MUZZLE);
    this.muzzleFlashMat = new THREE.MeshBasicMaterial({
      map: typeof document !== 'undefined' ? ProceduralTextures.getSoftGlowSprite() : null,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const flashGeo = new THREE.PlaneGeometry(0.22, 0.5);
    flashGeo.rotateX(Math.PI / 2);
    this.muzzleFlash = new THREE.Mesh(flashGeo, this.muzzleFlashMat);
    const flashCross = new THREE.Mesh(flashGeo, this.muzzleFlashMat);
    flashCross.rotation.z = Math.PI / 2;
    this.muzzleFlash.add(flashCross);
    this.muzzleFlash.position.copy(MUZZLE).add(new THREE.Vector3(0, 0, 0.2));
    this.weaponGroup.add(this.muzzleLight, this.muzzleFlash);

    // 6. Grounding: a soft contact shadow under the feet
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: typeof document !== 'undefined' ? ProceduralTextures.getSoftGlowSprite() : null,
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      })
    );
    shadow.position.y = 0.02;
    this.group.add(shadow);
    this.buildHipLamp();

    this.mats = {
      trouser: trouserMat,
      boot: bootMat,
      outer: outerMat,
      sleeve: sleeveMat,
      top: topMat,
      skin: skinMat,
      hair: hairMat,
      headgear: headgearMat,
      armor: armorMat,
      scarf: scarfMat
    };
    this.accessories = { ponytail, bandana, helmet, armor, scarf, scar, shades };

    this.applyLoadout('reese_1984');
    this.updateAnimation(0, 0, 0);
  }

  /**
   * Small LED lamp clipped to the front of the belt: a short beam onto the ground ahead and a
   * little spill light back up over Kyle, so he is lit by something that is visibly on him.
   */
  private buildHipLamp(): void {
    const lamp = this.lamp;
    lamp.position.set(-0.15, 0.05, 0.14);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.045), new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.5, metalness: 0.6 }));
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.02, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(LAMP_COLOR).multiplyScalar(3) })
    );
    lens.position.z = 0.0235;
    lamp.add(housing, lens);

    const beam = new THREE.SpotLight(LAMP_COLOR, LAMP_BEAM_INTENSITY, 9, 0.5, 0.65, 1.4);
    beam.position.set(0, 0, 0.03);
    beam.target.position.set(0, -HIP_HEIGHT, 3.5);
    lamp.add(beam, beam.target);
    // Phones skip the fill light (each light costs every lit pixel); the beam stays
    if (RENDER_BUDGET.lampSpill) {
      const spill = new THREE.PointLight(LAMP_COLOR, LAMP_SPILL_INTENSITY, 2.4, 1.5);
      spill.position.set(0.05, 0.25, 0.35);
      lamp.add(spill);
    }
    this.pelvis.add(lamp);
  }

  /** Hip, knee and ankle joints; the leg hangs down -y and walks along +z. */
  private buildLeg(x: number, trouserMat: THREE.Material, bootMat: THREE.Material): Leg {
    const hip = new THREE.Group();
    hip.position.set(x * 1.15, 0, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, THIGH - 0.12, 4, 10), trouserMat);
    thigh.position.y = -THIGH / 2;
    thigh.scale.set(1, 1, 1.08);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, SHIN - 0.14, 4, 10), trouserMat);
    shin.position.y = -SHIN / 2 + 0.02;
    const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), trouserMat);
    kneePad.position.set(0, -0.02, 0.04);
    knee.add(shin, kneePad);
    hip.add(knee);

    const ankle = new THREE.Group();
    ankle.position.y = -SHIN;
    const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.075, 0.16, 8), bootMat);
    bootShaft.position.y = 0.02;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.08, 0.26), bootMat);
    foot.position.set(0, -0.045, 0.055);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.02, 0.26), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.9 }));
    sole.position.set(0, -0.085, 0.055);
    ankle.add(bootShaft, foot, sole);
    knee.add(ankle);

    this.pelvis.add(hip);
    return { hip, knee, ankle };
  }

  /** Face, hair and headgear at the original (pre-scale) head size. */
  private buildHead(
    skinMat: THREE.MeshStandardMaterial,
    hairMat: THREE.MeshStandardMaterial,
    headgearMat: THREE.MeshStandardMaterial
  ): Record<'ponytail' | 'bandana' | 'helmet' | 'scar' | 'shades', THREE.Object3D> {
    const stubbleMat = new THREE.MeshStandardMaterial({ color: 0x9a7a64, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skinMat);
    head.scale.set(0.9, 1.06, 1.0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.14), stubbleMat);
    jaw.position.set(0, -0.085, 0.045);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.025, 0.05), darkMat);
    brow.position.set(0, 0.035, 0.125);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.05), skinMat);
    nose.position.set(0, -0.015, 0.15);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), darkMat);
    eyeL.position.set(-0.05, 0.005, 0.138);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), skinMat);
    earL.position.set(-0.14, -0.01, 0);
    earL.scale.set(0.5, 1, 0.8);
    const earR = earL.clone();
    earR.position.x = 0.14;
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
    this.headGroup.add(head, jaw, brow, nose, eyeL, eyeR, earL, earR, hairTop, hairBack, sideburnL, sideburnR);
    this.hairParts.push(hairTop, hairBack, sideburnL, sideburnR);

    const ponytail = new THREE.Group();
    for (const [y, z, r] of [[-0.02, -0.21, 0.06], [-0.09, -0.25, 0.055], [-0.17, -0.27, 0.05], [-0.25, -0.27, 0.04]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), hairMat);
      b.position.set(0, y, z);
      ponytail.add(b);
    }
    const bandana = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.157, 0.157, 0.045, 14), headgearMat);
    band.position.set(0, 0.06, 0);
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), headgearMat);
    knot.position.set(0, 0.06, -0.16);
    const knotTail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.012), headgearMat);
    knotTail.position.set(0.03, -0.01, -0.18);
    knotTail.rotation.z = 0.25;
    bandana.add(band, knot, knotTail);
    const helmet = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), headgearMat);
    shell.position.set(0, 0.03, -0.01);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.06), headgearMat);
    brim.position.set(0, 0.065, 0.15);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.15, metalness: 0.9, emissive: 0x3a1c08 })
    );
    visor.position.set(0, 0.02, 0.15);
    helmet.add(shell, brim, visor);
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
    this.headGroup.add(ponytail, bandana, helmet, scar, shades);
    return { ponytail, bandana, helmet, scar, shades };
  }

  /** Westinghouse M-25 style plasma rifle, shouldered on the right, pointing along +z. */
  private buildRifle(gunMat: THREE.Material, accentMat: THREE.Material): void {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      this.weaponGroup.add(m);
      this.rifleParts.push(m);
    };
    const tube = (r: number, len: number, z: number, mat: THREE.Material, y = 0) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
      m.rotation.x = Math.PI / 2;
      m.position.set(0.1, y, z);
      this.weaponGroup.add(m);
      this.rifleParts.push(m);
    };
    box(0.05, 0.11, 0.24, 0.1, -0.02, 0.02, gunMat); // stock
    box(0.075, 0.12, 0.4, 0.1, 0.0, 0.34, gunMat); // receiver
    box(0.04, 0.11, 0.055, 0.1, -0.1, 0.24, gunMat, 0.35); // pistol grip
    box(0.055, 0.13, 0.08, 0.1, -0.1, 0.4, accentMat); // power cell
    box(0.03, 0.045, 0.22, 0.1, 0.085, 0.32, accentMat); // sight rail
    box(0.035, 0.08, 0.04, 0.1, -0.07, 0.46, gunMat); // foregrip
    tube(0.042, 0.32, 0.68, gunMat); // barrel shroud
    for (const z of [0.58, 0.66, 0.74]) tube(0.046, 0.012, z, accentMat); // cooling rings
    tube(0.02, 0.12, 0.88, accentMat); // emitter
    // Plasma chamber window: the only glow on the rifle
    const chamber = new THREE.Mesh(
      new THREE.BoxGeometry(0.078, 0.022, 0.14),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.plasmaResistance).multiplyScalar(1.5) })
    );
    chamber.position.set(0.1, 0.05, 0.42);
    this.weaponGroup.add(chamber);
    this.rifleParts.push(chamber);
  }

  /** Swaps the procedural rifle for the sculpted plasma rifle (1 m long, centred, facing +z). */
  public applyRifleModel(rifle: { geometry: THREE.BufferGeometry; material: THREE.Material }): void {
    if (this.rifleParts.length === 0) return;
    for (const part of this.rifleParts) {
      this.weaponGroup.remove(part);
      disposeObject3D(part);
    }
    this.rifleParts.length = 0;
    const mesh = new THREE.Mesh(rifle.geometry, rifle.material);
    // Pistol grip in the right hand
    mesh.position.copy(GRIP_R).sub(ModelLibrary.gripPoint(rifle.geometry));
    this.weaponGroup.add(mesh);
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
    for (const t of this.coatTails) t.visible = look.outer === 'trench';

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
    this.loadoutId = loadoutId;
    this.useSculpted(loadoutId === 'reese_2029' && this.sculpted !== null);
  }

  /**
   * Takes the auto-rigged player model (Kyle 2029) and the sculpted rifle. Used for that loadout;
   * the other characters keep the procedural figure.
   */
  public applyPlayerModel(player: AutoRigged, rifle: { geometry: THREE.BufferGeometry; material: THREE.Material }): void {
    if (this.sculpted) return;
    const rifleMesh = new THREE.Mesh(rifle.geometry, rifle.material);
    player.root.add(rifleMesh);
    rifle.geometry.computeBoundingBox();
    this.sculpted = {
      root: player.root,
      anim: new HumanoidAnimator(player.root, player.rig, STRIDE_LENGTH),
      rifle: rifleMesh,
      grip: ModelLibrary.gripPoint(rifle.geometry),
      muzzleZ: rifle.geometry.boundingBox!.max.z,
      hips: player.rig.hips
    };
    player.root.visible = false;
    this.group.add(player.root);
    this.applyLoadout(this.loadoutId);
  }

  /** Shows the sculpted or the procedural figure and moves the muzzle flash and belt lamp onto it. */
  private useSculpted(on: boolean): void {
    const s = this.sculpted;
    this.pelvis.visible = !on;
    if (s) s.root.visible = on;
    if (on && s) {
      s.rifle.add(this.muzzleLight, this.muzzleFlash);
      this.muzzleLight.position.set(0, 0, s.muzzleZ);
      this.muzzleFlash.position.set(0, 0, s.muzzleZ + 0.2);
      s.root.add(this.lamp);
      this.lamp.position.set(-0.15, 0.97, 0.15);
      this.lamp.rotation.set(0, 0, 0);
      s.hips.attach(this.lamp);
    } else {
      this.weaponGroup.add(this.muzzleLight, this.muzzleFlash);
      this.muzzleLight.position.copy(MUZZLE);
      this.muzzleFlash.position.copy(MUZZLE).add(new THREE.Vector3(0, 0, 0.2));
      this.pelvis.add(this.lamp);
      this.lamp.position.set(-0.15, 0.05, 0.14);
      this.lamp.rotation.set(0, 0, 0);
    }
  }

  public triggerRecoil(intensity = 1.0): void {
    this.recoilOffset = Math.min(0.12, this.recoilOffset + 0.06 * intensity);
    this.recoilPitch = Math.max(-0.3, this.recoilPitch - 0.1 * intensity);
  }

  public pulseMuzzleFlash(color = 0xffaa00, recoilIntensity?: number): void {
    this.muzzleLight.color.setHex(color);
    this.muzzleLight.intensity = 2.8;
    this.muzzleFlashMat.color.setHex(color).multiplyScalar(2.2);
    this.muzzleFlashMat.opacity = 1;
    this.muzzleFlash.rotation.z = this.time * 37; // a different flare shape each shot
    if (recoilIntensity !== undefined) {
      this.triggerRecoil(recoilIntensity);
    }
  }

  /**
   * @param speed movement speed (0 when standing)
   * @param aimAngle where the rifle points (the whole figure faces this way)
   * @param moveAngle direction of travel; the legs turn towards it and run backwards when it is behind the aim
   */
  public updateAnimation(dt: number, speed: number, aimAngle: number, moveAngle = aimAngle): void {
    this.time += dt;
    // Turn quickly but not instantly when the target changes
    this.facing += wrapAngle(aimAngle - this.facing) * Math.min(1, dt * 18);
    const moving = speed > 0.1;
    this.gait += ((moving ? 1 : 0) - this.gait) * Math.min(1, dt * 10);
    const w = this.gait;

    // Legs face the direction of travel (within 90 degrees of the aim), running backwards beyond that
    if (moving) {
      let rel = wrapAngle(moveAngle - this.facing);
      this.backwards = Math.abs(rel) > Math.PI / 2 + 0.15;
      if (this.backwards) rel = wrapAngle(rel - Math.PI);
      this.hipsYaw += (rel * 0.85 - this.hipsYaw) * Math.min(1, dt * 12);
      this.phase += dt * (speed / STRIDE_LENGTH) * Math.PI * 2 * (this.backwards ? -1 : 1);
    } else {
      this.hipsYaw += (0 - this.hipsYaw) * Math.min(1, dt * 6);
    }
    const p = this.phase;

    this.group.rotation.y = this.facing;

    if (this.sculpted?.root.visible) {
      // Rifle shouldered on the right; the rig solves the hands onto it
      const s = this.sculpted;
      this.recoilOffset += (0 - this.recoilOffset) * Math.min(1, dt * 14);
      this.recoilPitch += (0 - this.recoilPitch) * Math.min(1, dt * 12);
      this.holdR.set(-0.13, 1.3, 0.24 - this.recoilOffset);
      this.holdL.set(-0.07, 1.33, 0.55 - this.recoilOffset);
      s.rifle.position.copy(this.holdR).sub(s.grip);
      s.rifle.rotation.x = this.recoilPitch;
      s.anim.update(dt, speed, this.holdR, this.holdL, this.hipsYaw, this.backwards);
      s.root.position.y = s.anim.bob;
      this.updateMuzzle(dt);
      return;
    }

    // Pelvis: bob twice per stride, roll and twist with each step
    this.pelvis.rotation.y = this.hipsYaw + Math.sin(p) * 0.1 * w;
    this.pelvis.rotation.z = Math.sin(p) * 0.05 * w;
    this.pelvis.position.y = HIP_HEIGHT + w * (0.03 * Math.cos(2 * p) - 0.03);

    this.poseLeg(this.legL, p, w);
    this.poseLeg(this.legR, p + Math.PI, w);

    // Torso counter-rotates so the rifle stays on the aim; leans into the run; breathes when idle
    const breathe = Math.sin(this.time * 2.1) * (1 - w);
    const lean = w * (this.backwards ? -0.06 : 0.16);
    this.spine.rotation.set(
      lean + breathe * 0.015,
      -this.pelvis.rotation.y,
      -this.pelvis.rotation.z * 0.6 + Math.sin(this.time * 0.9) * 0.012 * (1 - w)
    );
    this.headGroup.rotation.set(-lean * 0.7, Math.sin(p) * 0.04 * w, -this.spine.rotation.z * 0.5);

    // Rifle: recoil kick and recovery, step bob, idle sway
    this.recoilOffset += (0 - this.recoilOffset) * Math.min(1, dt * 14);
    this.recoilPitch += (0 - this.recoilPitch) * Math.min(1, dt * 12);
    this.weaponGroup.position.set(
      Math.sin(p) * 0.008 * w,
      0.36 + Math.cos(2 * p) * 0.012 * w + Math.sin(this.time * 1.7) * 0.004 * (1 - w),
      0.06 - this.recoilOffset
    );
    this.weaponGroup.rotation.set(this.recoilPitch, Math.sin(this.time * 1.3) * 0.01 * (1 - w), Math.sin(p) * 0.03 * w);
    this.weaponGroup.updateMatrix();

    this.solveArm(SHOULDER_R, GRIP_R, POLE_R, this.upperArmR, this.foreArmR, this.handR);
    this.solveArm(SHOULDER_L, GRIP_L, POLE_L, this.upperArmL, this.foreArmL, this.handL);

    // Long coat: trails behind when running, and the front panels follow the thighs
    this.coatFlap += (w * (0.45 + Math.sin(p * 2) * 0.08) - this.coatFlap) * Math.min(1, dt * 8);
    const [backL, backR, frontL, frontR] = this.coatTails;
    if (backL) {
      backL.rotation.x = this.coatFlap * (this.backwards ? -0.4 : 1);
      backR.rotation.x = this.coatFlap * (this.backwards ? -0.4 : 1);
      frontL.rotation.x = Math.min(0.1, this.legL.hip.rotation.x * 0.8);
      frontR.rotation.x = Math.min(0.1, this.legR.hip.rotation.x * 0.8);
    }

    this.updateMuzzle(dt);
  }

  private updateMuzzle(dt: number): void {
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 22);
    }
    if (this.muzzleFlashMat.opacity > 0) {
      this.muzzleFlashMat.opacity = Math.max(0, this.muzzleFlashMat.opacity - dt * 18);
    }
    this.muzzleFlash.visible = this.muzzleFlashMat.opacity > 0.01;
  }

  /**
   * Running leg: the thigh swings, the knee folds through the forward swing and straightens for
   * the stance, and the ankle keeps the boot roughly flat. Forward is -x rotation.
   */
  private poseLeg(leg: Leg, p: number, w: number): void {
    const thigh = -Math.sin(p) * 0.85 * w;
    const swing = Math.max(0, Math.cos(p));
    const knee = (0.1 + 1.2 * Math.pow(swing, 1.4)) * w + 0.04;
    leg.hip.rotation.x = thigh;
    leg.knee.rotation.x = knee;
    leg.ankle.rotation.x = -(thigh + knee) * 0.75 + Math.max(0, Math.sin(p)) * 0.3 * w;
  }

  /** Two-bone IK in spine space: shoulder to a grip point on the rifle, elbow bent towards the pole. */
  private solveArm(
    shoulder: THREE.Vector3,
    gripLocal: THREE.Vector3,
    pole: THREE.Vector3,
    upper: THREE.Mesh,
    lower: THREE.Mesh,
    hand: THREE.Mesh
  ): void {
    const target = this.v1.copy(gripLocal).applyMatrix4(this.weaponGroup.matrix);
    const toTarget = this.v2.subVectors(target, shoulder);
    const dist = Math.min(Math.max(toTarget.length(), 0.05), UPPER_ARM + FOREARM - 0.002);
    const dir = toTarget.normalize();
    const cosA = (UPPER_ARM * UPPER_ARM + dist * dist - FOREARM * FOREARM) / (2 * UPPER_ARM * dist);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const bend = this.v3.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    this.elbow.copy(shoulder).addScaledVector(dir, UPPER_ARM * cosA).addScaledVector(bend, UPPER_ARM * sinA);
    const wrist = this.v3.copy(shoulder).addScaledVector(dir, dist);

    this.placeSegment(upper, shoulder, this.elbow);
    this.placeSegment(lower, this.elbow, wrist);
    hand.position.copy(wrist);
    hand.quaternion.copy(lower.quaternion);
  }

  private placeSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    const d = this.v2.subVectors(b, a);
    if (d.lengthSq() > 1e-8) mesh.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
