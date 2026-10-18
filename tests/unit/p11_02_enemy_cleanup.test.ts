import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';

describe('P11-02 Boss & special-enemy mesh cleanup', () => {
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    grid = new SpatialHashGrid(4.0);
    audio = new AudioEngine();
    particles = new ParticleSystem();
    endoBatch = new EndoskeletonBatch(100);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  });

  it('removes all boss and special enemy meshes and telegraphs on clear', () => {
    // Initial state: only instanced projectile pool is in group
    expect(enemySystem.group.children.length).toBe(1);

    // Spawn special enemies and bosses
    enemySystem.spawnEnemy('hk_aerial_squadron_leader', 10, 10);
    enemySystem.spawnEnemy('hk_tank_goliath', -10, 10);
    enemySystem.spawnEnemy('t1000_prototype', 5, -5);
    enemySystem.spawnEnemy('infiltrator_csm101', -5, -5);
    enemySystem.spawnEnemy('t1_minigun_tracked', 0, 15);
    enemySystem.spawnEnemy('moto_terminator', 15, 0);

    // Update to create meshes and telegraphs
    enemySystem.update(0.1, 1.0);

    // Group should contain multiple meshes and telegraph groups
    expect(enemySystem.group.children.length).toBeGreaterThan(5);
    expect(enemySystem.activeEnemies.length).toBe(6);

    // Invoke clear
    enemySystem.clear();

    // Verification: active enemies list is empty and only pool mesh remains
    expect(enemySystem.activeEnemies.length).toBe(0);
    expect(enemySystem.group.children.length).toBe(1);
  });

  it('removes stray objects and ensures no ghost objects remain in group', () => {
    const strayMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    enemySystem.group.add(strayMesh);
    expect(enemySystem.group.children.length).toBe(2);

    enemySystem.clear();

    expect(strayMesh.parent).toBeNull();
    expect(enemySystem.group.children.length).toBe(1);
  });
});
