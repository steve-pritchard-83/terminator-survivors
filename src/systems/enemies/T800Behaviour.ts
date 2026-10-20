import type * as THREE from 'three';
import { tickCooldown } from './attackTimer';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { LineTelegraph } from '../../graphics/Telegraphs';

export class T800Behaviour implements EnemyBehaviour {
  private readonly telegraphs = new Map<number, LineTelegraph>();

  public createVisual(): THREE.Object3D | null {
    return null;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);

    const state = (enemy.state = enemy.state ?? {});
    let cd = state.phaseCooldown ?? enemy.phaseState ?? 0;
    cd = tickCooldown(cd, dt, distToPlayer >= 7.0 && distToPlayer <= 17.0, 0.5);

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new LineTelegraph(0.22, 0xff1744);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    // 0.5s laser sight telegraph before firing ranged plasma bolt
    if (cd <= 0.5 && cd > 0 && distToPlayer >= 7.0 && distToPlayer <= 17.0) {
      const chargeProgress = (0.5 - cd) / 0.5;
      telegraph.update(enemy.x, enemy.z, px, pz, chargeProgress);
    } else if (cd <= 0 && distToPlayer >= 7.0 && distToPlayer <= 17.0) {
      cd = 4.0;
      telegraph.setVisible(false);
      ctx.spawnEnemyProjectile(enemy.x, 1.0, enemy.z, px, pz, 9.0, 15);
    } else {
      telegraph.setVisible(false);
    }

    state.phaseCooldown = cd;
    enemy.phaseState = cd;
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const telegraph = this.telegraphs.get(enemy.id);
    if (telegraph) {
      ctx.group.remove(telegraph.group);
      telegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();
  }
}
