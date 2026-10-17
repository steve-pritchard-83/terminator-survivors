import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { InfiltratorMesh } from '../../graphics/meshes/InfiltratorMesh';
import { LineTelegraph } from '../../graphics/Telegraphs';

export class InfiltratorBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, InfiltratorMesh>();
  private readonly telegraphs = new Map<number, LineTelegraph>();

  public createVisual(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null {
    const infiltrator = new InfiltratorMesh();
    infiltrator.group.position.set(enemy.x, 0, enemy.z);
    ctx.group.add(infiltrator.group);
    this.meshes.set(enemy.id, infiltrator);
    return infiltrator.group;
  }

  public update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void {
    const infiltrator = this.meshes.get(enemy.id);
    if (!infiltrator) return;

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);

    infiltrator.group.position.set(enemy.x, 0, enemy.z);
    const facing = Math.atan2(px - enemy.x, pz - enemy.z);

    const state = (enemy.state = enemy.state ?? {});
    let shotsLeft = state.burstShotsLeft ?? 0;
    let burstTimer = state.burstTimer ?? 0;
    let cooldown = state.burstCooldown ?? enemy.phaseState ?? 0;
    let isFiring = false;

    let telegraph = this.telegraphs.get(enemy.id);
    if (!telegraph) {
      telegraph = new LineTelegraph(0.45, 0xff1744);
      ctx.group.add(telegraph.group);
      this.telegraphs.set(enemy.id, telegraph);
    }

    if (shotsLeft > 0) {
      telegraph.setVisible(false);
      burstTimer -= dt;
      isFiring = true;
      if (burstTimer <= 0) {
        shotsLeft--;
        burstTimer = 0.15;
        const spreadX = (ctx.rng.next() - 0.5) * 1.2;
        const spreadZ = (ctx.rng.next() - 0.5) * 1.2;
        ctx.spawnEnemyProjectile(enemy.x, 1.25, enemy.z, px + spreadX, pz + spreadZ, 12.0, 15);
        ctx.audio.playPlasmaShot(true);
      }
    } else {
      cooldown -= dt;
      if (cooldown <= 0.5 && cooldown > 0 && distToPlayer >= 4.0 && distToPlayer <= 20.0) {
        const progress = (0.5 - cooldown) / 0.5;
        telegraph.update(enemy.x, enemy.z, px, pz, progress, 1.4);
      } else if (cooldown <= 0 && distToPlayer >= 4.0 && distToPlayer <= 20.0) {
        cooldown = 3.2; // Interval between bursts
        shotsLeft = 3;
        burstTimer = 0;
        telegraph.setVisible(false);
      } else {
        telegraph.setVisible(false);
      }
    }

    state.burstShotsLeft = shotsLeft;
    state.burstTimer = burstTimer;
    state.burstCooldown = cooldown;
    enemy.phaseState = cooldown;

    infiltrator.updateAnimation(dt, enemy.speed, facing, isFiring);
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const infiltrator = this.meshes.get(enemy.id);
    if (infiltrator) {
      ctx.group.remove(infiltrator.group);
      infiltrator.dispose();
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
    for (const infiltrator of this.meshes.values()) {
      infiltrator.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.dispose();
    }
    this.telegraphs.clear();
  }
}
