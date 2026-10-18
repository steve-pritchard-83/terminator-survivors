import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDailyOperation } from '../../src/core/DailyOperation';
import { WaveDirector } from '../../src/systems/WaveDirector';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { HUDView } from '../../src/ui/HUDView';
import { globalEvents } from '../../src/core/EventBus';

describe('P11-12 Daily operation, threat levels, and endless leaderboard', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let grid: SpatialHashGrid;
  let particles: ParticleSystem;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;

  beforeEach(() => {
    runState = new RunState();
    audio = new AudioEngine();
    grid = new SpatialHashGrid(4);
    particles = new ParticleSystem();
    endoBatch = new EndoskeletonBatch();
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  });

  afterEach(() => {
    enemySystem.clear();
  });

  it('getDailyOperation is deterministic for the same date', () => {
    const d1 = new Date('2029-08-29T12:00:00Z');
    const d2 = new Date('2029-08-29T23:59:59Z');
    const op1 = getDailyOperation(d1);
    const op2 = getDailyOperation(d2);

    expect(op1.dateKey).toBe('2029-08-29');
    expect(op2.dateKey).toBe('2029-08-29');
    expect(op1.seed).toBe(op2.seed);
    expect(op1.stageId).toBe(op2.stageId);
    expect(op1.loadoutId).toBe(op2.loadoutId);
  });

  it('with judgment_hour, final boss spawns at minute 8', () => {
    runState.initRun('reese_2029', {}, 1234, 'la_2029_wasteland', ['judgment_hour']);
    const waveDirector = new WaveDirector(runState, enemySystem);

    let spawnedBoss: string | null = null;
    const unbind = globalEvents.on('boss:spawned', ({ archetype }) => {
      spawnedBoss = archetype;
    });

    // Fast-forward to 8 minutes (480 seconds)
    runState.timeSeconds = 479.9;
    waveDirector.update(0.2); // crosses into minute 8

    unbind();
    expect(spawnedBoss).toBe('skynet_tde_core');
  });

  it('with supply_starvation, collecting crates never increases player HP', () => {
    runState.initRun('reese_2029', {}, 1234, 'la_2029_wasteland', ['supply_starvation']);
    runState.hp = 50;
    const pickupSystem = new PickupSystem(runState, audio, particles);

    for (let i = 0; i < 30; i++) {
      pickupSystem.spawnSupplyCrate(0, 0);
    }

    // Collect all spawned crates
    for (const p of [...pickupSystem.pickups]) {
      (pickupSystem as any).collectPickup(p);
    }

    expect(runState.hp).toBe(50);
  });

  it('with jammed_frequency, boss warning banner is suppressed in HUDView', () => {
    const root = document.createElement('div');
    const hud = new HUDView(root);
    runState.initRun('reese_2029', {}, 1234, 'la_2029_wasteland', ['jammed_frequency']);

    hud.update(runState, null);
    hud.triggerBossWarning('HUNTER-KILLER GOLIATH');

    const banner = root.querySelector('#hud-boss-warning') as HTMLElement;
    expect(banner.style.display).toBe('none');
  });
});
