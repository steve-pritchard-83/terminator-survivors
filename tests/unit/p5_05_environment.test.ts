import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InteractiveEnvironmentSystem } from '../../src/systems/InteractiveEnvironmentSystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { EnemySystem, type EnemyProjectile } from '../../src/systems/EnemySystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { globalEvents } from '../../src/core/EventBus';
import type { ActiveEnemy } from '../../src/core/types';

describe('P5-05 Environmental interactables', () => {
  let runState: RunState;
  let grid: SpatialHashGrid;
  let scene: THREE.Scene;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let pickupSystem: PickupSystem;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;
  let interactiveEnv: InteractiveEnvironmentSystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    grid = new SpatialHashGrid(4.0);
    scene = new THREE.Scene();
    audio = new AudioEngine();
    particles = new ParticleSystem();
    pickupSystem = new PickupSystem(runState, audio, particles);
    endoBatch = new EndoskeletonBatch(50);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
    interactiveEnv = new InteractiveEnvironmentSystem(
      runState,
      grid,
      scene,
      audio,
      particles,
      pickupSystem,
      enemySystem
    );
  });

  it('spawns initial fuel drums and destructible cars on initialization', () => {
    expect(interactiveEnv.fuelDrums.length).toBeGreaterThanOrEqual(12);
    expect(interactiveEnv.cars.length).toBeGreaterThanOrEqual(8);
    expect(interactiveEnv.getCarColliders().length).toBeGreaterThanOrEqual(8);
  });

  it('fuel drum explodes on crate:destroyed event, deals 220 damage and knockback to enemies in radius', () => {
    const drum = interactiveEnv.spawnFuelDrum(0, 0);

    const enemy: ActiveEnemy = {
      id: 701,
      type: 'enemy',
      archetype: 't800_endoskeleton',
      x: 2.0,
      z: 0,
      vx: 0,
      vz: 0,
      radius: 0.6,
      hp: 300,
      maxHp: 300,
      speed: 2,
      damage: 15,
      xpValue: 15,
      armorStripMultiplier: 1.0,
      isFlying: false,
      slowTimer: 0,
      attackCooldown: 0,
      hitFlashTimer: 0,
      mass: 1.0,
      isBoss: false
    };
    grid.insert(enemy);

    let shakeReceived = false;
    const unbind = globalEvents.on('camera:shake', ({ trauma }) => {
      if (trauma >= 0.3) shakeReceived = true;
    });

    globalEvents.emit('crate:destroyed', { crateId: drum.id, x: 0, z: 0 });

    expect(shakeReceived).toBe(true);
    expect(enemy.hp).toBe(80); // 300 - 220
    expect(enemy.vx).toBeGreaterThan(0); // Outward knockback
    expect(interactiveEnv.fuelDrums.find((d) => d.id === drum.id)).toBeUndefined();
    unbind();
  });

  it('fuel drums trigger chain reactions when within blast radius (4.8m)', () => {
    // Drum 1 at (0, 0), Drum 2 at (2.5, 0) - within 4.8m!
    const drum1 = interactiveEnv.spawnFuelDrum(0, 0);
    const drum2 = interactiveEnv.spawnFuelDrum(2.5, 0);

    // Detonate drum1
    interactiveEnv.detonateFuelDrum(drum1);

    // Both drums should have detonated in chain reaction
    expect(interactiveEnv.fuelDrums.find((d) => d.id === drum1.id)).toBeUndefined();
    expect(interactiveEnv.fuelDrums.find((d) => d.id === drum2.id)).toBeUndefined();
  });

  it('destructible cars block incoming enemy plasma bolts and absorb damage', () => {
    const car = interactiveEnv.spawnDestructibleCar(5, 5);
    expect(car.hp).toBe(120);

    // Simulate an enemy projectile entering car radius
    const proj: EnemyProjectile = {
      poolIndex: 0,
      x: 5.2,
      y: 0.8,
      z: 5.2,
      vx: 5,
      vz: 0,
      rotY: 0,
      damage: 25,
      radius: 0.3,
      life: 0.1,
      maxLife: 2.0
    };
    enemySystem.enemyProjectiles.push(proj);

    interactiveEnv.update(0.016);

    // Projectile was blocked (life set to maxLife)
    expect(proj.life).toBe(proj.maxLife);
    // Car absorbed the 25 damage
    expect(car.hp).toBe(95);
  });

  it('destructible car is destroyed when HP <= 0, removing it from car colliders', () => {
    const car = interactiveEnv.spawnDestructibleCar(10, 10);
    const initialCollidersCount = interactiveEnv.getCarColliders().length;

    // Deal lethal damage to car
    interactiveEnv.damageCar(car, 150);

    expect(car.isDestroyed).toBe(true);
    expect(interactiveEnv.getCarColliders().length).toBe(initialCollidersCount - 1);
  });

  it('Tech-Com Supply Drop flare triggers, pulses, and awards supply crate + 50 scrap on player arrival', () => {
    runState.playerPos = { x: 0, z: 0 };
    interactiveEnv.triggerSupplyDropFlare(0, 0);

    expect(interactiveEnv.activeFlare).not.toBeNull();
    const flare = interactiveEnv.activeFlare!;
    expect(flare.timeRemaining).toBe(20.0);

    const initialScrap = runState.alloyScrapEarned;
    const initialCrates = pickupSystem.pickups.filter((p) => p.kind === 'crate').length;

    // Move player inside flare radius
    runState.playerPos = { x: flare.x, z: flare.z };

    interactiveEnv.update(0.1);

    // Awarded supply crate and scrap
    expect(runState.alloyScrapEarned).toBe(initialScrap + 50);
    expect(pickupSystem.pickups.filter((p) => p.kind === 'crate').length).toBe(initialCrates + 1);
    expect(interactiveEnv.activeFlare).toBeNull();
  });

  it('Tech-Com Supply Drop flare expires and dismisses if 20 seconds elapse without collection', () => {
    runState.playerPos = { x: 100, z: 100 }; // Far away from flare
    interactiveEnv.triggerSupplyDropFlare(0, 0);

    expect(interactiveEnv.activeFlare).not.toBeNull();

    // Elapse 21 seconds
    interactiveEnv.update(21.0);

    expect(interactiveEnv.activeFlare).toBeNull();
  });
});
