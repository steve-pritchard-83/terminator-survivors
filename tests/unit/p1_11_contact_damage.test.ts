import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { EnemySystem } from '../../src/systems/EnemySystem';

function setupSystem() {
  const runState = new RunState();
  runState.initRun('reese_2029', {});
  // Past the opening grace period, so hits land at full damage
  runState.timeSeconds = 120;
  const grid = new SpatialHashGrid(4.0);
  const audio = new AudioEngine();
  const particles = new ParticleSystem();
  const endoBatch = new EndoskeletonBatch(32);
  const enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  return { runState, grid, enemySystem };
}

describe('P1-11 contact damage cooldown decay (fixes B13)', () => {
  it('decrements attackCooldown even when player leaves contact radius, preventing instant re-hit on re-entry', () => {
    const { runState, enemySystem } = setupSystem();
    const enemy = enemySystem.spawnEnemy('t800_endoskeleton', 0, 0);

    const initialHp = runState.hp;
    runState.playerPos = { x: 0, z: 0 }; // In contact

    // Tick 1: Contact hit occurs immediately because initial attackCooldown is 0
    enemySystem.update(0.016, 0.016, []);
    expect(runState.hp).toBe(initialHp - enemy.damage);
    expect(enemy.attackCooldown).toBeCloseTo(0.55, 2);

    const hpAfterFirstHit = runState.hp;

    // Player moves away for 0.10s (out of contact radius)
    runState.playerPos = { x: 30, z: 30 };
    runState.updateTimers(0.10);
    enemySystem.update(0.10, 0.116, []);

    // attackCooldown decayed during the 0.10s away from player
    expect(enemy.attackCooldown).toBeCloseTo(0.45, 2);
    expect(runState.hp).toBe(hpAfterFirstHit);

    // Player re-enters contact radius
    runState.playerPos = { x: enemy.x, z: enemy.z };
    runState.updateTimers(0.10);
    enemySystem.update(0.10, 0.216, []);

    // Still on cooldown (0.45 - 0.10 = 0.35s left) -> NO instant second damage hit
    expect(enemy.attackCooldown).toBeCloseTo(0.35, 2);
    expect(runState.hp).toBe(hpAfterFirstHit);

    // Advance remaining 0.35s + a tick in contact
    runState.updateTimers(0.36);
    enemySystem.update(0.36, 0.576, []);

    // Second hit lands when cooldown naturally expires
    expect(runState.hp).toBe(hpAfterFirstHit - enemy.damage);
    expect(enemy.attackCooldown).toBeCloseTo(0.55, 2);
  });

  it('keeps HK tank chargeTimer isolated from contact attackCooldown', () => {
    const { enemySystem } = setupSystem();
    const tank = enemySystem.spawnEnemy('hk_tank_goliath', 10, 10);

    expect(tank.chargeTimer).toBe(0);
    expect(tank.attackCooldown).toBe(0);

    // Advance 1.5 seconds
    enemySystem.update(1.5, 1.5, []);
    expect(tank.chargeTimer).toBeCloseTo(1.5, 2);
    expect(tank.attackCooldown).toBe(0); // attackCooldown stayed 0 clamped
  });
});
