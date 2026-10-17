import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { T1000Mesh } from '../../graphics/meshes/T1000Mesh';

export class T1000Behaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, T1000Mesh>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const t1000 = new T1000Mesh();
    t1000.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(t1000.group);
    this.meshes.set(enemy.id, t1000);
    return t1000.group;
  }

  public update(enemy: ActiveEnemy, _dt: number, ctx: EnemyContext): void {
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
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const t1000 = this.meshes.get(enemy.id);
    if (t1000) {
      ctx.group.remove(t1000.group);
      t1000.dispose();
      this.meshes.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const t1000 of this.meshes.values()) {
      t1000.dispose();
    }
    this.meshes.clear();
  }
}
