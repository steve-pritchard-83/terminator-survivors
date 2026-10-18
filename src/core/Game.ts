import { SceneManager } from '../graphics/SceneManager';
import { GameLoop } from './GameLoop';
import { RunState } from '../state/RunState';
import { SaveManager } from '../state/SaveManager';
import { InputManager } from '../input/InputManager';
import { AudioEngine } from '../audio/AudioEngine';
import { SpatialHashGrid } from './SpatialHashGrid';
import { ParticleSystem } from '../systems/ParticleSystem';
import { createEnvironment, type IEnvironment } from '../graphics/environments';
import { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { PlayerSystem } from '../systems/PlayerSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { WaveDirector } from '../systems/WaveDirector';
import { PickupSystem } from '../systems/PickupSystem';
import { InteractiveEnvironmentSystem } from '../systems/InteractiveEnvironmentSystem';
import { UIManager } from '../ui/UIManager';
import { RunController, type RunControllerHost } from './RunController';
import { InputRouter, type InputRouterHost } from './InputRouter';
import { DebugAPI, type DebugAPIHost } from './DebugAPI';
import { SettingsApplier } from '../ui/SettingsApplier';
import { globalEvents } from './EventBus';
import { STAGES } from '../data/stages';
import type { LoadoutId, RunConfig, StageId } from './types';

export class Game implements RunControllerHost, InputRouterHost, DebugAPIHost {
  public readonly sceneManager: SceneManager;
  public readonly gameLoop: GameLoop;
  public readonly runState: RunState;
  public readonly saveManager: SaveManager;
  public readonly inputManager: InputManager;
  public readonly audioEngine: AudioEngine;
  public readonly grid: SpatialHashGrid;
  public readonly particles: ParticleSystem;
  public environment: IEnvironment;
  public readonly playerMesh: KyleReeseMesh;
  public readonly endoBatch: EndoskeletonBatch;

  public readonly playerSystem: PlayerSystem;
  public readonly weaponSystem: WeaponSystem;
  public readonly enemySystem: EnemySystem;
  public readonly waveDirector: WaveDirector;
  public readonly pickupSystem: PickupSystem;
  public readonly interactiveEnv: InteractiveEnvironmentSystem;
  public readonly uiManager: UIManager;
  public readonly runController: RunController;
  public readonly inputRouter: InputRouter;
  public readonly debugAPI?: DebugAPI;

  private prevPlayerPos = { x: 0, z: 0 };

  constructor(appContainer: HTMLElement) {
    // 1. Core State & Audio
    this.runState = new RunState();
    this.saveManager = new SaveManager();
    this.inputManager = new InputManager(this.saveManager);
    this.audioEngine = new AudioEngine();
    this.audioEngine.gamepadManager = this.inputManager.gamepadManager;
    this.grid = new SpatialHashGrid(4.0);

    const settings = this.saveManager.getData().settings;

    // 2. 3D Graphics & Scene
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvas-container';
    appContainer.appendChild(canvasContainer);

    this.sceneManager = new SceneManager(canvasContainer);
    this.particles = new ParticleSystem();
    this.environment = createEnvironment('la_2029_wasteland');
    this.playerMesh = new KyleReeseMesh();
    this.endoBatch = new EndoskeletonBatch(650);
    this.sceneManager.scene.add(this.environment.group, this.playerMesh.group, this.endoBatch.group, this.particles.group);

    // 3. Gameplay Systems
    this.playerSystem = new PlayerSystem(this.runState, this.playerMesh, this.particles);
    this.weaponSystem = new WeaponSystem(this.runState, this.grid, this.audioEngine, this.particles, this.playerMesh);
    this.enemySystem = new EnemySystem(this.runState, this.grid, this.audioEngine, this.particles, this.endoBatch);
    this.waveDirector = new WaveDirector(this.runState, this.enemySystem);
    this.pickupSystem = new PickupSystem(this.runState, this.audioEngine, this.particles);
    this.interactiveEnv = new InteractiveEnvironmentSystem(this.runState, this.grid, this.sceneManager.scene, this.audioEngine, this.particles, this.pickupSystem, this.enemySystem);
    this.sceneManager.scene.add(this.playerSystem.group, this.weaponSystem.group, this.enemySystem.group, this.pickupSystem.group);

    // 4. UI Layer & CRT Overlay
    const crtOverlay = document.createElement('div');
    crtOverlay.className = 'crt-overlay';
    appContainer.appendChild(crtOverlay);

    this.uiManager = new UIManager(
      appContainer,
      this.saveManager,
      this.inputManager,
      this.audioEngine,
      (config) => this.startRun(config),
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
    SettingsApplier.apply(settings, this.audioEngine);
    globalEvents.emit('settings:updated', settings);
    this.gameLoop.start();
  }

  public onRunStarted(): void {
    this.prevPlayerPos.x = this.runState.playerPos.x;
    this.prevPlayerPos.z = this.runState.playerPos.z;
  }

  public get activeBoss(): { name: string; hp: number; maxHp: number } | null {
    return this.runController.activeBoss;
  }

  public setStage(stageId: StageId): void {
    this.sceneManager.scene.remove(this.environment.group);
    this.environment.dispose();
    this.environment = createEnvironment(stageId);
    this.sceneManager.scene.add(this.environment.group);
    if (STAGES[stageId]) this.sceneManager.applyStage(STAGES[stageId]);
  }

  public startRun(configOrLoadout: RunConfig | LoadoutId = 'reese_2029', customSeed?: number, stageId: StageId = 'la_2029_wasteland', isDaily = false, dailyDateKey = ''): void {
    const config: RunConfig = typeof configOrLoadout === 'string' ? { loadoutId: configOrLoadout, seed: customSeed, stageId, daily: (isDaily || dailyDateKey) ? { dateKey: dailyDateKey } : undefined } : configOrLoadout;
    this.setStage(config.stageId ?? 'la_2029_wasteland');
    this.runController.startRunWith(config);
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
    this.enemySystem.update(dt, this.runState.timeSeconds, this.environment.obstacleColliders, this.environment);
    this.waveDirector.update(dt);
    this.pickupSystem.update(dt);
    this.particles.update(dt);
    this.environment.update(this.runState.playerPos.x, this.runState.playerPos.z, dt);
    this.interactiveEnv.update(dt, this.environment);
    this.environment.obstacleColliders.push(...this.interactiveEnv.getCarColliders());

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
    } else {
      const p = this.runState.mode === 'title' ? { x: 0, z: 0 } : this.runState.playerPos;
      this.sceneManager.updateCamera(p.x, p.z, dt);
    }
    this.sceneManager.render(dt, this.runState.timeSeconds);
  }

  public dispose(): void {
    this.gameLoop.stop(); this.runController.dispose(); this.debugAPI?.dispose();
    this.pickupSystem.dispose(); this.interactiveEnv.dispose(); this.environment.dispose();
  }
}
