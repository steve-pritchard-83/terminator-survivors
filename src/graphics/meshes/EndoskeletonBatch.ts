import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import { bakePart, mergeParts } from './geometryUtils';
import { buildEndoChassis, buildEndoLeg, buildEndoOptics } from './EndoskeletonGeometry';
import type { ActiveEnemy } from '../../core/types';
import { ProceduralTextures } from '../ProceduralTextures';
import { ELITE_AFFIXES } from '../../data/enemies';

export class EndoskeletonBatch {
  public readonly group = new THREE.Group();
  public readonly chassisInstancedMesh: THREE.InstancedMesh;
  public readonly leftLegInstancedMesh: THREE.InstancedMesh;
  public readonly rightLegInstancedMesh: THREE.InstancedMesh;
  public readonly opticsInstancedMesh: THREE.InstancedMesh;
  public readonly crabChassisInstancedMesh: THREE.InstancedMesh;
  public readonly crabOpticsInstancedMesh: THREE.InstancedMesh;
  private readonly maxCount: number;

  private readonly dummy = new THREE.Object3D();
  private readonly legDummy = new THREE.Object3D();
  private readonly dummyColor = new THREE.Color();

  constructor(maxCount = 650) {
    this.maxCount = maxCount;

    // Neutral polished steel (the endoskeleton is silver chrome, not blue)
    const chromeBright = 0xd6dadf;
    const chromeMid = 0xa0a6ad;
    const darkSocket = 0x07090c;
    const pistonSteel = 0x6e747b;
    const gunmetal = 0x2b2f35;
    const teethIvory = 0xdedcd4;

    // 1. T-800 endoskeleton geometry (skull, torso, arms, M-25 rifle) and the two animated legs
    const chassisGeo = buildEndoChassis();
    const leftLegGeo = buildEndoLeg(-0.15);
    const rightLegGeo = buildEndoLeg(0.15);

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x000000,
      emissiveIntensity: 0,
      metalness: 0.95,
      roughness: 0.36,
      envMapIntensity: 1.5,
      normalMap: ProceduralTextures.getBrushedMetalNormal(),
      roughnessMap: ProceduralTextures.getBrushedMetalRoughness()
    });

    this.chassisInstancedMesh = new THREE.InstancedMesh(chassisGeo, chassisMat, maxCount);
    this.chassisInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chassisInstancedMesh.frustumCulled = false;

    this.leftLegInstancedMesh = new THREE.InstancedMesh(leftLegGeo, chassisMat, maxCount);
    this.leftLegInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.leftLegInstancedMesh.frustumCulled = false;

    this.rightLegInstancedMesh = new THREE.InstancedMesh(rightLegGeo, chassisMat, maxCount);
    this.rightLegInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rightLegInstancedMesh.frustumCulled = false;

    // 3. Glowing red optics and rifle plasma chamber
    const opticsGeo = buildEndoOptics();

    const opticsMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0xff0000,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.1
    });

    this.opticsInstancedMesh = new THREE.InstancedMesh(opticsGeo, opticsMat, maxCount);
    this.opticsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.opticsInstancedMesh.frustumCulled = false;

    // 4. Build Detailed 6-Legged Cyberdyne Recon Crab-Walker (spider-tank scuttler)
    const crabParts: THREE.BufferGeometry[] = [
      // Main sloped octagonal armored carapace
      bakePart(
        new THREE.CylinderGeometry(0.28, 0.44, 0.2, 8),
        0,
        0.34,
        0,
        0,
        Math.PI / 8,
        0,
        chromeBright
      ),
      // Dorsal reactor cooling dome & spine vents
      bakePart(
        new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8),
        0,
        0.46,
        -0.04,
        0,
        0,
        0,
        pistonSteel
      ),
      bakePart(new THREE.BoxGeometry(0.24, 0.08, 0.28), 0, 0.42, -0.1, -0.15, 0, 0, gunmetal),
      // Dark recessed front optical visor bay
      bakePart(new THREE.BoxGeometry(0.34, 0.12, 0.2), 0, 0.31, 0.28, 0, 0, 0, darkSocket),
      // Twin forward plasma pincer barrels
      bakePart(
        new THREE.CylinderGeometry(0.028, 0.028, 0.32, 6),
        -0.14,
        0.24,
        0.4,
        Math.PI / 2,
        0,
        -0.12,
        chromeMid
      ),
      bakePart(
        new THREE.CylinderGeometry(0.028, 0.028, 0.32, 6),
        0.14,
        0.24,
        0.4,
        Math.PI / 2,
        0,
        0.12,
        chromeMid
      ),
      // 6 Multi-jointed Arachnid Scuttle Legs (Upper Femur + Angled Lower Tibia)
      // Front Pair
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        -0.38,
        0.32,
        0.22,
        0,
        -0.45,
        0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        -0.54,
        0.16,
        0.32,
        0.2,
        0,
        0.35,
        chromeBright
      ),
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        0.38,
        0.32,
        0.22,
        0,
        0.45,
        -0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        0.54,
        0.16,
        0.32,
        0.2,
        0,
        -0.35,
        chromeBright
      ),
      // Mid Pair
      bakePart(new THREE.BoxGeometry(0.36, 0.055, 0.06), -0.44, 0.32, 0.0, 0, 0, 0.25, pistonSteel),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        -0.62,
        0.16,
        0.0,
        0,
        0,
        0.38,
        chromeBright
      ),
      bakePart(new THREE.BoxGeometry(0.36, 0.055, 0.06), 0.44, 0.32, 0.0, 0, 0, -0.25, pistonSteel),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        0.62,
        0.16,
        0.0,
        0,
        0,
        -0.38,
        chromeBright
      ),
      // Rear Pair
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        -0.38,
        0.32,
        -0.22,
        0,
        0.45,
        0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        -0.54,
        0.16,
        -0.32,
        -0.2,
        0,
        0.35,
        chromeBright
      ),
      bakePart(
        new THREE.BoxGeometry(0.32, 0.055, 0.06),
        0.38,
        0.32,
        -0.22,
        0,
        -0.45,
        -0.25,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.03, 0.015, 0.36, 6),
        0.54,
        0.16,
        -0.32,
        -0.2,
        0,
        -0.35,
        chromeBright
      )
    ];
    const crabGeo = mergeParts(crabParts);
    this.crabChassisInstancedMesh = new THREE.InstancedMesh(crabGeo, chassisMat, maxCount);
    this.crabChassisInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crabChassisInstancedMesh.frustumCulled = false;

    const crabOpticsGeo = mergeParts([
      bakePart(new THREE.BoxGeometry(0.22, 0.045, 0.06), 0, 0.32, 0.37, 0, 0, 0, 0xff0000),
      bakePart(new THREE.SphereGeometry(0.03, 8, 8), -0.07, 0.32, 0.38, 0, 0, 0, 0xff4444),
      bakePart(new THREE.SphereGeometry(0.03, 8, 8), 0.07, 0.32, 0.38, 0, 0, 0, 0xff4444)
    ]);
    this.crabOpticsInstancedMesh = new THREE.InstancedMesh(crabOpticsGeo, opticsMat, maxCount);
    this.crabOpticsInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crabOpticsInstancedMesh.frustumCulled = false;

    this.group.add(
      this.chassisInstancedMesh,
      this.leftLegInstancedMesh,
      this.rightLegInstancedMesh,
      this.opticsInstancedMesh,
      this.crabChassisInstancedMesh,
      this.crabOpticsInstancedMesh
    );
  }

  public updateBatch(enemies: ActiveEnemy[], timeSeconds: number, playerX = 0, playerZ = 0): void {
    let activeIndex = 0;
    let crabIndex = 0;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const facingAngle = Math.atan2(playerX - enemy.x, playerZ - enemy.z);

      if (enemy.archetype === 'skynet_crab_drone') {
        if (crabIndex >= this.maxCount) continue;
        const scuttleBob = Math.abs(Math.sin(timeSeconds * 18 + enemy.id)) * 0.045;
        const scuttleTilt = Math.sin(timeSeconds * 18 + enemy.id) * 0.09;

        const eliteScale = enemy.isElite ? (enemy.scale ?? 1.4) : 1.0;
        const crabY = scuttleBob;
        let crabTilt = scuttleTilt;
        let crabPitch = 0;
        let crabX = enemy.x;
        let crabZ = enemy.z;

        if (enemy.hitFlashTimer > 0) {
          const stagger = Math.min(1.0, enemy.hitFlashTimer / 0.15);
          crabPitch = -0.18 * stagger;
          crabTilt += (Math.sin(enemy.id * 10) > 0 ? 0.15 : -0.15) * stagger;
          crabX -= Math.sin(facingAngle) * 0.08 * stagger;
          crabZ -= Math.cos(facingAngle) * 0.08 * stagger;
        }

        this.dummy.position.set(crabX, crabY, crabZ);
        this.dummy.rotation.set(crabPitch, facingAngle, crabTilt);
        this.dummy.scale.set(eliteScale, eliteScale, eliteScale);
        this.dummy.updateMatrix();

        this.crabChassisInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);
        this.crabOpticsInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);

        if (enemy.hitFlashTimer > 0) {
          this.dummyColor.setHex(0xffffff);
        } else if (enemy.isElite && enemy.affix) {
          this.dummyColor.setHex(ELITE_AFFIXES[enemy.affix]?.tintColor ?? 0xffab00);
        } else {
          this.dummyColor.setHex(0x9fb2c4);
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

      // Scale variation for T-600 heavy vs T-700 runner
      let scale = 1.0;
      if (enemy.archetype === 't600_rusted') scale = 1.25;
      else if (enemy.archetype === 't700_scout') scale = 0.94;
      if (enemy.isElite) scale *= (enemy.scale ?? 1.4);

      // Animatronic mechanical gait & stride
      const phase = timeSeconds * 7.5 + enemy.id * 1.3;
      let bobY = Math.abs(Math.sin(phase)) * 0.06;
      let rollZ = Math.sin(phase) * 0.055;
      let legStride = Math.sin(phase) * 0.52;
      let pitchX = 0;
      let posX = enemy.x;
      let posZ = enemy.z;

      // Stagger backward on hit
      if (enemy.hitFlashTimer > 0) {
        const stagger = Math.min(1.0, enemy.hitFlashTimer / 0.15);
        pitchX = -0.22 * stagger;
        rollZ += ((enemy.id % 2 === 0 ? 1 : -1) * 0.12) * stagger;
        bobY -= 0.04 * stagger;
        legStride *= (1 - stagger * 0.5);
        posX -= Math.sin(facingAngle) * 0.12 * stagger;
        posZ -= Math.cos(facingAngle) * 0.12 * stagger;
      }

      this.dummy.position.set(posX, bobY, posZ);
      this.dummy.rotation.set(pitchX, facingAngle, rollZ);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();

      this.chassisInstancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);
      this.opticsInstancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);

      // Left Leg articulated matrix
      this.legDummy.position.set(posX, bobY + 0.68 * scale, posZ);
      this.legDummy.rotation.set(legStride + pitchX * 0.4, facingAngle, rollZ);
      this.legDummy.scale.set(scale, scale, scale);
      this.legDummy.updateMatrix();
      this.leftLegInstancedMesh.setMatrixAt(activeIndex, this.legDummy.matrix);

      // Right Leg articulated matrix
      this.legDummy.rotation.set(-legStride + pitchX * 0.4, facingAngle, rollZ);
      this.legDummy.updateMatrix();
      this.rightLegInstancedMesh.setMatrixAt(activeIndex, this.legDummy.matrix);

      // Color tint & hit flash
      if (enemy.hitFlashTimer > 0) {
        this.dummyColor.setHex(0xffffff);
      } else if (enemy.isElite && enemy.affix) {
        this.dummyColor.setHex(ELITE_AFFIXES[enemy.affix]?.tintColor ?? 0xffab00);
      } else if (enemy.archetype === 't600_rusted') {
        this.dummyColor.setHex(0xd2b08c); // Weathered bronze/iron T-600
      } else if (enemy.archetype === 't700_scout') {
        this.dummyColor.setHex(0xaeb4bb); // Gunmetal T-700
      } else {
        this.dummyColor.setHex(0xffffff); // Gleaming Hyperalloy Chrome T-800
      }
      this.chassisInstancedMesh.setColorAt(activeIndex, this.dummyColor);
      this.leftLegInstancedMesh.setColorAt(activeIndex, this.dummyColor);
      this.rightLegInstancedMesh.setColorAt(activeIndex, this.dummyColor);

      activeIndex++;
    }

    this.chassisInstancedMesh.count = activeIndex;
    this.leftLegInstancedMesh.count = activeIndex;
    this.rightLegInstancedMesh.count = activeIndex;
    this.opticsInstancedMesh.count = activeIndex;

    this.chassisInstancedMesh.instanceMatrix.needsUpdate = true;
    this.leftLegInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rightLegInstancedMesh.instanceMatrix.needsUpdate = true;
    this.opticsInstancedMesh.instanceMatrix.needsUpdate = true;

    if (this.chassisInstancedMesh.instanceColor) {
      this.chassisInstancedMesh.instanceColor.needsUpdate = true;
    }
    if (this.leftLegInstancedMesh.instanceColor) {
      this.leftLegInstancedMesh.instanceColor.needsUpdate = true;
    }
    if (this.rightLegInstancedMesh.instanceColor) {
      this.rightLegInstancedMesh.instanceColor.needsUpdate = true;
    }

    this.crabChassisInstancedMesh.count = crabIndex;
    this.crabOpticsInstancedMesh.count = crabIndex;
    this.crabChassisInstancedMesh.instanceMatrix.needsUpdate = true;
    this.crabOpticsInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.crabChassisInstancedMesh.instanceColor) {
      this.crabChassisInstancedMesh.instanceColor.needsUpdate = true;
    }
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
