import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { T1000Mesh } from '../../graphics/meshes/T1000Mesh';
import { LineTelegraph } from '../../graphics/Telegraphs';

export class T1000Behaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, T1000Mesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();

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

    t1000.group.position.set(enemy.x, 0, enemy.z);
    t1000.group.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);

    const isLiquid = enemy.hp < enemy.maxHp * 0.45 && enemy.hp > enemy.maxHp * 0.25;
    const isSlashing = distToPlayer < 2.5;
    t1000.update(ctx.timeSeconds, isLiquid, isSlashing);

    const state = (enemy.state = enemy.state ?? {});
    let lungeCd = state.lungeCooldown ?? 2.5;
    lungeCd -= dt;

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new LineTelegraph(0.6, 0xdce8f8);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    if (lungeCd <= 0.5 && lungeCd > 0 && distToPlayer < 7.0) {
      const progress = (0.5 - lungeCd) / 0.5;
      telegraph.update(enemy.x, enemy.z, px, pz, progress, 1.2);
    } else if (lungeCd <= 0 && distToPlayer < 7.0) {
      lungeCd = 3.5;
      telegraph.setVisible(false);
      if (distToPlayer > 0.1) {
        enemy.vx = ((px - enemy.x) / distToPlayer) * 14.0;
        enemy.vz = ((pz - enemy.z) / distToPlayer) * 14.0;
      }
    } else {
      telegraph.setVisible(false);
      if (lungeCd < 0) lungeCd = 3.5;
    }
    state.lungeCooldown = lungeCd;
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const t1000 = this.meshes.get(enemy.id);
    if (t1000) {
      ctx.group.remove(t1000.group);
      t1000.dispose();
      this.meshes.delete(enemy.id);
    }
    const telegraph = this.telegraphs.get(enemy.id);
    if (telegraph) {
      ctx.group.remove(telegraph.group);
      telegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const t1000 of this.meshes.values()) {
      t1000.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.dispose();
    }
    this.telegraphs.clear();
  }
}
