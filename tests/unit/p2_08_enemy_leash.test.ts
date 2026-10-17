import { describe, it, expect, beforeEach } from 'vitest';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import type { ActiveEnemy } from '../../src/core/types';

describe('P2-08 enemy leash and relocation', () => {
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
    endoBatch = new EndoskeletonBatch(650);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  });

  const createEnemy = (overrides: Partial<ActiveEnemy>): ActiveEnemy => ({
    id: overrides.id ?? 1,
    archetype: overrides.archetype ?? 't600_rusted',
    x: overrides.x ?? 0,
    z: overrides.z ?? 0,
    radius: 0.5,
    type: 'enemy',
    hp: overrides.hp ?? 50,
    maxHp: 50,
    speed: overrides.speed ?? 3.5,
    damage: 10,
    isBoss: overrides.isBoss ?? false,
    isFlying: false,
    xpValue: 1,
    attackCooldown: 0,
    hitFlashTimer: 0,
    slowTimer: 0,
    armorStripMultiplier: 1.0,
    phaseState: 0,
    searchlightAlertTimer: 0,
    searchlightAngle: 0
  });

  it('teleports non-boss enemies farther than 40m to the 22-28m ring ahead of player movement', () => {
    // Player is moving along +Z direction
    runState.playerPos = { x: 0, z: 0 };
    runState.playerMoveAngle = 0; // heading +Z
    runState.isMoving = true;

    // Enemy is 45m behind the player at (0, -45)
    const enemy = createEnemy({ id: 1, x: 0, z: -45, isBoss: false });
    enemySystem.activeEnemies.push(enemy);

    enemySystem.update(0.016, 0);

    const distAfter = Math.hypot(enemy.x - runState.playerPos.x, enemy.z - runState.playerPos.z);
    expect(distAfter).toBeGreaterThanOrEqual(21.9);
    expect(distAfter).toBeLessThanOrEqual(28.1);
    // Should be relocated ahead (+Z quadrant)
    expect(enemy.z).toBeGreaterThan(0);
  });

  it('never relocates bosses even if farther than 40m from player', () => {
    runState.playerPos = { x: 0, z: 0 };
    runState.playerMoveAngle = 0;
    runState.isMoving = true;

    // Boss at 50m behind the player
    const boss = createEnemy({
      id: 99,
      archetype: 'hk_tank_goliath',
      x: 0,
      z: -50,
      isBoss: true
    });
    enemySystem.activeEnemies.push(boss);

    enemySystem.update(0.016, 0);

    // Boss should still be far behind, steering normally toward player
    const distAfter = Math.hypot(boss.x - runState.playerPos.x, boss.z - runState.playerPos.z);
    expect(distAfter).toBeGreaterThan(45);
    expect(boss.z).toBeLessThan(-40);
  });

  it('does not relocate non-boss enemies that are within the 40m threshold', () => {
    runState.playerPos = { x: 0, z: 0 };
    runState.playerMoveAngle = 0;
    runState.isMoving = true;

    // Enemy at 35m
    const enemy = createEnemy({ id: 2, x: 0, z: -35, isBoss: false });
    enemySystem.activeEnemies.push(enemy);

    enemySystem.update(0.016, 0);

    // Enemy was NOT teleported; only moved slightly closer
    expect(enemy.z).toBeCloseTo(-35 + 3.5 * 0.016, 1);
  });

  it('acceptance: running in a straight line for 60s keeps enemy pressure constant (enemies within 30m >= 70%)', () => {
    runState.playerPos = { x: 0, z: 0 };
    runState.playerMoveAngle = 0; // Running along +Z
    runState.isMoving = true;
    const playerSpeed = 7.8; // m/s

    // Spawn 100 non-boss enemies distributed within 10-25m
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      const r = 10 + (i % 15);
      const enemy = createEnemy({
        id: i + 1,
        x: Math.sin(angle) * r,
        z: Math.cos(angle) * r,
        speed: 3.5,
        isBoss: false
      });
      enemySystem.activeEnemies.push(enemy);
    }

    // Simulate 60 seconds at dt = 0.05s (1200 ticks)
    const dt = 0.05;
    for (let step = 0; step < 1200; step++) {
      runState.playerPos.z += playerSpeed * dt;
      enemySystem.update(dt, step * dt);
    }

    // Measure percentage of enemies within 30m of the player
    const px = runState.playerPos.x;
    const pz = runState.playerPos.z;
    const within30m = enemySystem.activeEnemies.filter((e) => {
      const d = Math.hypot(e.x - px, e.z - pz);
      return d <= 30;
    });

    const ratio = within30m.length / enemySystem.activeEnemies.length;
    expect(ratio).toBeGreaterThanOrEqual(0.7);
  });
});
