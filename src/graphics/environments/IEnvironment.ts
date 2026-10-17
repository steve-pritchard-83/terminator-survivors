import type * as THREE from 'three';

export interface IEnvironment {
  readonly group: THREE.Group;
  readonly obstacleColliders: Array<{ x: number; z: number; radius: number }>;
  update(px: number, pz: number): void;
  dispose(): void;
}
