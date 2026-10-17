import * as THREE from 'three';

export class T1000Mesh {
  public readonly group = new THREE.Group();
  private readonly bodyGroup: THREE.Group;
  private readonly leftBlade: THREE.Mesh;
  private readonly rightBlade: THREE.Mesh;
  private readonly puddleMesh: THREE.Mesh;
  private readonly liquidMat: THREE.MeshStandardMaterial;

  constructor() {
    this.liquidMat = new THREE.MeshStandardMaterial({
      color: 0xe8f0f8,
      metalness: 1.0,
      roughness: 0.03
    });

    // 1. Humanoid mercury figure
    this.bodyGroup = new THREE.Group();

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), this.liquidMat);
    head.position.y = 1.9;

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.8, 12), this.liquidMat);
    torso.position.y = 1.35;

    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.95, 10), this.liquidMat);
    legs.position.y = 0.5;

    // Morphing solid-chrome arm blades
    const bladeGeo = new THREE.ConeGeometry(0.08, 1.4, 6);
    bladeGeo.rotateX(Math.PI / 2);

    this.leftBlade = new THREE.Mesh(bladeGeo, this.liquidMat);
    this.leftBlade.position.set(-0.45, 1.3, 0.6);

    this.rightBlade = new THREE.Mesh(bladeGeo, this.liquidMat);
    this.rightBlade.position.set(0.45, 1.3, 0.6);

    this.bodyGroup.add(head, torso, legs, this.leftBlade, this.rightBlade);
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
}
