import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { HKTankMesh } from '../../graphics/meshes/HKTankMesh';
import { CircleTelegraph } from '../../graphics/Telegraphs';

export class HKTankBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, HKTankMesh>();
  private readonly telegraphs = new Map<number, CircleTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const tank = new HKTankMesh();
    tank.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(tank.group);
    this.meshes.set(enemy.id, tank);
    return tank.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const tank = this.meshes.get(enemy.id);
    if (!tank) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;

    tank.group.position.set(enemy.x, 0, enemy.z);
    const targetAngle = Math.atan2(px - enemy.x, pz - enemy.z);
    tank.group.rotation.y = targetAngle;

    const state = (enemy.state = enemy.state ?? {});
    const chargeTimer = (state.chargeTimer ?? enemy.chargeTimer ?? 0) + dt;
    state.chargeTimer = chargeTimer;
    enemy.chargeTimer = chargeTimer;

    if (!('targetX' in state) || chargeTimer <= dt * 1.5) {
      state.targetX = px;
      state.targetZ = pz;
    }
    const targetX = state.targetX;
    const targetZ = state.targetZ;

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new CircleTelegraph(4.5, 0xff1111);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    const chargeProgress = Math.min(1, chargeTimer / 3.0);
    telegraph.update(targetX, targetZ, chargeProgress, 4.5);

    if (chargeTimer >= 3.0) {
      state.chargeTimer = 0;
      enemy.chargeTimer = 0;
      ctx.audio.playExplosion(1.8);
      ctx.particles.spawnExplosion(targetX, 0.2, targetZ, 2.0);
      const blastDist = Math.hypot(px - targetX, pz - targetZ);
      if (blastDist < 4.5) {
        ctx.applyPlayerDamage(35);
      }
      telegraph.setVisible(false);
      enemy.state.targetX = px;
      enemy.state.targetZ = pz;
    }

    tank.update(ctx.timeSeconds, chargeProgress, chargeProgress, targetAngle);
  }

  public onRelocate(enemy: ActiveEnemy): void {
    const tank = this.meshes.get(enemy.id);
    if (tank) {
      tank.group.position.set(enemy.x, 0, enemy.z);
    }
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const tank = this.meshes.get(enemy.id);
    if (tank) {
      ctx.group.remove(tank.group);
      tank.dispose();
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
    for (const tank of this.meshes.values()) {
      tank.dispose();
    }
    this.meshes.clear();

    for (const telegraph of this.telegraphs.values()) {
      telegraph.dispose();
    }
    this.telegraphs.clear();
  }
}
