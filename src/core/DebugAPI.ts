import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { GameLoop } from './GameLoop';
import type { EnemySystem } from '../systems/EnemySystem';
import type { WeaponSystem } from '../systems/WeaponSystem';
import type { WaveDirector } from '../systems/WaveDirector';
import type { PickupSystem } from '../systems/PickupSystem';
import type { SceneManager } from '../graphics/SceneManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { RunController } from './RunController';
import type { InputManager } from '../input/InputManager';
import type { SaveManager } from '../state/SaveManager';
import type { UIManager } from '../ui/UIManager';
import type { InteractiveEnvironmentSystem } from '../systems/InteractiveEnvironmentSystem';
import type { IEnvironment } from '../graphics/environments';
import { globalEvents } from './EventBus';
import { globalRNG } from './RNG';
import type {
  EnemyArchetypeId,
  GameDebugAPI,
  PerfTelemetry,
  RunConfig,
  RuntimeSettings,
  SceneCensus,
  SpatialEntity,
  LoadoutId,
  WeaponId,
  PassiveId
} from './types';

export interface DebugAPIHost {
  readonly runState: RunState;
  readonly gameLoop: GameLoop;
  readonly enemySystem: EnemySystem;
  readonly weaponSystem?: WeaponSystem;
  readonly waveDirector: WaveDirector;
  readonly pickupSystem: PickupSystem;
  readonly sceneManager: SceneManager;
  readonly audioEngine: AudioEngine;
  readonly runController: RunController;
  readonly inputManager?: InputManager;
  readonly saveManager?: SaveManager;
  readonly uiManager?: UIManager;
  readonly interactiveEnv?: InteractiveEnvironmentSystem;
  readonly environment?: IEnvironment;
  startRun?: (
    configOrLoadout?: RunConfig | LoadoutId,
    customSeed?: number
  ) => void;
}

export class DebugAPI {
  public readonly api?: GameDebugAPI;

