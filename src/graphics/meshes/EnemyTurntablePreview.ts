import * as THREE from 'three';
import type { EnemyArchetypeId } from '../../core/types';
import { createPlaceholder } from './geometryUtils';
import { HKAerialMesh } from './HKAerialMesh';
import { HKTankMesh } from './HKTankMesh';
import { InfiltratorMesh } from './InfiltratorMesh';
import { SkynetCoreMesh } from './SkynetCoreMesh';
import { T1000Mesh } from './T1000Mesh';
import {
  T1MinigunMesh,
  MotoTerminatorMesh,
  PlasmaTurretMesh
} from './NewEnemyMeshes';
import { ModelLibrary } from '../ModelLibrary';
import { createEndoPreview } from '../EndoModel';

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
      inf.updateAnimation(0.016, 0, 0); // settle the rig into its rifle hold
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

    case 'plasma_turret': {
      const turret = new PlasmaTurretMesh();
      root.add(turret.group);
      root.scale.setScalar(0.9);
      root.position.set(0, -0.6, 0);
      break;
    }

    case 'skynet_crab_drone': {
      root.add(ModelLibrary.get('crab_drone') ?? createPlaceholder(0.9, 0.3, 0.8));
      root.position.set(0, -0.3, 0);
      root.scale.setScalar(1.6);
      break;
    }

    case 't600_rusted': {
      const t600 = ModelLibrary.getT600();
      root.add(t600 ? createEndoPreview(t600, 0xe0d4c4) : createPlaceholder(0.6, 1.9, 0.4));
      root.position.set(0, -0.9, 0);
      root.scale.setScalar(0.95);
      break;
    }

    case 't800_endoskeleton':
    default: {
      const endo = ModelLibrary.getEndo();
      root.add(endo ? createEndoPreview(endo) : createPlaceholder(0.55, 1.85, 0.35));
      root.position.set(0, -0.9, 0);
      root.scale.setScalar(0.95);
      break;
    }
  }

  return root;
}
