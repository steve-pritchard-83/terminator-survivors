import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import type { ActiveEnemy } from '../../src/core/types';
import { globalEvents } from '../../src/core/EventBus';

function createTestEnemy(overrides: Partial<ActiveEnemy> = {}): ActiveEnemy {
  return {
    id: 1,
    type: 'enemy',
    archetype: 't600_rusted',
    x: 0,
    z: 0,
    radius: 0.5,
    hp: 100,
    maxHp: 100,
    speed: 1,
    damage: 10,
    isBoss: false,
    isFlying: false,
    xpValue: 10,
    hitFlashTimer: 0,
    slowTimer: 0,
    armorStripMultiplier: 1,
    attackCooldown: 0,
    searchlightAngle: 0,
    searchlightAlertTimer: 0,
    phaseState: 0,
    ...overrides
  };
}

describe('P1-05 drone & orbital damage', () => {
  it('scales drone damage with mightMultiplier and respects 0.35s hit cooldown', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.weapons.clear();
    runState.weapons.set('seeker_drone', {
      id: 'seeker_drone',
      level: 1, // Base damage 18
      evolved: false,
      cooldownTimer: 0
    });
    // Set might multiplier to 2.0 -> damage should be 36
    runState.computedStats.mightMultiplier = 2.0;

    const grid = new SpatialHashGrid(4.0);
    const audio = new AudioEngine();
    const particles = new ParticleSystem();
    const playerMesh = new KyleReeseMesh();
    const weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);

    const damages: number[] = [];
    const unsub = globalEvents.on('enemy:damaged', (e) => {
      damages.push(e.damage);
    });

    // Enemy located at (2.8, 0), matching the initial drone orbital position at angle 0
    const enemy = createTestEnemy({
      id: 101,
      x: 2.8,
      z: 0,
      hp: 200,
      maxHp: 200
    });
    grid.insert(enemy);

    // Initial update with dt = 0 so angle stays at 0
    weaponSystem.update(0, [enemy]);
    expect(damages).toHaveLength(1);
    expect(damages[0]).toBe(36); // 18 * 2 = 36!

    // Second update immediately (dt = 0.016s): enemy should not take damage due to 0.35s cooldown
    weaponSystem.update(0.016, [enemy]);
    expect(damages).toHaveLength(1);

    unsub();
  });

  it('orbital strike count increases with bonusAmount and targets distinct enemies via findNearestN', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.weapons.clear();
    // laser_designator level 1 has amount = 1
    runState.weapons.set('laser_designator', {
      id: 'laser_designator',
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });
    // Add +2 bonus projectiles
    runState.computedStats.bonusAmount = 2;

    const grid = new SpatialHashGrid(4.0);
    const audio = new AudioEngine();
    const particles = new ParticleSystem();
    const playerMesh = new KyleReeseMesh();
    const weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);

    // Create 3 enemies around the player
    const enemies: ActiveEnemy[] = [
      createTestEnemy({ id: 1, x: 3, z: 0 }),
      createTestEnemy({ id: 2, x: 6, z: 0 }),
      createTestEnemy({ id: 3, x: 9, z: 0 })
    ];
    enemies.forEach((e) => grid.insert(e));

    // Test findNearestN
    const nearest3 = grid.findNearestN(0, 0, 3, 20, (e) => e.type === 'enemy');
    expect(nearest3).toHaveLength(3);
    expect(nearest3.map((e) => e.id)).toEqual([1, 2, 3]);

    // Track orbital beam strikes via camera shake events
    let strikeCount = 0;
    const unsub = globalEvents.on('camera:shake', () => {
      strikeCount++;
    });

    // Fire laser_designator (slot cooldownTimer is 0)
    weaponSystem.update(0.016, enemies);
    // count = stats.amount (1) + bonusAmount (2) = 3 strikes!
    expect(strikeCount).toBe(3);

    unsub();
  });
});
