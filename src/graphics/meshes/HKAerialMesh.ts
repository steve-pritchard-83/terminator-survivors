import * as THREE from 'three';
import { VolumetricSearchlight } from '../VolumetricSearchlight';
import { disposeObject3D } from '../dispose';
import { ModelLibrary } from '../ModelLibrary';
import {
  buildAerialCannons,
  buildAerialGlow,
  buildAerialHull,
  buildAerialNacelle,
  buildAerialThrust
} from './HKAerialGeometry';

export class HKAerialMesh {
  public readonly group = new THREE.Group();
  public readonly leftTurbine: THREE.Group;
  public readonly rightTurbine: THREE.Group;
  private readonly leftSearchlight: VolumetricSearchlight;
  private readonly rightSearchlight: VolumetricSearchlight;
  private readonly leftStrobe: THREE.Mesh;
  private readonly rightStrobe: THREE.Mesh;
  private readonly plasmaBarrels: THREE.Group;
  // Procedural hull pieces, replaced by the sculpted model once it has loaded
  private readonly proceduralParts: THREE.Object3D[] = [];
  private modelApplied = false;

  public currentPitch = 0;
  public currentRoll = 0;

  constructor(isSquadronLeader = false) {
    const scale = isSquadronLeader ? 1.55 : 1.1;

    // Dark gunmetal, as in the films: it reads by its rim highlights, engines and searchlights
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x8a9098,
      vertexColors: true,
      metalness: 0.82,
      roughness: 0.4,
      envMapIntensity: 1.2
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });

    const strobeRedMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff1111,
      emissiveIntensity: 2.0,
      roughness: 0.3
    });

    // 1. Hull (fuselage, wings, canopy, chin mount) and emissive visor / emitters
    const hull = new THREE.Mesh(buildAerialHull(), metalMat);
    const glow = new THREE.Mesh(buildAerialGlow(), glowMat);
    this.group.add(hull, glow);

    // Wingtip red strobes
    this.leftStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), strobeRedMat);
    this.leftStrobe.position.set(-3.2, -0.3, -0.35);
    this.rightStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), strobeRedMat);
    this.rightStrobe.position.set(3.2, -0.3, -0.35);
    this.group.add(this.leftStrobe, this.rightStrobe);

    // 2. Port & starboard tilting turbine nacelles (ducted fans)
    const nacelleGeo = buildAerialNacelle();
    const thrustGeo = buildAerialThrust();
    this.leftTurbine = new THREE.Group();
    this.leftTurbine.position.set(-2.6, 0.1, -0.3);
    this.leftTurbine.add(new THREE.Mesh(nacelleGeo, metalMat), new THREE.Mesh(thrustGeo, glowMat));
    this.rightTurbine = new THREE.Group();
    this.rightTurbine.position.set(2.6, 0.1, -0.3);
    this.rightTurbine.add(new THREE.Mesh(nacelleGeo, metalMat), new THREE.Mesh(thrustGeo, glowMat));
    this.group.add(this.leftTurbine, this.rightTurbine);

    // 3. Twin chin plasma cannons
    this.plasmaBarrels = new THREE.Group();
    this.plasmaBarrels.position.set(0, -0.35, 1.45);
    this.plasmaBarrels.add(new THREE.Mesh(buildAerialCannons(), metalMat));
    this.group.add(this.plasmaBarrels);

    // 5. Dual Volumetric Searchlights (scaled appropriately for parent group)
    this.leftSearchlight = new VolumetricSearchlight(9.5, 2.2);
    this.leftSearchlight.group.position.set(-0.8, -0.4, 0.5);
    this.leftSearchlight.group.rotation.x = -0.35; // Angled forward down to ground

    this.rightSearchlight = new VolumetricSearchlight(9.5, 2.2);
    this.rightSearchlight.group.position.set(0.8, -0.4, 0.5);
    this.rightSearchlight.group.rotation.x = -0.35;

    this.group.add(this.leftSearchlight.group, this.rightSearchlight.group);

    this.group.scale.set(scale, scale, scale);
    this.proceduralParts.push(hull, glow, this.leftTurbine, this.rightTurbine, this.plasmaBarrels);
    this.applyModelIfReady();
  }

  /** Swaps the procedural hull for the sculpted model as soon as it is available. */
  private applyModelIfReady(): void {
    if (this.modelApplied) return;
    const model = ModelLibrary.get('hk_aerial');
    if (!model) return;
    this.modelApplied = true;
    for (const part of this.proceduralParts) {
      this.group.remove(part);
      disposeObject3D(part);
    }
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

    // Turbine hover pitch oscillation + dynamic flight tilt + roll differential
    const hoverPitch = Math.sin(timeSeconds * 3.5) * 0.08;
    const thrusterForwardTilt = this.currentPitch * 1.5;
    const rollDifferential = this.currentRoll * 0.75;

    this.leftTurbine.rotation.x = hoverPitch + thrusterForwardTilt - rollDifferential;
    this.rightTurbine.rotation.x = hoverPitch + thrusterForwardTilt + rollDifferential;

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
