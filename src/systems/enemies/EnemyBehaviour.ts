import * as THREE from 'three';
import type { ActiveEnemy, EnemyArchetypeId } from '../../core/types';
import type { RunState } from '../../state/RunState';
import type { AudioEngine } from '../../audio/AudioEngine';
import type { ParticleSystem } from '../ParticleSystem';
import type { globalRNG } from '../../core/RNG';
import type { GameEventMap } from '../../core/EventBus';

export interface EnemyContext {
  runState: RunState;
  audio: AudioEngine;
  particles: ParticleSystem;
  spawnEnemyProjectile: (
    x: number,
    y: number,
    z: number,
    targetX: number,
    targetZ: number,
    speed?: number,
    damage?: number
  ) => void;
  spawnEnemy?: (archetype: EnemyArchetypeId, x: number, z: number) => void;
  applyPlayerDamage: (rawDamage: number) => void;
  emit: <K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]) => void;
  rng: typeof globalRNG;
  activeEnemies?: ActiveEnemy[];
  /** Schedules a telegraphed ground blast that damages the player if they are still inside when it lands. */
  scheduleBlast?: (x: number, z: number, radius: number, damage: number, delaySeconds: number) => void;
  group: THREE.Group;
  timeSeconds: number;
}

export interface EnemyBehaviour {
  createVisual?(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null;
  update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void;
  onDeath?(enemy: ActiveEnemy, ctx: EnemyContext): void;
  dispose?(enemy: ActiveEnemy, ctx: EnemyContext): void;
  onRelocate?(enemy: ActiveEnemy, ctx: EnemyContext): void;
  clear?(): void;
}
