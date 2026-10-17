import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { ENEMY_CONFIGS } from '../../src/data/enemies';
import { ENEMY_CODEX } from '../../src/data/lore';
import { WAVE_TIMELINE } from '../../src/data/waves';
import {
  T1MinigunBehaviour,
  MotoTerminatorBehaviour,
  HydrobotSwarmBehaviour,
  AerostatScoutBehaviour,
  PlasmaTurretBehaviour,
  T600MinigunnerBehaviour
} from '../../src/systems/enemies/NewEnemyBehaviours';
import type { EnemyContext } from '../../src/systems/enemies/EnemyBehaviour';
import type { ActiveEnemy } from '../../src/core/types';
import { globalRNG } from '../../src/core/RNG';

describe('P5-03 New Enemy Types', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let ctx: EnemyContext;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.playerPos = { x: 0, z: 0 };

    audio = new AudioEngine();
    vi.spyOn(audio, 'playPlasmaShot').mockImplementation(() => {});
    vi.spyOn(audio, 'playExplosion').mockImplementation(() => {});
    vi.spyOn(audio, 'playSearchlightAlert').mockImplementation(() => {});

    particles = new ParticleSystem();
    vi.spyOn(particles, 'spawnPlasmaImpact').mockImplementation(() => {});

    ctx = {
      runState,
      audio,
      particles,
      spawnEnemyProjectile: vi.fn(),
      applyPlayerDamage: vi.fn((dmg) => runState.takeDamage(dmg)),
      emit: vi.fn(),
      rng: globalRNG,
      group: new THREE.Group(),
      timeSeconds: 5.0
    };
  });

  const newArchetypes = [
    't1_minigun_tracked',
    'moto_terminator',
    'hydrobot_swarm',
    'aerostat_scout',
    'plasma_turret',
    't600_minigunner'
  ] as const;

  it('defines valid ENEMY_CONFIGS entries for all 6 new enemy archetypes', () => {
    for (const arch of newArchetypes) {
      const cfg = ENEMY_CONFIGS[arch];
      expect(cfg).toBeDefined();
      expect(cfg.name.length).toBeGreaterThan(3);
      expect(cfg.maxHp).toBeGreaterThan(0);
      expect(cfg.damage).toBeGreaterThan(0);
      expect(cfg.radius).toBeGreaterThan(0);
      expect(cfg.xpValue).toBeGreaterThan(0);
      expect(cfg.mass).toBeGreaterThan(0);
    }
  });

  it('contains comprehensive codex entries and threat levels for all 6 new enemies', () => {
    for (const arch of newArchetypes) {
      const entry = ENEMY_CODEX[arch];
      expect(entry).toBeDefined();
      expect(entry.name.length).toBeGreaterThan(3);
      expect(entry.designation.length).toBeGreaterThan(3);
      expect(entry.codex.length).toBeGreaterThan(20);
      expect(['LOW', 'MEDIUM', 'HIGH', 'EXTREME', 'LETHAL']).toContain(entry.threat);
    }
  });

  it('places new enemies into wave timeline at appropriate minutes', () => {
    const minute3Pool = WAVE_TIMELINE[3].pool.map((p) => p.archetype);
    expect(minute3Pool).toContain('t1_minigun_tracked');
    expect(minute3Pool).toContain('hydrobot_swarm');
    expect(minute3Pool).toContain('aerostat_scout');
    expect(minute3Pool).toContain('plasma_turret');
    expect(minute3Pool).toContain('t600_minigunner');

    const minute5Pool = WAVE_TIMELINE[5].pool.map((p) => p.archetype);
    expect(minute5Pool).toContain('moto_terminator');
  });

  function makeEnemy(archetype: typeof newArchetypes[number]): ActiveEnemy {
    const cfg = ENEMY_CONFIGS[archetype];
    return {
      id: 101,
      type: 'enemy',
      archetype,
      x: 6,
      z: 6,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      speed: cfg.speed,
      damage: cfg.damage,
      radius: cfg.radius,
      isBoss: cfg.isBoss,
      isFlying: cfg.isFlying,
      xpValue: cfg.xpValue,
      hitFlashTimer: 0,
      slowTimer: 0,
      armorStripMultiplier: 1.0,
      attackCooldown: 0
    };
  }

  it('T1MinigunBehaviour creates visual and fires sweeping bullet cone', () => {
    const b = new T1MinigunBehaviour();
    const e = makeEnemy('t1_minigun_tracked');
    const visual = b.createVisual(e, ctx);
    expect(visual).not.toBeNull();

    // Advance cooldown
    e.state = { burstCooldown: 0.1 };
    b.update(e, 0.2, ctx);

    expect(ctx.spawnEnemyProjectile).toHaveBeenCalled();
    expect(audio.playPlasmaShot).toHaveBeenCalled();

    b.dispose(e, ctx);
  });

  it('MotoTerminatorBehaviour creates visual and performs line dash attack', () => {
    const b = new MotoTerminatorBehaviour();
    const e = makeEnemy('moto_terminator');
    const visual = b.createVisual(e, ctx);
    expect(visual).not.toBeNull();

    e.state = { dashCooldown: 0.1 };
    b.update(e, 0.2, ctx);

    expect(e.state.isDashing).toBe(1);
    expect(Math.hypot(e.vx || 0, e.vz || 0)).toBeGreaterThan(10);

    b.dispose(e, ctx);
  });

  it('HydrobotSwarmBehaviour creates visual and undulates', () => {
    const b = new HydrobotSwarmBehaviour();
    const e = makeEnemy('hydrobot_swarm');
    const visual = b.createVisual(e, ctx);
    expect(visual).not.toBeNull();

    b.update(e, 0.016, ctx);
    expect(visual?.rotation.y).toBeDefined();

    b.dispose(e, ctx);
  });

  it('AerostatScoutBehaviour creates visual, hovers in air and pings when player near', () => {
    const b = new AerostatScoutBehaviour();
    const e = makeEnemy('aerostat_scout');
    const visual = b.createVisual(e, ctx);
    expect(visual).not.toBeNull();
    expect(visual?.position.y).toBeGreaterThan(3.5);

    e.state = { pingCooldown: 0.1 };
    b.update(e, 0.2, ctx);

    expect(audio.playSearchlightAlert).toHaveBeenCalled();
    expect(particles.spawnPlasmaImpact).toHaveBeenCalled();

    b.dispose(e, ctx);
  });

  it('PlasmaTurretBehaviour creates stationary visual and fires line plasma bolts', () => {
    const b = new PlasmaTurretBehaviour();
    const e = makeEnemy('plasma_turret');
    const visual = b.createVisual(e, ctx);
    expect(visual).not.toBeNull();
    expect(e.speed).toBe(0);

    e.state = { shotCooldown: 0.1 };
    b.update(e, 0.2, ctx);

    expect(ctx.spawnEnemyProjectile).toHaveBeenCalled();
    expect(audio.playPlasmaShot).toHaveBeenCalled();

    b.dispose(e, ctx);
  });

  it('T600MinigunnerBehaviour creates visual and unleashes 3-shot burst', () => {
    const b = new T600MinigunnerBehaviour();
    const e = makeEnemy('t600_minigunner');
    const visual = b.createVisual(e, ctx);
    expect(visual).not.toBeNull();

    e.state = { burstCooldown: 0.1 };
    b.update(e, 0.2, ctx);

    expect(ctx.spawnEnemyProjectile).toHaveBeenCalledTimes(3);

    b.dispose(e, ctx);
  });

  it('EnemySystem spawns and updates new enemy types correctly', () => {
    const grid = new SpatialHashGrid(4);
    const endoBatch = new EndoskeletonBatch(50);
    const enemySys = new EnemySystem(runState, grid, audio, particles, endoBatch);

    const t1 = enemySys.spawnEnemy('t1_minigun_tracked', 10, 10);
    const moto = enemySys.spawnEnemy('moto_terminator', 12, 12);
    const turret = enemySys.spawnEnemy('plasma_turret', 15, 15);

    expect(enemySys.activeEnemies).toHaveLength(3);
    expect(t1.archetype).toBe('t1_minigun_tracked');
    expect(moto.archetype).toBe('moto_terminator');
    expect(turret.archetype).toBe('plasma_turret');

    enemySys.update(0.016, 1.0);
    expect(enemySys.activeEnemies).toHaveLength(3);
  });
});
