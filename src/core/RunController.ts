import type { RunState } from '../state/RunState';
import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { UIManager } from '../ui/UIManager';
import type { SceneManager } from '../graphics/SceneManager';
import type { InputManager } from '../input/InputManager';
import type { WeaponSystem } from '../systems/WeaponSystem';
import type { EnemySystem } from '../systems/EnemySystem';
import type { PickupSystem } from '../systems/PickupSystem';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { WaveDirector } from '../systems/WaveDirector';
import type { InteractiveEnvironmentSystem } from '../systems/InteractiveEnvironmentSystem';
import type { GameLoop } from './GameLoop';
import type { LoadoutId, UpgradeChoice, WeaponId, ActiveEnemy } from './types';
import { globalEvents } from './EventBus';
import { globalRNG } from './RNG';

export interface RunControllerHost {
  readonly runState: RunState;
  readonly saveManager: SaveManager;
  readonly audioEngine: AudioEngine;
  readonly uiManager: UIManager;
  readonly sceneManager: SceneManager;
  readonly inputManager: InputManager;
  readonly weaponSystem: WeaponSystem;
  readonly enemySystem: EnemySystem;
  readonly pickupSystem: PickupSystem;
  readonly particles: ParticleSystem;
  readonly waveDirector: WaveDirector;
  readonly interactiveEnv?: InteractiveEnvironmentSystem;
  readonly gameLoop: GameLoop;
  onRunStarted?: () => void;
}

export class RunController {
  public activeBoss: { name: string; hp: number; maxHp: number } | null = null;
  private readonly unbinds: Array<() => void> = [];

  constructor(private readonly host: RunControllerHost) {
    this.setupEvents();
  }

  private setupEvents(): void {
    this.unbinds.push(
      globalEvents.on('levelup:triggered', ({ level, choices }) => {
        this.showLevelUpModal(level, choices);
      }),
      globalEvents.on('vault:opened', ({ upgradesAwarded, evolvedWeapon, alloyBonus }) => {
        this.handleVaultOpened(upgradesAwarded, evolvedWeapon, alloyBonus);
      }),
      globalEvents.on('boss:spawned', ({ name, maxHp }) => {
        this.handleBossSpawned(name, maxHp);
      }),
      globalEvents.on('enemy:killed', ({ enemy }) => {
        this.handleEnemyKilled(enemy);
      }),
      globalEvents.on('camera:shake', ({ trauma }) => {
        this.host.sceneManager.addScreenShake(trauma);
      }),
      globalEvents.on('player:damaged', () => {
        this.host.sceneManager.postProcessing.triggerDamageFlash();
        this.host.sceneManager.addScreenShake(0.42);
      }),
      globalEvents.on('enemy:damaged', ({ x, z, damage, isCrit, enemyId }) => {
        if (this.host.runState.mode !== 'playing') return;
        const screenPos = this.host.sceneManager.worldToScreen(x, 0.8, z);
        if (screenPos) {
          this.host.uiManager.hudView.damageNumbers.onEnemyDamaged(
            damage,
            isCrit,
            screenPos.x,
            screenPos.y,
            enemyId
          );
        }
        if (isCrit) {
          this.host.audioEngine.playCritCrunch();
          const enemy = this.host.enemySystem.activeEnemies.find((e) => e.id === enemyId);
          if (enemy?.isBoss) {
            this.host.gameLoop.hitStop(0.04);
          } else {
            this.host.gameLoop.hitStop(0.02);
          }
        }
      }),
      globalEvents.on('pickup:reward', ({ x, z, text, color }) => {
        if (this.host.runState.mode !== 'playing') return;
        const screenPos = this.host.sceneManager.worldToScreen(x, 0.8, z);
        if (screenPos) {
          this.host.uiManager.hudView.spawnFloatingText(text, color, screenPos.x, screenPos.y);
        }
      })
    );

    this.host.uiManager.hudView.onPauseClicked = () => {
      this.togglePause();
    };
  }

  public startRun(loadoutId: LoadoutId, customSeed?: number): void {
    const seed = (customSeed !== undefined ? customSeed : Date.now()) >>> 0;
    globalRNG.setSeed(seed);
    this.host.runState.initRun(loadoutId, this.host.saveManager.getData().upgrades, seed);
    this.host.runState.autoAimEnabled = this.host.saveManager.getData().settings.autoAim;

    this.host.weaponSystem.clear();
    this.host.enemySystem.clear();
    this.host.pickupSystem.clear();
    this.host.particles.clear();
    this.host.interactiveEnv?.clear();
    this.host.waveDirector.reset();
    this.activeBoss = null;
    this.host.inputManager.clearDashRequest();

    this.host.uiManager.titleScreen.hide();
    this.host.uiManager.hudView.damageNumbers.clear();
    this.host.uiManager.hudView.show();
    this.host.audioEngine.init();
    this.host.audioEngine.playRunStart();
    this.host.audioEngine.startMusic();

    this.host.onRunStarted?.();
  }

  public endRun(victory: boolean): void {
    if (this.host.runState.mode === 'gameover' || this.host.runState.mode === 'victory') return;
    this.host.runState.mode = victory ? 'victory' : 'gameover';
    this.host.audioEngine.stopMusic();
    this.host.audioEngine.playRunEnd(victory);

    this.host.saveManager.addRunResults(
      this.host.runState.kills,
      this.host.runState.timeSeconds,
      this.host.runState.alloyScrapEarned,
      victory,
      this.host.runState.bossesKilled
    );

    this.host.uiManager.levelUpModal.hide();
    this.host.uiManager.vaultModal.hide();
    this.host.uiManager.hudView.damageNumbers.clear();
    this.host.uiManager.hudView.hide();
    this.host.uiManager.endRunModal.show(
      victory,
      this.host.runState.timeSeconds,
      this.host.runState.kills,
      this.host.runState.level,
      this.host.runState.alloyScrapEarned,
      this.host.runState.seed,
      () => {
        this.host.audioEngine.playHudScanClose();
        this.host.runState.mode = 'title';
        this.host.uiManager.titleScreen.show();
      }
    );
  }

