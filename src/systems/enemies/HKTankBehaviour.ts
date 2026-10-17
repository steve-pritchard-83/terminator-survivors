import * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { HKTankMesh } from '../../graphics/meshes/HKTankMesh';
import { disposeObject3D } from '../../graphics/dispose';

export class HKTankBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, HKTankMesh>();
  private readonly reticleMeshes = new Map<number, THREE.Mesh>();

  private readonly artilleryReticleGeo: THREE.RingGeometry;
  private readonly artilleryReticleMat: THREE.MeshBasicMaterial;

  constructor() {
    this.artilleryReticleGeo = new THREE.RingGeometry(4.2, 4.5, 32);
    this.artilleryReticleGeo.rotateX(-Math.PI / 2);
    this.artilleryReticleGeo.userData = { shared: true };

    this.artilleryReticleMat = new THREE.MeshBasicMaterial({
      color: 0xff1111,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.artilleryReticleMat.userData = { shared: true };
  }

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

    let reticle = this.reticleMeshes.get(enemy.id);
    if (!reticle) {
      reticle = new THREE.Mesh(this.artilleryReticleGeo, this.artilleryReticleMat.clone());
      ctx.group.add(reticle);
      this.reticleMeshes.set(enemy.id, reticle);
    }
    reticle.visible = true;
    reticle.position.set(targetX, 0.05, targetZ);
    const chargeProgress = Math.min(1, chargeTimer / 3.0);
    reticle.scale.set(chargeProgress, 1, chargeProgress);
    (reticle.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.65 * chargeProgress;

    if (chargeTimer >= 3.0) {
      state.chargeTimer = 0;
      enemy.chargeTimer = 0;
      ctx.audio.playExplosion(1.8);
      ctx.particles.spawnExplosion(targetX, 0.2, targetZ, 2.0);
      const blastDist = Math.hypot(px - targetX, pz - targetZ);
      if (blastDist < 4.5) {
        ctx.applyPlayerDamage(35);
      }
      reticle.visible = false;
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
    const reticle = this.reticleMeshes.get(enemy.id);
    if (reticle) {
      ctx.group.remove(reticle);
      disposeObject3D(reticle);
      this.reticleMeshes.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const tank of this.meshes.values()) {
      tank.dispose();
    }
    this.meshes.clear();

    for (const reticle of this.reticleMeshes.values()) {
      disposeObject3D(reticle);
    }
    this.reticleMeshes.clear();
  }
}
