import type { RunState } from '../state/RunState';
import { XBOX_BUTTON } from '../input/GamepadManager';
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
import { dailyKey, dailySeed } from './daily';
import { AchievementTracker } from '../state/AchievementTracker';
import {
  DEFEAT_MOVIE_LEAD_IN_MS,
  FOOTSTEP_INTERVAL_SECONDS,
  HIT_STOP_GLOBAL_COOLDOWN,
  PLAYER_HIT_SHAKE
} from '../data/balance';
import { EVOLUTION_LEVEL } from '../data/weapons';

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

/** Seconds the result banner shows in the Quest app before the next run starts */
const VR_APP_REDEPLOY_SECONDS = 6;

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
      globalEvents.on('supply:drop', () => {
        this.host.audioEngine.playSearchlightAlert();
        this.host.uiManager.hudView.showTip('SUPPLY DROP: FOLLOW THE MARKER', 5);
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
        this.host.sceneManager.addScreenShake(PLAYER_HIT_SHAKE);
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
    this.host.uiManager.hudView.onToggleStereo3D = () => {
      const active = this.host.sceneManager.toggleStereo3D();
      this.host.uiManager.hudView.showTip(
        active ? '3D STEREO (SBS) ENABLED — SWITCH QUEST PANEL TO 3D SBS' : '2D STANDARD VIEW RESTORED',
        4
      );
      return active;
    };
    this.host.uiManager.hudView.onToggleVrSession = () => {
      this.toggleVrSession();
    };
    this.host.uiManager.hudView.onEvolutionReady = () => {
      this.showTipOnce('evolve', 'READY TO EVOLVE. OPEN A DATA VAULT.');
    };
  }

  /**
   * Opened as the Quest app (the APK starts at ?vr=1), the headset shows only the VR view: the flat title,
   * pause and results pages can never be seen. So the game enters VR as soon as it is ready, starts a run,
   * stays in VR between runs and pauses while the Quest's own menu is open.
   */
  public static readonly VR_APP = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vr') === '1';
  private vrAppRestartTimer: number | null = null;

  public startVrApp(): void {
    if (!RunController.VR_APP) return;
    const xrNav = (navigator as Navigator & { xr?: { requestSession?: (mode: string, opts?: object) => Promise<unknown> } }).xr;
    if (!xrNav?.requestSession) return;
    const renderer = this.host.sceneManager.renderer;
    void xrNav
      .requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })
      .then(async (raw) => {
        const session = raw as XRSession;
        await renderer.xr.setSession(session as never);
        session.addEventListener('visibilitychange', () => {
          // The Quest menu (or a system prompt) covers the game: hold the run until it closes
          if (session.visibilityState !== 'visible' && this.host.runState.mode === 'playing') {
            this.host.saveManager?.flush?.();
            this.host.runState.mode = 'paused';
          } else if (session.visibilityState === 'visible' && this.host.runState.mode === 'paused') {
            this.host.runState.mode = 'playing';
          }
        });
        if (this.host.runState.mode === 'title') this.startRunWith({});
      })
      .catch((err) => {
        // Refused without a user gesture: try again on the next trigger press or tap
        console.error('[vr-app] could not enter VR:', err);
        const retry = (): void => {
          window.removeEventListener('pointerdown', retry);
          window.removeEventListener('keydown', retry);
          this.startVrApp();
        };
        window.addEventListener('pointerdown', retry, { once: true });
        window.addEventListener('keydown', retry, { once: true });
      });
  }

  public toggleVrSession(): void {
    const renderer = this.host.sceneManager.renderer;
    const xrNav = (
      navigator as Navigator & {
        xr?: {
          isSessionSupported?: (m: string) => Promise<boolean>;
          requestSession?: (mode: string, opts?: object) => Promise<unknown>;
        };
      }
    ).xr;

    if (renderer.xr.isPresenting) {
      void renderer.xr.getSession()?.end();
      return;
    }

    if (xrNav?.requestSession) {
      void xrNav
        .requestSession('immersive-vr')
        .then((session) => {
          renderer.xr.setSession(session as never);
          this.host.uiManager.hudView.showTip('3D VR ACTIVE — USE THUMBSTICKS TO MOVE & AIM', 4);
        })
        .catch((err) => {
          this.host.uiManager.hudView.showTip(`VR ERROR: ${err?.message ?? 'OPEN IN QUEST BROWSER'}`, 5);
        });
    } else {
      // Android WebView in sideloaded 2D APK does not expose navigator.xr: launch Meta Quest Browser in WebXR mode
      this.host.uiManager.hudView.showTip('OPENING IN META QUEST BROWSER FOR 3D WEBXR...', 5);
      window.open('https://terminator-survivors.vercel.app/?vr=1', '_blank');
    }
  }

  public startRunWith(config: RunConfig): void {
    const loadoutId = config.loadoutId ?? this.host.saveManager.getData().selectedLoadout ?? 'reese_2029';
    if (config.daily) {
      // Same waves for everyone today, always at standard threat
      const key = dailyKey();
      this.startRun(loadoutId, dailySeed(key), 0);
      this.host.runState.daily = key;
      return;
    }
    const seed = config.seed;
    this.startRun(loadoutId, seed, config.threat ?? this.host.saveManager.getData().selectedThreat ?? 0);
  }

  public startRun(
    loadoutId: LoadoutId,
    customSeed?: number,
    threat = 0
  ): void {
    const seed = (customSeed !== undefined ? customSeed : Date.now()) >>> 0;
    globalRNG.setSeed(seed);
    this.host.runState.initRun(
      loadoutId,
      this.host.saveManager.getData().upgrades,
      seed,
      this.host.saveManager.getUnlockedWeapons()
    );
    this.host.runState.threat = threat;
    this.host.runState.daily = null;
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
    this.showTipOnce('move', 'MOVE TO DODGE. KYLE FIRES ON HIS OWN.');
    this.host.audioEngine.startAmbience();

    this.host.onRunStarted?.();

    if (
      typeof window !== 'undefined' &&
      (window.location.search.includes('vr=1') ||
        /OculusBrowser|Quest|Pacific|VR/i.test(window.navigator?.userAgent ?? '')) &&
      !this.host.sceneManager.renderer.xr.isPresenting
    ) {
      this.toggleVrSession();
    }
  }

  public endRun(victory: boolean, defeatReason?: string): void {
    if (this.host.runState.mode === 'gameover' || this.host.runState.mode === 'victory') return;
    if (this.host.sceneManager.renderer.xr.isPresenting && !RunController.VR_APP) {
      void this.host.sceneManager.renderer.xr.getSession()?.end();
    }
    this.host.runState.mode = victory ? 'victory' : 'gameover';
    this.host.audioEngine.stopMusic();
    this.host.audioEngine.stopAmbience();
    // The end-of-run movie has its own audio; the jingle only plays if the movie can't

    const finalScrap = this.host.runState.alloyScrapEarned;
    if (victory && !this.host.runState.daily) this.host.saveManager.recordThreatVictory(this.host.runState.threat);
    if (this.host.runState.daily) {
      this.host.saveManager.recordDaily(this.host.runState.daily, this.host.runState.timeSeconds, this.host.runState.kills, victory);
    }

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
    if (RunController.VR_APP && this.host.sceneManager.renderer.xr.isPresenting) {
      this.host.audioEngine.playRunEnd(victory);
      this.vrChoice = null;
      this.host.sceneManager.setXrPanel({
        title: victory ? 'MISSION ACCOMPLISHED' : 'TERMINATED',
        footer: `${this.host.runState.kills} KILLS · LV ${this.host.runState.level} · REDEPLOYING`
      });
      if (this.vrAppRestartTimer !== null) window.clearTimeout(this.vrAppRestartTimer);
      this.vrAppRestartTimer = window.setTimeout(() => {
        this.vrAppRestartTimer = null;
        this.host.enemySystem.clear();
        this.host.pickupSystem.clear();
        this.host.weaponSystem.clear();
        this.host.particles.clear();
        this.host.runState.mode = 'title';
        this.host.sceneManager.setXrPanel(null);
        this.startRunWith({});
      }, VR_APP_REDEPLOY_SECONDS * 1000);
      return;
    }
    const showSummary = (): void => {
      const lastConfig: RunConfig = this.host.runState.daily
        ? { daily: true }
        : { loadoutId: this.host.runState.loadoutId, threat: this.host.runState.threat };
      this.host.uiManager.endRunModal.show(
        victory,
        this.host.runState.timeSeconds,
        this.host.runState.kills,
        this.host.runState.level,
        finalScrap,
        this.host.runState.seed,
        () => {
          this.host.audioEngine.playHudScanClose();
          this.host.enemySystem.clear();
          this.host.pickupSystem.clear();
          this.host.weaponSystem.clear();
          this.host.particles.clear();
          this.host.runState.mode = 'title';
          this.host.uiManager.titleScreen.show();
        },
        runRecord,
        defeatReason,
        () => {
          this.host.audioEngine.playHudScanClose();
          this.host.runState.mode = 'title';
          this.startRunWith(lastConfig);
        }
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
    // The Quest app cannot show the flat pause menu: freeze the run with a banner in the headset instead
    if (RunController.VR_APP && this.host.sceneManager.renderer.xr.isPresenting) {
      this.host.saveManager?.flush?.();
      this.host.runState.mode = 'paused';
      this.host.audioEngine.playHudScanOpen();
      this.host.sceneManager.setXrPanel({ title: 'PAUSED', footer: 'PRESS Y TO RESUME' });
      console.info('[vr-app] paused');
      return;
    }
    if (this.host.sceneManager.renderer.xr.isPresenting) {
      void this.host.sceneManager.renderer.xr.getSession()?.end();
    }
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
    if (RunController.VR_APP) {
      this.host.sceneManager.setXrPanel(null);
      console.info('[vr-app] resumed');
    }
    if (
      typeof window !== 'undefined' &&
      (window.location.search.includes('vr=1') ||
        /OculusBrowser|Quest|Pacific|VR/i.test(window.navigator?.userAgent ?? '')) &&
      !this.host.sceneManager.renderer.xr.isPresenting
    ) {
      this.toggleVrSession();
    }
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

  /** One-time first-run tip, shown on the HUD and remembered in the save. */
  public showTipOnce(id: string, text: string): void {
    if (this.host.saveManager.hasSeenTip(id)) return;
    this.host.saveManager.markTipSeen(id);
    this.host.uiManager.hudView.showTip(text);
  }

  private vrChoice: { level: number; choices: UpgradeChoice[]; selected: number; stickHeld: boolean } | null = null;

  private drawVrChoice(): void {
    const v = this.vrChoice;
    if (!v) return;
    this.host.sceneManager.setXrPanel({
      title: `LEVEL ${v.level}`,
      selected: v.selected,
      cards: v.choices.map((c) => ({
        title: c.title,
        sub: c.subtitle,
        line: c.description.startsWith('★') ? c.description.split(' · ')[0] : c.description.split(' · ').slice(0, 2).join(' · '),
        hint: c.synergyHint && /EVOLUTION/.test(c.synergyHint) ? 'EVOLUTION' : undefined
      })),
      footer: 'STICK TO CHOOSE · TRIGGER TO TAKE'
    });
  }

  /** The VR level-up picker: either thumbstick moves between cards, a trigger or A/X takes the card. */
  public updateVrMenus(): void {
    const v = this.vrChoice;
    if (!v || this.host.runState.mode !== 'levelup') return;
    const gp = this.host.inputManager.gamepadManager;
    const x = gp.getStickX();
    if (Math.abs(x) < 0.35) {
      v.stickHeld = false;
    } else if (!v.stickHeld) {
      v.stickHeld = true;
      v.selected = (v.selected + (x > 0 ? 1 : -1) + v.choices.length) % v.choices.length;
      this.host.audioEngine.playUiClick();
      this.drawVrChoice();
    }
    if (gp.isButtonJustPressed(XBOX_BUTTON.A) || gp.isButtonJustPressed(XBOX_BUTTON.X)) {
      const pick = v.choices[v.selected];
      this.vrChoice = null;
      this.host.sceneManager.setXrPanel(null);
      this.host.audioEngine.playUpgradeApplied();
      this.host.runState.recordLevelUp(pick.title);
      this.host.runState.applyUpgrade(pick);
      console.info('[vr-app] took', pick.title);
      if (this.host.runState.pendingLevelUps > 0) {
        this.host.runState.pendingLevelUps--;
        this.showLevelUpModal(this.host.runState.level, this.host.runState.generateUpgradeChoices());
      } else {
        this.host.runState.mode = 'playing';
      }
    }
  }

  public showLevelUpModal(level: number, choices: UpgradeChoice[]): void {
    // In VR the flat cards cannot be seen: the choices go on the headset's centre panel instead
    if (this.host.sceneManager.renderer.xr.isPresenting && choices.length > 0) {
      this.host.runState.mode = 'levelup';
      this.host.audioEngine.playLevelUp();
      this.vrChoice = { level, choices, selected: 0, stickHeld: true };
      this.drawVrChoice();
      console.info('[vr-app] level-up', level, choices.map((c) => c.title).join(' | '));
      return;
    }
    this.host.runState.mode = 'levelup';
    const firstLevelUp = !this.host.saveManager.hasSeenTip('levelup');
    if (firstLevelUp) this.host.saveManager.markTipSeen('levelup');
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
        tip: firstLevelUp
          ? `LEVEL ${EVOLUTION_LEVEL} WEAPON + ITS PASSIVE = EVOLUTION AT A DATA VAULT`
          : undefined,
        onReroll: () => {
          if (this.host.runState.useReroll()) {
            this.host.audioEngine.playUiClick();
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
    if (this.host.sceneManager.renderer.xr.isPresenting) {
      if (evolvedWeapon) {
        this.host.audioEngine.playEvolution();
        this.host.sceneManager.setXrBanner(`WEAPON EVOLVED: ${evolvedWeapon.toUpperCase()}`, 4.0);
      } else {
        this.host.audioEngine.playUpgradeApplied();
        this.host.runState.pendingLevelUps += 3;
        if (this.host.runState.pendingLevelUps > 0) {
          this.host.runState.pendingLevelUps--;
          const choices = this.host.runState.generateUpgradeChoices();
          this.showLevelUpModal(this.host.runState.level, choices);
        }
      }
      return;
    }
    this.host.runState.mode = 'vault';
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
    }
    // Ordinary and elite kills never freeze the game: with packs they came so often that play felt choppy
  }

  /** Kyle's ability: four heavy pipe bombs thrown out in a cross. */
  public handleAbilityTriggered(_loadoutId: string, _abilityId: string, px: number, pz: number): void {
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
  }

  /** Arrows at the screen edge toward an off-screen boss and the nearest data vault or supply flare. */
  private updatePointers(): void {
    const hud = this.host.uiManager.hudView;
    const scene = this.host.sceneManager;
    const inset = 34;
    const boss = this.host.enemySystem.activeEnemies.find((e) => e.isBoss);
    hud.setPointer('boss', boss ? scene.getEdgePointer(boss.x, boss.z, inset) : null);
    const { x: px, z: pz } = this.host.runState.playerPos;
    let vault: { x: number; z: number } | null = null;
    let best = Infinity;
    for (const p of this.host.pickupSystem.pickups) {
      if (p.kind !== 'vault') continue;
      const d = (p.x - px) ** 2 + (p.z - pz) ** 2;
      if (d < best) {
        best = d;
        vault = p;
      }
    }
    const flare = this.host.interactiveEnv?.activeFlare;
    if (flare?.active) {
      const d = (flare.x - px) ** 2 + (flare.z - pz) ** 2;
      if (d < best) {
        vault = flare;
      }
    }
    hud.setPointer('vault', vault ? scene.getEdgePointer(vault.x, vault.z, inset) : null);
  }

  public update(dt: number): void {
    if (this.hitStopCooldownTimer > 0) {
      this.hitStopCooldownTimer = Math.max(0, this.hitStopCooldownTimer - dt);
    }

    if (this.host.runState.mode !== 'playing') {
      return;
    }


    if (this.activeBoss) {
      const boss = this.host.enemySystem.activeEnemies.find((e) => e.isBoss);
      if (boss) {
        this.activeBoss.hp = Math.max(0, boss.hp);
      }
    }

    this.host.uiManager.hudView.update(this.host.runState, this.activeBoss, this.host.gameLoop.fps);
    this.updatePointers();

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
      this.host.sceneManager.addScreenShake(0.45);
      this.host.audioEngine.playEmpBlast();
      this.host.audioEngine.playRevive();
      const px = this.host.runState.playerPos.x;
      const pz = this.host.runState.playerPos.z;
      this.host.weaponSystem.spawnEmpShockwave(px, pz, 8.5, true);
      // Knock back and stun nearby enemies so the player doesn't revive trapped inside a pack
      for (const enemy of this.host.enemySystem.activeEnemies) {
        const edx = enemy.x - px;
        const edz = enemy.z - pz;
        const dist = Math.hypot(edx, edz);
        if (dist < 8.5 && dist > 0.001) {
          const push = (enemy.isBoss ? 10 : 28) / Math.max(0.5, enemy.mass ?? 1);
          enemy.vx = (enemy.vx ?? 0) + (edx / dist) * push;
          enemy.vz = (enemy.vz ?? 0) + (edz / dist) * push;
          enemy.slowTimer = Math.max(enemy.slowTimer, 2.5);
        }
      }
      this.host.uiManager.hudView.showTip('SECOND WIND — DEFIBRILLATOR ENGAGED', 3.5);
      globalEvents.emit('pickup:reward', {
        x: px,
        z: pz,
        text: 'REVIVED! +50% HP',
        color: '#00ff88'
      });
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
