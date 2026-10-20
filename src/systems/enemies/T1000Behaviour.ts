import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { T1000Mesh } from '../../graphics/meshes/T1000Mesh';
import { LineTelegraph, ConeTelegraph } from '../../graphics/Telegraphs';

export class T1000Behaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, T1000Mesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();
  private readonly slashTelegraphs = new Map<number, ConeTelegraph>();

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
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.02 * dt);
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
      const puddleCooldown = (state.puddleCooldown ?? 7.0) - dt;
      state.puddleCooldown = puddleCooldown;

      if (puddleCooldown <= 0 && !isPuddle) {
        isPuddle = true;
        state.isPuddle = 1;
        state.puddleDuration = 1.5;
        ctx.audio.playSearchlightAlert();
      }
    }

    if (isPuddle) {
      const duration = (state.puddleDuration ?? 1.5) - dt;
      state.puddleDuration = duration;
      t1000.update(ctx.timeSeconds, true, false);

      if (duration <= 0) {
        isPuddle = false;
        state.isPuddle = 0;
        state.puddleCooldown = 8.5;
        // Reappear directly behind player
        const playerFacing = ctx.runState.playerFacing;
        enemy.x = px - Math.sin(playerFacing) * 2.2;
        enemy.z = pz - Math.cos(playerFacing) * 2.2;
        t1000.group.position.set(enemy.x, 0, enemy.z);
        ctx.audio.playCritCrunch();
        ctx.particles.spawnPlasmaImpact(enemy.x, 0.5, enemy.z);
        ctx.applyPlayerDamage(24);
      }
      return;
    }

    t1000.group.position.set(enemy.x, 0, enemy.z);
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);
    t1000.group.rotation.y = facing;

    const isSlashing = distToPlayer < 2.5;
    t1000.update(ctx.timeSeconds, false, isSlashing);

    // ATTACK 2: Slash combo (when close, 3 quick melee swipes)
    const slashTimer = (state.slashTimer ?? 1.8) - dt;
    state.slashTimer = slashTimer;
    if (distToPlayer < 3.0) {
      if (slashTimer <= 0.4 && slashTimer > 0) {
        const progress = (0.4 - slashTimer) / 0.4;
        slashTelegraph.update(enemy.x, enemy.z, facing, progress);
      } else if (slashTimer <= 0) {
        slashTelegraph.setVisible(false);
        state.slashTimer = 2.0;
        ctx.audio.playCritCrunch();
        ctx.particles.spawnPlasmaImpact(px, 0.8, pz);
        ctx.applyPlayerDamage(18);
      }
    } else {
      slashTelegraph.setVisible(false);
    }

    // ATTACK 1: Blade lunge (line telegraph)
    const lungeCd = (state.lungeCooldown ?? 2.5) - dt;
    state.lungeCooldown = lungeCd;

    if (lungeCd <= 0.5 && lungeCd > 0 && distToPlayer < 8.0 && distToPlayer >= 2.5) {
      const progress = (0.5 - lungeCd) / 0.5;
      lineTelegraph.update(enemy.x, enemy.z, px, pz, progress, 1.2);
    } else if (lungeCd <= 0 && distToPlayer < 8.0 && distToPlayer >= 2.5) {
      state.lungeCooldown = 3.5;
      lineTelegraph.setVisible(false);
      if (distToPlayer > 0.1) {
        enemy.vx = ((px - enemy.x) / distToPlayer) * 14.0;
        enemy.vz = ((pz - enemy.z) / distToPlayer) * 14.0;
      }
    } else {
      lineTelegraph.setVisible(false);
      if (lungeCd < 0) state.lungeCooldown = 3.5;
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
  }
}
