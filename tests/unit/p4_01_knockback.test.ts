import { describe, it, expect, beforeEach } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { ENEMY_CONFIGS } from '../../src/data/enemies';
import { BASE_WEAPONS } from '../../src/data/weapons';

describe('P4-01 knockback and enemy mass mechanics', () => {
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;
  let playerMesh: KyleReeseMesh;
  let weaponSystem: WeaponSystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    // Ensure crit chance is 0 to test baseline knockback impulse deterministically
    runState.computedStats.critChance = 0;
    grid = new SpatialHashGrid(4.0);
    audio = new AudioEngine();
    particles = new ParticleSystem();
    endoBatch = new EndoskeletonBatch(32);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
    playerMesh = new KyleReeseMesh();
    weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
  });

  it('defines correct mass for light drones, medium endoskeletons, and heavy bosses', () => {
    expect(ENEMY_CONFIGS.skynet_crab_drone.mass).toBe(1.0);
    expect(ENEMY_CONFIGS.t800_endoskeleton.mass).toBe(6.0);
    expect(ENEMY_CONFIGS.infiltrator_csm101.mass).toBe(25.0);
    expect(ENEMY_CONFIGS.hk_tank_goliath.mass).toBe(100.0);
    expect(BASE_WEAPONS.ithaca_37.knockback).toBe(18);
  });

  it('calculates impulse = knockback / mass across 3 enemy weights', () => {
    const drone = enemySystem.spawnEnemy('skynet_crab_drone', 0, 5);
    const t800 = enemySystem.spawnEnemy('t800_endoskeleton', 0, 5);
    const boss = enemySystem.spawnEnemy('infiltrator_csm101', 0, 5);

    const shotgunKnockback = BASE_WEAPONS.ithaca_37.knockback;

    // Direct hit along +Z (hitDir: { x: 0, z: 1 })
    // Using weaponSystem's applyDamageToTarget through fireContext
    const ctx = (weaponSystem as any).fireContext;
    ctx.applyDamageToTarget(drone, 20, shotgunKnockback, { x: 0, z: 1 });
    ctx.applyDamageToTarget(t800, 20, shotgunKnockback, { x: 0, z: 1 });
    ctx.applyDamageToTarget(boss, 20, shotgunKnockback, { x: 0, z: 1 });

    // Crab drone (mass 1.0): impulse = 18 / 1.0 = 18
    expect(drone.vz).toBeCloseTo(18.0, 2);
    expect(drone.vx).toBeCloseTo(0, 2);

    // T-800 (mass 6.0): impulse = 18 / 6.0 = 3
    expect(t800.vz).toBeCloseTo(3.0, 2);
    expect(t800.vx).toBeCloseTo(0, 2);

    // Boss (mass 25.0): impulse = 18 / 25.0 = 0.72
    expect(boss.vz).toBeCloseTo(0.72, 2);
    expect(boss.vx).toBeCloseTo(0, 2);
  });

  it('exponentially decays velocity via Math.exp(-8 * dt) and yields expected displacement', () => {
    const drone = enemySystem.spawnEnemy('skynet_crab_drone', 0, 0);
    const t800 = enemySystem.spawnEnemy('t800_endoskeleton', 0, 0);
    const boss = enemySystem.spawnEnemy('infiltrator_csm101', 0, 0);

    // Freeze enemies in place so their normal AI movement speed does not add to displacement
    drone.speed = 0;
    t800.speed = 0;
    boss.speed = 0;

    // Apply shotgun knockback along +X direction
    const ctx = (weaponSystem as any).fireContext;
    ctx.applyDamageToTarget(drone, 10, 18, { x: 1, z: 0 });
    ctx.applyDamageToTarget(t800, 10, 18, { x: 1, z: 0 });
    ctx.applyDamageToTarget(boss, 10, 18, { x: 1, z: 0 });

    const startXDrone = drone.x;
    const startXT800 = t800.x;
    const startXBoss = boss.x;

    // Step physics for 1.0 second at 60 FPS (dt = 1/60s)
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      enemySystem.update(dt, i * dt);
    }

    // Velocity should be virtually 0 after 1s (decay = exp(-8) ~= 0.00033)
    expect(drone.vx!).toBeLessThan(0.01);
    expect(t800.vx!).toBeLessThan(0.01);
    expect(boss.vx!).toBeLessThan(0.01);

    // Displacement matches discrete integration:
    // Drone (mass 1.0, v0 = 18): ~2.40 units
    expect(drone.x - startXDrone).toBeGreaterThan(2.0);
    expect(drone.x - startXDrone).toBeLessThan(2.5);

    // T-800 (mass 6.0, v0 = 3): ~0.40 units
    expect(t800.x - startXT800).toBeGreaterThan(0.3);
    expect(t800.x - startXT800).toBeLessThan(0.5);

    // Boss (mass 25.0, v0 = 0.72): ~0.096 units
    expect(boss.x - startXBoss).toBeGreaterThan(0.07);
    expect(boss.x - startXBoss).toBeLessThan(0.12);

    // Ratio between drone and T-800 displacement matches mass ratio exactly: 6.0x
    const ratioDroneToT800 = (drone.x - startXDrone) / (t800.x - startXT800);
    expect(ratioDroneToT800).toBeCloseTo(6.0, 1);
  });

  it('shotgun blast knocks back enemies away from Kyle in real combat update', () => {
    runState.playerPos = { x: 0, z: 0 };
    runState.playerFacing = 0; // Facing +Z
    runState.autoAimEnabled = true;

    runState.weapons.clear();
    runState.weapons.set('ithaca_37', {
      id: 'ithaca_37',
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });

    // Enemy placed 4 units ahead (+Z), high HP so it survives the blast to demonstrate pushback
    const drone = enemySystem.spawnEnemy('skynet_crab_drone', 0, 4);
    drone.hp = 200;
    drone.maxHp = 200;
    drone.speed = 0; // isolate knockback from AI advance
    grid.insert(drone);

    // Initial update fires shotgun pellets
    weaponSystem.update(0.016, [drone], 0);

    // Advance projectiles until pellet reaches drone (speed 22 m/s, distance 4m -> ~0.2s)
    for (let step = 0; step < 20; step++) {
      grid.clear();
      grid.insert(drone);
      weaponSystem.update(0.016, [drone]);
      enemySystem.update(0.016, step * 0.016);
    }

    // Drone should have taken knockback and moved further in +Z direction
    expect(drone.z).toBeGreaterThan(4.5);
    expect(drone.hp).toBeLessThan(drone.maxHp);
  });
});
