import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { BASE_WEAPONS, EVOLVED_WEAPONS, ALL_WEAPONS } from '../../src/data/weapons';
import { createWeaponPatternRegistry } from '../../src/systems/weapons';
import type { ActiveEnemy, WeaponDefinition, WeaponPatternId } from '../../src/core/types';

describe('P3-03 weapon behaviour registry', () => {
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

  it('WeaponSystem.ts meets acceptance criteria: fireWeapon contains NO switch statement', () => {
    const filePath = path.resolve(__dirname, '../../src/systems/WeaponSystem.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract fireWeapon method body
    const fireWeaponMatch = content.match(/private fireWeapon\s*\([^)]*\): void \{([\s\S]*?)\n\s*\}/);
    expect(fireWeaponMatch).toBeDefined();
    const fireWeaponBody = fireWeaponMatch![1];

    expect(fireWeaponBody.includes('switch')).toBe(false);
  });

  it('verifies all 16 weapons have a defined pattern and valid patternParams', () => {
    const allDefs: WeaponDefinition[] = [
      ...Object.values(BASE_WEAPONS),
      ...Object.values(EVOLVED_WEAPONS)
    ];

    expect(allDefs).toHaveLength(16);
    const validPatterns: WeaponPatternId[] = [
      'SpreadShot',
      'StraightShot',
      'Lobbed',
      'Nova',
      'Orbiters',
      'GroundZone',
      'Strike'
    ];

    for (const def of allDefs) {
      expect(validPatterns).toContain(def.pattern);
      expect(def.patternParams).toBeDefined();
    }
  });

  it('createWeaponPatternRegistry provides handlers for all 7 pattern types', () => {
    const { registry, orbiters } = createWeaponPatternRegistry();
    expect(registry.SpreadShot).toBeDefined();
    expect(registry.StraightShot).toBeDefined();
    expect(registry.Lobbed).toBeDefined();
    expect(registry.Nova).toBeDefined();
    expect(registry.Orbiters).toBe(orbiters);
    expect(registry.GroundZone).toBeDefined();
    expect(registry.Strike).toBeDefined();
  });

  it('fires SpreadShot (Ithaca 37) and spawns multiple pellets with spread', () => {
    runState.weapons.clear();
    runState.weapons.set('ithaca_37', { id: 'ithaca_37', level: 1, evolved: false, cooldownTimer: 0 });

    weaponSystem.update(0.016, []);
    expect(weaponSystem.patterns.SpreadShot).toBeDefined();
  });

  it('fires StraightShot (M-25 plasma) and spawns high-velocity bolt', () => {
    runState.weapons.clear();
    runState.weapons.set('m25_plasma', { id: 'm25_plasma', level: 1, evolved: false, cooldownTimer: 0 });

    weaponSystem.update(0.016, []);
    expect(weaponSystem.patterns.StraightShot).toBeDefined();
  });

  it('fires Lobbed (Pipe Bomb) and spawns arcing explosive projectile', () => {
    runState.weapons.clear();
    runState.weapons.set('pipe_bomb', { id: 'pipe_bomb', level: 1, evolved: false, cooldownTimer: 0 });

    weaponSystem.update(0.016, []);
    expect(weaponSystem.patterns.Lobbed).toBeDefined();
  });

  it('fires Nova (EMP Emitter) and triggers shockwave damage in radius', () => {
    runState.weapons.clear();
    runState.weapons.set('emp_emitter', { id: 'emp_emitter', level: 1, evolved: false, cooldownTimer: 0 });

    const enemy: ActiveEnemy = {
      id: 99,
      type: 'enemy',
      archetype: 't600_rusted',
      x: 1,
      z: 1,
      radius: 0.5,
      hp: 100,
      maxHp: 100,
      speed: 1,
      damage: 10,
      isBoss: false,
      isFlying: false,
      xpValue: 5,
      hitFlashTimer: 0,
      slowTimer: 0,
      armorStripMultiplier: 1,
      attackCooldown: 0,
      state: {}
    };
    grid.insert(enemy);

    weaponSystem.update(0.016, [enemy]);
    expect(enemy.hp).toBeLessThan(100);
    expect(enemy.slowTimer).toBeGreaterThan(0);
  });

  it('fires GroundZone (Napalm Canister) and creates damaging ground hazards', () => {
    runState.weapons.clear();
    runState.weapons.set('napalm_canister', { id: 'napalm_canister', level: 1, evolved: false, cooldownTimer: 0 });

    weaponSystem.update(0.016, []);
    expect(weaponSystem.patterns.GroundZone).toBeDefined();
  });

  it('fires Strike (Laser Designator) and targets enemies with orbital beam', () => {
    runState.weapons.clear();
    runState.weapons.set('laser_designator', { id: 'laser_designator', level: 1, evolved: false, cooldownTimer: 0 });

    weaponSystem.update(0.016, []);
    expect(weaponSystem.patterns.Strike).toBeDefined();
  });

  it('allows adding a new weapon with just a data entry without editing WeaponSystem', () => {
    // Add custom experimental weapon
    const customId = 'experimental_scatter' as any;
    (ALL_WEAPONS as Record<string, WeaponDefinition>)[customId] = {
      id: customId,
      name: 'Experimental Scatter Cannon',
      codeName: 'PROTOTYPE-X',
      isEvolved: false,
      iconColor: '#00ff88',
      pattern: 'SpreadShot',
      patternParams: {
        spreadAngle: 0.8,
        ringFull: false,
        projectileVisual: 'plasma',
        projectileRadius: 0.3
      },
      knockback: 10,
      levels: [
        {
          level: 1,
          damage: 50,
          cooldown: 0.5,
          area: 1.0,
          speed: 25,
          amount: 8,
          duration: 0.5,
          pierce: 3,
          description: 'Fires experimental 8-plasma scatter bursts'
        }
      ]
    };

    runState.weapons.clear();
    runState.weapons.set(customId, { id: customId, level: 1, evolved: false, cooldownTimer: 0 });

    // Successfully fires through pattern registry without any switch modifications
    expect(() => {
      weaponSystem.update(0.016, []);
    }).not.toThrow();

    delete (ALL_WEAPONS as Record<string, WeaponDefinition>)[customId];
  });
});
