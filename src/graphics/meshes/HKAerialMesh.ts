import * as THREE from 'three';
import { VolumetricSearchlight } from '../VolumetricSearchlight';

export class HKAerialMesh {
  public readonly group = new THREE.Group();
  private readonly leftTurbine: THREE.Group;
  private readonly rightTurbine: THREE.Group;
  private readonly leftSearchlight: VolumetricSearchlight;
  private readonly rightSearchlight: VolumetricSearchlight;
  private readonly leftStrobe: THREE.Mesh;
  private readonly rightStrobe: THREE.Mesh;
  private readonly plasmaBarrels: THREE.Group;

  constructor(isSquadronLeader = false) {
    const scale = isSquadronLeader ? 1.55 : 1.1;

    const hullMat = new THREE.MeshStandardMaterial({
      color: isSquadronLeader ? 0x778899 : 0x6e7b8c,
      metalness: 0.48,
      roughness: 0.48
    });

    const glowCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b8e6,
      emissiveIntensity: 1.6,
      roughness: 0.35
    });

    const strobeRedMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff1111,
      emissiveIntensity: 2.0,
      roughness: 0.3
    });

    // 1. Central fuselage hull & forward sensor nose (non-zero tip cylinder avoids degenerate cone apex normals)
    const noseGeo = new THREE.CylinderGeometry(0.18, 0.7, 2.2, 8);
    noseGeo.rotateX(Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeo, hullMat);
    noseMesh.position.set(0, 0, 1.4);

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 3.2), hullMat);

    // Forward optical sensor visor (crimson bar)
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.2), strobeRedMat);
    visorMesh.position.set(0, 0.1, 2.1);

    this.group.add(noseMesh, bodyMesh, visorMesh);

    // 2. Swept wings
    const wingGeo = new THREE.BoxGeometry(6.4, 0.15, 1.2);
    const wingMesh = new THREE.Mesh(wingGeo, hullMat);
    wingMesh.position.set(0, 0.15, -0.4);
    this.group.add(wingMesh);

    // Wingtip red strobes
    this.leftStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), strobeRedMat);
    this.leftStrobe.position.set(-3.2, 0.15, -0.4);
    this.rightStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), strobeRedMat);
    this.rightStrobe.position.set(3.2, 0.15, -0.4);
    this.group.add(this.leftStrobe, this.rightStrobe);

    // 3. Port & Starboard Tilting Turbine Nacelles
    this.leftTurbine = new THREE.Group();
    this.leftTurbine.position.set(-2.6, 0.1, -0.3);
    const nacelleGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.6, 12);
    nacelleGeo.rotateX(Math.PI / 2);
    const leftNacelleMesh = new THREE.Mesh(nacelleGeo, hullMat);
    const leftThrustGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.1, 0.4, 12),
      glowCyanMat
    );
    leftThrustGlow.position.set(0, 0, -0.9);
    leftThrustGlow.rotateX(Math.PI / 2);
    this.leftTurbine.add(leftNacelleMesh, leftThrustGlow);

    this.rightTurbine = new THREE.Group();
    this.rightTurbine.position.set(2.6, 0.1, -0.3);
    const rightNacelleMesh = new THREE.Mesh(nacelleGeo, hullMat);
    const rightThrustGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.1, 0.4, 12),
      glowCyanMat
    );
    rightThrustGlow.position.set(0, 0, -0.9);
    rightThrustGlow.rotateX(Math.PI / 2);
    this.rightTurbine.add(rightNacelleMesh, rightThrustGlow);

    this.group.add(this.leftTurbine, this.rightTurbine);

    // 4. Twin Underslung Plasma Cannons
    this.plasmaBarrels = new THREE.Group();
    this.plasmaBarrels.position.set(0, -0.55, 0.6);
    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelL = new THREE.Mesh(barrelGeo, hullMat);
    barrelL.position.x = -0.4;
    const barrelR = new THREE.Mesh(barrelGeo, hullMat);
    barrelR.position.x = 0.4;
    this.plasmaBarrels.add(barrelL, barrelR);
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
  }

  public update(timeSeconds: number, alertLevel: number, groundY: number): void {
    // Turbine hover pitch oscillation
    const pitch = Math.sin(timeSeconds * 3.5) * 0.08;
    this.leftTurbine.rotation.x = pitch;
    this.rightTurbine.rotation.x = pitch;

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
}
