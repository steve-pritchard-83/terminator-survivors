import * as THREE from 'three';
import type { ActiveEnemy, EnemyArchetypeId } from '../core/types';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ParticleSystem } from './ParticleSystem';
import type { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { ENEMY_CONFIGS } from '../data/enemies';
import { HKAerialMesh } from '../graphics/meshes/HKAerialMesh';
import { HKTankMesh } from '../graphics/meshes/HKTankMesh';
import { T1000Mesh } from '../graphics/meshes/T1000Mesh';
import { InfiltratorMesh } from '../graphics/meshes/InfiltratorMesh';
import { SkynetCoreMesh } from '../graphics/meshes/SkynetCoreMesh';
import { globalEvents } from '../core/EventBus';

export interface EnemyProjectile {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  radius: number;
  life: number;
  maxLife: number;
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

  // Individual boss/special meshes
  private readonly bossMeshes = new Map<number, THREE.Object3D>();
  private readonly hkAerialMeshes = new Map<number, HKAerialMesh>();
  private readonly hkTankMeshes = new Map<number, HKTankMesh>();
  private readonly t1000Meshes = new Map<number, T1000Mesh>();
  private readonly infiltratorMeshes = new Map<number, InfiltratorMesh>();
  private readonly skynetCoreMeshes = new Map<number, SkynetCoreMesh>();
  private readonly infiltratorBurstState = new Map<number, { shotsLeft: number; burstTimer: number }>();
  private readonly skynetNovaCooldown = new Map<number, number>();

  // Enemy projectiles & artillery reticles
  private readonly enemyProjectilePool: EnemyProjectile[] = [];
  private readonly enemyPlasmaGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.75, 8);
  private readonly enemyPlasmaMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
  private readonly artilleryReticleGeo = new THREE.RingGeometry(4.2, 4.5, 32);
  private readonly artilleryReticleMat = new THREE.MeshBasicMaterial({
    color: 0xff1111,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  private readonly tankReticleMeshes = new Map<number, THREE.Mesh>();
  private readonly tankTargetCoords = new Map<number, { x: number; z: number }>();

  constructor(
    runState: RunState,
    grid: SpatialHashGrid,
    audio: AudioEngine,
    particles: ParticleSystem,
    endoBatch: EndoskeletonBatch
  ) {
    this.runState = runState;
    this.grid = grid;
    this.audio = audio;
    this.particles = particles;
    this.endoBatch = endoBatch;

    this.enemyPlasmaGeo.rotateX(Math.PI / 2);
    this.artilleryReticleGeo.rotateX(-Math.PI / 2);

    // Pre-warm enemy projectile pool
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.enemyPlasmaGeo, this.enemyPlasmaMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.enemyProjectilePool.push({
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        damage: 12,
        radius: 0.35,
        life: 0,
        maxLife: 2.2
      });
    }
  }

  public spawnEnemy(
    archetype: EnemyArchetypeId,
    x: number,
    z: number,
    hpMult = 1.0,
    dmgMult = 1.0
  ): ActiveEnemy {
    const cfg = ENEMY_CONFIGS[archetype];
    const enemy: ActiveEnemy = {
      id: this.nextEnemyId++,
      type: 'enemy',
      archetype,
      x,
      z,
      radius: cfg.radius,
      hp: Math.round(cfg.maxHp * hpMult),
      maxHp: Math.round(cfg.maxHp * hpMult),
      speed: cfg.speed,
      damage: Math.round(cfg.damage * dmgMult),
      isBoss: cfg.isBoss,
      isFlying: cfg.isFlying,
      xpValue: cfg.xpValue,
      hitFlashTimer: 0,
      slowTimer: 0,
      armorStripMultiplier: 1.0,
      attackCooldown: 0,
      searchlightAngle: 0,
      searchlightAlertTimer: 0,
      phaseState: 0
    };

    this.activeEnemies.push(enemy);

    // Create specialized mesh if not handled by instanced batch
    if (archetype === 'hk_aerial_patrol' || archetype === 'hk_aerial_squadron_leader') {
      const hk = new HKAerialMesh(archetype === 'hk_aerial_squadron_leader');
      hk.group.position.set(x, 6.5, z);
      this.group.add(hk.group);
      this.hkAerialMeshes.set(enemy.id, hk);
    } else if (archetype === 'hk_tank_goliath') {
      const tank = new HKTankMesh();
      tank.group.position.set(x, 0, z);
      this.group.add(tank.group);
      this.hkTankMeshes.set(enemy.id, tank);
    } else if (archetype === 't1000_prototype') {
      const t1000 = new T1000Mesh();
      t1000.group.position.set(x, 0, z);
      this.group.add(t1000.group);
      this.t1000Meshes.set(enemy.id, t1000);
    } else if (archetype === 'infiltrator_csm101') {
      const infiltrator = new InfiltratorMesh();
      infiltrator.group.position.set(x, 0, z);
      this.group.add(infiltrator.group);
      this.infiltratorMeshes.set(enemy.id, infiltrator);
    } else if (archetype === 'skynet_tde_core') {
      const core = new SkynetCoreMesh();
      core.group.position.set(x, 0, z);
      this.group.add(core.group);
      this.skynetCoreMeshes.set(enemy.id, core);
    }

    return enemy;
  }

  private releaseEnemyProjectile(p: EnemyProjectile): void {
    p.mesh.visible = false;
    this.enemyProjectilePool.push(p);
  }

  private spawnEnemyProjectile(
    x: number,
    y: number,
    z: number,
    targetX: number,
    targetZ: number,
    speed = 9.5,
    damage = 12
  ): void {
    const dx = targetX - x;
    const dz = targetZ - z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    const angle = Math.atan2(dx, dz);

    let p: EnemyProjectile;
    if (this.enemyProjectilePool.length > 0) {
      p = this.enemyProjectilePool.pop()!;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = vx;
      p.vz = vz;
      p.damage = damage;
      p.radius = 0.35;
      p.life = 0;
      p.maxLife = 2.2;
      p.mesh.position.set(x, y, z);
      p.mesh.rotation.y = angle;
      p.mesh.visible = true;
    } else {
      const mesh = new THREE.Mesh(this.enemyPlasmaGeo, this.enemyPlasmaMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = angle;
      this.group.add(mesh);
      p = {
        mesh,
        x,
        y,
        z,
        vx,
        vz,
        damage,
        radius: 0.35,
        life: 0,
        maxLife: 2.2
      };
    }

    this.enemyProjectiles.push(p);
    this.audio.playPlasmaShot(false);
  }

  public update(
    dt: number,
    timeSeconds: number,
    obstacles: Array<{ x: number; z: number; radius: number }> = []
  ): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;

    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];

      // Check Death
      if (enemy.hp <= 0) {
        this.killEnemy(enemy, i);
        continue;
      }

      // Timers
      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer -= dt;
      }
      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= dt;
      }

      const effectiveSpeed = enemy.speed * (enemy.slowTimer > 0 ? 0.6 : 1.0);

      // Steering toward Kyle Reese
      const dx = px - enemy.x;
      const dz = pz - enemy.z;
      const dist = Math.hypot(dx, dz);

      // Soft Boids Separation Force (pushes overlapping enemies apart)
      const neighbors = this.grid.queryRadius(enemy.x, enemy.z, enemy.radius * 1.6);
      let sepX = 0;
      let sepZ = 0;
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

      let moveX = 0;
      let moveZ = 0;
      if (dist > 0.05) {
        const nx = dx / dist;
        const nz = dz / dist;
        moveX = (nx * effectiveSpeed + sepX) * dt;
        moveZ = (nz * effectiveSpeed + sepZ) * dt;
      }
      let nextX = enemy.x + moveX;
      let nextZ = enemy.z + moveZ;

      // Obstacle collision for ground enemies
      if (!enemy.isFlying && obstacles.length > 0) {
        for (let o = 0; o < obstacles.length; o++) {
          const obs = obstacles[o];
          const ox = nextX - obs.x;
          const oz = nextZ - obs.z;
          const odist = Math.hypot(ox, oz);
          const minDist = enemy.radius + obs.radius;
          if (odist < minDist && odist > 0.001) {
            const overlap = minDist - odist;
            nextX += (ox / odist) * overlap;
            nextZ += (oz / odist) * overlap;
          }
        }
      }
      enemy.x = nextX;
      enemy.z = nextZ;

      // Damage player if in contact radius
      if (dist < enemy.radius + 0.55) {
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 0.55;
          this.applyPlayerDamage(enemy.damage);
        }
      }

      // Specialized AI & Searchlight behaviors
      this.updateSpecialEnemy(enemy, dt, timeSeconds, px, pz, dist);
    }

    // Update enemy plasma projectiles
    for (let pIdx = this.enemyProjectiles.length - 1; pIdx >= 0; pIdx--) {
      const p = this.enemyProjectiles[pIdx];
      p.life += dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      const pdist = Math.hypot(px - p.x, pz - p.z);
      if (pdist < p.radius + 0.55) {
        this.applyPlayerDamage(p.damage);
        this.particles.spawnPlasmaImpact(p.x, p.y, p.z);
        this.releaseEnemyProjectile(p);
        this.enemyProjectiles.splice(pIdx, 1);
        continue;
      }

      if (p.life >= p.maxLife) {
        this.releaseEnemyProjectile(p);
        this.enemyProjectiles.splice(pIdx, 1);
      }
    }

    // Update Endoskeleton & Crab Scuttler instanced mesh batches
    this.endoBatch.updateBatch(this.activeEnemies, timeSeconds, px, pz);
  }

  private applyPlayerDamage(rawDamage: number): void {
    const dmgDealt = this.runState.takeDamage(rawDamage);
    if (dmgDealt > 0) {
      this.audio.playPlayerHit();
      globalEvents.emit('player:damaged', {
        currentHp: this.runState.hp,
        maxHp: this.runState.maxHp,
        damage: dmgDealt
      });
    }
  }

  private updateSpecialEnemy(
    enemy: ActiveEnemy,
    dt: number,
    timeSeconds: number,
    px: number,
    pz: number,
    distToPlayer: number
  ): void {
    // Ranged plasma fire for T-800 Endoskeletons
    if (enemy.archetype === 't800_endoskeleton') {
      enemy.phaseState -= dt;
      if (enemy.phaseState <= 0 && distToPlayer >= 7.0 && distToPlayer <= 17.0) {
        enemy.phaseState = 4.0;
        this.spawnEnemyProjectile(enemy.x, 1.0, enemy.z, px, pz, 9.0, 10);
      }
    }

    if (enemy.archetype === 'hk_aerial_patrol' || enemy.archetype === 'hk_aerial_squadron_leader') {
      const hk = this.hkAerialMeshes.get(enemy.id);
      if (hk) {
        hk.group.position.set(enemy.x, 6.5, enemy.z);
        hk.group.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);

        // Searchlight ground detection: checks if Kyle is inside searchlight cone pool
        const searchlightTargetZ = enemy.z + Math.cos(hk.group.rotation.y) * 8.5;
        const searchlightTargetX = enemy.x + Math.sin(hk.group.rotation.y) * 8.5;
        const distToSearchlight = Math.hypot(px - searchlightTargetX, pz - searchlightTargetZ);

        if (distToSearchlight < 3.8) {
          enemy.searchlightAlertTimer += dt;
          if (enemy.searchlightAlertTimer >= 1.2) {
            this.audio.playSearchlightAlert();
            this.audio.playPlasmaShot(true);
            this.applyPlayerDamage(18);
            enemy.searchlightAlertTimer = 0;
          }
        } else {
          enemy.searchlightAlertTimer = Math.max(0, enemy.searchlightAlertTimer - dt * 1.5);
        }

        hk.update(timeSeconds, enemy.searchlightAlertTimer / 1.2, 0);
      }
    } else if (enemy.archetype === 'hk_tank_goliath') {
      const tank = this.hkTankMeshes.get(enemy.id);
      if (tank) {
        tank.group.position.set(enemy.x, 0, enemy.z);
        tank.group.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);
        const targetAngle = Math.atan2(px - enemy.x, pz - enemy.z);

        enemy.attackCooldown += dt;
        let coords = this.tankTargetCoords.get(enemy.id);
        if (!coords || enemy.attackCooldown <= dt * 1.5) {
          coords = { x: px, z: pz };
          this.tankTargetCoords.set(enemy.id, coords);
        }

        let reticle = this.tankReticleMeshes.get(enemy.id);
        if (!reticle) {
          reticle = new THREE.Mesh(this.artilleryReticleGeo, this.artilleryReticleMat.clone());
          this.group.add(reticle);
          this.tankReticleMeshes.set(enemy.id, reticle);
        }
        reticle.visible = true;
        reticle.position.set(coords.x, 0.05, coords.z);
        const chargeProgress = Math.min(1, enemy.attackCooldown / 3.0);
        reticle.scale.set(chargeProgress, 1, chargeProgress);
        (reticle.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.65 * chargeProgress;

        if (enemy.attackCooldown >= 3.0) {
          enemy.attackCooldown = 0;
          this.audio.playExplosion(1.8);
          this.particles.spawnExplosion(coords.x, 0.2, coords.z, 2.0);
          const blastDist = Math.hypot(px - coords.x, pz - coords.z);
          if (blastDist < 4.5) {
            this.applyPlayerDamage(35);
          }
          reticle.visible = false;
          coords.x = px;
          coords.z = pz;
        }

        tank.update(timeSeconds, chargeProgress, chargeProgress, targetAngle);
      }
    } else if (enemy.archetype === 't1000_prototype') {
      const t1000 = this.t1000Meshes.get(enemy.id);
      if (t1000) {
        t1000.group.position.set(enemy.x, 0, enemy.z);
        t1000.group.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);
        const isLiquid = enemy.hp < enemy.maxHp * 0.45 && enemy.hp > enemy.maxHp * 0.25;
        const isSlashing = distToPlayer < 2.5;
        t1000.update(timeSeconds, isLiquid, isSlashing);
      }
    } else if (enemy.archetype === 'infiltrator_csm101') {
      const infiltrator = this.infiltratorMeshes.get(enemy.id);
      if (infiltrator) {
        infiltrator.group.position.set(enemy.x, 0, enemy.z);
        const facing = Math.atan2(px - enemy.x, pz - enemy.z);

        // 3-round burst plasma attack
        let burst = this.infiltratorBurstState.get(enemy.id);
        if (!burst) {
          burst = { shotsLeft: 0, burstTimer: 0 };
          this.infiltratorBurstState.set(enemy.id, burst);
        }

        let isFiring = false;
        if (burst.shotsLeft > 0) {
          burst.burstTimer -= dt;
          isFiring = true;
          if (burst.burstTimer <= 0) {
            burst.shotsLeft--;
            burst.burstTimer = 0.15;
            const spreadX = (Math.random() - 0.5) * 1.2;
            const spreadZ = (Math.random() - 0.5) * 1.2;
            this.spawnEnemyProjectile(enemy.x, 1.25, enemy.z, px + spreadX, pz + spreadZ, 12.0, 15);
            this.audio.playPlasmaShot(true);
          }
        } else {
          enemy.phaseState -= dt;
          if (enemy.phaseState <= 0 && distToPlayer >= 4.0 && distToPlayer <= 20.0) {
            enemy.phaseState = 3.2; // Interval between bursts
            burst.shotsLeft = 3;
            burst.burstTimer = 0;
          }
        }

        infiltrator.updateAnimation(dt, enemy.speed, facing, isFiring);
      }
    } else if (enemy.archetype === 'skynet_tde_core') {
      const core = this.skynetCoreMeshes.get(enemy.id);
      if (core) {
        core.group.position.set(enemy.x, 0, enemy.z);
        const isEnraged = enemy.hp < enemy.maxHp * 0.5;
        core.updateAnimation(dt, timeSeconds, isEnraged);

        // Phase 2 Enraged Temporal Nova: radial ring of plasma bolts
        if (isEnraged) {
          let cd = this.skynetNovaCooldown.get(enemy.id) ?? 3.5;
          cd -= dt;
          if (cd <= 0) {
            cd = 4.8;
            this.skynetNovaCooldown.set(enemy.id, cd);
            globalEvents.emit('camera:shake', { trauma: 0.45 });
            this.audio.playPlasmaShot(true);

            const boltCount = 10;
            const baseAngle = timeSeconds * 1.8;
            for (let b = 0; b < boltCount; b++) {
              const angle = baseAngle + (b * Math.PI * 2) / boltCount;
              const targetX = enemy.x + Math.sin(angle) * 12.0;
              const targetZ = enemy.z + Math.cos(angle) * 12.0;
              this.spawnEnemyProjectile(enemy.x, 3.6, enemy.z, targetX, targetZ, 8.5, 18);
            }
          } else {
            this.skynetNovaCooldown.set(enemy.id, cd);
          }
        }
      }
    } else if (enemy.isBoss) {
      const bossObj = this.bossMeshes.get(enemy.id);
      if (bossObj) {
        bossObj.position.set(enemy.x, 0, enemy.z);
        bossObj.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);
      }
    }
  }

  private killEnemy(enemy: ActiveEnemy, index: number): void {
    this.activeEnemies.splice(index, 1);
    this.runState.kills++;
    this.audio.playEndoDestroy();
    this.particles.spawnExplosion(enemy.x, 0.5, enemy.z, enemy.isBoss ? 2.0 : 0.8);

    // Remove specific 3D meshes
    if (this.hkAerialMeshes.has(enemy.id)) {
      const mesh = this.hkAerialMeshes.get(enemy.id)!;
      this.group.remove(mesh.group);
      this.hkAerialMeshes.delete(enemy.id);
    }
    if (this.hkTankMeshes.has(enemy.id)) {
      const mesh = this.hkTankMeshes.get(enemy.id)!;
      this.group.remove(mesh.group);
      this.hkTankMeshes.delete(enemy.id);
    }
    if (this.t1000Meshes.has(enemy.id)) {
      const mesh = this.t1000Meshes.get(enemy.id)!;
      this.group.remove(mesh.group);
      this.t1000Meshes.delete(enemy.id);
    }
    if (this.bossMeshes.has(enemy.id)) {
      const mesh = this.bossMeshes.get(enemy.id)!;
      this.group.remove(mesh);
      this.bossMeshes.delete(enemy.id);
    }
    if (this.infiltratorMeshes.has(enemy.id)) {
      const mesh = this.infiltratorMeshes.get(enemy.id)!;
      this.group.remove(mesh.group);
      this.infiltratorMeshes.delete(enemy.id);
      this.infiltratorBurstState.delete(enemy.id);
    }
    if (this.skynetCoreMeshes.has(enemy.id)) {
      const mesh = this.skynetCoreMeshes.get(enemy.id)!;
      this.group.remove(mesh.group);
      this.skynetCoreMeshes.delete(enemy.id);
      this.skynetNovaCooldown.delete(enemy.id);
    }
    const reticle = this.tankReticleMeshes.get(enemy.id);
    if (reticle) {
      this.group.remove(reticle);
      this.tankReticleMeshes.delete(enemy.id);
    }
    this.tankTargetCoords.delete(enemy.id);

    globalEvents.emit('enemy:killed', {
      enemy,
      x: enemy.x,
      z: enemy.z,
      xp: enemy.xpValue
    });
  }

  public clear(): void {
    this.activeEnemies.length = 0;
    for (const p of this.enemyProjectiles) {
      this.releaseEnemyProjectile(p);
    }
    this.enemyProjectiles.length = 0;
    for (const r of this.tankReticleMeshes.values()) {
      this.group.remove(r);
    }
    this.tankReticleMeshes.clear();
    this.tankTargetCoords.clear();

    for (const mesh of this.hkAerialMeshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.hkTankMeshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.t1000Meshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.infiltratorMeshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.skynetCoreMeshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.bossMeshes.values()) this.group.remove(mesh);
    this.hkAerialMeshes.clear();
    this.hkTankMeshes.clear();
    this.t1000Meshes.clear();
    this.infiltratorMeshes.clear();
    this.infiltratorBurstState.clear();
    this.skynetCoreMeshes.clear();
    this.skynetNovaCooldown.clear();
    this.bossMeshes.clear();
    this.endoBatch.updateBatch([], 0, 0, 0);
  }
}
