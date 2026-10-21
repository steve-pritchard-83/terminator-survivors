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
import type { IEnvironment } from '../graphics/environments';
import type { GameLoop } from './GameLoop';
import type { LoadoutId, RunConfig, UpgradeChoice, WeaponId, ActiveEnemy, RunHistoryRecord } from './types';
import { globalEvents } from './EventBus';
import { globalRNG } from './RNG';
import { AchievementTracker } from '../state/AchievementTracker';
import { DEFEAT_MOVIE_LEAD_IN_MS, FOOTSTEP_INTERVAL_SECONDS, HIT_STOP_GLOBAL_COOLDOWN } from '../data/balance';

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
  readonly environment?: IEnvironment;
  readonly gameLoop: GameLoop;
  onRunStarted?: () => void;
}

export class RunController {
  public activeBoss: { name: string; hp: number; maxHp: number } | null = null;
  public readonly achievementTracker: AchievementTracker;
  private readonly unbinds: Array<() => void> = [];
  private hitStopCooldownTimer = 0;
  private footstepTimer = 0;

  public triggerHitStop(seconds: number, force = false): void {
    if (!force && this.hitStopCooldownTimer > 0) return;
    this.hitStopCooldownTimer = HIT_STOP_GLOBAL_COOLDOWN;
    this.host.gameLoop.hitStop(seconds);
  }

  constructor(private readonly host: RunControllerHost) {
    this.achievementTracker = new AchievementTracker(this.host.saveManager, this.host.runState);
    this.setupEvents();
  }

