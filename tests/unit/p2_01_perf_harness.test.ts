import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../../src/core/Game';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    getPixelRatio = () => 1;
    render = vi.fn();
    dispose = vi.fn();
    toneMapping = 0;
    toneMappingExposure = 1;
    info = {
      render: { calls: 42, lines: 0, triangles: 1200, points: 0 },
      memory: { geometries: 15, textures: 8 }
    };
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});

vi.mock('../../src/graphics/PostProcessing', () => {
  return {
    PostProcessingManager: class {
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      update = vi.fn();
      render = vi.fn();
      triggerEmpGlitch = vi.fn();
      triggerDamageFlash = vi.fn();
    }
  };
});

describe('P2-01 perf harness', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
  });
  it('exposes spawnSwarm and getPerf on window.__GAME_DEBUG__ with required metrics', () => {
    const root = document.createElement('div');
    new Game(root);

    const debugApi = window.__GAME_DEBUG__;
    expect(debugApi).toBeDefined();
    expect(typeof debugApi?.spawnSwarm).toBe('function');
    expect(typeof debugApi?.getPerf).toBe('function');

    const perf = debugApi?.getPerf();
    expect(perf).toBeDefined();
    expect(typeof perf?.fps).toBe('number');
    expect(typeof perf?.frameTimeMs).toBe('number');
    expect(typeof perf?.drawCalls).toBe('number');
    expect(typeof perf?.geometries).toBe('number');
    expect(typeof perf?.textures).toBe('number');
  });

  it('spawnSwarm spawns requested enemy counts with spatial distribution', () => {
    const root = document.createElement('div');
    const game = new Game(root);
    game.startRun('reese_2029', 19842029);

    const debugApi = window.__GAME_DEBUG__;
    expect(game.enemySystem.activeEnemies.length).toBe(0);

    // Spawn 50 crab drones
    debugApi?.spawnSwarm('skynet_crab_drone', 50);
    expect(game.enemySystem.activeEnemies.length).toBe(50);

    // Spawn 25 T-800 endoskeletons
    debugApi?.spawnSwarm('t800_endoskeleton', 25);
    expect(game.enemySystem.activeEnemies.length).toBe(75);

    // Ensure enemies are distributed around player, not all at (0, 0)
    const positions = new Set(
      game.enemySystem.activeEnemies.map((e) => `${Math.round(e.x)},${Math.round(e.z)}`)
    );
    expect(positions.size).toBeGreaterThan(20);
  });
});
