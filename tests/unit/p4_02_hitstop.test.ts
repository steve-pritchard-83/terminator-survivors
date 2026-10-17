import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { PlayerSystem } from '../../src/systems/PlayerSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { RunController, type RunControllerHost } from '../../src/core/RunController';
import { SceneManager } from '../../src/graphics/SceneManager';
import { UIManager } from '../../src/ui/UIManager';
import { InputManager } from '../../src/input/InputManager';
import { WaveDirector } from '../../src/systems/WaveDirector';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { globalEvents } from '../../src/core/EventBus';
import { DamageNumbers } from '../../src/ui/DamageNumbers';

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

describe('P4-02 Hit-stop & crit punch', () => {
  let root: HTMLElement;
  let runState: RunState;
  let audio: AudioEngine;
  let gameLoop: GameLoop;
  let updateCalls: number[];

  beforeEach(() => {
    updateCalls = [];
    runState = new RunState();
    runState.initRun('reese_2029', {});
    audio = new AudioEngine();
    gameLoop = new GameLoop(
      (dt) => {
        updateCalls.push(dt);
      },
      () => {}
    );
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('GameLoop.hitStop clamps duration to max 0.10s and stacks up to 0.12s', () => {
    expect(gameLoop.hitStopTimer).toBe(0);

    gameLoop.hitStop(0.04);
    expect(gameLoop.hitStopTimer).toBeCloseTo(0.04, 3);

    // Stacking
    gameLoop.hitStop(0.04);
    expect(gameLoop.hitStopTimer).toBeCloseTo(0.08, 3);

    // Stack clamped at 0.12s
    gameLoop.hitStop(0.08);
    expect(gameLoop.hitStopTimer).toBeCloseTo(0.12, 3);

    // Single call clamped to 0.10s from 0
    gameLoop.hitStopTimer = 0;
    gameLoop.hitStop(0.5);
    expect(gameLoop.hitStopTimer).toBeCloseTo(0.10, 3);
  });

  it('scales simulation dt to 0 for exact frame count of hit-stop', () => {
    gameLoop.start();
    updateCalls.length = 0;

    // Trigger 0.045s of hit-stop (at 60 FPS, FIXED_DT = 1/60s ~= 0.016667s -> 3 frames)
    gameLoop.hitStop(0.045);

    let currentTime = (gameLoop as any).lastTime;
    // Tick 1 (16.67ms) -> remaining hitStopTimer ~0.0283s, dt = 0
    currentTime += 16.667;
    gameLoop.tick(currentTime);

    // Tick 2 (16.67ms) -> remaining hitStopTimer ~0.0116s, dt = 0
    currentTime += 16.667;
    gameLoop.tick(currentTime);

    // Tick 3 (16.67ms) -> hitStopTimer reaches 0, dt = 0
    currentTime += 16.667;
    gameLoop.tick(currentTime);

    // Tick 4 (16.67ms) -> hitStop finished, normal dt = FIXED_DT = 1/60
    currentTime += 16.667;
    gameLoop.tick(currentTime);

    expect(updateCalls).toHaveLength(4);
    expect(updateCalls[0]).toBe(0);
    expect(updateCalls[1]).toBe(0);
    expect(updateCalls[2]).toBe(0);
    expect(updateCalls[3]).toBeCloseTo(GameLoop.FIXED_DT, 4);

    gameLoop.stop();
  });

  it('during dt=0 hit-stop, enemies and projectiles freeze while Kyle can still aim', () => {
    const grid = new SpatialHashGrid(4.0);
    const particles = new ParticleSystem();
    const endoBatch = new EndoskeletonBatch(32);
    const enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
    const playerMesh = new KyleReeseMesh();
    const playerSystem = new PlayerSystem(runState, playerMesh, particles);
    const weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);

    // Spawn an enemy moving towards player
    const enemy = enemySystem.spawnEnemy('t800_endoskeleton', 0, 10);
    enemy.speed = 3.0;
    grid.insert(enemy);

    // Advance 1 frame with normal dt: enemy moves towards player at (0, 0)
    enemySystem.update(GameLoop.FIXED_DT, 0);
    const enemyZAfterNormal = enemy.z;
    expect(enemyZAfterNormal).toBeLessThan(10); // moved closer

    // Now freeze simulation with dt = 0 (as occurs during hit-stop)
    enemySystem.update(0, 0);
    expect(enemy.z).toBe(enemyZAfterNormal); // completely frozen!

    // Player position remains frozen with dt = 0, but aim updates facing direction
    runState.playerPos = { x: 0, z: 0 };
    const aimTargetAngle = Math.PI / 2; // Facing +X
    playerSystem.update(0, { x: 1, z: 0 }, aimTargetAngle, []);

    // Player pos did not change (speed * dt = 0)
    expect(runState.playerPos.x).toBe(0);
    expect(runState.playerPos.z).toBe(0);
    // Player facing angle updated to aim input!
    expect(runState.playerFacing).toBe(aimTargetAngle);

    // Weapon projectiles also freeze with dt = 0
    runState.weapons.set('ithaca_37', { id: 'ithaca_37', level: 1, evolved: false, cooldownTimer: 0 });
    weaponSystem.update(GameLoop.FIXED_DT, [enemy], 0); // Spawns pellets moving +Z
    const projBefore = (weaponSystem as any).projectiles[0];
    expect(projBefore).toBeDefined();
    const projZBefore = projBefore.z;

    weaponSystem.update(0, [enemy]);
    expect(projBefore.z).toBe(projZBefore); // projectile position unchanged!
  });

  it('triggers hit-stop and playCritCrunch on boss crits, boss death, and elite death', () => {
    const hitStopSpy = vi.spyOn(gameLoop, 'hitStop');
    const critCrunchSpy = vi.spyOn(audio, 'playCritCrunch');
    const rumbleSpy = vi.fn();
    audio.gamepadManager = {
      playRumble: rumbleSpy
    } as any;

    const grid = new SpatialHashGrid(4.0);
    const particles = new ParticleSystem();
    const endoBatch = new EndoskeletonBatch(32);
    const enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
    const playerMesh = new KyleReeseMesh();
    const weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
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

    const controller = new RunController(host);
    runState.mode = 'playing';

    // Spawn boss
    const boss = enemySystem.spawnEnemy('infiltrator_csm101', 5, 5);

    // 1. Crit on boss triggers 0.04s hitStop and playCritCrunch
    globalEvents.emit('enemy:damaged', {
      x: boss.x,
      z: boss.z,
      damage: 150,
      isCrit: true,
      enemyId: boss.id
    });

    expect(critCrunchSpy).toHaveBeenCalled();
    expect(rumbleSpy).toHaveBeenCalledWith(110, 0.9, 0.6);
    expect(hitStopSpy).toHaveBeenCalledWith(0.04);

    // 2. Boss death triggers 0.10s hitStop
    controller.handleEnemyKilled(boss);
    expect(hitStopSpy).toHaveBeenCalledWith(0.10);

    // 3. Elite death triggers 0.06s hitStop
    const elite = enemySystem.spawnEnemy('t800_endoskeleton', 2, 2);
    elite.state = { isElite: 1 };
    controller.handleEnemyKilled(elite);
    expect(hitStopSpy).toHaveBeenCalledWith(0.06);

    controller.dispose();
  });

  it('DamageNumbers displays bold red 1.4x scale pop for crits', () => {
    const container = document.createElement('div');
    root.appendChild(container);
    const damageNumbers = new DamageNumbers(container);

    damageNumbers.onEnemyDamaged(85, true, 200, 200, 1);
    const activeEl = container.querySelector('.floating-text-callout') as HTMLElement;
    expect(activeEl).toBeDefined();
    expect(activeEl.textContent).toBe('-85 CRIT!');
    expect(activeEl.style.fontWeight).toBe('bold');

    // Update at peak pop (t = 0.25)
    damageNumbers.update(0.1875); // 0.1875 / 0.75 = 0.25
    // Transform contains scale(1.610) -> (1.15 * 1.4 = 1.610)
    expect(activeEl.style.transform).toContain('scale(1.610)');
  });
});
