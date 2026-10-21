import * as THREE from 'three';
import { VolumetricSearchlight } from '../VolumetricSearchlight';
import { disposeObject3D } from '../dispose';
import { ModelLibrary } from '../ModelLibrary';
import { createPlaceholder } from './geometryUtils';

export class HKAerialMesh {
  public readonly group = new THREE.Group();
  private readonly leftSearchlight: VolumetricSearchlight;
  private readonly rightSearchlight: VolumetricSearchlight;
  private readonly leftStrobe: THREE.Mesh;
  private readonly rightStrobe: THREE.Mesh;
  // Stand-in until the sculpted model has loaded
  private readonly placeholder: THREE.Mesh;
  private modelApplied = false;

  public currentPitch = 0;
  public currentRoll = 0;

  constructor(isSquadronLeader = false) {
    const scale = isSquadronLeader ? 1.55 : 1.1;

    const strobeRedMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff1111,
      emissiveIntensity: 2.0,
      roughness: 0.3
    });

    this.placeholder = createPlaceholder(5.8, 0.8, 3.2, 0);
    this.group.add(this.placeholder);

    // Wingtip red strobes
    this.leftStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), strobeRedMat);
    this.leftStrobe.position.set(-3.2, -0.3, -0.35);
    this.rightStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), strobeRedMat);
    this.rightStrobe.position.set(3.2, -0.3, -0.35);
    this.group.add(this.leftStrobe, this.rightStrobe);

    // Dual Volumetric Searchlights (scaled appropriately for parent group)
    this.leftSearchlight = new VolumetricSearchlight(9.5, 2.2);
    this.leftSearchlight.group.position.set(-0.8, -0.4, 0.5);
    this.leftSearchlight.group.rotation.x = -0.35; // Angled forward down to ground

    this.rightSearchlight = new VolumetricSearchlight(9.5, 2.2);
    this.rightSearchlight.group.position.set(0.8, -0.4, 0.5);
    this.rightSearchlight.group.rotation.x = -0.35;

    this.group.add(this.leftSearchlight.group, this.rightSearchlight.group);

    this.group.scale.set(scale, scale, scale);
    this.applyModelIfReady();
  }

  /** Swaps the placeholder for the sculpted model as soon as it is available. */
  private applyModelIfReady(): void {
    if (this.modelApplied) return;
    const model = ModelLibrary.get('hk_aerial');
    if (!model) return;
    this.modelApplied = true;
    this.group.remove(this.placeholder);
    this.placeholder.geometry.dispose();
    this.group.add(model);
    // Strobes on the engine pods, searchlights under the nose
    this.leftStrobe.position.set(-2.95, 0.25, -0.3);
    this.rightStrobe.position.set(2.95, 0.25, -0.3);
    this.leftSearchlight.group.position.set(-0.55, -0.9, 2.3);
    this.rightSearchlight.group.position.set(0.55, -0.9, 2.3);
  }

  public update(
    timeSeconds: number,
    alertLevel: number,
    groundY: number,
    vx = 0,
    vz = 0,
    dt = 0.016
  ): void {
    this.applyModelIfReady();
    // Flight pitch and bank roll based on velocity relative to heading
    const heading = this.group.rotation.y;
    const fwdSpeed = vx * Math.sin(heading) + vz * Math.cos(heading);
    const latSpeed = vx * Math.cos(heading) - vz * Math.sin(heading);

    const targetPitch = Math.max(-0.25, Math.min(0.25, fwdSpeed * 0.035));
    const targetRoll = Math.max(-0.35, Math.min(0.35, -latSpeed * 0.05));

    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, Math.min(1, dt * 6));
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, Math.min(1, dt * 6));

    this.group.rotation.x = this.currentPitch;
    this.group.rotation.z = this.currentRoll;

    // Searchlight sweep back and forth
    const sweep = Math.sin(timeSeconds * 1.8) * 0.22;
    this.leftSearchlight.group.rotation.y = sweep - 0.15;
    this.rightSearchlight.group.rotation.y = sweep + 0.15;

    // Strobe blink every 1.0s
    const isStrobeOn = Math.sin(timeSeconds * 6) > 0.4;
    this.leftStrobe.visible = isStrobeOn;
    this.rightStrobe.visible = isStrobeOn;

    const groundOffset = groundY - this.group.position.y;
    this.leftSearchlight.update(timeSeconds, alertLevel, groundOffset);
    this.rightSearchlight.update(timeSeconds, alertLevel, groundOffset);
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}
