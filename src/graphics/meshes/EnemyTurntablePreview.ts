import * as THREE from 'three';
import type { EnemyArchetypeId } from '../../core/types';
import { bakePart, mergeParts } from './geometryUtils';
import { HKAerialMesh } from './HKAerialMesh';
import { HKTankMesh } from './HKTankMesh';
import { InfiltratorMesh } from './InfiltratorMesh';
import { SkynetCoreMesh } from './SkynetCoreMesh';
import { T1000Mesh } from './T1000Mesh';
import {
  T1MinigunMesh,
  MotoTerminatorMesh,
  HydrobotMesh,
  AerostatMesh,
  PlasmaTurretMesh,
  T600MinigunnerMesh
} from './NewEnemyMeshes';

export function createEnemyPreviewObject(archetype: EnemyArchetypeId): THREE.Object3D {
  const root = new THREE.Group();

  switch (archetype) {
    case 'hk_aerial_patrol':
      root.add(new HKAerialMesh().group);
      root.position.set(0, 0.5, 0);
      root.scale.setScalar(0.7);
      break;

    case 'hk_aerial_squadron_leader': {
      const leader = new HKAerialMesh();
      leader.group.scale.set(1.15, 1.15, 1.15);
      // Add command antennae
      const antGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
      const antMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
      const ant = new THREE.Mesh(antGeom, antMat);
      ant.position.set(0, 1.4, -0.6);
      leader.group.add(ant);
      root.add(leader.group);
      root.position.set(0, 0.5, 0);
      root.scale.setScalar(0.65);
      break;
    }

    case 'hk_tank_goliath': {
      const tank = new HKTankMesh();
      root.add(tank.group);
      root.scale.setScalar(0.55);
      root.position.set(0, -0.5, 0);
      break;
    }

    case 'infiltrator_csm101': {
      const inf = new InfiltratorMesh();
      root.add(inf.group);
      root.scale.setScalar(1.0);
      root.position.set(0, -0.9, 0);
      break;
    }

    case 't1000_prototype': {
      const t1000 = new T1000Mesh();
      root.add(t1000.group);
      root.scale.setScalar(1.0);
      root.position.set(0, -0.9, 0);
      break;
    }

    case 'skynet_tde_core': {
      const core = new SkynetCoreMesh();
      root.add(core.group);
      root.scale.setScalar(0.45);
      root.position.set(0, -0.6, 0);
      break;
    }

    case 't1_minigun_tracked': {
      const t1 = new T1MinigunMesh();
      root.add(t1.group);
      root.scale.setScalar(0.95);
      root.position.set(0, -0.5, 0);
      break;
    }

    case 'moto_terminator': {
      const moto = new MotoTerminatorMesh();
      root.add(moto.group);
      root.scale.setScalar(1.1);
      root.position.set(0, -0.5, 0);
      break;
    }

    case 'hydrobot_swarm': {
      const hydro = new HydrobotMesh();
      root.add(hydro.group);
      root.scale.setScalar(1.2);
      root.position.set(0, -0.3, 0);
      break;
    }

    case 'aerostat_scout': {
      const aero = new AerostatMesh();
      root.add(aero.group);
      root.scale.setScalar(1.4);
      root.position.set(0, 0.2, 0);
      break;
    }

    case 'plasma_turret': {
      const turret = new PlasmaTurretMesh();
      root.add(turret.group);
      root.scale.setScalar(0.9);
      root.position.set(0, -0.6, 0);
      break;
    }

    case 't600_minigunner': {
      const t600mg = new T600MinigunnerMesh();
      root.add(t600mg.group);
      root.scale.setScalar(0.9);
      root.position.set(0, -0.9, 0);
      break;
    }

    case 'skynet_crab_drone': {
      const shellSteel = 0x3a424e;
      const legMat = 0x242830;
      const eyeRed = 0xff0033;
      const parts: THREE.BufferGeometry[] = [
        bakePart(new THREE.CylinderGeometry(0.45, 0.55, 0.24, 8), 0, 0.35, 0, 0, 0, 0, shellSteel),
        bakePart(new THREE.BoxGeometry(0.35, 0.16, 0.4), 0, 0.38, 0.3, 0, 0, 0, shellSteel),
        bakePart(new THREE.SphereGeometry(0.1, 8, 8), 0, 0.38, 0.5, 0, 0, 0, eyeRed),
        // 4 Legs
        bakePart(new THREE.BoxGeometry(0.08, 0.4, 0.08), -0.5, 0.2, 0.35, 0.3, 0, -0.4, legMat),
        bakePart(new THREE.BoxGeometry(0.08, 0.4, 0.08), 0.5, 0.2, 0.35, 0.3, 0, 0.4, legMat),
        bakePart(new THREE.BoxGeometry(0.08, 0.4, 0.08), -0.5, 0.2, -0.35, -0.3, 0, -0.4, legMat),
        bakePart(new THREE.BoxGeometry(0.08, 0.4, 0.08), 0.5, 0.2, -0.35, -0.3, 0, 0.4, legMat)
      ];
      const geom = mergeParts(parts);
      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.3 }));
      root.add(mesh);
      root.position.set(0, -0.3, 0);
      root.scale.setScalar(1.2);
      break;
    }

    case 't600_rusted': {
      const rustSteel = 0x5a483a;
      const rubberSkin = 0x3d3530;
      const opticRed = 0xff2200;
      const parts: THREE.BufferGeometry[] = [
        bakePart(new THREE.BoxGeometry(0.7, 0.75, 0.42), 0, 1.25, 0, 0, 0, 0, rubberSkin),
        bakePart(new THREE.BoxGeometry(0.42, 0.45, 0.36), 0, 1.82, 0, 0, 0, 0, rubberSkin),
        bakePart(new THREE.SphereGeometry(0.05, 6, 6), -0.1, 1.84, 0.19, 0, 0, 0, opticRed),
        bakePart(new THREE.SphereGeometry(0.05, 6, 6), 0.1, 1.84, 0.19, 0, 0, 0, opticRed),
        bakePart(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 8), -0.52, 1.15, 0, 0, 0, 0.1, rustSteel),
        bakePart(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 8), 0.52, 1.15, 0, 0, 0, -0.1, rustSteel),
        bakePart(new THREE.CylinderGeometry(0.14, 0.12, 0.85, 8), -0.22, 0.45, 0, 0, 0, 0, rustSteel),
        bakePart(new THREE.CylinderGeometry(0.14, 0.12, 0.85, 8), 0.22, 0.45, 0, 0, 0, 0, rustSteel)
      ];
      const geom = mergeParts(parts);
      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.7 }));
      root.add(mesh);
      root.position.set(0, -0.9, 0);
      root.scale.setScalar(0.9);
      break;
    }

    case 't700_scout': {
      const gunmetal = 0x36404d;
      const chromeDark = 0x556270;
      const opticRed = 0xff0044;
      const parts: THREE.BufferGeometry[] = [
        bakePart(new THREE.BoxGeometry(0.56, 0.7, 0.34), 0, 1.25, 0, 0, 0, 0, gunmetal),
        bakePart(new THREE.SphereGeometry(0.18, 10, 8), 0, 1.76, 0, 0, 0, 0, chromeDark),
        bakePart(new THREE.SphereGeometry(0.045, 6, 6), -0.08, 1.76, 0.16, 0, 0, 0, opticRed),
        bakePart(new THREE.SphereGeometry(0.045, 6, 6), 0.08, 1.76, 0.16, 0, 0, 0, opticRed),
        bakePart(new THREE.CylinderGeometry(0.09, 0.08, 0.75, 8), -0.42, 1.15, 0, 0, 0, 0.15, chromeDark),
        bakePart(new THREE.CylinderGeometry(0.09, 0.08, 0.75, 8), 0.42, 1.15, 0, 0, 0, -0.15, chromeDark),
        bakePart(new THREE.CylinderGeometry(0.11, 0.09, 0.85, 8), -0.18, 0.45, 0, 0, 0, 0, chromeDark),
        bakePart(new THREE.CylinderGeometry(0.11, 0.09, 0.85, 8), 0.18, 0.45, 0, 0, 0, 0, chromeDark)
      ];
      const geom = mergeParts(parts);
      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.25 }));
      root.add(mesh);
      root.position.set(0, -0.9, 0);
      root.scale.setScalar(0.95);
      break;
    }

    case 't800_endoskeleton':
    default: {
      const chromeBright = 0xc5d3e0;
      const chromeMid = 0x8a99a8;
      const darkSocket = 0x10141a;
      const opticRed = 0xff002b;
      const parts: THREE.BufferGeometry[] = [
        bakePart(new THREE.SphereGeometry(0.185, 12, 10), 0, 1.75, 0, 0, 0, 0, chromeBright),
        bakePart(new THREE.BoxGeometry(0.24, 0.07, 0.1), 0, 1.72, 0.14, 0, 0, 0, darkSocket),
        bakePart(new THREE.SphereGeometry(0.042, 6, 6), -0.07, 1.72, 0.17, 0, 0, 0, opticRed),
        bakePart(new THREE.SphereGeometry(0.042, 6, 6), 0.07, 1.72, 0.17, 0, 0, 0, opticRed),
        bakePart(new THREE.BoxGeometry(0.55, 0.65, 0.32), 0, 1.25, 0, 0, 0, 0, chromeBright),
        bakePart(new THREE.CylinderGeometry(0.09, 0.08, 0.75, 8), -0.42, 1.15, 0, 0, 0, 0.1, chromeMid),
        bakePart(new THREE.CylinderGeometry(0.09, 0.08, 0.75, 8), 0.42, 1.15, 0, 0, 0, -0.1, chromeMid),
        bakePart(new THREE.CylinderGeometry(0.12, 0.1, 0.85, 8), -0.18, 0.45, 0, 0, 0, 0, chromeMid),
        bakePart(new THREE.CylinderGeometry(0.12, 0.1, 0.85, 8), 0.18, 0.45, 0, 0, 0, 0, chromeMid)
      ];
      const geom = mergeParts(parts);
      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.95, roughness: 0.18 }));
      root.add(mesh);
      root.position.set(0, -0.9, 0);
      root.scale.setScalar(0.95);
      break;
    }
  }

  return root;
}
