import * as THREE from 'three';
import { bakePart, mergeParts } from './geometryUtils';

export class PickupMeshFactory {
  private static coreGeo = mergeParts([
    // Outer metallic titanium hex-frame
    bakePart(new THREE.TorusGeometry(0.19, 0.035, 6, 6), 0, 0, 0, Math.PI / 2, 0, 0, 0x90a4b8),
    // Inner glowing octahedron crystal core
    bakePart(new THREE.OctahedronGeometry(0.15, 0), 0, 0, 0, 0, 0, 0, 0xffffff)
  ]);
  private static crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  private static vaultGeo = new THREE.BoxGeometry(1.4, 0.9, 1.0);

  private static cyanMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    vertexColors: true,
    emissive: 0x00a8cc,
    emissiveIntensity: 1.15,
    metalness: 0.4,
    roughness: 0.2
  });

  private static violetMat = new THREE.MeshStandardMaterial({
    color: 0xd400ff,
    vertexColors: true,
    emissive: 0x9900cc,
    emissiveIntensity: 1.35,
    metalness: 0.4,
    roughness: 0.2
  });

  private static redMat = new THREE.MeshStandardMaterial({
    color: 0xff1e8e,
    vertexColors: true,
    emissive: 0xcc0044,
    emissiveIntensity: 1.5,
    metalness: 0.4,
    roughness: 0.2
  });

  private static crateMat = new THREE.MeshStandardMaterial({
    color: 0x3d4734, // Olive drab army crate
    metalness: 0.4,
    roughness: 0.65
  });

  private static vaultMat = new THREE.MeshStandardMaterial({
    color: 0x2b313a,
    metalness: 0.9,
    roughness: 0.2
  });

  public static createDataCore(xpValue: number): THREE.Mesh {
    let mat = this.cyanMat;
    let scale = 1.0;
    if (xpValue >= 20) {
      mat = this.redMat;
      scale = 1.45;
    } else if (xpValue >= 5) {
      mat = this.violetMat;
      scale = 1.22;
    }
    const mesh = new THREE.Mesh(this.coreGeo, mat);
    mesh.scale.set(scale, scale, scale);
    mesh.position.y = 0.32;
    return mesh;
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
