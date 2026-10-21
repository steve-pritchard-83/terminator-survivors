import type * as THREE from 'three';
import { tickCooldown } from './attackTimer';
import { ENEMY_ATTACK_DAMAGE } from '../../data/balance';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import {
  T1MinigunMesh,
  MotoTerminatorMesh,
  PlasmaTurretMesh
} from '../../graphics/meshes/NewEnemyMeshes';
import { ConeTelegraph, LineTelegraph } from '../../graphics/Telegraphs';

export class T1MinigunBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, T1MinigunMesh>();
  private readonly telegraphs = new Map<number, ConeTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const mesh = new T1MinigunMesh();
    mesh.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(mesh.group);
    this.meshes.set(enemy.id, mesh);
    return mesh.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const mesh = this.meshes.get(enemy.id);
    if (!mesh) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);

    mesh.group.position.set(enemy.x, 0, enemy.z);
    mesh.group.rotation.y = facing;

    const state = (enemy.state = enemy.state ?? {});
    const cd = (state.burstCooldown ?? 3.5) - dt;
    state.burstCooldown = cd;

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new ConeTelegraph(8.0, Math.PI / 3, 0xff5500);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    if (cd <= 0.6 && cd > 0) {
      const progress = (0.6 - cd) / 0.6;
      telegraph.update(enemy.x, enemy.z, facing, progress);
    } else if (cd <= 0) {
      telegraph.setVisible(false);
      state.burstCooldown = 4.2;
      ctx.audio.playEnemyShot('minigun');
      // Sweeping cone burst: 5 bullets across arc
      for (let b = -2; b <= 2; b++) {
        const angle = facing + b * 0.12;
        const tx = enemy.x + Math.sin(angle) * 10.0;
        const tz = enemy.z + Math.cos(angle) * 10.0;
        ctx.spawnEnemyProjectile(enemy.x, 0.72, enemy.z, tx, tz, 11.0, ENEMY_ATTACK_DAMAGE.t1ConeBolt);
      }
    } else {
      telegraph.setVisible(false);
    }
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const mesh = this.meshes.get(enemy.id);
    if (mesh) {
      ctx.group.remove(mesh.group);
      mesh.dispose();
      this.meshes.delete(enemy.id);
    }
    const t = this.telegraphs.get(enemy.id);
    if (t) {
      ctx.group.remove(t.group);
      t.dispose();
      this.telegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const m of this.meshes.values()) {
      m.group.removeFromParent();
      m.dispose();
    }
    this.meshes.clear();
    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();
  }
}

export class MotoTerminatorBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, MotoTerminatorMesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const mesh = new MotoTerminatorMesh();
    mesh.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(mesh.group);
    this.meshes.set(enemy.id, mesh);
    return mesh.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const mesh = this.meshes.get(enemy.id);
    if (!mesh) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);

    mesh.group.position.set(enemy.x, 0, enemy.z);
    mesh.group.rotation.y = facing;

    const state = (enemy.state = enemy.state ?? {});
    const dashCd = (state.dashCooldown ?? 3.2) - dt;
    state.dashCooldown = dashCd;
    const isDashing = (state.isDashing ?? 0) === 1;

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new LineTelegraph(0.8, 0xff0044);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    if (dashCd <= 0.4 && dashCd > 0 && !isDashing && distToPlayer < 14.0) {
      const progress = (0.4 - dashCd) / 0.4;
      telegraph.update(enemy.x, enemy.z, px, pz, progress, 1.2);
    } else if (dashCd <= 0 && !isDashing && distToPlayer < 14.0) {
      telegraph.setVisible(false);
      state.isDashing = 1;
      state.dashDuration = 0.35;
      ctx.audio.playSwing(enemy.x, enemy.z, px, pz);
      state.dashVx = Math.sin(facing) * 14.0;
      state.dashVz = Math.cos(facing) * 14.0;
      state.dashCooldown = 3.6;
      ctx.audio.playExplosion(0.8);
    } else {
      telegraph.setVisible(false);
    }

    if (state.isDashing === 1) {
      const dur = (state.dashDuration ?? 0.35) - dt;
      state.dashDuration = dur;
      enemy.vx = state.dashVx ?? 0;
      enemy.vz = state.dashVz ?? 0;
      if (distToPlayer < 1.4) {
        ctx.applyPlayerDamage(ENEMY_ATTACK_DAMAGE.motoDash);
      }
      if (dur <= 0) {
        state.isDashing = 0;
        enemy.vx = 0;
        enemy.vz = 0;
      }
    }
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const mesh = this.meshes.get(enemy.id);
    if (mesh) {
      ctx.group.remove(mesh.group);
      mesh.dispose();
      this.meshes.delete(enemy.id);
    }
    const t = this.telegraphs.get(enemy.id);
    if (t) {
      ctx.group.remove(t.group);
      t.dispose();
      this.telegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const m of this.meshes.values()) {
      m.group.removeFromParent();
      m.dispose();
    }
    this.meshes.clear();
    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();
  }
}

export class PlasmaTurretBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, PlasmaTurretMesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const mesh = new PlasmaTurretMesh();
    mesh.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(mesh.group);
    this.meshes.set(enemy.id, mesh);
    return mesh.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const mesh = this.meshes.get(enemy.id);
    if (!mesh) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);

    mesh.group.position.set(enemy.x, 0, enemy.z);
    mesh.barrelGroup.rotation.y = facing;

    const state = (enemy.state = enemy.state ?? {});
    const shotCd = tickCooldown(state.shotCooldown ?? 2.2, dt, distToPlayer < 18.0, 0.4);
    state.shotCooldown = shotCd;

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new LineTelegraph(0.4, 0x00e5ff);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    if (shotCd <= 0.4 && shotCd > 0 && distToPlayer < 18.0) {
      const progress = (0.4 - shotCd) / 0.4;
      telegraph.update(enemy.x, enemy.z, px, pz, progress, 1.2);
    } else if (shotCd <= 0 && distToPlayer < 18.0) {
      telegraph.setVisible(false);
      state.shotCooldown = 2.4;
      ctx.audio.playEnemyShot('heavy');
      ctx.spawnEnemyProjectile(enemy.x, 0.95, enemy.z, px, pz, 13.0, ENEMY_ATTACK_DAMAGE.turretBolt);
    } else {
      telegraph.setVisible(false);
    }
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const mesh = this.meshes.get(enemy.id);
    if (mesh) {
      ctx.group.remove(mesh.group);
      mesh.dispose();
      this.meshes.delete(enemy.id);
    }
    const t = this.telegraphs.get(enemy.id);
    if (t) {
      ctx.group.remove(t.group);
      t.dispose();
      this.telegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const m of this.meshes.values()) {
      m.group.removeFromParent();
      m.dispose();
    }
    this.meshes.clear();
    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();
  }
}

