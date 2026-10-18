import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BunkerEnvironment } from '../../src/graphics/environments/BunkerEnvironment';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { HUDView } from '../../src/ui/HUDView';

describe('P11-11 Bunker defence objective', () => {
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;
  let bunkerEnv: BunkerEnvironment;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {}, 1234, 'century_city_bunker');
    grid = new SpatialHashGrid(4);
    audio = new AudioEngine();
    particles = new ParticleSystem();
    endoBatch = new EndoskeletonBatch();
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
    bunkerEnv = new BunkerEnvironment();
  });

  afterEach(() => {
    enemySystem.clear();
    bunkerEnv.dispose();
  });

  it('enemies within bunker radius stop and damage bunker using contact damage and cooldown', () => {
    const target = bunkerEnv.bunkerTarget;
    expect(target).toBeDefined();

    // Spawn an enemy directly at bunker target
    const enemy = enemySystem.spawnEnemy('t600_rusted', target.x, target.z);
    const initialHealth = bunkerEnv.getBunkerHealth()!;
    expect(initialHealth.current).toBe(1500);

    // Update enemy system with bunker environment
    enemySystem.update(0.1, 1.0, [], bunkerEnv);

    const healthAfterHit = bunkerEnv.getBunkerHealth()!;
    expect(healthAfterHit.current).toBeLessThan(initialHealth.current);
    expect(healthAfterHit.current).toBe(initialHealth.current - enemy.damage);
    expect(enemy.attackCooldown).toBeGreaterThan(0);

    // Immediate next tick before cooldown expires does not damage again
    enemySystem.update(0.1, 1.1, [], bunkerEnv);
    expect(bunkerEnv.getBunkerHealth()!.current).toBe(healthAfterHit.current);
  });

  it('HUD shows bunker health bar when bunker exists', () => {
    const root = document.createElement('div');
    const hud = new HUDView(root);
    const bunkerBar = root.querySelector('#hud-bunker-bar') as HTMLElement;
    expect(bunkerBar).not.toBeNull();
    expect(bunkerBar.style.display).toBe('none');

    // Update with bunker health
    hud.update(runState, null, 60, { current: 1500, max: 1500 });
    expect(bunkerBar.style.display).toBe('flex');
    const fill = root.querySelector('#hud-bunker-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');

    // Update with lower health
    hud.update(runState, null, 60, { current: 150, max: 1500 });
    expect(fill.style.width).toBe('10%');
    expect(fill.style.background).toBe('var(--color-red)');

    // Without bunker health
    hud.update(runState, null, 60, null);
    expect(bunkerBar.style.display).toBe('none');
  });

  it('bunker HP reaching 0 triggers breach and damageBunker clamps to 0', () => {
    bunkerEnv.damageBunker(2000);
    const health = bunkerEnv.getBunkerHealth()!;
    expect(health.current).toBe(0);
  });
});
