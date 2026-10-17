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
import { globalEvents } from '../core/EventBus';

export class EnemySystem {
  public readonly group = new THREE.Group();
  public readonly activeEnemies: ActiveEnemy[] = [];
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
      // Scaled elite infiltrator
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.4, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x9ca8b8, metalness: 0.9, roughness: 0.2 })
      );
      body.position.y = 1.1;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      eye.position.set(0.12, 1.9, 0.45);
      group.add(body, eye);
      group.position.set(x, 0, z);
      this.group.add(group);
      this.bossMeshes.set(enemy.id, group);
    } else if (archetype === 'skynet_tde_core') {
      // Massive pulsing sphere surrounded by lightning rings
      const coreGeo = new THREE.SphereGeometry(3.2, 24, 20);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00bfff,
        emissiveIntensity: 3.5,
        wireframe: true
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(x, 3.2, z);
      this.group.add(coreMesh);
      this.bossMeshes.set(enemy.id, coreMesh);
    }

    return enemy;
  }

  public update(dt: number, timeSeconds: number): void {
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

      if (dist > 0.05) {
        const nx = dx / dist;
        const nz = dz / dist;
        enemy.x += nx * effectiveSpeed * dt;
        enemy.z += nz * effectiveSpeed * dt;
      }

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
        const chargeProgress = Math.min(1, enemy.attackCooldown / 3.0);
        if (enemy.attackCooldown >= 3.0) {
          enemy.attackCooldown = 0;
          this.audio.playExplosion(1.8);
          this.particles.spawnExplosion(px, 0.2, pz, 1.8);
          if (distToPlayer < 7.0) {
            this.applyPlayerDamage(35);
          }
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

    globalEvents.emit('enemy:killed', {
      enemy,
      x: enemy.x,
      z: enemy.z,
      xp: enemy.xpValue
    });
  }

  public clear(): void {
    this.activeEnemies.length = 0;
    for (const mesh of this.hkAerialMeshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.hkTankMeshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.t1000Meshes.values()) this.group.remove(mesh.group);
    for (const mesh of this.bossMeshes.values()) this.group.remove(mesh);
    this.hkAerialMeshes.clear();
    this.hkTankMeshes.clear();
    this.t1000Meshes.clear();
    this.bossMeshes.clear();
    this.endoBatch.updateBatch([], 0, 0, 0);
  }
}
