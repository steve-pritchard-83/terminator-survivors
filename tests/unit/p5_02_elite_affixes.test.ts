import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { ELITE_AFFIXES, ENEMY_CONFIGS } from '../../src/data/enemies';
import { WAVE_TIMELINE } from '../../src/data/waves';
import { globalEvents } from '../../src/core/EventBus';

describe('P5-02 Elite Affixes', () => {
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;
  let weaponSystem: WeaponSystem;
  let pickupSystem: PickupSystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.playerPos = { x: 0, z: 0 };

    grid = new SpatialHashGrid(4);
    audio = new AudioEngine();
    vi.spyOn(audio, 'playExplosion').mockImplementation(() => {});
    vi.spyOn(audio, 'playPlayerHit').mockImplementation(() => {});
    vi.spyOn(audio, 'playEndoDestroy').mockImplementation(() => {});

    particles = new ParticleSystem();
    vi.spyOn(particles, 'spawnExplosion').mockImplementation(() => {});
    vi.spyOn(particles, 'spawnEnemyDebris').mockImplementation(() => {});

    endoBatch = new EndoskeletonBatch(100);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);

    const playerMesh = new THREE.Object3D();
    weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh as any);
    pickupSystem = new PickupSystem(runState, audio, particles);
  });

  it('defines all 5 elite affixes with distinct colors and descriptions', () => {
    const affixes = Object.keys(ELITE_AFFIXES);
    expect(affixes).toContain('Armored');
    expect(affixes).toContain('Overclocked');
    expect(affixes).toContain('Shielded');
    expect(affixes).toContain('Self-Destruct');
    expect(affixes).toContain('Regenerating');

    for (const affix of affixes as Array<keyof typeof ELITE_AFFIXES>) {
      const cfg = ELITE_AFFIXES[affix];
      expect(cfg.id).toBe(affix);
      expect(cfg.tintColor).toBeGreaterThan(0);
      expect(cfg.description.length).toBeGreaterThan(5);
    }
  });

  it('WAVE_TIMELINE defines escalating eliteChance per minute', () => {
    expect(WAVE_TIMELINE[0].eliteChance).toBeCloseTo(0.02, 2);
    expect(WAVE_TIMELINE[5].eliteChance).toBeGreaterThan(WAVE_TIMELINE[0].eliteChance);
    expect(WAVE_TIMELINE[10].eliteChance).toBeLessThanOrEqual(0.35);
  });

  it('spawns elite enemy with 1.4x scale, 1.4x radius, and 2x HP', () => {
    const baseCfg = ENEMY_CONFIGS.t800_endoskeleton;
    const elite = enemySystem.spawnEnemy('t800_endoskeleton', 5, 5, 1.0, 1.0, 'Armored');

    expect(elite.isElite).toBe(true);
    expect(elite.affix).toBe('Armored');
    expect(elite.scale).toBe(1.4);
    expect(elite.radius).toBeCloseTo(baseCfg.radius * 1.4, 2);
    expect(elite.maxHp).toBe(baseCfg.maxHp * 2);
    expect(elite.hp).toBe(baseCfg.maxHp * 2);
  });

  it('Armored elite mitigates 50% damage until EMP strips armor', () => {
    const elite = enemySystem.spawnEnemy('t800_endoskeleton', 5, 5, 1.0, 1.0, 'Armored');
    const startHp = elite.hp;

    // Apply 40 damage while armor is intact (armorStripMultiplier >= 1.0)
    // 50% mitigation -> 20 damage dealt
    (weaponSystem as any).applyDamageToTarget(elite, 40);
    expect(startHp - elite.hp).toBe(20);

    // Strip armor (armorStripMultiplier < 1.0, e.g. 0.70 via EMP)
    elite.armorStripMultiplier = 0.70;
    const hpBeforeEmpHit = elite.hp;
    // 1 / 0.70 * 40 ≈ 57 damage dealt (no -50% reduction)
    (weaponSystem as any).applyDamageToTarget(elite, 40);
    expect(hpBeforeEmpHit - elite.hp).toBeGreaterThan(40);
  });

  it('Overclocked elite gains +60% movement speed', () => {
    const baseSpeed = ENEMY_CONFIGS.t700_scout.speed;
    const elite = enemySystem.spawnEnemy('t700_scout', 5, 5, 1.0, 1.0, 'Overclocked');

    expect(elite.speed).toBeCloseTo(baseSpeed * 1.6, 2);
  });

  it('Shielded elite absorbs first 30% HP with energy barrier', () => {
    const elite = enemySystem.spawnEnemy('t800_endoskeleton', 5, 5, 1.0, 1.0, 'Shielded');
    const expectedShield = Math.round(elite.maxHp * 0.30);
    expect(elite.shieldHp).toBe(expectedShield);

    // Hit for 20 damage: should deplete shield only, HP remains intact
    const startHp = elite.hp;
    (weaponSystem as any).applyDamageToTarget(elite, 20);
    expect(elite.hp).toBe(startHp);
    expect(elite.shieldHp).toBe(expectedShield - 20);

    // Hit for remaining shield + 15 damage: should break shield and deal 15 to HP
    const remainingShield = elite.shieldHp ?? 0;
    (weaponSystem as any).applyDamageToTarget(elite, remainingShield + 15);
    expect(elite.shieldHp).toBe(0);
    expect(elite.hp).toBe(startHp - 15);
  });

  it('Regenerating elite recovers 3% max HP per second', () => {
    const elite = enemySystem.spawnEnemy('t800_endoskeleton', 5, 5, 1.0, 1.0, 'Regenerating');
    elite.hp = elite.maxHp * 0.50; // Damaged to 50%
    const hpStart = elite.hp;

    // Advance 1 second
    enemySystem.update(1.0, 10.0);
    const expectedRegen = elite.maxHp * 0.03;
    expect(elite.hp - hpStart).toBeCloseTo(expectedRegen, 1);
  });

  it('Self-Destruct elite detonates upon death and damages player within radius', () => {
    runState.playerPos = { x: 2, z: 2 };
    runState.hp = 100;
    const elite = enemySystem.spawnEnemy('t600_rusted', 2.5, 2.5, 1.0, 1.0, 'Self-Destruct');
    elite.hp = 0;

    // Kill enemy
    (enemySystem as any).killEnemy(elite, 0);

    expect(particles.spawnExplosion).toHaveBeenCalledWith(2.5, 0.5, 2.5, 2.8);
    expect(audio.playExplosion).toHaveBeenCalledWith(1.8);
    expect(runState.hp).toBeLessThan(100);
  });

  it('drops a guaranteed supply crate when an elite enemy is killed', () => {
    const elite = enemySystem.spawnEnemy('t800_endoskeleton', 4, 4, 1.0, 1.0, 'Overclocked');
    elite.hp = 0;

    // Emit enemy:killed as happens when enemy dies
    globalEvents.emit('enemy:killed', { enemy: elite, x: 4, z: 4, xp: 50 });

    const cratePickups = pickupSystem.pickups.filter((p) => p.kind === 'crate');
    expect(cratePickups.length).toBe(1);
    expect(cratePickups[0].x).toBe(4);
    expect(cratePickups[0].z).toBe(4);
  });
});
