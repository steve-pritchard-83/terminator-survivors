import type { RunState } from '../state/RunState';
import type { EnemySystem } from './EnemySystem';
import {
  BOSS_FIGHT_SPAWN,
  BOSS_SPAWN,
  EMPLACEMENT_SPAWN_MAX_DIST,
  EMPLACEMENT_SPAWN_MIN_DIST,
  LEASH_EXEMPT_ARCHETYPES,
  PACK_SPAWN,
  RUN_DURATION_MINUTES,
  threatMultipliers,
  WAVE_TIMELINE
} from '../data/waves';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import type { EnemyArchetypeId } from '../core/types';
import { ELITE_AFFIXES, ENEMY_CONFIGS, type EliteAffix } from '../data/enemies';

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

    const threat = threatMultipliers(this.runState.threat);
    const hpMultiplier = entry.hpMultiplier * threat.hp;
    const damageMultiplier = entry.damageMultiplier * threat.damage;
    const eliteChance = entry.eliteChance;

    // Normal wave spawns, thinned out while a boss is alive so the fight stays readable
    const bossAlive = this.enemySystem.activeEnemies.some((e) => e.isBoss);
    const spawnInterval = entry.spawnInterval * (bossAlive ? BOSS_FIGHT_SPAWN.intervalMultiplier : 1);
    const enemyCap = Math.floor(entry.minEnemies * (bossAlive ? BOSS_FIGHT_SPAWN.enemyCapMultiplier : 1));
    this.spawnTimer += dt;
    if (this.spawnTimer >= spawnInterval && this.enemySystem.activeEnemies.length < enemyCap) {
      this.spawnTimer = 0;
      this.spawnPerimeterEnemy(entry.pool, hpMultiplier, damageMultiplier, eliteChance, enemyCap - this.enemySystem.activeEnemies.length);
    }
  }

  public spawnBoss(archetype: EnemyArchetypeId, bannerText?: string): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    const angle = globalRNG.range(0, Math.PI * 2);
    const dist = BOSS_SPAWN.distance;
    const bx = px + Math.cos(angle) * dist;
    const bz = pz + Math.sin(angle) * dist;

    const threat = threatMultipliers(this.runState.threat);
    const boss = this.enemySystem.spawnEnemy(archetype, bx, bz, BOSS_SPAWN.hpMultiplier * threat.hp, BOSS_SPAWN.damageMultiplier * threat.damage);
    globalEvents.emit('boss:spawned', {
      archetype,
      name: bannerText ?? (ENEMY_CONFIGS[archetype]?.name ?? archetype).toUpperCase(),
      maxHp: boss?.maxHp ?? 1000
    });
  }

  private spawnPerimeterEnemy(
    pool: Array<{ archetype: EnemyArchetypeId; weight: number }>,
    hpMult: number,
    dmgMult: number,
    eliteChance = 0,
    room = 1
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

    // Fodder comes as a pack (one of them may be an elite); heavies and emplacements come alone
    const packMinutes = Math.max(0, this.runState.timeSeconds - PACK_SPAWN.startSeconds) / 60;
    const packMax = PACK_SPAWN.max[chosenArchetype];
    const packSize = packMax && packMinutes > 0
      ? Math.min(packMax, 1 + Math.floor(packMinutes * PACK_SPAWN.perMinute), Math.max(1, room))
      : 1;
    for (let i = 0; i < packSize; i++) {
      const isElite = eliteChance > 0 && globalRNG.chance(eliteChance / packSize);
      const affix = isElite ? (globalRNG.pick(Object.keys(ELITE_AFFIXES) as EliteAffix[])) : undefined;
      const ox = i === 0 ? 0 : globalRNG.range(-PACK_SPAWN.spread, PACK_SPAWN.spread);
      const oz = i === 0 ? 0 : globalRNG.range(-PACK_SPAWN.spread, PACK_SPAWN.spread);
      this.enemySystem.spawnEnemy(chosenArchetype, sx + ox, sz + oz, hpMult, dmgMult, affix);
    }
  }
}
