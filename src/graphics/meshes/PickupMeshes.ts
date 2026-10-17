import * as THREE from 'three';
import { bakePart, mergeParts } from './geometryUtils';

export class PickupMeshFactory {
  private static crystalGeo = mergeParts([
    // Tall floating vertical diamond crystal (stretched octahedron)
    bakePart(new THREE.OctahedronGeometry(0.16, 0).scale(1.0, 1.85, 1.0), 0, 0.12, 0, 0, 0, 0, 0xffffff),
    // Crisp horizontal orbital stabilizer ring
    bakePart(new THREE.TorusGeometry(0.20, 0.022, 6, 8), 0, 0.12, 0, Math.PI / 2, 0, 0, 0xd8f8ff)
  ]);
  private static beamGeo = new THREE.CylinderGeometry(0.025, 0.11, 1.25, 8, 1, true);
  private static groundRingGeo = new THREE.RingGeometry(0.16, 0.26, 16);
  private static crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  private static vaultGeo = new THREE.BoxGeometry(1.4, 0.9, 1.0);

  // Tier 1 XP: Vibrant Neon Emerald Green
  private static emeraldMat = new THREE.MeshStandardMaterial({
    color: 0x00ff66,
    vertexColors: true,
    emissive: 0x00dd55,
    emissiveIntensity: 1.55,
    metalness: 0.2,
    roughness: 0.25
  });
  private static emeraldBeamMat = new THREE.MeshBasicMaterial({
    color: 0x00ff66,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  // Tier 2 XP (xp >= 5): Vibrant Solar Gold
  private static goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc400,
    vertexColors: true,
    emissive: 0xff9900,
    emissiveIntensity: 1.65,
    metalness: 0.25,
    roughness: 0.22
  });
  private static goldBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffc400,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  // Tier 3 XP (xp >= 20): High-energy Neon Magenta-Ruby
  private static rubyMat = new THREE.MeshStandardMaterial({
    color: 0xff0066,
    vertexColors: true,
    emissive: 0xff0055,
    emissiveIntensity: 1.8,
    metalness: 0.25,
    roughness: 0.2
  });
  private static rubyBeamMat = new THREE.MeshBasicMaterial({
    color: 0xff0066,
    transparent: true,
    opacity: 0.44,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  private static crateMat = new THREE.MeshStandardMaterial({
    color: 0x3d4734, // Olive drab army crate
    metalness: 0.3,
    roughness: 0.72
  });

  private static vaultMat = new THREE.MeshStandardMaterial({
    color: 0x2b313a,
    metalness: 0.6,
    roughness: 0.45
  });

  public static createDataCore(xpValue: number): THREE.Group {
    let mat = this.emeraldMat;
    let beamMat = this.emeraldBeamMat;
    let scale = 1.0;
    if (xpValue >= 20) {
      mat = this.rubyMat;
      beamMat = this.rubyBeamMat;
      scale = 1.38;
    } else if (xpValue >= 5) {
      mat = this.goldMat;
      beamMat = this.goldBeamMat;
      scale = 1.18;
    }

    const group = new THREE.Group();

    const crystal = new THREE.Mesh(this.crystalGeo, mat);
    crystal.scale.set(scale, scale, scale);
    group.add(crystal);

    // Vertical holographic loot beam so XP drops are unmistakable from across the map
    const beam = new THREE.Mesh(this.beamGeo, beamMat);
    beam.position.y = 0.55;
    group.add(beam);

    // Ground pulse ring
    const ring = new THREE.Mesh(this.groundRingGeo, beamMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.28;
    group.add(ring);

    group.position.y = 0.35;
    return group;
  }

  public static createSupplyCrate(): THREE.Group {
    const group = new THREE.Group();
    const crate = new THREE.Mesh(this.crateGeo, this.crateMat);
    crate.position.y = 0.4;
    // White Tech-Com resistance chevron marking
    const chevronGeo = new THREE.BoxGeometry(0.5, 0.08, 0.82);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0xdfe8f0 });
    const chevron = new THREE.Mesh(chevronGeo, chevronMat);
    chevron.position.y = 0.4;
    group.add(crate, chevron);
    return group;
  }

  public static createBossVault(): THREE.Group {
    const group = new THREE.Group();
    const chest = new THREE.Mesh(this.vaultGeo, this.vaultMat);
    chest.position.y = 0.45;

    // Glowing Cyberdyne red telemetry screen
    const screenGeo = new THREE.BoxGeometry(0.8, 0.24, 1.02);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.55, 0);

    const light = new THREE.PointLight(0xff2222, 1.8, 6);
    light.position.set(0, 0.8, 0);

    group.add(chest, screen, light);
    return group;
  }
}
