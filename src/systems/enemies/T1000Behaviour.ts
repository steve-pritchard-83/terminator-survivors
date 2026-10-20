import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { tickCooldown } from './attackTimer';
import { T1000Mesh } from '../../graphics/meshes/T1000Mesh';
import { LineTelegraph, ConeTelegraph, CircleTelegraph } from '../../graphics/Telegraphs';
import { T1000_TUNING } from '../../data/balance';

export class T1000Behaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, T1000Mesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();
  private readonly slashTelegraphs = new Map<number, ConeTelegraph>();
  private readonly landingTelegraphs = new Map<number, CircleTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const t1000 = new T1000Mesh();
    t1000.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(t1000.group);
    this.meshes.set(enemy.id, t1000);
    return t1000.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const t1000 = this.meshes.get(enemy.id);
    if (!t1000) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);

    // Multi-phase threshold calculation
    let phase = 1;
    if (enemy.hp < enemy.maxHp * 0.20) {
      phase = 3;
    } else if (enemy.hp < enemy.maxHp * 0.50) {
      phase = 2;
    }
    enemy.phase = phase;

    const state = (enemy.state = enemy.state ?? {});

    // Phase 3: Liquid metal regeneration (2% per second unless slowed/burning/stunned)
    if (phase === 3 && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
      state.burnTimer = Math.max(0, (state.burnTimer ?? 0) - dt);
      const isCountered = (enemy.slowTimer ?? 0) > 0 || state.burnTimer > 0;
      if (!isCountered) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * T1000_TUNING.regenFractionPerSecond * dt);
      }
    }

    // Telegraph setups
    let lineTelegraph = this.telegraphs.get(enemy.id);
    if (!lineTelegraph) {
      lineTelegraph = new LineTelegraph(0.6, 0xdce8f8);
      ctx.group.add(lineTelegraph.group);
      this.telegraphs.set(enemy.id, lineTelegraph);
    }

    let slashTelegraph = this.slashTelegraphs.get(enemy.id);
    if (!slashTelegraph) {
      slashTelegraph = new ConeTelegraph(3.0, Math.PI / 3, 0xdce8f8);
      ctx.group.add(slashTelegraph.group);
      this.slashTelegraphs.set(enemy.id, slashTelegraph);
    }

    // ATTACK 3 (Phase 2+): Liquid Puddle Ambush (untargetable for 1.5s, reappears behind player)
    let isPuddle = (state.isPuddle ?? 0) === 1;
    if (phase >= 2) {
      const puddleCooldown = (state.puddleCooldown ?? T1000_TUNING.puddleFirstCooldown) - dt;
      state.puddleCooldown = puddleCooldown;

      if (puddleCooldown <= 0 && !isPuddle) {
        isPuddle = true;
        state.isPuddle = 1;
        state.puddleDuration = T1000_TUNING.puddleDurationSeconds;
        ctx.audio.playSearchlightAlert();
      }
    }

    if (isPuddle) {
      const duration = (state.puddleDuration ?? T1000_TUNING.puddleDurationSeconds) - dt;
      state.puddleDuration = duration;
      t1000.update(ctx.timeSeconds, true, false);

      let landing = this.landingTelegraphs.get(enemy.id);
      if (!landing) {
        landing = new CircleTelegraph(2.5, 0xdce8f8);
        ctx.group.add(landing.group);
        this.landingTelegraphs.set(enemy.id, landing);
      }
      if (duration <= 0.6 && duration > 0) {
        // Lock the landing spot behind the player once, so moving away dodges the hit
        if ((state.landLocked ?? 0) !== 1) {
          state.landLocked = 1;
          state.landX = px - Math.sin(ctx.runState.playerFacing) * 2.2;
          state.landZ = pz - Math.cos(ctx.runState.playerFacing) * 2.2;
        }
        landing.update(state.landX, state.landZ, (0.6 - duration) / 0.6, 2.5);
      }

      if (duration <= 0) {
        isPuddle = false;
        state.isPuddle = 0;
        state.landLocked = 0;
        landing.setVisible(false);
        state.puddleCooldown = T1000_TUNING.puddleRepeatCooldown;
        // Reappear at the locked spot behind where the player was
        enemy.x = state.landX ?? px;
        enemy.z = state.landZ ?? pz;
        t1000.group.position.set(enemy.x, 0, enemy.z);
        ctx.audio.playCritCrunch();
        ctx.particles.spawnPlasmaImpact(enemy.x, 0.5, enemy.z);
        if (Math.hypot(px - enemy.x, pz - enemy.z) <= 2.5) {
          ctx.applyPlayerDamage(T1000_TUNING.reappearDamage);
        }
      }
      return;
    }

    t1000.group.position.set(enemy.x, 0, enemy.z);
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);
    t1000.group.rotation.y = facing;

    const isSlashing = distToPlayer < 2.5;
    t1000.update(ctx.timeSeconds, false, isSlashing);

    // ATTACK 2: Slash combo (when close, 3 quick melee swipes)
    const slashTimer = tickCooldown(state.slashTimer ?? 1.8, dt, distToPlayer < 3.0, 0.4);
    state.slashTimer = slashTimer;
    if (distToPlayer < 3.0) {
      if (slashTimer <= 0.4 && slashTimer > 0) {
        const progress = (0.4 - slashTimer) / 0.4;
        slashTelegraph.update(enemy.x, enemy.z, facing, progress);
      } else if (slashTimer <= 0) {
        slashTelegraph.setVisible(false);
        state.slashTimer = T1000_TUNING.slashCooldown;
        ctx.audio.playCritCrunch();
        ctx.particles.spawnPlasmaImpact(px, 0.8, pz);
        ctx.applyPlayerDamage(T1000_TUNING.slashDamage);
      }
    } else {
      slashTelegraph.setVisible(false);
    }

    // ATTACK 1: Blade lunge (line telegraph)
    const lungeCd = tickCooldown(state.lungeCooldown ?? 2.5, dt, distToPlayer < 8.0 && distToPlayer >= 2.5, 0.5);
    state.lungeCooldown = lungeCd;

    if (lungeCd <= 0.5 && lungeCd > 0 && distToPlayer < 8.0 && distToPlayer >= 2.5) {
      const progress = (0.5 - lungeCd) / 0.5;
      lineTelegraph.update(enemy.x, enemy.z, px, pz, progress, 1.2);
    } else if (lungeCd <= 0 && distToPlayer < 8.0 && distToPlayer >= 2.5) {
      state.lungeCooldown = T1000_TUNING.lungeCooldown;
      lineTelegraph.setVisible(false);
      if (distToPlayer > 0.1) {
        enemy.vx = ((px - enemy.x) / distToPlayer) * T1000_TUNING.lungeSpeed;
        enemy.vz = ((pz - enemy.z) / distToPlayer) * T1000_TUNING.lungeSpeed;
      }
    } else {
      lineTelegraph.setVisible(false);
      if (lungeCd < 0) state.lungeCooldown = T1000_TUNING.lungeCooldown;
    }
  }

  public onDeath(enemy: ActiveEnemy, ctx: EnemyContext): void {
    ctx.audio.playExplosion(2.4);
    ctx.particles.spawnExplosion(enemy.x, 0.5, enemy.z, 3.8);
    ctx.particles.spawnEnemyDebris(enemy.x, 0.5, enemy.z, 16);
    ctx.emit('camera:shake', { trauma: 0.8 });
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const t1000 = this.meshes.get(enemy.id);
    if (t1000) {
      ctx.group.remove(t1000.group);
      t1000.dispose();
      this.meshes.delete(enemy.id);
    }
    const lineTelegraph = this.telegraphs.get(enemy.id);
    if (lineTelegraph) {
      ctx.group.remove(lineTelegraph.group);
      lineTelegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
    const slashTelegraph = this.slashTelegraphs.get(enemy.id);
    if (slashTelegraph) {
      ctx.group.remove(slashTelegraph.group);
      slashTelegraph.dispose();
      this.slashTelegraphs.delete(enemy.id);
    }
    const landing = this.landingTelegraphs.get(enemy.id);
    if (landing) {
      ctx.group.remove(landing.group);
      landing.dispose();
      this.landingTelegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const t1000 of this.meshes.values()) {
      t1000.group.removeFromParent();
      t1000.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();

    for (const s of this.slashTelegraphs.values()) {
      s.group.removeFromParent();
      s.dispose();
    }
    this.slashTelegraphs.clear();

    for (const l of this.landingTelegraphs.values()) {
      l.group.removeFromParent();
      l.dispose();
    }
    this.landingTelegraphs.clear();
  }
}
