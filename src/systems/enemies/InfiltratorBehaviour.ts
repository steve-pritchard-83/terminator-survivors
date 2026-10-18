import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { InfiltratorMesh } from '../../graphics/meshes/InfiltratorMesh';
import { LineTelegraph, ConeTelegraph } from '../../graphics/Telegraphs';

export class InfiltratorBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, InfiltratorMesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();
  private readonly coneTelegraphs = new Map<number, ConeTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const infiltrator = new InfiltratorMesh();
    infiltrator.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(infiltrator.group);
    this.meshes.set(enemy.id, infiltrator);
    return infiltrator.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const infiltrator = this.meshes.get(enemy.id);
    if (!infiltrator) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);

    infiltrator.group.position.set(enemy.x, 0, enemy.z);
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);

    // Multi-phase threshold calculation
    let phase = 1;
    if (enemy.hp < enemy.maxHp * 0.20) {
      phase = 3;
    } else if (enemy.hp < enemy.maxHp * 0.50) {
      phase = 2;
    }
    enemy.phase = phase;

    const state = (enemy.state = enemy.state ?? {});

    // Phase 3 trigger: burn skin away to chrome endoskeleton, speed boost, call 6 crab drones
    if (phase === 3 && !state.phase3Triggered) {
      state.phase3Triggered = 1;
      infiltrator.setPhase3Endoskeleton();
      enemy.speed = 3.2 * 1.3; // +30% movement speed
      ctx.audio.playSearchlightAlert();
      ctx.emit('camera:shake', { trauma: 0.5 });
      if (ctx.spawnEnemy) {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          ctx.spawnEnemy('skynet_crab_drone', enemy.x + Math.sin(angle) * 3.2, enemy.z + Math.cos(angle) * 3.2);
        }
      }
    }

    // Telegraph setups
    let lineTelegraph = this.telegraphs.get(enemy.id);
    if (!lineTelegraph) {
      lineTelegraph = new LineTelegraph(0.45, 0xff1744);
      ctx.group.add(lineTelegraph.group);
      this.telegraphs.set(enemy.id, lineTelegraph);
    }

    let coneTelegraph = this.coneTelegraphs.get(enemy.id);
    if (!coneTelegraph) {
      coneTelegraph = new ConeTelegraph(9.0, Math.PI / 4, 0xff2200);
      ctx.group.add(coneTelegraph.group);
      this.coneTelegraphs.set(enemy.id, coneTelegraph);
    }

    let shotsLeft = state.burstShotsLeft ?? 0;
    let burstTimer = state.burstTimer ?? 0;
    let burstCooldown = state.burstCooldown ?? enemy.phaseState ?? 3.0;
    let walkShootCooldown = state.walkShootCooldown ?? 2.2;
    let chargeTimer = state.chargeTimer ?? 5.5;
    let isCharging = (state.isCharging ?? 0) === 1;
    let isFiring = false;

    // ATTACK 3 (Phase 2+): Straight line charge
    if (phase >= 2) {
      chargeTimer -= dt;
      if (chargeTimer <= 0.6 && chargeTimer > 0 && !isCharging) {
        // Telegraphing charge
        const progress = (0.6 - chargeTimer) / 0.6;
        coneTelegraph.update(enemy.x, enemy.z, facing, progress);
      } else if (chargeTimer <= 0 && !isCharging) {
        // Execute charge
        coneTelegraph.setVisible(false);
        isCharging = true;
        state.isCharging = 1;
        state.chargeDuration = 0.45;
        state.chargeVx = Math.sin(facing) * 15.0;
        state.chargeVz = Math.cos(facing) * 15.0;
        chargeTimer = 5.5;
        ctx.audio.playExplosion(1.0);
      }
    } else {
      coneTelegraph.setVisible(false);
    }

    if (isCharging) {
      const duration = (state.chargeDuration ?? 0.45) - dt;
      state.chargeDuration = duration;
      enemy.vx = state.chargeVx ?? 0;
      enemy.vz = state.chargeVz ?? 0;

      // Charge impact damage
      if (distToPlayer < 1.6) {
        ctx.applyPlayerDamage(28);
        ctx.emit('camera:shake', { trauma: 0.4 });
      }

      if (duration <= 0) {
        isCharging = false;
        state.isCharging = 0;
        enemy.vx = 0;
        enemy.vz = 0;
      }
    }

    // ATTACK 1: 3-round plasma burst (with line telegraph)
    if (shotsLeft > 0) {
      lineTelegraph.setVisible(false);
      burstTimer -= dt;
      isFiring = true;
      if (burstTimer <= 0) {
        shotsLeft--;
        burstTimer = 0.15;
        const spreadX = (ctx.rng.next() - 0.5) * 1.2;
        const spreadZ = (ctx.rng.next() - 0.5) * 1.2;
        ctx.spawnEnemyProjectile(enemy.x, 1.25, enemy.z, px + spreadX, pz + spreadZ, 12.0, 15);
        ctx.audio.playPlasmaShot(true);
      }
    } else if (!isCharging) {
      burstCooldown -= dt;
      if (burstCooldown <= 0.5 && burstCooldown > 0 && distToPlayer >= 4.0 && distToPlayer <= 20.0) {
        const progress = (0.5 - burstCooldown) / 0.5;
        lineTelegraph.update(enemy.x, enemy.z, px, pz, progress, 1.4);
      } else if (burstCooldown <= 0 && distToPlayer >= 4.0 && distToPlayer <= 20.0) {
        burstCooldown = 3.2;
        shotsLeft = 3;
        burstTimer = 0;
        lineTelegraph.setVisible(false);
      } else {
        lineTelegraph.setVisible(false);
      }
    }

    // ATTACK 2: Walk-and-shoot spray (fires 2 plasma bolts while moving)
    walkShootCooldown -= dt;
    if (walkShootCooldown <= 0 && !isFiring && !isCharging && distToPlayer > 3.0 && distToPlayer < 18.0) {
      walkShootCooldown = 2.4;
      isFiring = true;
      ctx.spawnEnemyProjectile(enemy.x, 1.25, enemy.z, px, pz, 10.0, 10);
      ctx.audio.playPlasmaShot(false);
    }

    state.burstShotsLeft = shotsLeft;
    state.burstTimer = burstTimer;
    state.burstCooldown = burstCooldown;
    state.walkShootCooldown = walkShootCooldown;
    state.chargeTimer = chargeTimer;
    enemy.phaseState = burstCooldown;

    infiltrator.updateAnimation(dt, enemy.speed, facing, isFiring);
  }

  public onDeath(enemy: ActiveEnemy, ctx: EnemyContext): void {
    ctx.audio.playExplosion(2.2);
    ctx.particles.spawnExplosion(enemy.x, 0.5, enemy.z, 3.5);
    ctx.particles.spawnEnemyDebris(enemy.x, 0.5, enemy.z, 12);
    ctx.emit('camera:shake', { trauma: 0.65 });
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const infiltrator = this.meshes.get(enemy.id);
    if (infiltrator) {
      ctx.group.remove(infiltrator.group);
      infiltrator.dispose();
      this.meshes.delete(enemy.id);
    }
    const lineTelegraph = this.telegraphs.get(enemy.id);
    if (lineTelegraph) {
      ctx.group.remove(lineTelegraph.group);
      lineTelegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
    const coneTelegraph = this.coneTelegraphs.get(enemy.id);
    if (coneTelegraph) {
      ctx.group.remove(coneTelegraph.group);
      coneTelegraph.dispose();
      this.coneTelegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const infiltrator of this.meshes.values()) {
      infiltrator.group.removeFromParent();
      infiltrator.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();

    for (const c of this.coneTelegraphs.values()) {
      c.group.removeFromParent();
      c.dispose();
    }
    this.coneTelegraphs.clear();
  }
}