  private setupEvents(): void {
    const onVisibility = () => {
      if (document.hidden && this.host.runState.mode === 'playing') {
        this.pauseGame();
      }
    };
    const onGamepadDisconnect = () => {
      if (this.host.runState.mode === 'playing') {
        this.pauseGame();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('gamepaddisconnected', onGamepadDisconnect);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    this.unbinds.push(
      () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('gamepaddisconnected', onGamepadDisconnect);
        }
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisibility);
        }
      },
      globalEvents.on('levelup:triggered', ({ level, choices }) => {
        this.showLevelUpModal(level, choices);
      }),
      globalEvents.on('vault:opened', ({ upgradesAwarded, evolvedWeapon, alloyBonus }) => {
        this.handleVaultOpened(upgradesAwarded, evolvedWeapon, alloyBonus);
      }),
      globalEvents.on('boss:spawned', ({ archetype, name, maxHp }) => {
        this.handleBossSpawned(name, maxHp, archetype);
      }),
      globalEvents.on('enemy:killed', ({ enemy }) => {
        this.handleEnemyKilled(enemy);
      }),
      globalEvents.on('camera:shake', ({ trauma }) => {
        this.host.sceneManager.addScreenShake(trauma);
      }),
      globalEvents.on('wave:minute', ({ minute }) => {
        // Start fetching the victory movie well before it is needed
        if (minute >= 8) this.host.uiManager.victoryVideo.prepare();
      }),
      globalEvents.on('player:damaged', () => {
        // The defeat movie is only fetched once the player is in real trouble
        const rs = this.host.runState;
        if (rs.hp > 0 && rs.hp / rs.maxHp < 0.5) this.host.uiManager.defeatVideo.prepare();
      }),
      globalEvents.on('achievement:unlocked', () => {
        this.host.audioEngine.playAchievement();
      }),
      globalEvents.on('ability:triggered', ({ loadoutId, abilityId, x, z }) => {
        this.handleAbilityTriggered(loadoutId, abilityId, x, z);
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
            this.triggerHitStop(0.04);
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

  public startRunWith(config: RunConfig): void {
    const loadoutId = config.loadoutId ?? this.host.saveManager.getData().selectedLoadout ?? 'reese_2029';
    const seed = config.seed;
    this.startRun(loadoutId, seed);
  }

  public startRun(
    loadoutId: LoadoutId,
    customSeed?: number
  ): void {
    const seed = (customSeed !== undefined ? customSeed : Date.now()) >>> 0;
    globalRNG.setSeed(seed);
    this.host.runState.initRun(
      loadoutId,
      this.host.saveManager.getData().upgrades,
      seed,
      this.host.saveManager.getUnlockedWeapons()
    );
    this.achievementTracker.setRunState(this.host.runState);
    this.host.runState.autoAimEnabled = this.host.saveManager.getData().settings.autoAim;

    this.host.weaponSystem.clear();
    this.host.enemySystem.clear();
    this.host.pickupSystem.clear();
    this.host.particles.clear();
    this.host.interactiveEnv?.reset();
    this.host.waveDirector.reset();
    this.activeBoss = null;

    this.host.uiManager.titleScreen.hide();
    this.host.uiManager.hudView.damageNumbers.clear();
    this.host.uiManager.hudView.show();
    this.host.audioEngine.init();
    this.host.audioEngine.playRunStart();
    this.host.audioEngine.startMusic();
    this.host.audioEngine.startAmbience();

    this.host.onRunStarted?.();
  }

  public endRun(victory: boolean, defeatReason?: string): void {
    if (this.host.runState.mode === 'gameover' || this.host.runState.mode === 'victory') return;
    this.host.runState.mode = victory ? 'victory' : 'gameover';
    this.host.audioEngine.stopMusic();
    this.host.audioEngine.stopAmbience();
    // The end-of-run movie has its own audio; the jingle only plays if the movie can't

    const finalScrap = this.host.runState.alloyScrapEarned;

    this.host.saveManager.addRunResults(
      this.host.runState.kills,
      this.host.runState.timeSeconds,
      finalScrap,
      victory,
      this.host.runState.bossesKilled
    );

    globalEvents.emit('run:completed', {
      victory,
      timeSeconds: this.host.runState.timeSeconds,
      kills: this.host.runState.kills,
      alloyScrap: finalScrap,
      loadoutId: this.host.runState.loadoutId
    });

    const damageByWeapon = typeof this.host.weaponSystem?.getDamageByWeapon === 'function'
      ? this.host.weaponSystem.getDamageByWeapon()
      : {};
    let topWeapon: { id: WeaponId; damage: number } | undefined = undefined;
    let maxDmg = 0;
    for (const [wId, dmg] of Object.entries(damageByWeapon)) {
      if (dmg > maxDmg) {
        maxDmg = dmg;
        topWeapon = { id: wId as WeaponId, damage: dmg };
      }
    }

    const killsByTypeRecord: Record<string, number> = {};
    if (this.host.runState.killsByType) {
      for (const [k, v] of this.host.runState.killsByType.entries()) {
        killsByTypeRecord[k] = v;
      }
    }

    const outcome: 'victory' | 'defeat' = victory ? 'victory' : 'defeat';

    const runRecord: RunHistoryRecord = {
      id: `run_${Date.now()}_${globalRNG.next().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
      durationSeconds: this.host.runState.timeSeconds,
      loadoutId: this.host.runState.loadoutId,
      outcome,
      levelReached: this.host.runState.level,
      kills: this.host.runState.kills,
      scrapEarned: finalScrap,
      topWeapon,
      weaponDamageBreakdown: damageByWeapon,
      killsByType: killsByTypeRecord,
      levelUpTimeline: this.host.runState.levelUpTimeline ? [...this.host.runState.levelUpTimeline] : []
    };

    if (typeof this.host.saveManager?.recordRunHistory === 'function') {
      this.host.saveManager.recordRunHistory(runRecord);
    }
    this.host.saveManager?.flush?.();

    this.host.uiManager.levelUpModal.hide();
    this.host.uiManager.vaultModal.hide();
    this.host.uiManager.hudView.damageNumbers.clear();
    this.host.uiManager.hudView.hide();
    const showSummary = (): void => {
      this.host.uiManager.endRunModal.show(
        victory,
        this.host.runState.timeSeconds,
        this.host.runState.kills,
        this.host.runState.level,
        finalScrap,
        this.host.runState.seed,
        () => {
          this.host.audioEngine.playHudScanClose();
          this.host.runState.mode = 'title';
          this.host.uiManager.titleScreen.show();
        },
        runRecord,
        defeatReason
      );
    };

    // Movie first (victory or defeat); if it cannot play, fall back to the jingle and go straight to the results.
    // Defeat gets a short lead-in so the death and the terminated sting are seen and heard first.
    const movie = victory ? this.host.uiManager.victoryVideo : this.host.uiManager.defeatVideo;
    movie.play((played) => {
      if (!played) this.host.audioEngine.playRunEnd(victory);
      showSummary();
    }, victory ? 0 : DEFEAT_MOVIE_LEAD_IN_MS);
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
    this.host.saveManager?.flush?.();
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
    this.host.runState.mode = 'playing';
  }

  public abortToTitle(): void {
    this.host.uiManager.pauseModal.hide();
    this.host.audioEngine.stopMusic();
    this.host.audioEngine.stopAmbience();
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
    this.host.uiManager.levelUpModal.show(
      level,
      choices,
      (choice) => {
        this.host.audioEngine.playUpgradeApplied();
        this.host.runState.recordLevelUp(choice.title);
        this.host.runState.applyUpgrade(choice);
        if (this.host.runState.pendingLevelUps > 0) {
          this.host.runState.pendingLevelUps--;
          this.host.audioEngine.playLevelUp();
          const nextChoices = this.host.runState.generateUpgradeChoices();
          this.showLevelUpModal(this.host.runState.level, nextChoices);
        } else {
          this.host.runState.mode = 'playing';
        }
      },
      {
        rerollsLeft: this.host.runState.rerollsLeft,
        skipsLeft: this.host.runState.skipsLeft,
        banishesLeft: this.host.runState.banishesLeft,
        onReroll: () => {
          if (this.host.runState.useReroll()) {
            this.host.audioEngine.playUiClick();
            const newChoices = this.host.runState.generateUpgradeChoices();
            this.showLevelUpModal(level, newChoices);
          }
        },
        onSkip: () => {
          if (this.host.runState.useSkip()) {
            this.host.audioEngine.playUiBuy();
            if (this.host.runState.pendingLevelUps > 0) {
              this.host.runState.pendingLevelUps--;
              this.host.audioEngine.playLevelUp();
              const nextChoices = this.host.runState.generateUpgradeChoices();
              this.showLevelUpModal(this.host.runState.level, nextChoices);
            } else {
              this.host.runState.mode = 'playing';
            }
          }
        },
        onBanish: (choice) => {
          if (this.host.runState.banishUpgrade(choice.id)) {
            this.host.audioEngine.playUiError();
            const newChoices = this.host.runState.generateUpgradeChoices();
            this.showLevelUpModal(level, newChoices);
          }
        }
      }
    );
  }

  public handleVaultOpened(
    upgradesAwarded: number,
    evolvedWeapon?: WeaponId,
    alloyBonus = 0
  ): void {
    this.host.runState.mode = 'vault';
    this.host.sceneManager.addScreenShake(0.35);
    if (evolvedWeapon) this.host.audioEngine.playEvolution();
    this.host.uiManager.vaultModal.show(upgradesAwarded, evolvedWeapon, alloyBonus, () => {
      this.host.audioEngine.playUpgradeApplied();
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

  public handleBossSpawned(name: string, maxHp: number, archetype = ''): void {
    this.activeBoss = { name, hp: maxHp, maxHp };
    this.host.audioEngine.playBossStinger(archetype);
    this.host.audioEngine.playSearchlightAlert();
    this.host.sceneManager.addScreenShake(0.65);
    this.host.uiManager.hudView.triggerBossWarning(name);
  }

  public handleEnemyKilled(enemy: ActiveEnemy): void {
    this.host.runState.recordKill(enemy.archetype);
    if (enemy.isBoss) {
      globalEvents.emit('boss:defeated', { archetype: enemy.archetype, x: enemy.x, z: enemy.z });
      this.host.runState.bossesKilled++;
      this.host.sceneManager.addScreenShake(0.75);
      this.triggerHitStop(0.10, true);
      if (this.activeBoss) {
        this.activeBoss = null;
      }
      if (enemy.archetype === 'skynet_tde_core') {
        this.endRun(true);
      }
    } else if (enemy.isElite || enemy.state?.isElite) {
      this.triggerHitStop(0.06, true);
    }
  }

  public handleAbilityTriggered(loadoutId: string, _abilityId: string, px: number, pz: number): void {
    if (loadoutId === 'reese_2029') {
      const angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      for (const ang of angles) {
        this.host.weaponSystem.spawnProjectile({
          weaponId: 'pipe_bomb',
          meshCategory: 'bomb',
          x: px,
          y: 0.5,
          z: pz,
          vx: Math.sin(ang) * 9,
          vy: 4.2,
          vz: Math.cos(ang) * 9,
          rotY: ang,
          damage: 160 * this.host.runState.computedStats.mightMultiplier,
          radius: 0.4,
          pierceLeft: 1,
          life: 0,
          maxLife: 1.2,
          isAreaOnExpire: true,
          areaRadius: 4.5,
          knockback: 18
        });
      }
      this.host.audioEngine.playLaunch('throw');
      this.host.sceneManager.addScreenShake(0.35);
    } else if (loadoutId === 'techcom_sapper') {
      for (const slot of this.host.runState.weapons.values()) {
        slot.cooldownTimer = 0;
      }
      this.host.weaponSystem.spawnEmpShockwave(px, pz, 14, true);
      this.host.audioEngine.playExplosion(1.4);
      this.host.sceneManager.addScreenShake(0.45);
      const nearby = this.host.enemySystem.activeEnemies.filter(
        (e) => Math.hypot(e.x - px, e.z - pz) <= 14
      );
      for (const e of nearby) {
        this.host.weaponSystem.applyDamageToTarget(
          e,
          250 * this.host.runState.computedStats.mightMultiplier,
          20,
          { x: e.x - px, z: e.z - pz },
          'm25_plasma'
        );
      }
    } else if (loadoutId === 'sarah_connor') {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const gx = px + Math.sin(ang) * 4.5;
        const gz = pz + Math.cos(ang) * 4.5;
        this.host.weaponSystem.spawnGroundZone(
          gx,
          gz,
          2.6,
          85 * this.host.runState.computedStats.mightMultiplier,
          6.0,
          6,
          'ithaca_37'
        );
      }
      this.host.audioEngine.playGlassBreak();
      this.host.audioEngine.playFireDeploy();
      this.host.sceneManager.addScreenShake(0.3);
    } else if (loadoutId === 'reprogrammed_t800') {
      this.host.runState.invulnerabilityTimer = 5.0;
      this.host.audioEngine.playServo();
      this.host.sceneManager.addScreenShake(0.5);
    } else if (loadoutId === 'reese_1984' || loadoutId === 'john_connor') {
      if (loadoutId === 'john_connor') this.host.audioEngine.playRadioClick();
      else this.host.audioEngine.playMagOut();
      this.host.sceneManager.addScreenShake(0.25);
    }
  }

  public update(dt: number): void {
    if (this.hitStopCooldownTimer > 0) {
      this.hitStopCooldownTimer = Math.max(0, this.hitStopCooldownTimer - dt);
    }

    if (this.host.runState.mode !== 'playing') {
      return;
    }

    if (this.host.runState.loadoutId === 'reprogrammed_t800' && this.host.runState.isAbilityActive) {
      const px = this.host.runState.playerPos.x;
      const pz = this.host.runState.playerPos.z;
      for (const e of this.host.enemySystem.activeEnemies) {
        if (Math.hypot(e.x - px, e.z - pz) < 1.6) {
          this.host.weaponSystem.applyDamageToTarget(
            e,
            200 * dt * this.host.runState.computedStats.mightMultiplier,
            15,
            { x: e.x - px, z: e.z - pz },
            'm25_plasma'
          );
        }
      }
    }

    if (this.activeBoss) {
      const boss = this.host.enemySystem.activeEnemies.find((e) => e.isBoss);
      if (boss) {
        this.activeBoss.hp = Math.max(0, boss.hp);
      }
    }

    this.host.uiManager.hudView.update(this.host.runState, this.activeBoss, this.host.gameLoop.fps);

    if (this.host.runState.mode === 'playing') {
      this.host.audioEngine.updateMusicIntensity(
        this.host.enemySystem.activeEnemies.length,
        Boolean(this.activeBoss),
        dt
      );
      this.host.audioEngine.updateAmbience(dt);
      this.footstepTimer -= dt;
      if (this.host.runState.isMoving && this.footstepTimer <= 0) {
        this.host.audioEngine.playFootstep();
        this.footstepTimer = FOOTSTEP_INTERVAL_SECONDS;
      }
    }

    const lethalStatus = this.host.runState.resolveLethalDamage();
    if (lethalStatus === 'revived') {
      this.host.sceneManager.postProcessing.triggerEmpGlitch();
      this.host.audioEngine.playEmpBlast();
      this.host.audioEngine.playRevive();
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
    this.achievementTracker.destroy();
    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;
  }
}
