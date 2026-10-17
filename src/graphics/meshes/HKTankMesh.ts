import * as THREE from 'three';
import { VolumetricSearchlight } from '../VolumetricSearchlight';

export class HKTankMesh {
  public readonly group = new THREE.Group();
  public readonly turretGroup: THREE.Group;
  private readonly leftCannon: THREE.Group;
  private readonly rightCannon: THREE.Group;
  private readonly leftSearchlight: VolumetricSearchlight;
  private readonly rightSearchlight: VolumetricSearchlight;
  private readonly telegraphLine: THREE.Line;

  constructor() {
    const scale = 2.2;

    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x48525e,
      metalness: 0.48,
      roughness: 0.48
    });

    const treadMat = new THREE.MeshStandardMaterial({
      color: 0x24282e,
      metalness: 0.35,
      roughness: 0.72
    });

    const opticRedMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff1111,
      emissiveIntensity: 2.0,
      roughness: 0.3
    });

    // 1. Lower Track Chassis (Left & Right Caterpillar Tread Pods)
    const treadLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 5.2), treadMat);
    treadLeft.position.set(-1.8, 0.55, 0);

    const treadRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 5.2), treadMat);
    treadRight.position.set(1.8, 0.55, 0);

    // Center armor belly
    const centerHull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 4.4), tankMat);
    centerHull.position.set(0, 0.8, 0);

    this.group.add(treadLeft, treadRight, centerHull);

    // 2. Central Hydraulic Neck Tower & Turret
    this.turretGroup = new THREE.Group();
    this.turretGroup.position.set(0, 1.2, 0);

    const neckPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 10), tankMat);
    neckPylon.position.set(0, 0.7, 0);

    // Hammerhead command bridge
    const hammerhead = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 2.2), tankMat);
    hammerhead.position.set(0, 1.7, 0.3);

    // Red optical scanner slit across brow
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.25), opticRedMat);
    scanner.position.set(0, 1.75, 1.45);

    this.turretGroup.add(neckPylon, hammerhead, scanner);

    // 3. Twin Heavy Plasma Cannon Booms
    const cannonBarrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.4, 10);
    cannonBarrelGeo.rotateX(Math.PI / 2);

    this.leftCannon = new THREE.Group();
    this.leftCannon.position.set(-2.0, 1.6, 0.8);
    const leftBarrel = new THREE.Mesh(cannonBarrelGeo, tankMat);
    leftBarrel.position.set(0, 0, 1.6);
    this.leftCannon.add(leftBarrel);

    this.rightCannon = new THREE.Group();
    this.rightCannon.position.set(2.0, 1.6, 0.8);
    const rightBarrel = new THREE.Mesh(cannonBarrelGeo, tankMat);
    rightBarrel.position.set(0, 0, 1.6);
    this.rightCannon.add(rightBarrel);

    this.turretGroup.add(this.leftCannon, this.rightCannon);

    // 4. Dual Volumetric Searchlights (sized in local space before 2.2x parent scale)
    this.leftSearchlight = new VolumetricSearchlight(6.5, 1.6);
    this.leftSearchlight.group.position.set(-1.2, 1.4, 1.2);
    this.leftSearchlight.group.rotation.x = -0.15;

    this.rightSearchlight = new VolumetricSearchlight(6.5, 1.6);
    this.rightSearchlight.group.position.set(1.2, 1.4, 1.2);
    this.rightSearchlight.group.rotation.x = -0.15;

    this.turretGroup.add(this.leftSearchlight.group, this.rightSearchlight.group);

    // 5. Plasma Ground Telegraph Beam (visible when charging)
    const telegraphGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0, 0.1, 24)
    ]);
    const telegraphMat = new THREE.LineBasicMaterial({
      color: 0xff1e8e,
      linewidth: 3,
      transparent: true,
      opacity: 0
    });
    this.telegraphLine = new THREE.Line(telegraphGeo, telegraphMat);
    this.turretGroup.add(this.telegraphLine);

    this.group.add(this.turretGroup);
    this.group.scale.set(scale, scale, scale);
  }

  public update(
    timeSeconds: number,
    alertLevel: number,
    chargeProgress: number,
    targetAngle: number
  ): void {
    // Turret tracks player angle
    this.turretGroup.rotation.y = THREE.MathUtils.lerp(
      this.turretGroup.rotation.y,
      targetAngle - this.group.rotation.y,
      0.08
    );

    // Searchlight sweep
    const sweep = Math.sin(timeSeconds * 1.5) * 0.18;
    this.leftSearchlight.group.rotation.y = sweep - 0.12;
    this.rightSearchlight.group.rotation.y = sweep + 0.12;

    this.leftSearchlight.update(timeSeconds, alertLevel, -1.4);
    this.rightSearchlight.update(timeSeconds, alertLevel, -1.4);

    // Telegraph line opacity when charging plasma cannon
    (this.telegraphLine.material as THREE.LineBasicMaterial).opacity =
      chargeProgress > 0 ? 0.3 + chargeProgress * 0.7 : 0;
  }
}