  constructor(private readonly host: DebugAPIHost) {
    if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
      this.api = this.createAPI();
      if (typeof window !== 'undefined') {
        window.__GAME_DEBUG__ = this.api;
      }
    }
  }

  private createAPI(): GameDebugAPI {
    const api: GameDebugAPI = {
      getState: () => ({
        mode: this.host.runState.mode,
        fps: this.host.gameLoop.fps,
        timeSeconds: this.host.runState.timeSeconds,
        seed: this.host.runState.seed,
        level: this.host.runState.level,
        xp: this.host.runState.xp,
        xpToNext: this.host.runState.xpToNext,
        pendingLevelUps: this.host.runState.pendingLevelUps,
        hp: this.host.runState.hp,
        maxHp: this.host.runState.maxHp,
        kills: this.host.runState.kills,
        alloyScrap: this.host.runState.alloyScrapEarned,
        activeEnemies: this.host.enemySystem.activeEnemies.length,
        playerPos: { ...this.host.runState.playerPos },
        weapons: Array.from(this.host.runState.weapons.values()).map((w) => ({
          id: w.id,
          level: w.level,
          evolved: w.evolved
        })),
        passives: Array.from(this.host.runState.passives.entries()).map(([id, level]) => ({ id, level })),
        revivalsLeft: this.host.runState.revivalsLeft,
        invulnerabilityTimer: this.host.runState.invulnerabilityTimer,
        activeBoss: this.host.runController?.activeBoss ?? null
      }),
      grantXp: (amount: number) => {
        const levels = this.host.runState.addXp(amount);
        if (levels > 0) {
          this.host.runState.pendingLevelUps += levels;
          if (this.host.runState.mode === 'playing') {
            this.host.runState.pendingLevelUps--;
            this.host.audioEngine.playLevelUp();
            const choices = this.host.runState.generateUpgradeChoices();
            globalEvents.emit('levelup:triggered', { level: this.host.runState.level, choices });
          }
        }
      },
      spawnBoss: (archetype: EnemyArchetypeId) => {
        this.host.waveDirector.spawnBoss(archetype);
      },
      spawnSwarm: (archetype: EnemyArchetypeId, count: number, atX?: number, atZ?: number) => {
        let px = this.host.runState.playerPos.x;
        let pz = this.host.runState.playerPos.z;
        let spawnRadiusBase = 16;
        if (typeof atX === 'number' && typeof atZ === 'number') {
          px = atX;
          pz = atZ;
          spawnRadiusBase = 2.5;
        }
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (globalRNG.next() - 0.5) * 0.2;
          const radius = spawnRadiusBase + (i % 6) * 0.5 + globalRNG.next() * 1;
          const ex = px + Math.cos(angle) * radius;
          const ez = pz + Math.sin(angle) * radius;
          this.host.enemySystem.spawnEnemy(archetype, ex, ez);
        }
      },
      getPerf: (): PerfTelemetry => {
        const perfMemory =
          typeof performance !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
            ? Number((((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize) / (1024 * 1024)).toFixed(1))
            : undefined;
        return {
          fps: this.host.gameLoop.fps,
          frameTimeMs: this.host.gameLoop.frameTimeMs,
          drawCalls: this.host.sceneManager.renderer.info.render.calls,
          geometries: this.host.sceneManager.renderer.info.memory.geometries,
          textures: this.host.sceneManager.renderer.info.memory.textures,
          heapMB: perfMemory
        };
      },
      triggerVault: () => {
        this.host.pickupSystem.spawnBossVault(this.host.runState.playerPos.x, this.host.runState.playerPos.z);
      },
      spawnCrate: (x?: number, z?: number) => {
        this.host.pickupSystem.spawnSupplyCrate(x ?? this.host.runState.playerPos.x, z ?? this.host.runState.playerPos.z);
      },
      fastForward: (seconds: number) => {
        this.host.runState.timeSeconds += seconds;
      },
      setGodMode: (enabled: boolean) => {
        this.host.runState.godMode = enabled;
      },
      togglePause: () => this.host.runController.togglePause(),
      pauseGame: () => this.host.runController.pauseGame(),
      resumeGame: () => this.host.runController.resumeFromPause(),

      getSceneCensus: (): SceneCensus => {
        let visibleLights = 0;
        let totalMeshes = 0;
        const meshBreakdown: Record<string, number> = {};
        this.host.sceneManager.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            totalMeshes++;
            let path = obj.name || obj.type;
            let curr = obj.parent;
            while (curr && curr !== this.host.sceneManager.scene) {
              const label =
                curr.name ||
                (curr === this.host.enemySystem.group
                  ? 'enemySysGroup'
                  : curr === this.host.weaponSystem?.group
                    ? 'weaponSysGroup'
                    : curr === this.host.pickupSystem.group
                      ? 'pickupSysGroup'
                      : curr === this.host.interactiveEnv?.group
                        ? 'interactiveGroup'
                        : curr === this.host.environment?.group
                          ? 'envGroup'
                          : curr.type);
              path = label + ' > ' + path;
              curr = curr.parent;
            }
            meshBreakdown[path] = (meshBreakdown[path] ?? 0) + 1;
          }
          if (
            (obj as THREE.PointLight).isPointLight &&
            obj.visible &&
            (obj as THREE.PointLight).intensity > 0
          ) {
            visibleLights++;
          }
        });

        return {
          enemyGroupChildren: this.host.enemySystem.group.children.length,
          weaponGroupChildren: this.host.weaponSystem?.group.children.length ?? 0,
          pickupGroupChildren: this.host.pickupSystem.group.children.length,
          fuelDrums: this.host.interactiveEnv?.fuelDrums.length ?? 0,
          cars: this.host.interactiveEnv?.cars.length ?? 0,
          obstacleColliders: this.host.environment?.obstacleColliders.length ?? 0,
          visibleLights,
          totalMeshes,
          meshBreakdown
        };
      },

      getRuntimeSettings: (): RuntimeSettings => {
        const govState = this.host.sceneManager.getQualityGovernorState();
        return {
          shakeScale: this.host.sceneManager.shakeScale,
          flashScale: this.host.sceneManager.postProcessing?.getFlashIntensityScale?.() ?? 1.0,
          hitStopEnabled: this.host.gameLoop.hitStopEnabled,
          damageNumbersMode: this.host.uiManager?.hudView.damageNumbers.getMode() ?? 'all',
          qualityPreset: this.host.sceneManager.qualityPreset,
          pixelRatio: govState.pixelRatio,
          lightsEnabled: this.host.sceneManager.dynamicLighting.isEnabled(),
          keyBindings: this.host.inputManager?.getKeyBindings() ?? ({} as any),
          bodyClasses: typeof document !== 'undefined' ? Array.from(document.body.classList) : []
        };
      },

      getSave: () => JSON.parse(JSON.stringify(this.host.saveManager?.getData() ?? {})),

      damageEnemy: (target: number | 'boss', amount: number, crit?: boolean): boolean => {
        let targetEntity: SpatialEntity | undefined;
        if (target === 'boss') {
          targetEntity = this.host.enemySystem.activeEnemies.find((e) => e.isBoss);
        } else {
          targetEntity = this.host.enemySystem.activeEnemies.find((e) => e.id === target);
          if (!targetEntity) {
            targetEntity = this.host.interactiveEnv?.fuelDrums.find((d) => d.id === target);
          }
        }
        if (!targetEntity || !this.host.weaponSystem) return false;
        // Debug damage skips the boss fight-length cap so tests can end a fight at once
        this.host.weaponSystem.bossCapEnabled = false;
        try {
          return this.host.weaponSystem.applyDamageToTarget(targetEntity, amount, 0, undefined, undefined, crit);
        } finally {
          this.host.weaponSystem.bossCapEnabled = true;
        }
      },

      killAllEnemies: () => {
        const enemies = [...this.host.enemySystem.activeEnemies];
        for (const enemy of enemies) {
          api.damageEnemy(enemy.id, 1e9);
        }
        this.host.enemySystem.update(0, this.host.runState.timeSeconds);
      },

      setPlayerHp: (hp: number) => {
        this.host.runState.hp = hp;
      },

      startRunWith: (config: RunConfig) => {
        this.host.startRun?.(config);
      },

      grantWeapon: (id: WeaponId, level = 1) => {
        this.host.runState.weapons.set(id, { id, level, evolved: false, cooldownTimer: 0 });
      },

      grantPassive: (id: PassiveId, level = 1) => {
        this.host.runState.passives.set(id, level);
        this.host.runState.recalculateStats();
      }
    };

    return api;
  }

  public dispose(): void {
    if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
      if (typeof window !== 'undefined' && window.__GAME_DEBUG__ === this.api) {
        delete window.__GAME_DEBUG__;
      }
    }
  }
}
