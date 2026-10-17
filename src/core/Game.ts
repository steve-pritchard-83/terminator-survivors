import * as THREE from 'three';
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
import { globalEvents } from './EventBus';
import type { EnemyArchetypeId, GameDebugAPI, LoadoutId } from './types';

export class Game {
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

  private activeBoss: { name: string; hp: number; maxHp: number } | null = null;
  private isPaused = false;

  constructor(appContainer: HTMLElement) {
    // 1. Core State & Audio
    this.runState = new RunState();
    this.saveManager = new SaveManager();
    this.inputManager = new InputManager();
    this.audioEngine = new AudioEngine();
    this.grid = new SpatialHashGrid(4.0);

    // Apply saved volume settings
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
    this.playerSystem = new PlayerSystem(this.runState, this.playerMesh);
    this.weaponSystem = new WeaponSystem(
      this.runState,
      this.grid,
      this.audioEngine,
      this.particles,
      this.playerMesh
    );
    this.enemySystem = new EnemySystem(
      this.runState,
      this.grid,
      this.audioEngine,
      this.particles,
      this.endoBatch
    );
    this.waveDirector = new WaveDirector(this.runState, this.enemySystem);
    this.pickupSystem = new PickupSystem(this.runState, this.grid, this.audioEngine);

    this.sceneManager.scene.add(
      this.weaponSystem.group,
      this.enemySystem.group,
      this.pickupSystem.group
    );

    // 4. UI Layer & CRT Overlay
    const crtOverlay = document.createElement('div');
    crtOverlay.className = 'crt-overlay';
    appContainer.appendChild(crtOverlay);

    this.uiManager = new UIManager(
      appContainer,
      this.saveManager,
      this.inputManager,
      (loadoutId) => this.startRun(loadoutId)
    );

    // 5. Game Loop
    this.gameLoop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (alpha) => this.render(alpha)
    );

    // 6. Hook up Events
    this.setupEvents();

    // 7. Setup Debug Interface
    this.setupDebugAPI();

