import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { RunController, type RunControllerHost } from '../../src/core/RunController';
import { SceneManager } from '../../src/graphics/SceneManager';
import { UIManager } from '../../src/ui/UIManager';
import { InputManager } from '../../src/input/InputManager';
import { WaveDirector } from '../../src/systems/WaveDirector';
import { PickupSystem } from '../../src/systems/PickupSystem';

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
      render: { calls: 12, lines: 0, triangles: 500, points: 0 },
      memory: { geometries: 10, textures: 5 }
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

describe('P11-05 Hit-stop restrictions and global cooldown throttling', () => {
  let root: HTMLElement;
  let runState: RunState;
  let audio: AudioEngine;
  let gameLoop: GameLoop;
  let enemySystem: EnemySystem;
  let weaponSystem: WeaponSystem;
  let controller: RunController;
  let hitStopSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    audio = new AudioEngine();
    gameLoop = new GameLoop(
      () => {},
      () => {}
    );
    hitStopSpy = vi.spyOn(gameLoop, 'hitStop');

    root = document.createElement('div');
    document.body.appendChild(root);

    const grid = new SpatialHashGrid(4.0);
    const particles = new ParticleSystem();
    const endoBatch = new EndoskeletonBatch(32);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
    const playerMesh = new KyleReeseMesh();
    weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
    const waveDirector = new WaveDirector(runState, enemySystem);
    const pickupSystem = new PickupSystem(runState, audio);
    const sceneManager = new SceneManager(root);
    const inputManager = new InputManager();
    const uiManager = new UIManager(
      root,
      { getData: () => ({ settings: { autoAim: true }, upgrades: {} }) } as any,
      inputManager,
      audio,
      () => {},
      () => runState
    );

    const host: RunControllerHost = {
      runState,
      saveManager: {
        addRunResults: vi.fn(),
        getData: () => ({ upgrades: {}, settings: { autoAim: true } })
      } as any,
      audioEngine: audio,
      uiManager,
      sceneManager,
      inputManager,
      weaponSystem,
      enemySystem,
      pickupSystem,
      particles,
      waveDirector,
      gameLoop
    };

    controller = new RunController(host);
    runState.mode = 'playing';
  });

  it('triggers 0 hit-stops for 10 fodder crits, 1 for boss crit, and throttles rapid boss crits within 0.1s', () => {
    // 1. Spawn standard fodder enemy (T-800)
    const fodder = enemySystem.spawnEnemy('t800_endoskeleton', 0, 5);

    // Apply 10 crits via WeaponSystem against fodder
    for (let i = 0; i < 10; i++) {
      weaponSystem.applyDamageToTarget(fodder, 5, 0, undefined, undefined, true);
    }

    // Standard fodder crits MUST NOT trigger hit-stop
    expect(hitStopSpy).toHaveBeenCalledTimes(0);

    // 2. Spawn boss enemy
    const boss = enemySystem.spawnEnemy('hk_aerial_squadron_leader', 10, 10);

    // Apply 1 crit against boss
    weaponSystem.applyDamageToTarget(boss, 50, 0, undefined, undefined, true);
    expect(hitStopSpy).toHaveBeenCalledTimes(1);
    expect(hitStopSpy).toHaveBeenCalledWith(0.04);

    // 3. Apply second boss crit within 0.1s (e.g. 0.05s elapsed)
    controller.update(0.05);
    weaponSystem.applyDamageToTarget(boss, 50, 0, undefined, undefined, true);

    // Should still be exactly 1 call due to HIT_STOP_GLOBAL_COOLDOWN (0.25s)
    expect(hitStopSpy).toHaveBeenCalledTimes(1);

    // 4. Advance time past cooldown (0.25s)
    controller.update(0.25);
    weaponSystem.applyDamageToTarget(boss, 50, 0, undefined, undefined, true);

    // Now second hit-stop occurs
    expect(hitStopSpy).toHaveBeenCalledTimes(2);

    controller.dispose();
  });
});
