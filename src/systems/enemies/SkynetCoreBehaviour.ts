import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { SkynetCoreMesh } from '../../graphics/meshes/SkynetCoreMesh';
import { CircleTelegraph } from '../../graphics/Telegraphs';

export class SkynetCoreBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, SkynetCoreMesh>();
  private readonly telegraphs = new Map<number, CircleTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const core = new SkynetCoreMesh();
    core.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(core.group);
    this.meshes.set(enemy.id, core);
    return core.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const core = this.meshes.get(enemy.id);
    if (!core) return;

    core.group.position.set(enemy.x, 0, enemy.z);
    const isEnraged = enemy.hp < enemy.maxHp * 0.5;
    core.updateAnimation(dt, ctx.timeSeconds, isEnraged);

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new CircleTelegraph(12.0, 0x00e5ff);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    // Phase 2 Enraged Temporal Nova: radial ring of plasma bolts
    if (isEnraged) {
      const state = (enemy.state = enemy.state ?? {});
      let cd = state.novaCooldown ?? 3.5;
      cd -= dt;

      if (cd <= 0.6 && cd > 0) {
        const progress = (0.6 - cd) / 0.6;
        telegraph.update(enemy.x, enemy.z, progress, 12.0);
      } else if (cd <= 0) {
        cd = 4.8;
        state.novaCooldown = cd;
        telegraph.setVisible(false);
        ctx.emit('camera:shake', { trauma: 0.45 });
        ctx.audio.playPlasmaShot(true);

        const boltCount = 10;
        const baseAngle = ctx.timeSeconds * 1.8;
        for (let b = 0; b < boltCount; b++) {
          const angle = baseAngle + (b * Math.PI * 2) / boltCount;
          const targetX = enemy.x + Math.sin(angle) * 12.0;
          const targetZ = enemy.z + Math.cos(angle) * 12.0;
          ctx.spawnEnemyProjectile(enemy.x, 3.6, enemy.z, targetX, targetZ, 8.5, 18);
        }
      } else {
        telegraph.setVisible(false);
        state.novaCooldown = cd;
      }
    } else {
      telegraph.setVisible(false);
    }
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const core = this.meshes.get(enemy.id);
    if (core) {
      ctx.group.remove(core.group);
      core.dispose();
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
    for (const core of this.meshes.values()) {
      core.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.dispose();
    }
    this.telegraphs.clear();
  }
}