  public togglePause(): void {
    if (this.host.runState.mode === 'paused') {
      this.resumeFromPause();
    } else if (this.host.runState.mode === 'playing') {
      this.pauseGame();
    }
  }

  public pauseGame(): void {
    if (this.host.runState.mode !== 'playing') return;
    this.host.runState.mode = 'paused';
    this.host.audioEngine.playHudScanOpen();
    this.host.uiManager.pauseModal.show(
      () => this.resumeFromPause(),
      () => this.abortToTitle()
    );
  }

  public resumeFromPause(): void {
    if (this.host.runState.mode !== 'paused') return;
    this.host.uiManager.pauseModal.hide();
    this.host.audioEngine.playHudScanClose();
    this.host.inputManager.clearDashRequest();
    this.host.runState.mode = 'playing';
  }

  public abortToTitle(): void {
    this.host.uiManager.pauseModal.hide();
    this.host.audioEngine.stopMusic();
    this.host.uiManager.hudView.damageNumbers.clear();
    this.host.uiManager.hudView.hide();
    this.host.enemySystem.clear();
    this.host.pickupSystem.clear();
    this.host.weaponSystem.clear();
    this.host.particles.clear();
    this.activeBoss = null;
    if (this.host.runState.mode === 'playing') {
      this.host.runState.mode = 'paused';
    }
    this.host.runState.mode = 'title';
    this.host.uiManager.titleScreen.show();
  }

  public showLevelUpModal(level: number, choices: UpgradeChoice[]): void {
    this.host.runState.mode = 'levelup';
    this.host.audioEngine.playHudScanOpen();
    this.host.uiManager.levelUpModal.show(level, choices, (choice) => {
      this.host.audioEngine.playUpgradeApplied();
      this.host.runState.applyUpgrade(choice);
      this.host.inputManager.clearDashRequest();
      if (this.host.runState.pendingLevelUps > 0) {
        this.host.runState.pendingLevelUps--;
        this.host.audioEngine.playLevelUp();
        const nextChoices = this.host.runState.generateUpgradeChoices();
        this.showLevelUpModal(this.host.runState.level, nextChoices);
      } else {
        this.host.runState.mode = 'playing';
      }
    });
  }

  public handleVaultOpened(
    upgradesAwarded: number,
    evolvedWeapon?: WeaponId,
    alloyBonus = 0
  ): void {
    this.host.runState.mode = 'vault';
    this.host.sceneManager.addScreenShake(0.35);
    this.host.uiManager.vaultModal.show(upgradesAwarded, evolvedWeapon, alloyBonus, () => {
      this.host.audioEngine.playUpgradeApplied();
      this.host.inputManager.clearDashRequest();
      this.host.runState.mode = 'playing';
      if (!evolvedWeapon) {
        this.host.runState.pendingLevelUps += 3;
        if (this.host.runState.pendingLevelUps > 0) {
          this.host.runState.pendingLevelUps--;
          this.host.audioEngine.playLevelUp();
          const choices = this.host.runState.generateUpgradeChoices();
          this.showLevelUpModal(this.host.runState.level, choices);
        }
      }
    });
  }

  public handleBossSpawned(name: string, maxHp: number): void {
    this.activeBoss = { name, hp: maxHp, maxHp };
    this.host.audioEngine.playSearchlightAlert();
    this.host.sceneManager.addScreenShake(0.65);
    this.host.uiManager.hudView.triggerBossWarning(name);
  }

  public handleEnemyKilled(enemy: ActiveEnemy): void {
    if (enemy.isBoss) {
      this.host.runState.bossesKilled++;
      this.host.sceneManager.addScreenShake(0.75);
      this.host.gameLoop.hitStop(0.10);
      if (this.activeBoss) {
        this.activeBoss = null;
      }
      if (enemy.archetype === 'skynet_tde_core') {
        this.endRun(true);
      }
    } else if (enemy.state?.isElite) {
      this.host.gameLoop.hitStop(0.06);
    }
  }

  public update(_dt: number): void {
    if (this.host.runState.mode !== 'playing') {
      return;
    }

    if (this.activeBoss) {
      const boss = this.host.enemySystem.activeEnemies.find((e) => e.isBoss);
      if (boss) {
        this.activeBoss.hp = Math.max(0, boss.hp);
      }
    }

    this.host.uiManager.hudView.update(this.host.runState, this.activeBoss);

    const lethalStatus = this.host.runState.resolveLethalDamage();
    if (lethalStatus === 'revived') {
      this.host.sceneManager.postProcessing.triggerEmpGlitch();
      this.host.audioEngine.playEmpBlast();
      globalEvents.emit('player:revived', { remaining: this.host.runState.revivalsLeft });
    } else if (lethalStatus === 'dead') {
      this.host.audioEngine.playPlayerTerminated();
      globalEvents.emit('player:died');
      this.endRun(false);
      return;
    }

    if (this.host.runState.mode === 'playing' && this.host.runState.pendingLevelUps > 0) {
      this.host.runState.pendingLevelUps--;
      this.host.audioEngine.playLevelUp();
      const choices = this.host.runState.generateUpgradeChoices();
      globalEvents.emit('levelup:triggered', { level: this.host.runState.level, choices });
    }
  }

  public dispose(): void {
    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;
  }
}
