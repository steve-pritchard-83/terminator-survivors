import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { InfiltratorBehaviour } from '../../src/systems/enemies/InfiltratorBehaviour';
import { HKTankBehaviour } from '../../src/systems/enemies/HKTankBehaviour';
import { HKAerialBehaviour } from '../../src/systems/enemies/HKAerialBehaviour';
import { T1000Behaviour } from '../../src/systems/enemies/T1000Behaviour';
import { SkynetCoreBehaviour } from '../../src/systems/enemies/SkynetCoreBehaviour';
import type { EnemyContext } from '../../src/systems/enemies/EnemyBehaviour';
import type { ActiveEnemy } from '../../src/core/types';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { globalRNG } from '../../src/core/RNG';
import { GameLoop } from '../../src/core/GameLoop';
import { ENEMY_CONFIGS } from '../../src/data/enemies';

describe('P5-01 Multi-Phase Boss Fights & Telegraphs', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let group: THREE.Group;
  let ctx: EnemyContext;
  let spawnedEnemies: Array<{ archetype: string; x: number; z: number }>;
  let emittedEvents: Array<{ event: string; payload: unknown }>;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.playerPos = { x: 0, z: 0 };

    audio = new AudioEngine();
    vi.spyOn(audio, 'playExplosion').mockImplementation(() => {});
    vi.spyOn(audio, 'playSearchlightAlert').mockImplementation(() => {});
    vi.spyOn(audio, 'playPlasmaShot').mockImplementation(() => {});
    vi.spyOn(audio, 'playCritCrunch').mockImplementation(() => {});
    vi.spyOn(audio, 'playEmpBlast').mockImplementation(() => {});

    particles = new ParticleSystem();
    vi.spyOn(particles, 'spawnExplosion').mockImplementation(() => {});
    vi.spyOn(particles, 'spawnEnemyDebris').mockImplementation(() => {});
    vi.spyOn(particles, 'spawnPlasmaImpact').mockImplementation(() => {});

    group = new THREE.Group();
    spawnedEnemies = [];
    emittedEvents = [];

    ctx = {
      runState,
      audio,
      particles,
      spawnEnemyProjectile: vi.fn(),
      spawnEnemy: (archetype, x, z) => {
        spawnedEnemies.push({ archetype, x, z });
      },
      applyPlayerDamage: vi.fn((dmg) => runState.takeDamage(dmg)),
      emit: (evt, payload) => {
        emittedEvents.push({ event: evt, payload });
      },
      rng: globalRNG,
      group,
      timeSeconds: 10
    };
  });

  function createBoss(archetype: keyof typeof ENEMY_CONFIGS): ActiveEnemy {
    const cfg = ENEMY_CONFIGS[archetype];
    return {
      id: 999,
      type: 'enemy',
      archetype,
      x: 5,
      z: 5,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      speed: cfg.speed,
      damage: cfg.damage,
      radius: cfg.radius,
      isBoss: true,
      isFlying: cfg.isFlying,
      xpValue: cfg.xpValue,
      hitFlashTimer: 0,
      slowTimer: 0,
      armorStripMultiplier: 1.0,
      attackCooldown: 0
    };
  }

  describe('Infiltrator CSM-101', () => {
    it('progresses through Phase 1, Phase 2 (<50% HP), and Phase 3 (<20% HP)', () => {
      const boss = createBoss('infiltrator_csm101');
      const behaviour = new InfiltratorBehaviour();
      behaviour.createVisual(boss, ctx);

      // Phase 1 (100% HP)
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(1);

      // Phase 2 (< 50% HP, e.g. 45% HP)
      boss.hp = boss.maxHp * 0.45;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(2);

      // Phase 3 (< 20% HP, e.g. 15% HP): burns away skin, speeds up, calls 6 crab drones
      boss.hp = boss.maxHp * 0.15;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(3);
      expect(boss.speed).toBeCloseTo(3.2 * 1.3, 2);
      expect(spawnedEnemies.filter((e) => e.archetype === 'skynet_crab_drone')).toHaveLength(6);

      // Death sequence
      behaviour.onDeath?.(boss, ctx);
      expect(particles.spawnExplosion).toHaveBeenCalledWith(boss.x, 0.5, boss.z, 3.5);
      expect(particles.spawnEnemyDebris).toHaveBeenCalledWith(boss.x, 0.5, boss.z, 12);

      behaviour.dispose(boss, ctx);
    });
  });

  describe('HK Tank Goliath', () => {
    it('progresses through Phase 1, Phase 2 (<50% HP), and Phase 3 (<20% HP)', () => {
      const boss = createBoss('hk_tank_goliath');
      const behaviour = new HKTankBehaviour();
      behaviour.createVisual(boss, ctx);

      // Phase 1
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(1);

      // Phase 2 (< 50% HP)
      boss.hp = boss.maxHp * 0.48;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(2);

      // Phase 3 (< 20% HP): spawns 2 T-600s
      boss.hp = boss.maxHp * 0.18;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(3);
      expect(spawnedEnemies.filter((e) => e.archetype === 't600_rusted')).toHaveLength(2);

      // Death sequence
      behaviour.onDeath?.(boss, ctx);
      expect(particles.spawnExplosion).toHaveBeenCalledWith(boss.x, 0.5, boss.z, 4.0);

      behaviour.dispose(boss, ctx);
    });
  });

  describe('HK Aerial Command Gunship', () => {
    it('progresses through Phase 1, Phase 2 (<50% HP), and Phase 3 (<20% HP)', () => {
      const boss = createBoss('hk_aerial_squadron_leader');
      const behaviour = new HKAerialBehaviour();
      behaviour.createVisual(boss, ctx);

      // Phase 1
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(1);

      // Phase 2 (< 50% HP): calls 2 HK patrol escorts
      boss.hp = boss.maxHp * 0.45;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(2);
      expect(spawnedEnemies.filter((e) => e.archetype === 'hk_aerial_patrol')).toHaveLength(2);

      // Phase 3 (< 20% HP)
      boss.hp = boss.maxHp * 0.15;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(3);

      // Death sequence
      behaviour.onDeath?.(boss, ctx);
      expect(particles.spawnExplosion).toHaveBeenCalledWith(boss.x, 4.0, boss.z, 4.0);

      behaviour.dispose(boss, ctx);
    });
  });

  describe('Liquid Metal Prototype T-1000', () => {
    it('progresses through Phase 1, Phase 2, and Phase 3 with liquid metal regen', () => {
      const boss = createBoss('t1000_prototype');
      const behaviour = new T1000Behaviour();
      behaviour.createVisual(boss, ctx);

      // Phase 1
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(1);

      // Phase 2 (< 50% HP)
      boss.hp = boss.maxHp * 0.45;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(2);

      // Phase 3 (< 20% HP): regenerates 2%/s when uncountered
      boss.hp = boss.maxHp * 0.15;
      const initialHp = boss.hp;
      behaviour.update(boss, 1.0, ctx); // 1 full second
      expect(boss.phase).toBe(3);
      expect(boss.hp).toBeGreaterThan(initialHp);
      expect(boss.hp - initialHp).toBeCloseTo(boss.maxHp * 0.02, 1);

      // If countered (slowTimer > 0), regeneration is suppressed
      boss.slowTimer = 2.0;
      const suppressedHp = boss.hp;
      behaviour.update(boss, 1.0, ctx);
      expect(boss.hp).toBe(suppressedHp);

      // Death sequence
      behaviour.onDeath?.(boss, ctx);
      expect(particles.spawnExplosion).toHaveBeenCalled();

      behaviour.dispose(boss, ctx);
    });
  });

  describe('Skynet Time Displacement Core', () => {
    it('progresses through Phase 1, Phase 2 (spawns 4 T-800s), and Phase 3', () => {
      const boss = createBoss('skynet_tde_core');
      const behaviour = new SkynetCoreBehaviour();
      behaviour.createVisual(boss, ctx);

      // Phase 1
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(1);

      // Phase 2 (< 50% HP): spawns 4 T-800 Endoskeletons
      boss.hp = boss.maxHp * 0.45;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(2);
      expect(spawnedEnemies.filter((e) => e.archetype === 't800_endoskeleton')).toHaveLength(4);

      // Phase 3 (< 20% HP)
      boss.hp = boss.maxHp * 0.15;
      behaviour.update(boss, 0.016, ctx);
      expect(boss.phase).toBe(3);

      // Death sequence
      behaviour.onDeath?.(boss, ctx);
      expect(particles.spawnExplosion).toHaveBeenCalledWith(boss.x, 1.5, boss.z, 5.0);

      behaviour.dispose(boss, ctx);
    });
  });

  describe('Boss Death Sequences', () => {
    it('standard hitStop clamps to 0.10s and stacks up to 0.12s', () => {
      const loop = new GameLoop(vi.fn(), vi.fn());
      expect(loop.hitStopTimer).toBe(0);

      loop.hitStop(0.5);
      expect(loop.hitStopTimer).toBe(0.10);

      loop.hitStop(0.05);
      expect(loop.hitStopTimer).toBe(0.12);
    });
  });
});
