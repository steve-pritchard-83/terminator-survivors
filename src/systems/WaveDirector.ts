import type { RunState } from '../state/RunState';
import type { EnemySystem } from './EnemySystem';
import { WAVE_TIMELINE } from '../data/waves';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import type { EnemyArchetypeId } from '../core/types';

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
    const minute = Math.min(30, Math.floor(totalSec / 60));

    // Check minute transition
    if (minute !== this.currentMinute) {
      this.currentMinute = minute;
      globalEvents.emit('wave:minute', { minute });

      const entry = WAVE_TIMELINE[minute];
      if (entry?.boss && !this.spawnedBossesThisRun.has(`${minute}_${entry.boss}`)) {
        this.spawnedBossesThisRun.add(`${minute}_${entry.boss}`);
        this.spawnBoss(entry.boss, entry.alertBanner);
      }
    }

    const entry = WAVE_TIMELINE[Math.min(30, this.currentMinute)];
    if (!entry) return;

    // Normal wave spawns
    this.spawnTimer += dt;
    if (
      this.spawnTimer >= entry.spawnInterval &&
      this.enemySystem.activeEnemies.length < entry.minEnemies
    ) {
      this.spawnTimer = 0;
      this.spawnPerimeterEnemy(entry.pool, entry.hpMultiplier, entry.damageMultiplier);
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
      maxHp: boss.maxHp
    });
  }

  private spawnPerimeterEnemy(
    pool: Array<{ archetype: EnemyArchetypeId; weight: number }>,
    hpMult: number,
    dmgMult: number
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

    this.enemySystem.spawnEnemy(chosenArchetype, sx, sz, hpMult, dmgMult);
  }
}
