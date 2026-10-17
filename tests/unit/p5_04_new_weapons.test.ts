import { describe, it, expect, beforeEach } from 'vitest';
import { BASE_WEAPONS, EVOLVED_WEAPONS, PASSIVES, canEvolveWeapon } from '../../src/data/weapons';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import type { ActiveEnemy, BaseWeaponId, EvolvedWeaponId, PassiveId } from '../../src/core/types';

describe('P5-04 new weapons, passives, and evolutions (14/12/14)', () => {
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let playerMesh: KyleReeseMesh;
  let weaponSystem: WeaponSystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    grid = new SpatialHashGrid(4.0);
    audio = new AudioEngine();
    particles = new ParticleSystem();
    playerMesh = new KyleReeseMesh();
    weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
  });

  it('verifies exact counts: 14 base weapons, 14 evolved weapons, 12 passives', () => {
    const baseKeys = Object.keys(BASE_WEAPONS) as BaseWeaponId[];
    const evoKeys = Object.keys(EVOLVED_WEAPONS) as EvolvedWeaponId[];
    const passiveKeys = Object.keys(PASSIVES) as PassiveId[];

    expect(baseKeys).toHaveLength(14);
    expect(evoKeys).toHaveLength(14);
    expect(passiveKeys).toHaveLength(12);
  });

  it('verifies all 6 new base weapons and their evolutions have valid definitions', () => {
    const pairs: Array<{ base: BaseWeaponId; evo: EvolvedWeaponId; passive: PassiveId }> = [
      { base: 'm16_carbine', evo: 'phased_plasma_assault', passive: 'ammo_belt' },
      { base: 'rpg_launcher', evo: 'tandem_warhead', passive: 'infrared_goggles' },
      { base: 'molotov', evo: 'firestorm_lane', passive: 'fuel_tank' },
      { base: 'resistance_k9', evo: 'k9_pack', passive: 'dog_tags' },
      { base: 'reprogrammed_t800', evo: 'guardian_protocol', passive: 'polaroid_luck' },
      { base: 'coltan_knife', evo: 'hyperalloy_blade', passive: 'might_shells' }
    ];

    for (const p of pairs) {
      const base = BASE_WEAPONS[p.base];
      const evo = EVOLVED_WEAPONS[p.evo];
      expect(base).toBeDefined();
      expect(evo).toBeDefined();
      expect(base.evolvesInto).toBe(p.evo);
      expect(evo.evolvesFrom).toBe(p.base);
      expect(base.pairedPassive).toBe(p.passive);

      // Evolution check
      const passivesMap = new Map<PassiveId, number>([[p.passive, 1]]);
      expect(canEvolveWeapon(p.base, 8, passivesMap)).toBe(p.evo);
    }
  });

  it('verifies the 4 new passives apply stats correctly in recalculateStats', () => {
    runState.passives.set('ammo_belt', 2);
    runState.passives.set('infrared_goggles', 2);
    runState.passives.set('polaroid_luck', 2);
    runState.passives.set('dog_tags', 2);

    runState.recalculateStats();

    // ammo_belt: durationMultiplier +0.15 * 2 = +0.30
    expect(runState.computedStats.durationMultiplier).toBeCloseTo(1.3, 2);
    // infrared_goggles: critMultiplier 1.75 + 0.20 * 2 = 2.15
    expect(runState.computedStats.critMultiplier).toBeCloseTo(2.15, 2);
    // polaroid_luck: luckMultiplier 1.0 + 0.25 * 2 = 1.50
    expect(runState.computedStats.luckMultiplier).toBeCloseTo(1.5, 2);
    // dog_tags: revivalChance 0.15 * 2 = 0.30, maxHp + 20
    expect(runState.computedStats.revivalChance).toBeCloseTo(0.3, 2);
    expect(runState.maxHp).toBe(120);
  });

  it('DogUnit pattern manages autonomous companion, damages enemies, reveals Infiltrators', () => {
    runState.weapons.clear();
    runState.weapons.set('resistance_k9', {
      id: 'resistance_k9',
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });

    const enemy: ActiveEnemy = {
      id: 101,
      type: 'enemy',
      archetype: 'infiltrator_csm101',
      x: 3,
      z: 0,
      vx: 0,
      vz: 0,
      radius: 0.8,
      hp: 100,
      maxHp: 100,
      speed: 2,
      damage: 10,
      xpValue: 10,
      armorStripMultiplier: 1.0,
      isFlying: false,
      slowTimer: 0,
      attackCooldown: 0,
      hitFlashTimer: 0,
      isBoss: true
    };
    grid.insert(enemy);

    // Update weapon system to spawn and move dog
    weaponSystem.update(0.1, [enemy]);
    const dogPattern = weaponSystem.patterns.DogUnit as any;
    expect(dogPattern.dogs.length).toBe(1);

    // Simulate several frames so the dog reaches the enemy
    for (let f = 0; f < 30; f++) {
      weaponSystem.update(0.05, [enemy]);
    }

    // Infiltrator was bitten and revealed (armorStripMultiplier >= 1.4)
    expect(enemy.armorStripMultiplier).toBeGreaterThanOrEqual(1.4);
    expect(enemy.hp).toBeLessThan(100);
  });

  it('AllySummon pattern spawns T-800, follows player, taunts and absorbs damage', () => {
    runState.weapons.clear();
    runState.weapons.set('reprogrammed_t800', {
      id: 'reprogrammed_t800',
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });

    const enemy: ActiveEnemy = {
      id: 202,
      type: 'enemy',
      archetype: 't800_endoskeleton',
      x: -2.0,
      z: 0,
      vx: 0,
      vz: 0,
      radius: 0.8,
      hp: 120,
      maxHp: 120,
      speed: 2,
      damage: 10,
      xpValue: 10,
      armorStripMultiplier: 1.0,
      isFlying: false,
      slowTimer: 0,
      attackCooldown: 0,
      hitFlashTimer: 0,
      isBoss: false
    };
    grid.insert(enemy);

    weaponSystem.update(0.1, [enemy]);
    const allyPattern = weaponSystem.patterns.AllySummon as any;
    expect(allyPattern.maxHp).toBe(300);
    expect(allyPattern.hp).toBeLessThanOrEqual(300);

    // Simulate contact hits on T-800
    for (let f = 0; f < 20; f++) {
      weaponSystem.update(0.1, [enemy]);
    }

    // T-800 absorbed contact damage
    expect(allyPattern.hp).toBeLessThan(300);
  });

  it('MeleeSweep slashes in arc and applies knockback to enemies in range', () => {
    runState.weapons.clear();
    runState.weapons.set('coltan_knife', {
      id: 'coltan_knife',
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });

    const enemy: ActiveEnemy = {
      id: 303,
      type: 'enemy',
      archetype: 'skynet_crab_drone',
      x: 0,
      z: 1.5, // Directly in front (facing angle 0 is +Z)
      vx: 0,
      vz: 0,
      radius: 0.5,
      hp: 80,
      maxHp: 80,
      speed: 4,
      damage: 8,
      xpValue: 5,
      armorStripMultiplier: 1.0,
      isFlying: false,
      slowTimer: 0,
      attackCooldown: 0,
      hitFlashTimer: 0,
      mass: 0.5,
      isBoss: false
    };
    grid.insert(enemy);

    weaponSystem.update(0.016, [enemy], 0); // Aiming directly forward

    // Enemy took slashing damage and received knockback
    expect(enemy.hp).toBeLessThan(80);
    expect(Math.abs(enemy.vz ?? 0) + Math.abs(enemy.vx ?? 0)).toBeGreaterThan(0);
  });

  it('Molotov creates a line of ground zones along targetAngle', () => {
    runState.weapons.clear();
    runState.weapons.set('molotov', {
      id: 'molotov',
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });

    weaponSystem.update(0.016, [], 0); // Aim forward (+Z)

    const groundZones = (weaponSystem as any).groundZones;
    expect(groundZones.length).toBe(3); // 3-bottle line
    // Zones should be placed at increasing Z coordinates
    expect(groundZones[0].z).toBeLessThan(groundZones[2].z);
  });

  it('Dog Tags grant revival chance in resolveLethalDamage when revivalsLeft is 0', () => {
    runState.hp = 0;
    runState.revivalsLeft = 0;
    runState.computedStats.revivalChance = 1.0; // 100% chance for test

    const outcome = runState.resolveLethalDamage();
    expect(outcome).toBe('revived');
    expect(runState.hp).toBeGreaterThan(0);
  });
});
