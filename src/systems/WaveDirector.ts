import type { RunState } from '../state/RunState';
import type { EnemySystem } from './EnemySystem';
import {
  BOSS_FIGHT_SPAWN,
  EMPLACEMENT_SPAWN_MAX_DIST,
  EMPLACEMENT_SPAWN_MIN_DIST,
  HYDROBOT_FORMATION,
  LEASH_EXEMPT_ARCHETYPES,
  RUN_DURATION_MINUTES,
  WAVE_TIMELINE
} from '../data/waves';
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
    const minute = Math.min(RUN_DURATION_MINUTES, Math.floor(totalSec / 60));
    const entry = WAVE_TIMELINE[minute];

    // Check minute transition
    if (minute !== this.currentMinute) {
      this.currentMinute = minute;
      globalEvents.emit('wave:minute', { minute });

      const bossToSpawn = entry?.boss;
      const bossKey = `${minute}_${bossToSpawn}`;
      if (bossToSpawn && !this.spawnedBossesThisRun.has(bossKey)) {
        this.spawnedBossesThisRun.add(bossKey);
        this.spawnBoss(bossToSpawn, entry?.alertBanner);
      }
    }

    if (!entry) return;

    const hpMultiplier = entry.hpMultiplier;
    const damageMultiplier = entry.damageMultiplier;
    const eliteChance = entry.eliteChance;

    // Normal wave spawns, thinned out while a boss is alive so the fight stays readable
    const bossAlive = this.enemySystem.activeEnemies.some((e) => e.isBoss);
    const spawnInterval = entry.spawnInterval * (bossAlive ? BOSS_FIGHT_SPAWN.intervalMultiplier : 1);
    const enemyCap = Math.floor(entry.minEnemies * (bossAlive ? BOSS_FIGHT_SPAWN.enemyCapMultiplier : 1));
    this.spawnTimer += dt;
    if (this.spawnTimer >= spawnInterval && this.enemySystem.activeEnemies.length < enemyCap) {
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
    let angle = globalRNG.range(0, Math.PI * 2);
    let dist = globalRNG.range(22, 28);
    let sx = px + Math.cos(angle) * dist;
    let sz = pz + Math.sin(angle) * dist;

    if (LEASH_EXEMPT_ARCHETYPES.has(chosenArchetype)) {
      // Fixed emplacement placed ahead of the player's movement
      const heading = this.runState.isMoving ? this.runState.playerMoveAngle : this.runState.playerFacing;
      angle = heading + globalRNG.range(-0.6, 0.6);
      dist = globalRNG.range(EMPLACEMENT_SPAWN_MIN_DIST, EMPLACEMENT_SPAWN_MAX_DIST);
      sx = px + Math.sin(angle) * dist;
      sz = pz + Math.cos(angle) * dist;
    }

    if (chosenArchetype === 'hydrobot_swarm') {
      for (let i = 0; i < HYDROBOT_FORMATION.count; i++) {
        const ox = (globalRNG.next() - 0.5) * 2 * HYDROBOT_FORMATION.spread;
        const oz = (globalRNG.next() - 0.5) * 2 * HYDROBOT_FORMATION.spread;
        this.enemySystem.spawnEnemy(chosenArchetype, sx + ox, sz + oz, hpMult, dmgMult);
      }
      return;
    }

    const isElite = eliteChance > 0 && globalRNG.chance(eliteChance);
    const affix = isElite ? (globalRNG.pick(Object.keys(ELITE_AFFIXES) as EliteAffix[])) : undefined;

    this.enemySystem.spawnEnemy(chosenArchetype, sx, sz, hpMult, dmgMult, affix);
  }
}
