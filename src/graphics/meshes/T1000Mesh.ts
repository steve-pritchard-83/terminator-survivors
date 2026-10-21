import * as THREE from 'three';
import { disposeObject3D } from '../dispose';

export class T1000Mesh {
  public readonly group = new THREE.Group();
  private readonly bodyGroup: THREE.Group;
  private readonly leftBlade: THREE.Mesh;
  private readonly rightBlade: THREE.Mesh;
  private readonly puddleMesh: THREE.Mesh;
  private readonly liquidMat: THREE.MeshStandardMaterial;

  constructor() {
    // Polished mirror chrome: it reflects the night sky and fires, so contrast does the work
    this.liquidMat = new THREE.MeshStandardMaterial({
      color: 0xf4f8fc,
      metalness: 1.0,
      roughness: 0.04,
      envMapIntensity: 2.4
    });
    const mat = this.liquidMat;

    // 1. Humanoid mercury figure, built from smooth lathe profiles
    this.bodyGroup = new THREE.Group();

    const lathe = (profile: Array<[number, number]>, segments = 18): THREE.Mesh =>
      new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments), mat);

    // Torso: waist, chest, shoulder line, neck
    const torso = lathe([
      [0.001, 0.92], [0.2, 0.95], [0.22, 1.1], [0.27, 1.35], [0.3, 1.52], [0.27, 1.66], [0.11, 1.72], [0.09, 1.8], [0.001, 1.8]
    ]);

    // Legs: thigh, knee, shin, flowing foot
    const legProfile: Array<[number, number]> = [
      [0.001, 0.0], [0.11, 0.0], [0.1, 0.08], [0.085, 0.4], [0.1, 0.52], [0.125, 0.68], [0.14, 0.93], [0.001, 0.93]
    ];
    const legL = lathe(legProfile, 14);
    legL.position.x = -0.12;
    const legR = lathe(legProfile, 14);
    legR.position.x = 0.12;

    // Head with a face: brow, nose, chin
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), mat);
    head.position.y = 1.93;
    head.scale.set(0.88, 1.12, 1.0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat);
    nose.position.set(0, 1.9, 0.19);
    nose.scale.set(0.8, 1.2, 1.2);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.06), mat);
    brow.position.set(0, 1.97, 0.16);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat);
    chin.position.set(0, 1.8, 0.12);
    chin.scale.set(1.1, 0.8, 1);

    // Shoulders and arms flowing into blades
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mat);
    shoulderL.position.set(-0.33, 1.6, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.33;
    const arm = (sx: number): THREE.Mesh => {
      const from = new THREE.Vector3(sx * 0.33, 1.6, 0);
      const to = new THREE.Vector3(sx * 0.43, 1.3, 0.5);
      const dir = to.clone().sub(from);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, dir.length(), 10), mat);
      m.position.copy(from.clone().add(to).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    };

    // Morphing solid-chrome arm blades: broad, flat and pointed so they read from above
    const bladeGeo = new THREE.ConeGeometry(0.1, 1.5, 4);
    bladeGeo.rotateX(Math.PI / 2);
    bladeGeo.scale(1.7, 0.35, 1);

    this.leftBlade = new THREE.Mesh(bladeGeo, mat);
    this.leftBlade.position.set(-0.45, 1.3, 1.2);

    this.rightBlade = new THREE.Mesh(bladeGeo, mat);
    this.rightBlade.position.set(0.45, 1.3, 1.2);

    // Liquid pool the figure is flowing out of
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.05, 20), mat);
    pool.position.y = 0.025;

    this.bodyGroup.add(
      torso, legL, legR, head, nose, brow, chin, shoulderL, shoulderR, arm(-1), arm(1), this.leftBlade, this.rightBlade, pool
    );
    this.group.add(this.bodyGroup);

    // 2. Mercury Puddle (flattened disc for puddle state)
    const puddleGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.08, 24);
    this.puddleMesh = new THREE.Mesh(puddleGeo, this.liquidMat);
    this.puddleMesh.position.y = 0.04;
    this.puddleMesh.visible = false;
    this.group.add(this.puddleMesh);
  }

  public update(timeSeconds: number, isLiquid: boolean, isSlashing: boolean): void {
    if (isLiquid) {
      this.bodyGroup.visible = false;
      this.puddleMesh.visible = true;
      const pulse = 1.0 + Math.sin(timeSeconds * 12) * 0.1;
      this.puddleMesh.scale.set(pulse, 1.0, pulse);
      return;
    }

    this.bodyGroup.visible = true;
    this.puddleMesh.visible = false;

    // Subtle fluid ripple
    this.bodyGroup.position.y = Math.sin(timeSeconds * 6) * 0.04;

    if (isSlashing) {
      this.leftBlade.scale.set(1.4, 1.4, 1.8);
      this.rightBlade.scale.set(1.4, 1.4, 1.8);
      this.leftBlade.rotation.x = Math.sin(timeSeconds * 14) * 0.8;
      this.rightBlade.rotation.x = -Math.sin(timeSeconds * 14) * 0.8;
    } else {
      this.leftBlade.scale.set(1, 1, 1);
      this.rightBlade.scale.set(1, 1, 1);
      this.leftBlade.rotation.x = 0;
      this.rightBlade.rotation.x = 0;
    }
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}
