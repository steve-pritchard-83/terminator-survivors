import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { CircleTelegraph, LineTelegraph, ConeTelegraph } from '../../src/graphics/Telegraphs';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { T800Behaviour } from '../../src/systems/enemies/T800Behaviour';
import { InfiltratorBehaviour } from '../../src/systems/enemies/InfiltratorBehaviour';
import { HKAerialBehaviour } from '../../src/systems/enemies/HKAerialBehaviour';
import { HKTankBehaviour } from '../../src/systems/enemies/HKTankBehaviour';
import { SkynetCoreBehaviour } from '../../src/systems/enemies/SkynetCoreBehaviour';
import { T1000Behaviour } from '../../src/systems/enemies/T1000Behaviour';

describe('P4-03 Attack telegraphs', () => {
  let group: THREE.Group;
  let runState: RunState;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let endoBatch: EndoskeletonBatch;
  let grid: SpatialHashGrid;
  let enemySystem: EnemySystem;

  beforeEach(() => {
    group = new THREE.Group();
    runState = new RunState();
    runState.initRun('reese_2029', {});
    audio = new AudioEngine();
    particles = new ParticleSystem();
    endoBatch = new EndoskeletonBatch(32);
    grid = new SpatialHashGrid(4.0);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  });

  describe('Telegraph visual primitives', () => {
    it('CircleTelegraph renders outer perimeter ring and scaling inner fill ring', () => {
      const circle = new CircleTelegraph(4.0, 0xff1744);
      group.add(circle.group);

      expect(circle.group.visible).toBe(false);

      // Update at 50% charge
      circle.update(10, 20, 0.5, 4.0);
      expect(circle.group.visible).toBe(true);
      expect(circle.group.position.x).toBe(10);
      expect(circle.group.position.z).toBe(20);

      // Inner fill scale reflects 0.5 progress
      const innerMesh = circle.group.children[1] as THREE.Mesh;
      expect(innerMesh.scale.x).toBeCloseTo(0.5, 2);
      expect(innerMesh.scale.z).toBeCloseTo(0.5, 2);

      circle.setVisible(false);
      expect(circle.group.visible).toBe(false);

      circle.dispose();
    });

    it('LineTelegraph aligns from source to target and scales length to distance', () => {
      const line = new LineTelegraph(0.3, 0xff1744);
      group.add(line.group);

      // Vector from (0, 0) to (0, 10): along +Z, distance = 10, angle = 0
      line.update(0, 0, 0, 10, 0.8);
      expect(line.group.visible).toBe(true);
      expect(line.group.position.x).toBe(0);
      expect(line.group.position.z).toBe(0);
      expect(line.group.rotation.y).toBeCloseTo(0, 3);
      expect(line.group.scale.z).toBeCloseTo(10, 2);

      // Vector from (0, 0) to (5, 0): along +X, distance = 5, angle = PI/2
      line.update(0, 0, 5, 0, 1.0);
      expect(line.group.rotation.y).toBeCloseTo(Math.PI / 2, 3);
      expect(line.group.scale.z).toBeCloseTo(5, 2);

      line.dispose();
    });

    it('ConeTelegraph renders sector fan and disposes without memory leaks', () => {
      const cone = new ConeTelegraph(8.0, Math.PI / 3, 0xff1744);
      group.add(cone.group);

      cone.update(2, 4, Math.PI / 4, 0.75);
      expect(cone.group.visible).toBe(true);
      expect(cone.group.position.x).toBe(2);
      expect(cone.group.position.z).toBe(4);
      expect(cone.group.rotation.y).toBeCloseTo(Math.PI / 4, 3);

      const fillMesh = cone.group.children[1] as THREE.Mesh;
      expect(fillMesh.scale.x).toBeCloseTo(0.75, 2);

      cone.dispose();
    });
  });

  describe('Enemy attack telegraph integrations', () => {
    it('T-800 displays red laser sight line during 0.5s pre-fire charging phase', () => {
      const behaviour = new T800Behaviour();
      const enemy = enemySystem.spawnEnemy('t800_endoskeleton', 0, 10);
      runState.playerPos = { x: 0, z: 0 };

      // Initialize state to 0.4s before fire (within 0.5s window)
      enemy.state = { phaseCooldown: 0.4 };

      const spawnProjSpy = vi.fn();
      const ctx = {
        runState,
        audio,
        particles,
        spawnEnemyProjectile: spawnProjSpy,
        applyPlayerDamage: vi.fn(),
        emit: vi.fn(),
        rng: {} as any,
        group,
        timeSeconds: 0
      };

      behaviour.update(enemy, 0.016, ctx);
      const telegraph = (behaviour as any).telegraphs.get(enemy.id);
      expect(telegraph).toBeDefined();
      expect(telegraph.group.visible).toBe(true);
      expect(spawnProjSpy).not.toHaveBeenCalled();

      // Step past 0s cooldown: shoots projectile and hides telegraph
      behaviour.update(enemy, 0.5, ctx);
      expect(telegraph.group.visible).toBe(false);
      expect(spawnProjSpy).toHaveBeenCalled();

      behaviour.dispose(enemy, ctx);
      expect((behaviour as any).telegraphs.has(enemy.id)).toBe(false);
    });

    it('Infiltrator displays burst charging line telegraph for 0.5s before 3-round burst', () => {
      const behaviour = new InfiltratorBehaviour();
      const enemy = enemySystem.spawnEnemy('infiltrator_csm101', 5, 5);
      runState.playerPos = { x: 0, z: 0 };

      const ctx = {
        runState,
        audio,
        particles,
        spawnEnemyProjectile: vi.fn(),
        applyPlayerDamage: vi.fn(),
        emit: vi.fn(),
        rng: { next: () => 0.5 } as any,
        group,
        timeSeconds: 0
      };
      behaviour.createVisual(enemy, ctx);

      // Cooldown at 0.3s (within 0.5s charging phase)
      enemy.state = { burstCooldown: 0.3, burstShotsLeft: 0 };
      behaviour.update(enemy, 0.016, ctx);

      const telegraph = (behaviour as any).telegraphs.get(enemy.id);
      expect(telegraph).toBeDefined();
      expect(telegraph.group.visible).toBe(true);

      // Step past cooldown to initiate burst
      behaviour.update(enemy, 0.4, ctx);
      expect(telegraph.group.visible).toBe(false);
      expect(enemy.state.burstShotsLeft).toBe(3);

      behaviour.dispose(enemy, ctx);
    });

    it('HK Aerial displays charging fill ring on ground when player is detected in searchlight', () => {
      const behaviour = new HKAerialBehaviour();
      const enemy = enemySystem.spawnEnemy('hk_aerial_patrol', 0, 0);
      const ctx = {
        runState,
        audio,
        particles,
        spawnEnemyProjectile: vi.fn(),
        applyPlayerDamage: vi.fn(),
        emit: vi.fn(),
        rng: {} as any,
        group,
        timeSeconds: 0
      };
      behaviour.createVisual(enemy, ctx);

      // Place player inside searchlight pool (at z = 8.5 ahead of aerial)
      runState.playerPos = { x: 0, z: 8.5 };

      behaviour.update(enemy, 0.3, ctx);
      const telegraph = (behaviour as any).telegraphs.get(enemy.id);
      expect(telegraph).toBeDefined();
      expect(telegraph.group.visible).toBe(true);

      // Progressively charges up to 1.2s
      expect(enemy.state?.searchlightAlert).toBeGreaterThan(0.2);

      behaviour.dispose(enemy, ctx);
    });

    it('HK Tank displays artillery circle telegraph with charging fill ring during 3.0s charge', () => {
      const behaviour = new HKTankBehaviour();
      const enemy = enemySystem.spawnEnemy('hk_tank_goliath', 0, 0);
      runState.playerPos = { x: 10, z: 10 };

      const ctx = {
        runState,
        audio,
        particles,
        spawnEnemyProjectile: vi.fn(),
        applyPlayerDamage: vi.fn(),
        emit: vi.fn(),
        rng: {} as any,
        group,
        timeSeconds: 0
      };
      behaviour.createVisual(enemy, ctx);

      behaviour.update(enemy, 1.5, ctx);
      const telegraph = (behaviour as any).telegraphs.get(enemy.id);
      expect(telegraph).toBeDefined();
      expect(telegraph.group.visible).toBe(true);

      // At 1.5s out of 3.0s, charge progress is 0.5
      expect(enemy.state?.chargeTimer).toBeCloseTo(1.5, 2);

      // Finish 3.0s charge: artillery blast triggers, telegraph hides
      behaviour.update(enemy, 1.6, ctx);
      expect(telegraph.group.visible).toBe(false);

      behaviour.dispose(enemy, ctx);
    });

    it('Skynet Core displays radial nova warning circle before discharging plasma spokes', () => {
      const behaviour = new SkynetCoreBehaviour();
      const enemy = enemySystem.spawnEnemy('skynet_tde_core', 0, 0);
      // Enraged phase (< 50% HP)
      enemy.hp = enemy.maxHp * 0.4;

      const ctx = {
        runState,
        audio,
        particles,
        spawnEnemyProjectile: vi.fn(),
        applyPlayerDamage: vi.fn(),
        emit: vi.fn(),
        rng: {} as any,
        group,
        timeSeconds: 10
      };
      behaviour.createVisual(enemy, ctx);

      // Cooldown at 0.4s (within 0.6s warning telegraph window)
      enemy.state = { novaCooldown: 0.4 };
      behaviour.update(enemy, 0.016, ctx);

      const telegraph = (behaviour as any).telegraphs.get(enemy.id);
      expect(telegraph).toBeDefined();
      expect(telegraph.group.visible).toBe(true);

      // Step past cooldown: fires nova bolts and hides telegraph
      behaviour.update(enemy, 0.5, ctx);
      expect(telegraph.group.visible).toBe(false);

      behaviour.dispose(enemy, ctx);
    });

    it('T-1000 displays blade lunge line telegraph before forward dash attack', () => {
      const behaviour = new T1000Behaviour();
      const enemy = enemySystem.spawnEnemy('t1000_prototype', 0, 4);
      runState.playerPos = { x: 0, z: 0 };

      const ctx = {
        runState,
        audio,
        particles,
        spawnEnemyProjectile: vi.fn(),
        applyPlayerDamage: vi.fn(),
        emit: vi.fn(),
        rng: {} as any,
        group,
        timeSeconds: 0
      };
      behaviour.createVisual(enemy, ctx);

      // Lunge cooldown at 0.3s (within 0.5s telegraph window)
      enemy.state = { lungeCooldown: 0.3 };
      behaviour.update(enemy, 0.016, ctx);

      const telegraph = (behaviour as any).telegraphs.get(enemy.id);
      expect(telegraph).toBeDefined();
      expect(telegraph.group.visible).toBe(true);

      // Execute lunge: bursts forward with high velocity and hides telegraph
      behaviour.update(enemy, 0.4, ctx);
      expect(telegraph.group.visible).toBe(false);
      expect(enemy.vz).toBeLessThan(0); // lunges toward player at z = 0

      behaviour.dispose(enemy, ctx);
    });
  });
});
