import type * as THREE from 'three';

export interface EnvironmentalHazard {
  x: number;
  z: number;
  radius: number;
  damagePerSec: number;
  type: 'molten_steel' | 'laser_grid' | 'temporal_vortex';
}

export interface ConveyorZone {
  x: number;
  z: number;
  halfWidth: number;
  halfLength: number;
  vx: number;
  vz: number;
}

export interface IEnvironment {
  readonly group: THREE.Group;
  readonly obstacleColliders: Array<{ x: number; z: number; radius: number }>;
  update(px: number, pz: number, dt?: number): void;
  dispose(): void;
  getConveyorVelocity?(x: number, z: number): { vx: number; vz: number } | null;
  getHazardDamage?(x: number, z: number, dt: number, isPlayer: boolean): number;
  getBunkerHealth?(): { current: number; max: number } | null;
  damageBunker?(amount: number): void;
  bunkerTarget?: { x: number; z: number; radius: number } | null;
}
