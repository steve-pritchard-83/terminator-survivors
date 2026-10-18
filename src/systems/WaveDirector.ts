import type { RunState } from '../state/RunState';
import type { EnemySystem } from './EnemySystem';
import { RUN_DURATION_MINUTES, WAVE_TIMELINE } from '../data/waves';
import { STAGES } from '../data/stages';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import type { EnemyArchetypeId } from '../core/types';
import { ELITE_AFFIXES, type EliteAffix } from '../data/enemies';

export class WaveDirector {
  private readonly runState: RunState;
  private readonly enemySystem: EnemySystem;

  private spawnTimer = 0;
  private currentMinute = -1;
  private spawnedBossesThisRun = new Set<string>();

  constructor(runState: RunState, enemySystem: EnemySystem) {
    this.runState = runState;
    this.enemySystem = enemySystem;
  }

  public reset(): void {
    this.spawnTimer = 0;
    this.currentMinute = -1;
    this.spawnedBossesThisRun.clear();
  }

  public update(dt: number): void {
    if (this.runState.mode !== 'playing') return;

    this.runState.timeSeconds += dt;
    const totalSec = Math.floor(this.runState.timeSeconds);
    const maxMinutes = this.runState.activeThreats.has('judgment_hour') ? 8 : RUN_DURATION_MINUTES;
    const minute = this.runState.isEndless
      ? Math.floor(totalSec / 60)
      : Math.min(maxMinutes, Math.floor(totalSec / 60));
    const timeline = STAGES[this.runState.stageId]?.waveTimeline ?? WAVE_TIMELINE;

    // Tech Noir special: Infiltrator stalker spawns at 0:30 (30 seconds)
    if (this.runState.stageId === 'tech_noir_1984' && this.runState.timeSeconds >= 30 && !this.spawnedBossesThisRun.has('tech_noir_stalker_30s')) {
      this.spawnedBossesThisRun.add('tech_noir_stalker_30s');
      this.spawnBoss('infiltrator_csm101', 'WARNING // INFILTRATOR UNIT CSM-101 ENGAGED');
    }

    // Check minute transition
    if (minute !== this.currentMinute) {
      this.currentMinute = minute;
      globalEvents.emit('wave:minute', { minute });

      if (this.runState.isEndless && minute > RUN_DURATION_MINUTES) {
        const endlessBosses: EnemyArchetypeId[] = [
          'hk_aerial_squadron_leader',
          'hk_tank_goliath',
          't1000_prototype',
          'skynet_tde_core'
        ];
        const isBossMinute = (minute - RUN_DURATION_MINUTES) % 3 === 0;
        const bossIdx = Math.floor((minute - RUN_DURATION_MINUTES - 1) / 3) % endlessBosses.length;
        const bossArchetype = isBossMinute ? endlessBosses[bossIdx] : undefined;

        if (bossArchetype && !this.spawnedBossesThisRun.has(`${minute}_${bossArchetype}`)) {
          this.spawnedBossesThisRun.add(`${minute}_${bossArchetype}`);
          this.spawnBoss(bossArchetype, `ALERT // ENDLESS WAVE ${minute}: MACHINE SIEGE`);
        }
      } else {
        const isJudgment = this.runState.activeThreats.has('judgment_hour');
        const timelineMinute = isJudgment ? (minute === 8 ? 10 : Math.floor((minute / 8) * 10)) : minute;
        const entry = timeline[timelineMinute] ?? timeline[minute];
        const isJudgmentBossMinute = isJudgment && minute > 0 && minute % 2 === 0 && minute !== 8;
        const bossToSpawn = entry?.boss ?? (isJudgmentBossMinute ? 'hk_aerial_patrol' : undefined);
        const banner = entry?.alertBanner ?? (isJudgmentBossMinute ? `JUDGMENT SIEGE // MINUTE ${minute}` : undefined);

        if (bossToSpawn && !this.spawnedBossesThisRun.has(`${minute}_${bossToSpawn}`)) {
          this.spawnedBossesThisRun.add(`${minute}_${bossToSpawn}`);
          this.spawnBoss(bossToSpawn, banner);
        }
      }
    }

    const isJudgment = this.runState.activeThreats.has('judgment_hour');
    const timelineMin = isJudgment ? (this.currentMinute === 8 ? 10 : Math.floor((this.currentMinute / 8) * 10)) : Math.min(maxMinutes, this.currentMinute);
    const entry = timeline[timelineMin] ?? timeline[Math.min(maxMinutes, this.currentMinute)];
    if (!entry) return;

    let hpMultiplier = entry.hpMultiplier;
    let damageMultiplier = entry.damageMultiplier;
    let eliteChance = entry.eliteChance;

    if (this.runState.activeThreats.has('terminator_reinforcements')) {
      hpMultiplier *= 1.25;
    }
    if (this.runState.activeThreats.has('plasma_overcharge')) {
      damageMultiplier *= 1.20;
    }
    if (this.runState.activeThreats.has('hyperalloy_surge')) {
      eliteChance = Math.min(1.0, eliteChance + 0.30);
    }

    if (this.runState.isEndless && this.currentMinute > RUN_DURATION_MINUTES) {
      const endlessScale = Math.pow(1.15, this.currentMinute - RUN_DURATION_MINUTES);
      hpMultiplier *= endlessScale;
      damageMultiplier *= endlessScale;
    }

    // Normal wave spawns
    this.spawnTimer += dt;
    if (
      this.spawnTimer >= entry.spawnInterval &&
      this.enemySystem.activeEnemies.length < entry.minEnemies
    ) {
      this.spawnTimer = 0;
      this.spawnPerimeterEnemy(entry.pool, hpMultiplier, damageMultiplier, eliteChance);
    }
  }

  public spawnBoss(archetype: EnemyArchetypeId, bannerText?: string): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    const angle = globalRNG.range(0, Math.PI * 2);
    const dist = 24;
    const bx = px + Math.cos(angle) * dist;
    const bz = pz + Math.sin(angle) * dist;

    const boss = this.enemySystem.spawnEnemy(archetype, bx, bz, 1.25, 1.2);
    globalEvents.emit('boss:spawned', {
      archetype,
      name: bannerText ?? archetype.toUpperCase(),
      maxHp: boss?.maxHp ?? 1000
    });
  }

  private spawnPerimeterEnemy(
    pool: Array<{ archetype: EnemyArchetypeId; weight: number }>,
    hpMult: number,
    dmgMult: number,
    eliteChance = 0
  ): void {
    if (pool.length === 0) return;

    // Weighted random selection
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let rand = globalRNG.range(0, totalWeight);
    let chosenArchetype = pool[0].archetype;

    for (let i = 0; i < pool.length; i++) {
      if (rand < pool[i].weight) {
        chosenArchetype = pool[i].archetype;
        break;
      }
      rand -= pool[i].weight;
    }

    // Spawn on camera perimeter
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    const angle = globalRNG.range(0, Math.PI * 2);
    const dist = globalRNG.range(22, 28);
    const sx = px + Math.cos(angle) * dist;
    const sz = pz + Math.sin(angle) * dist;

    const isElite = eliteChance > 0 && globalRNG.chance(eliteChance);
    const affix = isElite ? (globalRNG.pick(Object.keys(ELITE_AFFIXES) as EliteAffix[])) : undefined;

    this.enemySystem.spawnEnemy(chosenArchetype, sx, sz, hpMult, dmgMult, affix);
  }
}
