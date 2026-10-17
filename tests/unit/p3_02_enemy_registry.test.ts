import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { createEnemyBehaviourRegistry } from '../../src/systems/enemies';

describe('P3-02 enemy behaviour registry', () => {
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

  it('EnemySystem.ts meets acceptance criteria: < 250 lines and zero archetype === comparisons', () => {
    const filePath = path.resolve(__dirname, '../../src/systems/EnemySystem.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    expect(lines.length).toBeLessThan(250);
    expect(content.includes('archetype ===')).toBe(false);
  });

  it('creates registry with all special archetypes populated', () => {
    const registry = createEnemyBehaviourRegistry();
    expect(registry['t800_endoskeleton']).toBeDefined();
    expect(registry['hk_aerial_patrol']).toBeDefined();
    expect(registry['hk_aerial_squadron_leader']).toBeDefined();
    expect(registry['hk_tank_goliath']).toBeDefined();
    expect(registry['t1000_prototype']).toBeDefined();
    expect(registry['infiltrator_csm101']).toBeDefined();
    expect(registry['skynet_tde_core']).toBeDefined();
  });

  it('spawns T800 and fires plasma projectile when in range [7, 17]', () => {
    runState.playerPos = { x: 0, z: 0 };
    const t800 = enemySystem.spawnEnemy('t800_endoskeleton', 10, 0);
    t800.state!.phaseCooldown = 0;

    expect(enemySystem.enemyProjectiles.length).toBe(0);
    enemySystem.update(0.016, 1.0);
    expect(enemySystem.enemyProjectiles.length).toBe(1);
  });

  it('spawns HK Aerial, updates searchlight detection, and alerts/damages player', () => {
    runState.playerPos = { x: 0, z: 8.5 };
    const hk = enemySystem.spawnEnemy('hk_aerial_patrol', 0, 0);
    hk.speed = 0;

    const initialHp = runState.hp;
    // Update multiple seconds to trigger searchlight alert
    for (let i = 0; i < 80; i++) {
      enemySystem.update(0.02, 1.0 + i * 0.02);
    }

    expect(runState.hp).toBeLessThan(initialHp);
    expect(hk.state!.searchlightAlert).toBeDefined();
  });

  it('spawns HK Tank, tracks target, triggers artillery explosion and cleans up reticle on death', () => {
    runState.playerPos = { x: 0, z: 0 };
    const tank = enemySystem.spawnEnemy('hk_tank_goliath', 12, 0);

    // Initial reticle creation during update
    enemySystem.update(0.05, 1.0);
    expect(tank.state!.chargeTimer).toBeGreaterThan(0);

    // Fast forward charge timer to trigger artillery blast
    tank.state!.chargeTimer = 3.0;
    enemySystem.update(0.05, 4.0);
    expect(tank.state!.chargeTimer).toBe(0);

    // Tank death cleans up
    tank.hp = 0;
    enemySystem.update(0.016, 4.1);
    expect(enemySystem.activeEnemies.length).toBe(0);
  });

  it('spawns Infiltrator and fires 3-round burst attack', () => {
    runState.playerPos = { x: 0, z: 12 };
    const infiltrator = enemySystem.spawnEnemy('infiltrator_csm101', 0, 0);
    infiltrator.speed = 0;
    infiltrator.state!.burstCooldown = 0;

    // Trigger burst mode
    enemySystem.update(0.016, 1.0);
    expect(infiltrator.state!.burstShotsLeft).toBe(3);

    // Shot 1
    enemySystem.update(0.016, 1.016);
    expect(infiltrator.state!.burstShotsLeft).toBe(2);
    expect(enemySystem.enemyProjectiles.length).toBe(1);

    // Shot 2
    enemySystem.update(0.16, 1.18);
    expect(infiltrator.state!.burstShotsLeft).toBe(1);
    expect(enemySystem.enemyProjectiles.length).toBe(2);

    // Shot 3
    enemySystem.update(0.16, 1.35);
    expect(infiltrator.state!.burstShotsLeft).toBe(0);
    expect(enemySystem.enemyProjectiles.length).toBe(3);
  });

  it('spawns Skynet Core and unleashes 10-bolt Temporal Nova when enraged (<50% HP)', () => {
    runState.playerPos = { x: 0, z: 0 };
    const core = enemySystem.spawnEnemy('skynet_tde_core', 15, 0);
    core.hp = core.maxHp * 0.4; // Enraged
    core.state!.novaCooldown = 0;

    enemySystem.update(0.016, 1.0);
    expect(enemySystem.enemyProjectiles.length).toBe(10);
  });

  it('calling clear() cleanly empties all enemies, projectiles, and behaviour meshes', () => {
    enemySystem.spawnEnemy('hk_aerial_patrol', 5, 5);
    enemySystem.spawnEnemy('hk_tank_goliath', 10, 10);
    enemySystem.spawnEnemy('t1000_prototype', 3, 3);
    enemySystem.spawnEnemy('infiltrator_csm101', 7, 7);
    enemySystem.spawnEnemy('skynet_tde_core', 12, 12);

    expect(enemySystem.activeEnemies.length).toBe(5);
    enemySystem.clear();
    expect(enemySystem.activeEnemies.length).toBe(0);
    expect(enemySystem.enemyProjectiles.length).toBe(0);
  });
});
