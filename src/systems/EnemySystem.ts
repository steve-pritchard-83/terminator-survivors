import * as THREE from 'three';
import type { ActiveEnemy, EnemyArchetypeId, SpatialEntity, EliteAffix } from '../core/types';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ParticleSystem } from './ParticleSystem';
import type { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { ELITE_AFFIXES, ENEMY_CONFIGS, applyEliteAffix, handleEliteDeath } from '../data/enemies';
import { InstancedPool, type PoolableUser } from '../graphics/InstancedPool';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import { CircleTelegraph } from '../graphics/Telegraphs';
import {
  EMPLACEMENT_DESPAWN_DISTANCE,
  ENEMY_LEASH_DISTANCE,
  ENEMY_RELOCATE_MAX_DIST,
  ENEMY_RELOCATE_MIN_DIST,
  LEASH_EXEMPT_ARCHETYPES
} from '../data/waves';
import { type EnemyBehaviour, type EnemyContext, createEnemyBehaviourRegistry } from './enemies';
import type { IEnvironment } from '../graphics/environments';
import { ENDO_STEP, OPENING_GRACE } from '../data/balance';
import { ENEMY_SHADOW, PALETTE } from '../data/artDirection';
import { RENDER_BUDGET } from '../data/performance';
import { ProceduralTextures } from '../graphics/ProceduralTextures';
import { buildBoltGeometry, createBoltMaterial } from '../graphics/PlasmaBolts';

export interface EnemyProjectile extends PoolableUser {
  poolIndex: number; x: number; y: number; z: number; vx: number; vz: number;
  rotY: number; damage: number; radius: number; life: number; maxLife: number;
}

export class EnemySystem {
  public readonly group = new THREE.Group();
  public readonly activeEnemies: ActiveEnemy[] = [];
  public readonly enemyProjectiles: EnemyProjectile[] = [];
  private nextEnemyId = 1;
  private endoStepTimer = 0;
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
  private readonly pendingBlasts: Array<{ x: number; z: number; radius: number; damage: number; remaining: number; total: number; telegraph: CircleTelegraph }> = [];
  private readonly eliteAuraGeo = new THREE.SphereGeometry(0.95, 14, 10);
  private readonly eliteAuraMats = new Map<number, THREE.MeshBasicMaterial>();
  // Skynet plasma: red streaks with hot cores, distinct from the Resistance's pink-violet
  private readonly enemyPlasmaGeo = buildBoltGeometry(1.5, 0.04, 0.12, PALETTE.plasmaSkynetCore, PALETTE.plasmaSkynet);
  private readonly enemyPlasmaMat = createBoltMaterial(2.6);
  // One instanced low-poly disc per enemy: a soft dark contact patch on the ground
  private readonly shadowMesh: THREE.InstancedMesh;
  private readonly shadowDummy = new THREE.Object3D();

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
    this.enemyPlasmaGeo.userData = { shared: true }; this.enemyPlasmaMat.userData = { shared: true };
    this.eliteAuraGeo.userData = { shared: true };
    this.enemyPool = new InstancedPool<EnemyProjectile>(this.enemyPlasmaGeo, this.enemyPlasmaMat, 256, this.group);
    const shadowGeo = new THREE.CircleGeometry(1, ENEMY_SHADOW.segments).rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: ProceduralTextures.getSoftGlowSprite(),
      transparent: true,
      opacity: RENDER_BUDGET.shadowOpacity,
      depthWrite: false
    });
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, ENEMY_SHADOW.maxCount);
    this.shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.renderOrder = -1;
    this.shadowMesh.count = 0;
    this.group.add(this.shadowMesh);

    this.context = {
      runState: this.runState, audio: this.audio, particles: this.particles,
      spawnEnemyProjectile: (x, y, z, tx, tz, spd, dmg) => this.spawnEnemyProjectile(x, y, z, tx, tz, spd, dmg),
      spawnEnemy: (arch, x, z) => this.spawnEnemy(arch, x, z), applyPlayerDamage: (dmg) => this.applyPlayerDamage(dmg),
      emit: (evt, payload) => globalEvents.emit(evt, payload), rng: globalRNG, activeEnemies: this.activeEnemies,
      scheduleBlast: (x, z, radius, damage, delay) => this.scheduleBlast(x, z, radius, damage, delay),
      group: this.group, timeSeconds: 0
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
    const visual = this.behaviours[archetype]?.createVisual?.(enemy, this.context);
    if (visual && enemy.isElite) this.decorateEliteVisual(visual, enemy);
    return enemy;
  }

  /** Elites rendered as standalone meshes (not instanced) get the same scale and a tinted aura. */
  private decorateEliteVisual(visual: THREE.Object3D, enemy: ActiveEnemy): void {
    visual.scale.multiplyScalar(enemy.scale ?? 1.4);
    const tint = ELITE_AFFIXES[enemy.affix as EliteAffix]?.tintColor ?? 0xffab00;
    let mat = this.eliteAuraMats.get(tint);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: tint, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
      });
      mat.userData = { shared: true };
      this.eliteAuraMats.set(tint, mat);
    }
    const aura = new THREE.Mesh(this.eliteAuraGeo, mat);
    aura.position.y = 0.9;
    visual.add(aura);
  }

  private scheduleBlast(x: number, z: number, radius: number, damage: number, delaySeconds: number): void {
    const telegraph = new CircleTelegraph(radius, 0xff6d00);
    this.group.add(telegraph.group);
    telegraph.update(x, z, 0.001, radius);
    this.pendingBlasts.push({ x, z, radius, damage, remaining: delaySeconds, total: delaySeconds, telegraph });
  }

  private updatePendingBlasts(dt: number): void {
    for (let i = this.pendingBlasts.length - 1; i >= 0; i--) {
      const b = this.pendingBlasts[i];
      b.remaining -= dt;
      if (b.remaining > 0) {
        b.telegraph.update(b.x, b.z, 1 - b.remaining / b.total, b.radius);
        continue;
      }
      this.particles.spawnExplosion(b.x, 0.5, b.z, 2.8);
      this.audio.playExplosion(1.8);
      globalEvents.emit('camera:shake', { trauma: 0.5 });
      if (Math.hypot(this.runState.playerPos.x - b.x, this.runState.playerPos.z - b.z) < b.radius) {
        this.applyPlayerDamage(b.damage);
      }
      this.group.remove(b.telegraph.group);
      b.telegraph.dispose();
      this.pendingBlasts.splice(i, 1);
    }
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
    this.audio.playEnemyShot('light');
  }

  public update(dt: number, timeSeconds: number, obstacles: Array<{ x: number; z: number; radius: number }> = [], env?: IEnvironment): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    this.context.timeSeconds = timeSeconds;
    this.updatePendingBlasts(dt);
    this.updateEndoSteps(dt, px, pz);

    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (enemy.hp <= 0) { this.killEnemy(enemy, i); continue; }

      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= dt;
      if (enemy.slowTimer > 0) enemy.slowTimer -= dt; if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

      const effectiveSpeed = enemy.speed * (enemy.slowTimer > 0 ? 0.6 : 1.0);
      let dx = px - enemy.x; let dz = pz - enemy.z; let dist = Math.hypot(dx, dz);

      if (LEASH_EXEMPT_ARCHETYPES.has(enemy.archetype)) {
        if (dist > EMPLACEMENT_DESPAWN_DISTANCE) {
          // Silent removal: no kill, XP or event.
          this.activeEnemies.splice(i, 1);
          this.behaviours[enemy.archetype]?.dispose?.(enemy, this.context);
          continue;
        }
      } else if (!enemy.isBoss && dist > ENEMY_LEASH_DISTANCE) {
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
    this.updateShadows();
  }

  private updateShadows(): void {
    const count = Math.min(this.activeEnemies.length, ENEMY_SHADOW.maxCount, RENDER_BUDGET.shadowMax);
    for (let i = 0; i < count; i++) {
      const enemy = this.activeEnemies[i];
      let r = Math.max(ENEMY_SHADOW.minRadius, enemy.radius * ENEMY_SHADOW.radiusScale) * (enemy.scale ?? 1);
      if (enemy.isFlying) r *= ENEMY_SHADOW.flyingScale;
      this.shadowDummy.position.set(enemy.x, 0.03, enemy.z);
      this.shadowDummy.scale.set(r, 1, r);
      this.shadowDummy.updateMatrix();
      this.shadowMesh.setMatrixAt(i, this.shadowDummy.matrix);
    }
    this.shadowMesh.count = count;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
  }

  public relocateEnemy(enemy: ActiveEnemy, px: number, pz: number): void {
    const heading = this.runState.isMoving ? this.runState.playerMoveAngle : this.runState.playerFacing;
    const angle = heading + (globalRNG.next() - 0.5) * (Math.PI * 0.4);
    const spawnDist = ENEMY_RELOCATE_MIN_DIST + globalRNG.next() * (ENEMY_RELOCATE_MAX_DIST - ENEMY_RELOCATE_MIN_DIST);
    enemy.x = px + Math.sin(angle) * spawnDist; enemy.z = pz + Math.cos(angle) * spawnDist;
    enemy.vx = 0; enemy.vz = 0; this.behaviours[enemy.archetype]?.onRelocate?.(enemy, this.context);
  }

  private applyPlayerDamage(rawDamage: number): void {
    // Gentler opening while the player finds their feet
    const scale = this.runState.timeSeconds < OPENING_GRACE.seconds ? OPENING_GRACE.damageScale : 1;
    const dmgDealt = this.runState.takeDamage(rawDamage * scale);
    if (dmgDealt > 0) {
      this.audio.playPlayerHit();
      globalEvents.emit('player:damaged', { currentHp: this.runState.hp, maxHp: this.runState.maxHp, damage: dmgDealt });
    }
  }

  /** Which death sound an enemy gets: bosses and machines explode, small drones crunch, humanoids collapse. */
  private deathKind(enemy: ActiveEnemy): 'boss' | 'machine' | 'small' | 'humanoid' {
    if (enemy.isBoss) return 'boss';
    if (enemy.isFlying || (enemy.mass ?? 0) >= 8) return 'machine';
    if (enemy.radius < 0.5) return 'small';
    return 'humanoid';
  }

  /** Metal footsteps from the nearest walking endoskeleton, so they can be heard approaching. */
  private updateEndoSteps(dt: number, px: number, pz: number): void {
    this.endoStepTimer -= dt;
    if (this.endoStepTimer > 0) return;
    this.endoStepTimer = ENDO_STEP.intervalSeconds;
    let nearest: ActiveEnemy | null = null;
    let nearestDist = ENDO_STEP.radius;
    for (const enemy of this.activeEnemies) {
      if (this.deathKind(enemy) !== 'humanoid') continue;
      const dist = Math.hypot(enemy.x - px, enemy.z - pz);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }
    if (nearest) this.audio.playEndoStep(nearest.x, nearest.z, px, pz);
  }

  private killEnemy(enemy: ActiveEnemy, index: number): void {
    this.activeEnemies.splice(index, 1);
    this.runState.kills++;
    this.audio.playEnemyDeath(this.deathKind(enemy), enemy.x, enemy.z, this.runState.playerPos.x, this.runState.playerPos.z);
    this.particles.spawnExplosion(enemy.x, 0.5, enemy.z, enemy.isBoss ? 2.0 : 0.8);
    if (this.endoBatch.handles(enemy.archetype)) {
      // Instanced enemies collapse on screen for a moment instead of vanishing
      this.endoBatch.addCorpse(enemy, this.runState.playerPos.x, this.runState.playerPos.z);
    } else {
      this.particles.spawnDeathBurst(enemy.x, 0.4, enemy.z, enemy.isBoss ? 2.4 : Math.max(0.8, enemy.radius));
    }
    this.particles.spawnEnemyDebris(enemy.x, 0.5, enemy.z, enemy.isBoss ? 8 : undefined);
    if (enemy.isElite) handleEliteDeath(enemy, this.context);
    this.behaviours[enemy.archetype]?.onDeath?.(enemy, this.context);
    this.behaviours[enemy.archetype]?.dispose?.(enemy, this.context);
    globalEvents.emit('enemy:killed', { enemy, x: enemy.x, z: enemy.z, xp: enemy.xpValue });
  }

  public clear(): void {
    this.activeEnemies.length = 0;
    for (const b of this.pendingBlasts) {
      this.group.remove(b.telegraph.group);
      b.telegraph.dispose();
    }
    this.pendingBlasts.length = 0;
    for (const p of this.enemyProjectiles) this.releaseEnemyProjectile(p);
    this.enemyProjectiles.length = 0;
    this.enemyPool.clear();
    for (const b of Object.values(this.behaviours)) b.clear?.();
    this.endoBatch.clearCorpses();
    this.endoBatch.updateBatch([], 0, 0, 0);
    this.shadowMesh.count = 0;
    const keep = (c: THREE.Object3D) => c === this.enemyPool.mesh || c === this.shadowMesh;
    for (let i = this.group.children.length - 1; i >= 0; i--) {
      if (!keep(this.group.children[i])) this.group.remove(this.group.children[i]);
    }
    if (this.group.children.some((c) => !keep(c))) {
      throw new Error('EnemySystem.clear() failed: non-pool children remain');
    }
  }
}
