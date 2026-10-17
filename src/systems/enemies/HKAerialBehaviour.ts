import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { HKAerialMesh } from '../../graphics/meshes/HKAerialMesh';

export class HKAerialBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, HKAerialMesh>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const isLeader = enemy.archetype === 'hk_aerial_squadron_leader';
    const hk = new HKAerialMesh(isLeader);
    hk.group.position.set(enemy.x, 6.5, enemy.z);
    ctx.group.add(hk.group);
    this.meshes.set(enemy.id, hk);
    return hk.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const hk = this.meshes.get(enemy.id);
    if (!hk) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;

    hk.group.position.set(enemy.x, 6.5, enemy.z);
    hk.group.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);

    // Searchlight ground detection: checks if player is inside searchlight cone pool
    const searchlightTargetZ = enemy.z + Math.cos(hk.group.rotation.y) * 8.5;
    const searchlightTargetX = enemy.x + Math.sin(hk.group.rotation.y) * 8.5;
    const distToSearchlight = Math.hypot(px - searchlightTargetX, pz - searchlightTargetZ);

    const state = (enemy.state = enemy.state ?? {});
    let alertTimer = state.searchlightAlert ?? enemy.searchlightAlertTimer ?? 0;
    if (distToSearchlight < 3.8) {
      alertTimer += dt;
      if (alertTimer >= 1.2) {
        ctx.audio.playSearchlightAlert();
        ctx.audio.playPlasmaShot(true);
        ctx.applyPlayerDamage(18);
        alertTimer = 0;
      }
    } else {
      alertTimer = Math.max(0, alertTimer - dt * 1.5);
    }

    state.searchlightAlert = alertTimer;
    enemy.searchlightAlertTimer = alertTimer;

    hk.update(ctx.timeSeconds, alertTimer / 1.2, 0);
  }

  public onRelocate(enemy: ActiveEnemy): void {
    const hk = this.meshes.get(enemy.id);
    if (hk) {
      hk.group.position.set(enemy.x, 6.5, enemy.z);
    }
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const hk = this.meshes.get(enemy.id);
    if (hk) {
      ctx.group.remove(hk.group);
      hk.dispose();
      this.meshes.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const hk of this.meshes.values()) {
      hk.dispose();
    }
    this.meshes.clear();
  }
}
