import { ACHIEVEMENTS } from '../data/achievements';
import { globalEvents } from '../core/EventBus';
import type { SaveManager } from './SaveManager';
import type { RunState } from './RunState';

export class AchievementTracker {
  private readonly saveManager: SaveManager;
  private runState: RunState | null = null;
  private unsubs: Array<() => void> = [];

  private runKills = 0;
  private activeBossArchetype: string | null = null;
  private bossDamageTaken = false;

  constructor(saveManager: SaveManager, runState?: RunState) {
    this.saveManager = saveManager;
    if (runState) {
      this.runState = runState;
    }
    this.bindEvents();
  }

  public setRunState(runState: RunState | null): void {
    this.runState = runState;
    this.resetRunCounters();
  }

  public resetRunCounters(): void {
    this.runKills = 0;
    this.activeBossArchetype = null;
    this.bossDamageTaken = false;
  }

  private bindEvents(): void {
    this.unsubs.push(
      globalEvents.on('enemy:killed', ({ enemy }) => {
        this.runKills++;
        this.saveManager.recordEnemyKill(enemy.archetype);
        const lifetimeKills = this.saveManager.getData().totalKills + this.runKills;

        this.tryUnlock('first_blood');
        if (lifetimeKills >= 500) this.tryUnlock('terminator_hunter');
        if (this.runKills >= 1000) this.tryUnlock('mass_dismantler');
      })
    );

    this.unsubs.push(
      globalEvents.on('wave:minute', ({ minute }) => {
        if (minute >= 5) this.tryUnlock('survivor_5m');
      })
    );

    this.unsubs.push(
      globalEvents.on('boss:spawned', ({ archetype }) => {
        this.activeBossArchetype = archetype;
        this.bossDamageTaken = false;
      })
    );

    this.unsubs.push(
      globalEvents.on('player:damaged', () => {
        if (this.activeBossArchetype) {
          this.bossDamageTaken = true;
        }
      })
    );

    this.unsubs.push(
      globalEvents.on('boss:defeated', ({ archetype }) => {
        if (archetype === 'hk_aerial_squadron_leader') this.tryUnlock('hk_aerial_slayer');
        else if (archetype === 'hk_tank_goliath') this.tryUnlock('hk_tank_slayer');
        else if (archetype === 't1000_prototype') this.tryUnlock('t1000_slayer');
        else if (archetype === 'skynet_tde_core') this.tryUnlock('skynet_core_slayer');

        if (!this.bossDamageTaken && this.activeBossArchetype) {
          this.tryUnlock('untouchable_boss');
        }
        this.activeBossArchetype = null;
      })
    );

    this.unsubs.push(
      globalEvents.on('weapon:evolved', ({ to }) => {
        this.saveManager.recordEvolutionDiscovered(to);
        this.tryUnlock('first_evolution');
      })
    );

    this.unsubs.push(
      globalEvents.on('levelup:triggered', ({ level }) => {
        if (level >= 20) this.tryUnlock('level_20');
      })
    );

    this.unsubs.push(
      globalEvents.on('run:completed', (data) => {
        if (data.alloyScrap >= 1000) {
          this.tryUnlock('scrap_collector_1k');
        }

        if (data.victory) {
          this.tryUnlock('judgment_survivor');
        }
      })
    );
  }

  public tryUnlock(id: string): boolean {
    if (this.saveManager.isAchievementUnlocked(id)) {
      return false;
    }
    const def = ACHIEVEMENTS[id];
    if (!def) {
      return false;
    }

    const unlocked = this.saveManager.unlockAchievement(id);
    if (unlocked) {
      globalEvents.emit('achievement:unlocked', {
        achievementId: id,
        title: def.title,
        description: def.description,
        rewardDescription: def.reward.description
      });
    }
    return unlocked;
  }

  public destroy(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
  }
}
