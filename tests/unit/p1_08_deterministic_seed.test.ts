import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { WaveDirector } from '../../src/systems/WaveDirector';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { EndRunModal } from '../../src/ui/EndRunModal';
import { globalRNG } from '../../src/core/RNG';
import { globalEvents } from '../../src/core/EventBus';

function simulateRun(seed: number, ticks = 600) {
  globalEvents.clear();
  globalRNG.setSeed(seed);
  const runState = new RunState();
  runState.initRun('reese_2029', {}, seed);
  const grid = new SpatialHashGrid(4.0);
  const audio = new AudioEngine();
  const particles = new ParticleSystem();
  const playerMesh = new KyleReeseMesh();
  const endoBatch = new EndoskeletonBatch(64);
  const enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  const weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
  const waveDirector = new WaveDirector(runState, enemySystem);
  const pickupSystem = new PickupSystem(runState, audio);

  const dt = 1 / 60;
  for (let t = 0; t < ticks; t++) {
    runState.updateTimers(dt);
    runState.timeSeconds += dt;
    grid.clear();
    for (const enemy of enemySystem.activeEnemies) {
      grid.insert(enemy);
    }
    for (const pickup of pickupSystem.pickups) {
      grid.insert(pickup);
    }
    weaponSystem.update(dt, enemySystem.activeEnemies, null);
    enemySystem.update(dt, runState.timeSeconds, []);
    waveDirector.update(dt);
    pickupSystem.update(dt);
  }

  return {
    seed: runState.seed,
    kills: runState.kills,
    hp: runState.hp,
    enemies: enemySystem.activeEnemies.map((e) => ({
      id: e.id,
      x: Number(e.x.toFixed(2)),
      z: Number(e.z.toFixed(2)),
      hp: e.hp
    }))
  };
}

describe('P1-08 seeded RNG everywhere', () => {
  it('produces identical kills, hp, and enemy positions for two runs with the same seed across 600 ticks', () => {
    const testSeed = 19842029;
    const runA = simulateRun(testSeed, 600);
    const runB = simulateRun(testSeed, 600);

    expect(runA.seed).toBe(testSeed);
    expect(runB.seed).toBe(testSeed);
    expect(runA.kills).toBe(runB.kills);
    expect(runA.hp).toBe(runB.hp);
    expect(runA.enemies.length).toBeGreaterThan(0);
    expect(runA.enemies).toEqual(runB.enemies);
  });

  it('produces divergent enemy positions and simulation outcomes when seeds differ', () => {
    const run1 = simulateRun(11111, 300);
    const run2 = simulateRun(99999, 300);

    expect(run1.seed).not.toBe(run2.seed);
    // Across 300 ticks with distinct seeds, enemy positions must diverge
    expect(run1.enemies).not.toEqual(run2.enemies);
  });

  it('displays the mission seed on the end-run modal', () => {
    const root = document.createElement('div');
    const modal = new EndRunModal(root);
    modal.show(true, 120, 45, 5, 250, 883416, () => {});

    expect(root.textContent).toContain('MISSION SEED: 883416');
  });
});
