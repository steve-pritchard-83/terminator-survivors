import { SceneManager } from '../graphics/SceneManager';
import { GameLoop } from './GameLoop';
import { RunState } from '../state/RunState';
import { SaveManager } from '../state/SaveManager';
import { InputManager } from '../input/InputManager';
import { AudioEngine } from '../audio/AudioEngine';
import { SpatialHashGrid } from './SpatialHashGrid';
import { ParticleSystem } from '../systems/ParticleSystem';
import { Environment2029 } from '../graphics/Environment2029';
import { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { PlayerSystem } from '../systems/PlayerSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { WaveDirector } from '../systems/WaveDirector';
import { PickupSystem } from '../systems/PickupSystem';
import { UIManager } from '../ui/UIManager';
import { RunController, type RunControllerHost } from './RunController';
import { InputRouter, type InputRouterHost } from './InputRouter';
import { DebugAPI, type DebugAPIHost } from './DebugAPI';
import type { LoadoutId } from './types';

export class Game implements RunControllerHost, InputRouterHost, DebugAPIHost {
  public readonly sceneManager: SceneManager;
  public readonly gameLoop: GameLoop;
  public readonly runState: RunState;
  public readonly saveManager: SaveManager;
  public readonly inputManager: InputManager;
  public readonly audioEngine: AudioEngine;
  public readonly grid: SpatialHashGrid;
  public readonly particles: ParticleSystem;
  public readonly environment: Environment2029;
  public readonly playerMesh: KyleReeseMesh;
  public readonly endoBatch: EndoskeletonBatch;

  public readonly playerSystem: PlayerSystem;
  public readonly weaponSystem: WeaponSystem;
  public readonly enemySystem: EnemySystem;
  public readonly waveDirector: WaveDirector;
  public readonly pickupSystem: PickupSystem;
  public readonly uiManager: UIManager;
  public readonly runController: RunController;
  public readonly inputRouter: InputRouter;
  public readonly debugAPI?: DebugAPI;

  private prevPlayerPos = { x: 0, z: 0 };

  constructor(appContainer: HTMLElement) {
    // 1. Core State & Audio
    this.runState = new RunState();
    this.saveManager = new SaveManager();
    this.inputManager = new InputManager();
    this.audioEngine = new AudioEngine();
    this.audioEngine.gamepadManager = this.inputManager.gamepadManager;
    this.grid = new SpatialHashGrid(4.0);

    const settings = this.saveManager.getData().settings;
    this.audioEngine.setMasterVolume(settings.masterVolume);
    this.audioEngine.setMusicVolume(settings.musicVolume);
    this.audioEngine.setSfxVolume(settings.sfxVolume);

    // 2. 3D Graphics & Scene
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvas-container';
    appContainer.appendChild(canvasContainer);

    this.sceneManager = new SceneManager(canvasContainer);
    this.particles = new ParticleSystem();
    this.environment = new Environment2029();
    this.playerMesh = new KyleReeseMesh();
    this.endoBatch = new EndoskeletonBatch(650);

    this.sceneManager.scene.add(
      this.environment.group,
      this.playerMesh.group,
      this.endoBatch.group,
      this.particles.group
    );

    // 3. Gameplay Systems
    this.playerSystem = new PlayerSystem(this.runState, this.playerMesh, this.particles);
    this.weaponSystem = new WeaponSystem(this.runState, this.grid, this.audioEngine, this.particles, this.playerMesh);
    this.enemySystem = new EnemySystem(this.runState, this.grid, this.audioEngine, this.particles, this.endoBatch);
    this.waveDirector = new WaveDirector(this.runState, this.enemySystem);
    this.pickupSystem = new PickupSystem(this.runState, this.audioEngine);
    this.sceneManager.scene.add(this.playerSystem.group, this.weaponSystem.group, this.enemySystem.group, this.pickupSystem.group);

    // 4. UI Layer & CRT Overlay
    const crtOverlay = document.createElement('div');
    crtOverlay.className = 'crt-overlay';
    if (!settings.crtScanlines) crtOverlay.style.display = 'none';
    appContainer.appendChild(crtOverlay);

    this.uiManager = new UIManager(
      appContainer,
      this.saveManager,
      this.inputManager,
      this.audioEngine,
      (loadoutId) => this.startRun(loadoutId),
      () => this.runState
    );

    // 5. RunController, InputRouter, DebugAPI & GameLoop
    this.runController = new RunController(this);
    this.inputRouter = new InputRouter(this, () => this.togglePause());
    this.gameLoop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (alpha, dt) => this.render(alpha, dt)
    );
    if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
      this.debugAPI = new DebugAPI(this);
    }
    this.gameLoop.start();
  }

  public onRunStarted(): void {
    this.prevPlayerPos.x = this.runState.playerPos.x;
    this.prevPlayerPos.z = this.runState.playerPos.z;
  }

  public get activeBoss(): { name: string; hp: number; maxHp: number } | null {
    return this.runController.activeBoss;
  }

  public startRun(loadoutId: LoadoutId, customSeed?: number): void {
    this.runController.startRun(loadoutId, customSeed);
  }

  public endRun(victory: boolean): void { this.runController.endRun(victory); }
  public togglePause(): void { this.runController.togglePause(); }
  public pauseGame(): void { this.runController.pauseGame(); }
  public resumeFromPause(): void { this.runController.resumeFromPause(); }
  public abortToTitle(): void { this.runController.abortToTitle(); }

  private fixedUpdate(dt: number): void {
    const input = this.inputRouter.update(dt);

    if (this.runState.mode !== 'playing') {
      if (this.runState.mode === 'title') this.environment.update(0, 0);
      return;
    }

    this.prevPlayerPos.x = this.runState.playerPos.x;
    this.prevPlayerPos.z = this.runState.playerPos.z;

    this.playerSystem.update(dt, input.move, input.aim, this.environment.obstacleColliders, input.aimPos);

    this.grid.clear();
    for (const enemy of this.enemySystem.activeEnemies) this.grid.insert(enemy);
    for (const pickup of this.pickupSystem.pickups) this.grid.insert(pickup);

    this.weaponSystem.update(dt, this.enemySystem.activeEnemies, input.aim);
    this.enemySystem.update(dt, this.runState.timeSeconds, this.environment.obstacleColliders);
    this.waveDirector.update(dt);
    this.pickupSystem.update(dt);
    this.particles.update(dt);
    this.environment.update(this.runState.playerPos.x, this.runState.playerPos.z);

    const isLowHp = this.runState.hp > 0 && (this.runState.hp / this.runState.maxHp) < 0.25;
    this.audioEngine.updateHeartbeat(dt, isLowHp);
    const lowHpPulse = isLowHp ? 0.35 + 0.55 * Math.pow(Math.max(0, Math.sin(this.runState.timeSeconds * Math.PI * 2 * 1.6)), 2) : 0;
    this.sceneManager.postProcessing.setLowHpIntensity(lowHpPulse);

    this.runController.update(dt);
    this.sceneManager.adjustQuality(this.gameLoop.fps, dt);
  }

  private render(alpha: number, dt = GameLoop.FIXED_DT): void {
    if (this.runState.mode === 'playing') {
      const interp = this.playerSystem.setInterpolatedPosition(alpha, this.prevPlayerPos);
      this.sceneManager.updateCamera(interp.x, interp.z, dt);
      this.uiManager.hudView.updateDamageNumbers(dt);
    } else if (this.runState.mode === 'title') {
      this.sceneManager.updateCamera(0, 0, dt);
    } else {
      this.sceneManager.updateCamera(this.runState.playerPos.x, this.runState.playerPos.z, dt);
    }
    this.sceneManager.render(dt, this.runState.timeSeconds);
  }

  public dispose(): void {
    this.gameLoop.stop();
    this.runController.dispose();
    this.debugAPI?.dispose();
    this.pickupSystem.dispose();
  }
}

