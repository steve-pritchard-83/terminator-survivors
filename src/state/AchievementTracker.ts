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
        if (lifetimeKills >= 100) this.tryUnlock('skynet_threat');
        if (lifetimeKills >= 500) this.tryUnlock('terminator_hunter');
        if (this.runKills >= 1000) this.tryUnlock('mass_dismantler');
        if (lifetimeKills >= 5000) this.tryUnlock('salvage_czar');
        if (lifetimeKills >= 10000) this.tryUnlock('genocide_protocol');
      })
    );

    this.unsubs.push(
      globalEvents.on('wave:minute', ({ minute }) => {
        if (minute >= 1) this.tryUnlock('survivor_1m');
        if (minute >= 3) this.tryUnlock('survivor_3m');
        if (minute >= 5) this.tryUnlock('survivor_5m');
        if (minute >= 8) this.tryUnlock('survivor_8m');

        if (this.runState?.isEndless) {
          if (minute >= 15) this.tryUnlock('endless_veteran');
          if (minute >= 20) this.tryUnlock('endless_master');
        }
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
        if (to === 'trench_sweeper') this.tryUnlock('trench_sweeper_evo');
        else if (to === 'thermite_buster') this.tryUnlock('thermite_buster_evo');
        else if (to === 'm95a1_plasma') this.tryUnlock('m95a1_plasma_evo');
        else if (to === 'emp_supernova') this.tryUnlock('emp_supernova_evo');
        else if (to === 'perimeter_ring') this.tryUnlock('perimeter_ring_evo');

        if (this.runState) {
          let evolvedCount = 0;
          for (const slot of this.runState.weapons.values()) {
            if (slot.evolved) evolvedCount++;
          }
          if (evolvedCount >= 3) {
            this.tryUnlock('arsenal_complete');
          }
        }
      })
    );

    this.unsubs.push(
      globalEvents.on('levelup:triggered', ({ level }) => {
        if (level >= 10) this.tryUnlock('level_10');
        if (level >= 20) this.tryUnlock('level_20');
        if (level >= 30) this.tryUnlock('level_30');
      })
    );

    this.unsubs.push(
      globalEvents.on('run:completed', (data) => {
        if (data.alloyScrap >= 1000) {
          this.tryUnlock('scrap_collector_1k');
        }

        if (this.saveManager.getData().alloyScrap >= 5000) {
          this.tryUnlock('scrap_bank_5k');
        }

        if (data.victory) {
          this.tryUnlock('judgment_survivor');

          if (data.stageId === 'la_2029_wasteland') this.tryUnlock('clear_wasteland');
          else if (data.stageId === 'cyberdyne_factory') this.tryUnlock('clear_cyberdyne');
          else if (data.stageId === 'tech_noir_1984') this.tryUnlock('clear_tech_noir');
          else if (data.stageId === 'skynet_central_tde') this.tryUnlock('clear_skynet_central');
          else if (data.stageId === 'century_city_bunker') this.tryUnlock('clear_bunker');

          if (data.threatCount >= 1) this.tryUnlock('threat_initiate');
          if (data.threatCount >= 3) this.tryUnlock('threat_veteran');
          if (data.threatCount >= 5) this.tryUnlock('threat_nightmare');

          if (this.runState?.isDailyOperation) {
            this.tryUnlock('daily_operative');
          }
        }

        const currentData = this.saveManager.getData();
        if (currentData.unlockedLoadouts.length >= 3 && currentData.victories >= 5) {
          this.tryUnlock('techcom_legend');
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
