import * as THREE from 'three';
import { bakePart, mergeParts } from './geometryUtils';
import type { ActiveEnemy } from '../../core/types';
import { ProceduralTextures } from '../ProceduralTextures';

export class EndoskeletonBatch {
  public readonly group = new THREE.Group();
  public readonly chassisInstancedMesh: THREE.InstancedMesh;
  public readonly opticsInstancedMesh: THREE.InstancedMesh;
  public readonly crabChassisInstancedMesh: THREE.InstancedMesh;
  public readonly crabOpticsInstancedMesh: THREE.InstancedMesh;
  private readonly maxCount: number;

  private readonly dummy = new THREE.Object3D();
  private readonly dummyColor = new THREE.Color();

  constructor(maxCount = 650) {
    this.maxCount = maxCount;

    // 1. Build composite hyperalloy chassis geometry
    const chassisParts: THREE.BufferGeometry[] = [
      // Cranium dome
      bakePart(new THREE.SphereGeometry(0.19, 10, 8), 0, 1.72, 0),
      // Supraorbital brow bar
      bakePart(new THREE.BoxGeometry(0.30, 0.07, 0.22), 0, 1.73, 0.07),
      // Maxilla & teeth block
      bakePart(new THREE.BoxGeometry(0.22, 0.16, 0.20), 0, 1.56, 0.05),
      // Cheek hydraulic pistons L/R
      bakePart(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), -0.13, 1.60, 0.04, 0, 0, 0.2),
      bakePart(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), 0.13, 1.60, 0.04, 0, 0, -0.2),
      // Cervical spine & pistons
      bakePart(new THREE.CylinderGeometry(0.07, 0.08, 0.18, 8), 0, 1.44, -0.02),
      // Clavicle yoke
      bakePart(new THREE.BoxGeometry(0.62, 0.09, 0.20), 0, 1.34, 0),
      // Thoracic ribcage core
      bakePart(new THREE.CylinderGeometry(0.18, 0.14, 0.42, 8), 0, 1.12, 0),
      // Spinal column rod
      bakePart(new THREE.CylinderGeometry(0.055, 0.055, 0.65, 6), 0, 0.95, -0.06),
      // Pelvic H-Chassis
      bakePart(new THREE.BoxGeometry(0.42, 0.16, 0.22), 0, 0.72, 0),
      // Thigh twin struts L/R
      bakePart(new THREE.CylinderGeometry(0.065, 0.055, 0.38, 6), -0.14, 0.48, 0),
      bakePart(new THREE.CylinderGeometry(0.065, 0.055, 0.38, 6), 0.14, 0.48, 0),
      // Shin pistons L/R
      bakePart(new THREE.CylinderGeometry(0.05, 0.04, 0.36, 6), -0.14, 0.18, 0),
      bakePart(new THREE.CylinderGeometry(0.05, 0.04, 0.36, 6), 0.14, 0.18, 0),
      // Upper arms L/R
      bakePart(new THREE.CylinderGeometry(0.05, 0.045, 0.34, 6), -0.34, 1.15, 0.05, 0.35, 0, 0),
      bakePart(new THREE.CylinderGeometry(0.05, 0.045, 0.34, 6), 0.34, 1.15, 0.05, 0.35, 0, 0),
      // Forearm & M-25 rifle barrel
      bakePart(new THREE.BoxGeometry(0.08, 0.09, 0.58), 0.26, 1.02, 0.32)
    ];

    const chassisGeo = mergeParts(chassisParts);

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xd4e2f2,
      emissive: 0x24364d,
      emissiveIntensity: 0.48,
      metalness: 0.68,
      roughness: 0.22,
      normalMap: ProceduralTextures.getBrushedMetalNormal(),
      roughnessMap: ProceduralTextures.getBrushedMetalRoughness()
    });

    this.chassisInstancedMesh = new THREE.InstancedMesh(chassisGeo, chassisMat, maxCount);
    this.chassisInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chassisInstancedMesh.castShadow = false;
    this.chassisInstancedMesh.receiveShadow = false;

    // 2. Build glowing crimson optics geometry
    const opticsParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.SphereGeometry(0.038, 8, 8), -0.075, 1.68, 0.17),
      bakePart(new THREE.SphereGeometry(0.038, 8, 8), 0.075, 1.68, 0.17),
      bakePart(new THREE.BoxGeometry(0.10, 0.08, 0.22), 0, 1.16, 0.04)
    ];
    const opticsGeo = mergeParts(opticsParts);

    const opticsMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff0000,
      emissiveIntensity: 4.5,
      roughness: 0.2,
      metalness: 0.1
    });

    this.opticsInstancedMesh = new THREE.InstancedMesh(opticsGeo, opticsMat, maxCount);
    this.opticsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // 3. Build Skynet Recon Crab Scuttler instanced mesh (quadruped spider-tank drone)
    const crabParts: THREE.BufferGeometry[] = [
      // Armored low-profile carapace dome
      bakePart(new THREE.CylinderGeometry(0.28, 0.38, 0.22, 8), 0, 0.32, 0),
      // Front sensor visor cowl
      bakePart(new THREE.BoxGeometry(0.32, 0.14, 0.24), 0, 0.30, 0.22),
      // 4 articulated mechanical scuttle legs
      bakePart(new THREE.CylinderGeometry(0.035, 0.025, 0.48, 6), -0.34, 0.20, 0.22, 0.3, 0, 0.6),
      bakePart(new THREE.CylinderGeometry(0.035, 0.025, 0.48, 6), 0.34, 0.20, 0.22, 0.3, 0, -0.6),
      bakePart(new THREE.CylinderGeometry(0.035, 0.025, 0.48, 6), -0.34, 0.20, -0.22, -0.3, 0, 0.6),
      bakePart(new THREE.CylinderGeometry(0.035, 0.025, 0.48, 6), 0.34, 0.20, -0.22, -0.3, 0, -0.6)
    ];
    const crabGeo = mergeParts(crabParts);
    this.crabChassisInstancedMesh = new THREE.InstancedMesh(crabGeo, chassisMat, maxCount);
    this.crabChassisInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const crabEyeGeo = bakePart(new THREE.SphereGeometry(0.06, 8, 8), 0, 0.31, 0.35);
    this.crabOpticsInstancedMesh = new THREE.InstancedMesh(crabEyeGeo, opticsMat, maxCount);
    this.crabOpticsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.group.add(
      this.chassisInstancedMesh,
      this.opticsInstancedMesh,
      this.crabChassisInstancedMesh,
      this.crabOpticsInstancedMesh
    );
  }

  public updateBatch(
    enemies: ActiveEnemy[],
    timeSeconds: number,
    playerX = 0,
    playerZ = 0
  ): void {
    let activeIndex = 0;
    let crabIndex = 0;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const facingAngle = Math.atan2(playerX - enemy.x, playerZ - enemy.z);

      if (enemy.archetype === 'skynet_crab_drone') {
        if (crabIndex >= this.maxCount) continue;
        const scuttleBob = Math.abs(Math.sin(timeSeconds * 16 + enemy.id)) * 0.05;
        const scuttleTilt = Math.sin(timeSeconds * 16 + enemy.id) * 0.1;

        this.dummy.position.set(enemy.x, scuttleBob, enemy.z);
        this.dummy.rotation.set(0, facingAngle, scuttleTilt);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();

        this.crabChassisInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);
        this.crabOpticsInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);

        if (enemy.hitFlashTimer > 0) {
          this.dummyColor.setHex(0xffffff);
        } else {
          this.dummyColor.setHex(0x8a9ba8);
        }
        this.crabChassisInstancedMesh.setColorAt(crabIndex, this.dummyColor);
        crabIndex++;
        continue;
      }

      // Only render humanoid endoskeletons in the primary instanced batch
      if (
        enemy.archetype !== 't800_endoskeleton' &&
        enemy.archetype !== 't600_rusted' &&
        enemy.archetype !== 't700_scout'
      ) {
        continue;
      }
      if (activeIndex >= this.maxCount) continue;

      // Animatronic mechanical limp / bob
      const bobY = Math.abs(Math.sin(timeSeconds * 8 + enemy.id)) * 0.08;
      const rollZ = Math.sin(timeSeconds * 8 + enemy.id) * 0.07;

      this.dummy.position.set(enemy.x, bobY, enemy.z);
      this.dummy.rotation.set(0, facingAngle, rollZ);

      // Scale variation for T-600 heavy vs T-700 runner
      let scale = 1.0;
      if (enemy.archetype === 't600_rusted') scale = 1.25;
      else if (enemy.archetype === 't700_scout') scale = 0.92;
      this.dummy.scale.set(scale, scale, scale);

      this.dummy.updateMatrix();

      this.chassisInstancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);
      this.opticsInstancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);

      // Color tint & hit flash
      if (enemy.hitFlashTimer > 0) {
        this.dummyColor.setHex(0xffffff);
      } else if (enemy.archetype === 't600_rusted') {
        this.dummyColor.setHex(0x5a524c); // Dark rusted iron
      } else if (enemy.archetype === 't700_scout') {
        this.dummyColor.setHex(0x707c8a);
      } else {
        this.dummyColor.setHex(0x9ca8b8); // Chrome T-800
      }
      this.chassisInstancedMesh.setColorAt(activeIndex, this.dummyColor);

      activeIndex++;
    }

    this.chassisInstancedMesh.count = activeIndex;
    this.opticsInstancedMesh.count = activeIndex;
    this.chassisInstancedMesh.instanceMatrix.needsUpdate = true;
    this.opticsInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.chassisInstancedMesh.instanceColor) {
      this.chassisInstancedMesh.instanceColor.needsUpdate = true;
    }

    this.crabChassisInstancedMesh.count = crabIndex;
    this.crabOpticsInstancedMesh.count = crabIndex;
    this.crabChassisInstancedMesh.instanceMatrix.needsUpdate = true;
    this.crabOpticsInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.crabChassisInstancedMesh.instanceColor) {
      this.crabChassisInstancedMesh.instanceColor.needsUpdate = true;
    }
  }
}
