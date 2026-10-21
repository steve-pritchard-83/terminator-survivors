import * as THREE from 'three';
import { VolumetricSearchlight } from '../VolumetricSearchlight';
import { disposeObject3D } from '../dispose';
import { buildTankGlow, buildTankLower, buildTankTurret } from './HKTankGeometry';

export class HKTankMesh {
  public readonly group = new THREE.Group();
  public readonly turretGroup: THREE.Group;
  private readonly leftSearchlight: VolumetricSearchlight;
  private readonly rightSearchlight: VolumetricSearchlight;
  private readonly telegraphLine: THREE.Line;

  constructor() {
    const scale = 2.2;

    // Dark gunmetal: strong reflections and a cold highlight read as armour at distance
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.78,
      roughness: 0.42,
      envMapIntensity: 1.4
    });
    // Emissive scanner, sensor lenses and plasma coils
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });

    // 1. Lower hull and caterpillar tracks
    const lower = new THREE.Mesh(buildTankLower(), metalMat);
    this.group.add(lower);

    // 2. Neck tower, hammerhead command pod and twin plasma cannons (all in turret space)
    this.turretGroup = new THREE.Group();
    this.turretGroup.position.set(0, 1.2, 0);
    this.turretGroup.add(new THREE.Mesh(buildTankTurret(), metalMat));
    this.turretGroup.add(new THREE.Mesh(buildTankGlow(), glowMat));

    // 4. Dual Volumetric Searchlights (sized in local space before 2.2x parent scale)
    this.leftSearchlight = new VolumetricSearchlight(6.5, 1.6);
    this.leftSearchlight.group.position.set(-1.2, 1.55, 1.6);
    this.leftSearchlight.group.rotation.x = -0.15;

    this.rightSearchlight = new VolumetricSearchlight(6.5, 1.6);
    this.rightSearchlight.group.position.set(1.2, 1.55, 1.6);
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

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}