    // Start in Title Mode (camera flyover)
    this.gameLoop.start();
  }

  private setupEvents(): void {
    this.inputManager.onDashCallback = () => {
      if (!this.isPaused && this.runState.mode === 'playing') {
        this.inputManager.consumeDash();
        if (this.runState.triggerDash()) {
          this.audioEngine.playCombatDive();
        }
      }
    };

    globalEvents.on('player:damaged', () => {
      this.sceneManager.postProcessing.triggerDamageFlash();
      if (this.runState.hp <= 0) {
        if (this.runState.revivalsLeft > 0) {
          this.runState.revivalsLeft--;
          this.runState.hp = Math.round(this.runState.maxHp * 0.5);
          this.sceneManager.postProcessing.triggerEmpGlitch();
          this.audioEngine.playEmpBlast();
        } else {
          this.endRun(false);
        }
      }
    });

    globalEvents.on('boss:spawned', ({ name, maxHp }) => {
      this.activeBoss = { name, hp: maxHp, maxHp };
    });

    globalEvents.on('levelup:triggered', ({ level, choices }) => {
      this.isPaused = true;
      this.runState.mode = 'levelup';
      this.uiManager.levelUpModal.show(level, choices, (choice) => {
        this.runState.applyUpgrade(choice);
        this.isPaused = false;
        this.runState.mode = 'playing';
      });
    });

    globalEvents.on('vault:opened', ({ upgradesAwarded, evolvedWeapon, alloyBonus }) => {
      this.isPaused = true;
      this.runState.mode = 'vault';
      this.uiManager.vaultModal.show(upgradesAwarded, evolvedWeapon, alloyBonus, () => {
        this.isPaused = false;
        this.runState.mode = 'playing';
      });
    });

    globalEvents.on('enemy:killed', ({ enemy }) => {
      if (enemy.isBoss && this.activeBoss) {
        this.activeBoss = null;
        if (enemy.archetype === 'skynet_tde_core') {
          this.endRun(true);
        }
      }
    });
  }

  public startRun(loadoutId: LoadoutId): void {
    this.runState.initRun(loadoutId, this.saveManager.getData().upgrades);
    this.weaponSystem.clear();
    this.enemySystem.clear();
    this.pickupSystem.clear();
    this.particles.clear();
    this.waveDirector.reset();
    this.activeBoss = null;
    this.isPaused = false;

    this.uiManager.titleScreen.hide();
    this.uiManager.hudView.show();
    this.audioEngine.init();
    this.audioEngine.startMusic();
  }

  public endRun(victory: boolean): void {
    this.runState.mode = victory ? 'victory' : 'gameover';
    this.isPaused = true;
    this.audioEngine.stopMusic();

    this.saveManager.addRunResults(
      this.runState.kills,
      this.runState.timeSeconds,
      this.runState.alloyScrapEarned,
      victory
    );

    this.uiManager.hudView.hide();
    this.uiManager.endRunModal.show(
      victory,
      this.runState.timeSeconds,
      this.runState.kills,
      this.runState.level,
      this.runState.alloyScrapEarned,
      () => {
        this.runState.mode = 'title';
        this.uiManager.titleScreen.show();
        this.isPaused = false;
      }
    );
  }

  private fixedUpdate(dt: number): void {
    if (this.isPaused || this.runState.mode !== 'playing') {
      // Idle rotation in title screen
      if (this.runState.mode === 'title') {
        this.environment.update(0, 0);
        this.sceneManager.updateCamera(0, 0, dt);
      }
      return;
    }

    // Input & Dash
    if (this.inputManager.consumeDash()) {
      const dashed = this.runState.triggerDash();
      if (dashed) {
        this.audioEngine.playCombatDive();
      }
    }

    const move = this.inputManager.getMovement();
    const aim = this.inputManager.getAimAngle();

    // 1. Player Update
    this.playerSystem.update(dt, move, aim, this.environment.obstacleColliders);

    // 2. Rebuild Spatial Hash Grid
    this.grid.clear();
    for (const enemy of this.enemySystem.activeEnemies) {
      this.grid.insert(enemy);
    }
    for (const pickup of this.pickupSystem.pickups) {
      this.grid.insert(pickup);
    }

    // 3. Systems Update
    this.weaponSystem.update(dt, this.enemySystem.activeEnemies);
    this.enemySystem.update(dt, this.runState.timeSeconds);
    this.waveDirector.update(dt);
    this.pickupSystem.update(dt);
    this.particles.update(dt);
    this.environment.update(this.runState.playerPos.x, this.runState.playerPos.z);

    // Camera follow
    this.sceneManager.updateCamera(this.runState.playerPos.x, this.runState.playerPos.z, dt);

    // Update active boss HP telemetry
    if (this.activeBoss) {
      const boss = this.enemySystem.activeEnemies.find((e) => e.isBoss);
      if (boss) {
        this.activeBoss.hp = Math.max(0, boss.hp);
      }
    }

    // Update HUD
    this.uiManager.hudView.update(this.runState, this.activeBoss);

    // Quality Governor
    this.sceneManager.adjustQuality(this.gameLoop.fps);
  }

  private render(alpha: number): void {
    this.sceneManager.render(GameLoop.FIXED_DT, this.runState.timeSeconds);
  }

  private setupDebugAPI(): void {
    const debugApi: GameDebugAPI = {
      getState: () => ({
        mode: this.runState.mode,
        fps: this.gameLoop.fps,
        timeSeconds: this.runState.timeSeconds,
        level: this.runState.level,
        xp: this.runState.xp,
        xpToNext: this.runState.xpToNext,
        hp: this.runState.hp,
        maxHp: this.runState.maxHp,
        kills: this.runState.kills,
        alloyScrap: this.runState.alloyScrapEarned,
        activeEnemies: this.enemySystem.activeEnemies.length,
        playerPos: { ...this.runState.playerPos },
        isDashing: this.runState.isDashing,
        dashCooldown: this.runState.dashCooldownTimer,
        weapons: Array.from(this.runState.weapons.values()).map((w) => ({
          id: w.id,
          level: w.level,
          evolved: w.evolved
        })),
        passives: Array.from(this.runState.passives.entries()).map(([id, level]) => ({ id, level }))
      }),
      grantXp: (amount: number) => {
        const leveled = this.runState.addXp(amount);
        if (leveled) {
          const choices = this.runState.generateUpgradeChoices();
          globalEvents.emit('levelup:triggered', { level: this.runState.level, choices });
        }
      },
      spawnBoss: (archetype: EnemyArchetypeId) => {
        this.waveDirector.spawnBoss(archetype);
      },
      triggerVault: () => {
        this.pickupSystem.spawnBossVault(this.runState.playerPos.x, this.runState.playerPos.z);
      },
      fastForward: (seconds: number) => {
        this.runState.timeSeconds += seconds;
      },
      setGodMode: (enabled: boolean) => {
        this.runState.godMode = enabled;
      }
    };

    if (typeof window !== 'undefined') {
      window.__GAME_DEBUG__ = debugApi;
    }
  }
}
