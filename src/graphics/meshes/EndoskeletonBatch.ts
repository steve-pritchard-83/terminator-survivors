import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import { bakePart, mergeParts } from './geometryUtils';
import type { ActiveEnemy } from '../../core/types';
import { ProceduralTextures } from '../ProceduralTextures';

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

    const chromeBright = 0xb8c6d4;
    const chromeMid = 0x8e9eae;
    const darkSocket = 0x10161e;
    const pistonSteel = 0x5c6c7c;
    const gunmetal = 0x2a3340;
    const teethIvory = 0xbec8d2;

    // 1. Build detailed T-800 Upper Body, Skull, Ribcage, Pelvis & M-25 Rifle
    const chassisParts: THREE.BufferGeometry[] = [
      // Sculpted cranium dome & occipital rear plate
      bakePart(new THREE.SphereGeometry(0.185, 14, 12), 0, 1.75, -0.01, 0, 0, 0, chromeBright),
      bakePart(
        new THREE.CylinderGeometry(0.15, 0.12, 0.16, 10),
        0,
        1.66,
        -0.02,
        0,
        0,
        0,
        chromeMid
      ),
      // Heavy supraorbital brow ridge
      bakePart(new THREE.BoxGeometry(0.31, 0.065, 0.18), 0, 1.75, 0.09, 0.08, 0, 0, chromeBright),
      // Recessed dark orbital eye socket cavity (prevents glowing eyes from washing out face)
      bakePart(new THREE.BoxGeometry(0.26, 0.075, 0.12), 0, 1.69, 0.1, 0, 0, 0, darkSocket),
      // Zygomatic cheekbones L/R
      bakePart(
        new THREE.BoxGeometry(0.06, 0.08, 0.16),
        -0.135,
        1.65,
        0.08,
        0,
        0.15,
        0,
        chromeBright
      ),
      bakePart(
        new THREE.BoxGeometry(0.06, 0.08, 0.16),
        0.135,
        1.65,
        0.08,
        0,
        -0.15,
        0,
        chromeBright
      ),
      // Dark triangular nasal aperture
      bakePart(new THREE.BoxGeometry(0.055, 0.065, 0.08), 0, 1.64, 0.155, 0, 0, 0, darkSocket),
      // Upper maxilla & metallic teeth grille
      bakePart(new THREE.BoxGeometry(0.18, 0.065, 0.16), 0, 1.59, 0.09, 0, 0, 0, chromeMid),
      bakePart(new THREE.BoxGeometry(0.15, 0.04, 0.14), 0, 1.545, 0.11, 0, 0, 0, teethIvory),
      // Articulated lower mandible jawbone
      bakePart(new THREE.BoxGeometry(0.19, 0.065, 0.18), 0, 1.495, 0.07, 0.08, 0, 0, chromeBright),
      // Cheek hydraulic pistons L/R
      bakePart(
        new THREE.CylinderGeometry(0.022, 0.022, 0.19, 8),
        -0.13,
        1.58,
        0.03,
        0.15,
        0,
        0.18,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.022, 0.022, 0.19, 8),
        0.13,
        1.58,
        0.03,
        0.15,
        0,
        -0.18,
        pistonSteel
      ),

      // Cervical spine & dual neck hydraulic dampers
      bakePart(
        new THREE.CylinderGeometry(0.065, 0.075, 0.18, 10),
        0,
        1.43,
        -0.02,
        0,
        0,
        0,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6),
        -0.07,
        1.43,
        0.02,
        0,
        0,
        -0.15,
        chromeBright
      ),
      bakePart(
        new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6),
        0.07,
        1.43,
        0.02,
        0,
        0,
        0.15,
        chromeBright
      ),

      // Broad armored trapezius & clavicle yoke (strong top-down silhouette)
      bakePart(new THREE.BoxGeometry(0.7, 0.1, 0.28), 0, 1.35, -0.01, 0, 0, 0, chromeBright),
      // Shoulder ball-joint rotary actuators L/R
      bakePart(new THREE.SphereGeometry(0.11, 10, 8), -0.37, 1.34, 0, 0, 0, 0, chromeMid),
      bakePart(new THREE.SphereGeometry(0.11, 10, 8), 0.37, 1.34, 0, 0, 0, 0, chromeMid),

      // Dark inner hydraulic chest core + breastplate sternum + 3 segmented rib arches
      bakePart(
        new THREE.CylinderGeometry(0.19, 0.14, 0.44, 10),
        0,
        1.13,
        -0.01,
        0,
        0,
        0,
        darkSocket
      ),
      bakePart(new THREE.BoxGeometry(0.14, 0.36, 0.24), 0, 1.15, 0.03, 0, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.5, 0.065, 0.26), 0, 1.26, 0.01, 0, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.46, 0.06, 0.24), 0, 1.15, 0.01, 0, 0, 0, chromeMid),
      bakePart(new THREE.BoxGeometry(0.4, 0.055, 0.21), 0, 1.04, 0.0, 0, 0, 0, chromeBright),

      // Lumbar spinal vertebrae column & twin abdominal hydraulic struts
      bakePart(
        new THREE.CylinderGeometry(0.06, 0.065, 0.34, 8),
        0,
        0.88,
        -0.04,
        0,
        0,
        0,
        chromeMid
      ),
      bakePart(
        new THREE.CylinderGeometry(0.024, 0.024, 0.3, 6),
        -0.11,
        0.88,
        0.03,
        0,
        0,
        0.12,
        pistonSteel
      ),
      bakePart(
        new THREE.CylinderGeometry(0.024, 0.024, 0.3, 6),
        0.11,
        0.88,
        0.03,
        0,
        0,
        -0.12,
        pistonSteel
      ),

      // Heavy pelvic H-Chassis & hip sockets
      bakePart(new THREE.BoxGeometry(0.46, 0.15, 0.25), 0, 0.72, 0, 0, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.14, 0.2, 0.27), 0, 0.7, 0, 0, 0, 0, pistonSteel),

      // Left & Right Upper Humerus Struts & Elbow Servos
      bakePart(
        new THREE.CylinderGeometry(0.055, 0.048, 0.34, 8),
        -0.37,
        1.16,
        0.04,
        0.35,
        0,
        0.08,
        chromeBright
      ),
      bakePart(
        new THREE.CylinderGeometry(0.055, 0.048, 0.34, 8),
        0.37,
        1.16,
        0.04,
        0.35,
        0,
        -0.08,
        chromeBright
      ),
      bakePart(new THREE.SphereGeometry(0.065, 8, 8), -0.35, 1.0, 0.12, 0, 0, 0, pistonSteel),
      bakePart(new THREE.SphereGeometry(0.065, 8, 8), 0.35, 1.0, 0.12, 0, 0, 0, pistonSteel),

      // Left support forearm reaching across to rifle handguard
      bakePart(
        new THREE.CylinderGeometry(0.045, 0.04, 0.36, 8),
        -0.16,
        0.98,
        0.26,
        1.25,
        0.55,
        0,
        chromeMid
      ),
      // Right trigger forearm
      bakePart(
        new THREE.CylinderGeometry(0.045, 0.04, 0.34, 8),
        0.28,
        0.98,
        0.25,
        1.35,
        -0.2,
        0,
        chromeMid
      ),

      // Westinghouse M-25 40W Phased Plasma Rifle (receiver, cooling shroud, barrel, stock, magazine)
      bakePart(new THREE.BoxGeometry(0.09, 0.13, 0.56), 0.18, 1.0, 0.38, 0, -0.08, 0, gunmetal),
      bakePart(
        new THREE.CylinderGeometry(0.032, 0.032, 0.38, 8),
        0.16,
        1.02,
        0.72,
        Math.PI / 2,
        0,
        0.08,
        chromeMid
      ),
      bakePart(new THREE.BoxGeometry(0.06, 0.14, 0.09), 0.18, 0.89, 0.42, 0.2, -0.08, 0, darkSocket)
    ];

    const chassisGeo = mergeParts(chassisParts);

    // 2. Build Articulated Leg Geometry (origin at hip y = 0.68 so rotation.x swings the leg naturally)
    const buildLegGeo = (sideOffset: number): THREE.BufferGeometry => {
      return mergeParts([
        // Upper femur main strut + parallel hydraulic piston
        bakePart(
          new THREE.CylinderGeometry(0.065, 0.055, 0.34, 8),
          sideOffset,
          -0.16,
          0,
          0,
          0,
          0,
          chromeBright
        ),
        bakePart(
          new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6),
          sideOffset,
          -0.16,
          -0.055,
          0,
          0,
          0,
          pistonSteel
        ),
        // Knee actuator joint drum
        bakePart(
          new THREE.SphereGeometry(0.068, 8, 8),
          sideOffset,
          -0.34,
          0.01,
          0,
          0,
          0,
          chromeMid
        ),
        // Lower tibia shin strut
        bakePart(
          new THREE.CylinderGeometry(0.052, 0.042, 0.32, 8),
          sideOffset,
          -0.5,
          0,
          0,
          0,
          0,
          chromeBright
        ),
        // Skeletal mechanical foot & heel spur
        bakePart(
          new THREE.BoxGeometry(0.11, 0.06, 0.24),
          sideOffset,
          -0.65,
          0.04,
          0,
          0,
          0,
          pistonSteel
        )
      ]);
    };

    const leftLegGeo = buildLegGeo(-0.15);
    const rightLegGeo = buildLegGeo(0.15);

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x0a1018,
      emissiveIntensity: 0.12,
      metalness: 0.48,
      roughness: 0.48,
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

    // 3. Build glowing pinpoint crimson optics & rifle plasma coil
    const opticsParts: THREE.BufferGeometry[] = [
      // Left & Right pinpoint crimson optical sensors inside the dark eye sockets
      bakePart(new THREE.SphereGeometry(0.026, 8, 8), -0.068, 1.69, 0.165, 0, 0, 0, 0xff2222),
      bakePart(new THREE.SphereGeometry(0.026, 8, 8), 0.068, 1.69, 0.165, 0, 0, 0, 0xff2222),
      // M-25 rifle glowing plasma chamber strip
      bakePart(new THREE.BoxGeometry(0.098, 0.04, 0.22), 0.18, 1.03, 0.44, 0, -0.08, 0, 0xd400ff)
    ];
    const opticsGeo = mergeParts(opticsParts);

    const opticsMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0xff1111,
      emissiveIntensity: 2.8,
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
      bakePart(new THREE.BoxGeometry(0.22, 0.045, 0.06), 0, 0.32, 0.37, 0, 0, 0, 0xff2222),
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

        this.dummy.position.set(enemy.x, scuttleBob, enemy.z);
        this.dummy.rotation.set(0, facingAngle, scuttleTilt);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();

        this.crabChassisInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);
        this.crabOpticsInstancedMesh.setMatrixAt(crabIndex, this.dummy.matrix);

        if (enemy.hitFlashTimer > 0) {
          this.dummyColor.setHex(0xffffff);
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

      // Animatronic mechanical gait & stride
      const phase = timeSeconds * 7.5 + enemy.id * 1.3;
      const bobY = Math.abs(Math.sin(phase)) * 0.06;
      const rollZ = Math.sin(phase) * 0.055;
      const legStride = Math.sin(phase) * 0.52;

      this.dummy.position.set(enemy.x, bobY, enemy.z);
      this.dummy.rotation.set(0, facingAngle, rollZ);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();

      this.chassisInstancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);
      this.opticsInstancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);

      // Left Leg articulated matrix
      this.legDummy.position.set(enemy.x, bobY + 0.68 * scale, enemy.z);
      this.legDummy.rotation.set(legStride, facingAngle, rollZ);
      this.legDummy.scale.set(scale, scale, scale);
      this.legDummy.updateMatrix();
      this.leftLegInstancedMesh.setMatrixAt(activeIndex, this.legDummy.matrix);

      // Right Leg articulated matrix
      this.legDummy.rotation.set(-legStride, facingAngle, rollZ);
      this.legDummy.updateMatrix();
      this.rightLegInstancedMesh.setMatrixAt(activeIndex, this.legDummy.matrix);

      // Color tint & hit flash
      if (enemy.hitFlashTimer > 0) {
        this.dummyColor.setHex(0xffffff);
      } else if (enemy.archetype === 't600_rusted') {
        this.dummyColor.setHex(0x8c7662); // Weathered bronze/iron T-600
      } else if (enemy.archetype === 't700_scout') {
        this.dummyColor.setHex(0x8899ad); // Gunmetal T-700
      } else {
        this.dummyColor.setHex(0xd0e0f0); // Gleaming Hyperalloy Chrome T-800
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
