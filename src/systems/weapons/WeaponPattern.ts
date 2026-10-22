import type * as THREE from 'three';
import type {
  ActiveEnemy,
  SpatialEntity,
  WeaponDefinition,
  WeaponId,
  WeaponLevelStats
} from '../../core/types';
import type { RunState } from '../../state/RunState';
import type { AudioEngine } from '../../audio/AudioEngine';
import type { ParticleSystem } from '../ParticleSystem';
import type { KyleReeseMesh } from '../../graphics/meshes/KyleReeseMesh';
import type { SpatialHashGrid } from '../../core/SpatialHashGrid';
import type { globalRNG } from '../../core/RNG';
import type { GameEventMap } from '../../core/EventBus';

export type ProjectileMeshCategory = 'pellet' | 'plasma' | 'heavy_plasma' | 'bomb';

export interface SpawnProjectileParams {
  weaponId: string;
  meshCategory: ProjectileMeshCategory;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  pitchX?: number;
  damage: number;
  radius: number;
  pierceLeft: number;
  life: number;
  maxLife: number;
  isAreaOnExpire?: boolean;
  areaRadius?: number;
  knockback?: number;
}

export interface WeaponFireContext {
  runState: RunState;
  audio: AudioEngine;
  particles: ParticleSystem;
  playerMesh: KyleReeseMesh;
  grid: SpatialHashGrid;
  group: THREE.Group;
  spawnProjectile: (params: SpawnProjectileParams) => void;
  spawnEmpShockwave: (x: number, z: number, maxRadius: number, isSupernova?: boolean) => void;
  spawnGroundZone: (
    x: number,
    z: number,
    radius: number,
    damagePerSec: number,
    duration: number,
    knockback?: number,
    weaponId?: WeaponId
  ) => void;
  spawnOrbitalIonBeam: (x: number, z: number, radius: number) => void;
  applyDamageToTarget: (
    target: SpatialEntity,
    damage: number,
    knockback?: number,
    hitDir?: { x: number; z: number },
    weaponId?: WeaponId
  ) => boolean;
  emit: <K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]) => void;
  /** True when a point is on screen (always true when no camera is attached, as in unit tests) */
  isVisible: (x: number, z: number, margin?: number) => boolean;
  /** Average ground distance from the player to the screen edges, in metres */
  reachRadius: () => number;
  /** Ground distance from the player to the screen edge in a direction (radians, 0 = +z), in metres */
  reachAlong: (angle: number) => number;
  rng: typeof globalRNG;
  scratch: {
    empHit: SpatialEntity[];
    orbitalHit: SpatialEntity[];
    orbitalTargets: SpatialEntity[];
    droneHit: SpatialEntity[];
  };
}

export interface WeaponPattern {
  fire(
    def: WeaponDefinition,
    stats: WeaponLevelStats,
    px: number,
    pz: number,
    targetAngle: number,
    ctx: WeaponFireContext
  ): void;
  update?(
    dt: number,
    px: number,
    pz: number,
    enemies: ActiveEnemy[],
    ctx: WeaponFireContext
  ): void;
  clear?(group: THREE.Group): void;
}
