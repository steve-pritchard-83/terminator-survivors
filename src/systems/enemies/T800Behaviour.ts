import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';

export class T800Behaviour implements EnemyBehaviour {
  public createVisual(): THREE.Object3D | null {
    return null;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);

    const state = (enemy.state = enemy.state ?? {});
    let cd = state.phaseCooldown ?? enemy.phaseState ?? 0;
    cd -= dt;

    if (cd <= 0 && distToPlayer >= 7.0 && distToPlayer <= 17.0) {
      cd = 4.0;
      ctx.spawnEnemyProjectile(enemy.x, 1.0, enemy.z, px, pz, 9.0, 10);
    }

    state.phaseCooldown = cd;
    enemy.phaseState = cd;
  }
}
