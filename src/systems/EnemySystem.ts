import * as THREE from 'three';
import type { ActiveEnemy, EnemyArchetypeId, SpatialEntity, EliteAffix } from '../core/types';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ParticleSystem } from './ParticleSystem';
import type { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { ENEMY_CONFIGS, applyEliteAffix, handleEliteDeath } from '../data/enemies';
import { InstancedPool, type PoolableUser } from '../graphics/InstancedPool';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import { ENEMY_LEASH_DISTANCE, ENEMY_RELOCATE_MAX_DIST, ENEMY_RELOCATE_MIN_DIST } from '../data/waves';
import { type EnemyBehaviour, type EnemyContext, createEnemyBehaviourRegistry } from './enemies';
import type { IEnvironment } from '../graphics/environments';

export interface EnemyProjectile extends PoolableUser {
  poolIndex: number; x: number; y: number; z: number; vx: number; vz: number;
  rotY: number; damage: number; radius: number; life: number; maxLife: number;
}

export class EnemySystem {
  public readonly group = new THREE.Group();
  public readonly activeEnemies: ActiveEnemy[] = [];
  public readonly enemyProjectiles: EnemyProjectile[] = [];
  private nextEnemyId = 1;
  private readonly runState: RunState;
  private readonly grid: SpatialHashGrid;
  private readonly audio: AudioEngine;
  private readonly particles: ParticleSystem;
  private readonly endoBatch: EndoskeletonBatch;
  public readonly behaviours: Record<string, EnemyBehaviour>;
  private readonly context: EnemyContext;
  private readonly separationScratch: SpatialEntity[] = [];
  private readonly enemyPool: InstancedPool<EnemyProjectile>;
  private readonly enemyProjectilePool: EnemyProjectile[] = [];
  private readonly enemyPlasmaGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.75, 8);
  private readonly enemyPlasmaMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });

  constructor(
    runState: RunState,
    grid: SpatialHashGrid,
    audio: AudioEngine,
    particles: ParticleSystem,
    endoBatch: EndoskeletonBatch,
    behaviours = createEnemyBehaviourRegistry()
  ) {
    this.runState = runState; this.grid = grid; this.audio = audio;
    this.particles = particles; this.endoBatch = endoBatch; this.behaviours = behaviours;
    this.enemyPlasmaGeo.rotateX(Math.PI / 2);
    this.enemyPlasmaGeo.userData = { shared: true }; this.enemyPlasmaMat.userData = { shared: true };
    this.enemyPool = new InstancedPool<EnemyProjectile>(this.enemyPlasmaGeo, this.enemyPlasmaMat, 256, this.group);

    this.context = {
      runState: this.runState, audio: this.audio, particles: this.particles,
      spawnEnemyProjectile: (x, y, z, tx, tz, spd, dmg) => this.spawnEnemyProjectile(x, y, z, tx, tz, spd, dmg),
      spawnEnemy: (arch, x, z) => this.spawnEnemy(arch, x, z), applyPlayerDamage: (dmg) => this.applyPlayerDamage(dmg),
      emit: (evt, payload) => globalEvents.emit(evt, payload), rng: globalRNG, group: this.group, timeSeconds: 0
    };
  }

  public spawnEnemy(archetype: EnemyArchetypeId, x: number, z: number, hpMult = 1.0, dmgMult = 1.0, affix?: EliteAffix): ActiveEnemy {
    const cfg = ENEMY_CONFIGS[archetype];
    const enemy: ActiveEnemy = {
      id: this.nextEnemyId++, type: 'enemy', archetype, x, z, radius: cfg.radius,
      hp: Math.round(cfg.maxHp * hpMult), maxHp: Math.round(cfg.maxHp * hpMult), speed: cfg.speed,
      damage: Math.round(cfg.damage * dmgMult), mass: cfg.mass, vx: 0, vz: 0, isBoss: cfg.isBoss,
      isFlying: cfg.isFlying, xpValue: cfg.xpValue, hitFlashTimer: 0, slowTimer: 0, armorStripMultiplier: 1.0,
      attackCooldown: 0, chargeTimer: 0, searchlightAngle: 0, searchlightAlertTimer: 0, phaseState: 0, state: {}
    };
    if (affix && !cfg.isBoss) applyEliteAffix(enemy, affix);

    this.activeEnemies.push(enemy);
    this.behaviours[archetype]?.createVisual?.(enemy, this.context);
    return enemy;
  }

  private releaseEnemyProjectile(p: EnemyProjectile): void {
    this.enemyPool.release(p.poolIndex);
    this.enemyProjectilePool.push(p);
  }

  private spawnEnemyProjectile(x: number, y: number, z: number, targetX: number, targetZ: number, speed = 9.5, damage = 12): void {
    const dx = targetX - x; const dz = targetZ - z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;
    const vx = (dx / dist) * speed; const vz = (dz / dist) * speed;
    const angle = Math.atan2(dx, dz);

    const p = this.enemyProjectilePool.pop() ?? { poolIndex: 0, x, y, z, vx, vz, rotY: angle, damage, radius: 0.35, life: 0, maxLife: 2.2 };
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vz = vz; p.rotY = angle; p.damage = damage; p.radius = 0.35; p.life = 0; p.maxLife = 2.2;

    this.enemyPool.acquire(p);
    this.enemyPool.setTransform(p.poolIndex, x, y, z, angle);
    this.enemyProjectiles.push(p);
    this.audio.playPlasmaShot(false);
  }

  public update(dt: number, timeSeconds: number, obstacles: Array<{ x: number; z: number; radius: number }> = [], env?: IEnvironment): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    this.context.timeSeconds = timeSeconds;

    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (enemy.hp <= 0) { this.killEnemy(enemy, i); continue; }

      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= dt;
      if (enemy.slowTimer > 0) enemy.slowTimer -= dt; if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

      const effectiveSpeed = enemy.speed * (enemy.slowTimer > 0 ? 0.6 : 1.0) * (this.runState.activeThreats.has('relentless_pursuit') ? 1.15 : 1.0);
      let dx = px - enemy.x; let dz = pz - enemy.z; let dist = Math.hypot(dx, dz);

      if (!enemy.isBoss && dist > ENEMY_LEASH_DISTANCE) {
        this.relocateEnemy(enemy, px, pz);
        dx = px - enemy.x; dz = pz - enemy.z; dist = Math.hypot(dx, dz);
      }

      const neighbors = this.grid.queryRadius(enemy.x, enemy.z, enemy.radius * 1.6, this.separationScratch);
      let sepX = 0; let sepZ = 0;
      const maxNeighbors = Math.min(neighbors.length, 6);
      for (let n = 0; n < maxNeighbors; n++) {
        const other = neighbors[n];
        if (other.id === enemy.id || other.type !== 'enemy') continue;
        const odx = enemy.x - other.x;
        const odz = enemy.z - other.z;
        const odistSq = odx * odx + odz * odz;
        const minSep = enemy.radius + other.radius;
        if (odistSq > 0.0001 && odistSq < minSep * minSep) {
          const odist = Math.sqrt(odistSq);
          const push = (minSep - odist) / minSep;
          sepX += (odx / odist) * push * 3.2;
          sepZ += (odz / odist) * push * 3.2;
        }
      }

      let moveX = 0; let moveZ = 0;
      if (dist > 0.05) {
        const nx = dx / dist; const nz = dz / dist;
        moveX = (nx * effectiveSpeed + sepX) * dt;
        moveZ = (nz * effectiveSpeed + sepZ) * dt;
      }
      if (env?.bunkerTarget && env.damageBunker && Math.hypot(enemy.x - env.bunkerTarget.x, enemy.z - env.bunkerTarget.z) <= env.bunkerTarget.radius) {
        moveX = 0; moveZ = 0;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 0.55;
          env.damageBunker(enemy.damage);
          this.audio.playExplosion(0.2);
        }
      }
      if (enemy.vx || enemy.vz) {
        const evx = enemy.vx ?? 0;
        const evz = enemy.vz ?? 0;
        moveX += evx * dt;
        moveZ += evz * dt;

        const decay = Math.exp(-8 * dt);
        enemy.vx = evx * decay;
        enemy.vz = evz * decay;
      }

      let nextX = enemy.x + moveX;
      let nextZ = enemy.z + moveZ;

      if (!enemy.isFlying && obstacles.length > 0) {
        for (let o = 0; o < obstacles.length; o++) {
          const obs = obstacles[o];
          const ox = nextX - obs.x; const oz = nextZ - obs.z;
          const odist = Math.hypot(ox, oz);
          const minDist = enemy.radius + obs.radius;
          if (odist < minDist && odist > 0.001) {
            const overlap = minDist - odist;
            nextX += (ox / odist) * overlap; nextZ += (oz / odist) * overlap;
          }
        }
      }
      enemy.x = nextX;
      enemy.z = nextZ;

      if (dist < enemy.radius + 0.55 && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 0.55;
        this.applyPlayerDamage(enemy.damage);
      }
      if (enemy.affix === 'Regenerating' && enemy.hp < enemy.maxHp && enemy.hp > 0) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.03 * dt);
      }
      this.behaviours[enemy.archetype]?.update(enemy, dt, this.context);
    }

    for (let pIdx = this.enemyProjectiles.length - 1; pIdx >= 0; pIdx--) {
      const p = this.enemyProjectiles[pIdx];
      p.life += dt; p.x += p.vx * dt; p.z += p.vz * dt;
      this.enemyPool.setTransform(p.poolIndex, p.x, p.y, p.z, p.rotY);
      if (Math.hypot(px - p.x, pz - p.z) < p.radius + 0.55) {
        this.applyPlayerDamage(p.damage); this.particles.spawnPlasmaImpact(p.x, p.y, p.z);
        this.releaseEnemyProjectile(p); this.enemyProjectiles.splice(pIdx, 1);
      } else if (p.life >= p.maxLife) {
        this.releaseEnemyProjectile(p); this.enemyProjectiles.splice(pIdx, 1);
      }
    }

    this.endoBatch.updateBatch(this.activeEnemies, timeSeconds, px, pz);
  }

  public relocateEnemy(enemy: ActiveEnemy, px: number, pz: number): void {
    const heading = this.runState.isMoving ? this.runState.playerMoveAngle : this.runState.playerFacing;
    const angle = heading + (globalRNG.next() - 0.5) * (Math.PI * 0.4);
    const spawnDist = ENEMY_RELOCATE_MIN_DIST + globalRNG.next() * (ENEMY_RELOCATE_MAX_DIST - ENEMY_RELOCATE_MIN_DIST);
    enemy.x = px + Math.sin(angle) * spawnDist; enemy.z = pz + Math.cos(angle) * spawnDist;
    enemy.vx = 0; enemy.vz = 0; this.behaviours[enemy.archetype]?.onRelocate?.(enemy, this.context);
  }

  private applyPlayerDamage(rawDamage: number): void {
    const dmgDealt = this.runState.takeDamage(rawDamage);
    if (dmgDealt > 0) {
      this.audio.playPlayerHit();
      globalEvents.emit('player:damaged', { currentHp: this.runState.hp, maxHp: this.runState.maxHp, damage: dmgDealt });
    }
  }

  private killEnemy(enemy: ActiveEnemy, index: number): void {
    this.activeEnemies.splice(index, 1);
    this.runState.kills++; this.audio.playEndoDestroy(enemy.x, enemy.z, this.runState.playerPos.x, this.runState.playerPos.z);
    this.particles.spawnExplosion(enemy.x, 0.5, enemy.z, enemy.isBoss ? 2.0 : 0.8);
    this.particles.spawnEnemyDebris(enemy.x, 0.5, enemy.z, enemy.isBoss ? 8 : undefined);
    if (enemy.isElite) handleEliteDeath(enemy, this.context);
    this.behaviours[enemy.archetype]?.onDeath?.(enemy, this.context);
    this.behaviours[enemy.archetype]?.dispose?.(enemy, this.context);
    globalEvents.emit('enemy:killed', { enemy, x: enemy.x, z: enemy.z, xp: enemy.xpValue });
  }

  public clear(): void {
    this.activeEnemies.length = 0;
    for (const p of this.enemyProjectiles) this.releaseEnemyProjectile(p);
    this.enemyProjectiles.length = 0;
    this.enemyPool.clear();
    for (const b of Object.values(this.behaviours)) b.clear?.();
    this.endoBatch.updateBatch([], 0, 0, 0);
    for (let i = this.group.children.length - 1; i >= 0; i--) {
      if (this.group.children[i] !== this.enemyPool.mesh) this.group.remove(this.group.children[i]);
    }
    if (this.group.children.some((c) => c !== this.enemyPool.mesh)) {
      throw new Error('EnemySystem.clear() failed: non-pool children remain');
    }
  }
}
