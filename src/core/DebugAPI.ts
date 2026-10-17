import type { RunState } from '../state/RunState';
import type { GameLoop } from './GameLoop';
import type { EnemySystem } from '../systems/EnemySystem';
import type { WaveDirector } from '../systems/WaveDirector';
import type { PickupSystem } from '../systems/PickupSystem';
import type { SceneManager } from '../graphics/SceneManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { RunController } from './RunController';
import { globalEvents } from './EventBus';
import { globalRNG } from './RNG';
import type { EnemyArchetypeId, GameDebugAPI, PerfTelemetry } from './types';

export interface DebugAPIHost {
  readonly runState: RunState;
  readonly gameLoop: GameLoop;
  readonly enemySystem: EnemySystem;
  readonly waveDirector: WaveDirector;
  readonly pickupSystem: PickupSystem;
  readonly sceneManager: SceneManager;
  readonly audioEngine: AudioEngine;
  readonly runController: RunController;
}

export class DebugAPI {
  public readonly api: GameDebugAPI;

  constructor(private readonly host: DebugAPIHost) {
    this.api = this.createAPI();
    if (typeof window !== 'undefined') {
      window.__GAME_DEBUG__ = this.api;
    }
  }

  private createAPI(): GameDebugAPI {
    return {
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
        isDashing: this.host.runState.isDashing,
        dashCooldown: this.host.runState.dashCooldownTimer,
        weapons: Array.from(this.host.runState.weapons.values()).map((w) => ({
          id: w.id,
          level: w.level,
          evolved: w.evolved
        })),
        passives: Array.from(this.host.runState.passives.entries()).map(([id, level]) => ({ id, level }))
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
      spawnSwarm: (archetype: EnemyArchetypeId, count: number) => {
        const px = this.host.runState.playerPos.x;
        const pz = this.host.runState.playerPos.z;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (globalRNG.next() - 0.5) * 0.2;
          const radius = 16 + (i % 6) * 2.5 + globalRNG.next() * 2;
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
      fastForward: (seconds: number) => {
        this.host.runState.timeSeconds += seconds;
      },
      setGodMode: (enabled: boolean) => {
        this.host.runState.godMode = enabled;
      },
      togglePause: () => this.host.runController.togglePause(),
      pauseGame: () => this.host.runController.pauseGame(),
      resumeGame: () => this.host.runController.resumeFromPause()
    };
  }

  public dispose(): void {
    if (typeof window !== 'undefined' && window.__GAME_DEBUG__ === this.api) {
      delete window.__GAME_DEBUG__;
    }
  }
}
