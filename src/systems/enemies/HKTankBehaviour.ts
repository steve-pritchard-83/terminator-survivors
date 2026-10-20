import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { HKTankMesh } from '../../graphics/meshes/HKTankMesh';
import { CircleTelegraph } from '../../graphics/Telegraphs';

export class HKTankBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, HKTankMesh>();
  private readonly telegraphs = new Map<number, CircleTelegraph>();
  private readonly searchlightTelegraphs = new Map<number, CircleTelegraph>();

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

    // Multi-phase threshold calculation
    let phase = 1;
    if (enemy.hp < enemy.maxHp * 0.20) {
      phase = 3;
    } else if (enemy.hp < enemy.maxHp * 0.50) {
      phase = 2;
    }
    enemy.phase = phase;

    const state = (enemy.state = enemy.state ?? {});

    // Phase 3 trigger: spawn 2 T-600s from rear hatch, crush obstacles
    if (phase === 3 && !state.phase3Triggered) {
      state.phase3Triggered = 1;
      ctx.audio.playSearchlightAlert();
      ctx.emit('camera:shake', { trauma: 0.6 });
      if (ctx.spawnEnemy) {
        ctx.spawnEnemy('t600_rusted', enemy.x - Math.sin(targetAngle) * 3.5, enemy.z - Math.cos(targetAngle) * 3.5);
        ctx.spawnEnemy('t600_rusted', enemy.x - Math.sin(targetAngle) * 4.5, enemy.z - Math.cos(targetAngle) * 4.5);
      }
    }

    // Mortar telegraph setup
    let mortarTelegraph = this.telegraphs.get(enemy.id);
    if (!mortarTelegraph) {
      mortarTelegraph = new CircleTelegraph(4.5, 0xff1111);
      ctx.group.add(mortarTelegraph.group);
      this.telegraphs.set(enemy.id, mortarTelegraph);
    }

    // Searchlight sweep telegraph setup
    let searchlightTelegraph = this.searchlightTelegraphs.get(enemy.id);
    if (!searchlightTelegraph) {
      searchlightTelegraph = new CircleTelegraph(5.5, 0xffaa00);
      ctx.group.add(searchlightTelegraph.group);
      this.searchlightTelegraphs.set(enemy.id, searchlightTelegraph);
    }

    // ATTACK 1: Artillery Mortar
    const chargeTimer = (state.chargeTimer ?? enemy.chargeTimer ?? 0) + dt;
    state.chargeTimer = chargeTimer;
    enemy.chargeTimer = chargeTimer;

    if (!('targetX' in state) || chargeTimer <= dt * 1.5) {
      state.targetX = px;
      state.targetZ = pz;
    }
    const targetX = state.targetX;
    const targetZ = state.targetZ;

    const chargeProgress = Math.min(1, chargeTimer / 3.0);
    mortarTelegraph.update(targetX, targetZ, chargeProgress, 4.5);

    if (chargeTimer >= 3.0) {
      state.chargeTimer = 0;
      enemy.chargeTimer = 0;
      ctx.audio.playExplosion(1.8);
      ctx.particles.spawnExplosion(targetX, 0.2, targetZ, 2.5);
      const blastDist = Math.hypot(px - targetX, pz - targetZ);
      if (blastDist < 4.5) {
        ctx.applyPlayerDamage(35);
      }
      mortarTelegraph.setVisible(false);
      state.targetX = px;
      state.targetZ = pz;
    }

    // ATTACK 2: Frontal Twin Plasma Cannon Spread
    let cannonCooldown = state.cannonCooldown ?? 2.8;
    cannonCooldown -= dt;
    const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);
    if (cannonCooldown <= 0 && distToPlayer < 24.0) {
      cannonCooldown = 3.2;
      const leftX = enemy.x + Math.sin(targetAngle - 0.25) * 2.2;
      const leftZ = enemy.z + Math.cos(targetAngle - 0.25) * 2.2;
      const rightX = enemy.x + Math.sin(targetAngle + 0.25) * 2.2;
      const rightZ = enemy.z + Math.cos(targetAngle + 0.25) * 2.2;
      ctx.spawnEnemyProjectile(leftX, 1.8, leftZ, px, pz, 14.0, 18);
      ctx.spawnEnemyProjectile(rightX, 1.8, rightZ, px, pz, 14.0, 18);
      ctx.audio.playPlasmaShot(true);
    }
    state.cannonCooldown = cannonCooldown;

    // ATTACK 3 (Phase 2+): Twin Searchlight Sweep & Barrage
    if (phase >= 2) {
      let searchlightLock = state.searchlightLock ?? 0;
      // The beam turns toward the player at a limited rate; standing still inside it builds the lock.
      const playerAngle = Math.atan2(px - enemy.x, pz - enemy.z);
      let beamAngle = state.beamAngle ?? playerAngle;
      let beamDiff = Math.atan2(Math.sin(playerAngle - beamAngle), Math.cos(playerAngle - beamAngle));
      const maxTurn = 0.8 * dt;
      beamAngle += Math.max(-maxTurn, Math.min(maxTurn, beamDiff));
      state.beamAngle = beamAngle;
      beamDiff = Math.atan2(Math.sin(playerAngle - beamAngle), Math.cos(playerAngle - beamAngle));
      const inFront = Math.abs(beamDiff) < 0.26;
      if (distToPlayer < 16.0 && inFront) {
        searchlightLock += dt;
        searchlightTelegraph.update(px, pz, Math.min(1, searchlightLock / 2.5), 5.5);

        if (searchlightLock >= 2.5) {
          searchlightLock = 0;
          searchlightTelegraph.setVisible(false);
          ctx.audio.playSearchlightAlert();
          ctx.audio.playExplosion(2.2);
          // Rapid 3-shell barrage around player
          for (let b = 0; b < 3; b++) {
            const bx = px + (ctx.rng.next() - 0.5) * 4.0;
            const bz = pz + (ctx.rng.next() - 0.5) * 4.0;
            ctx.particles.spawnExplosion(bx, 0.2, bz, 2.0);
            if (Math.hypot(px - bx, pz - bz) < 3.2) {
              ctx.applyPlayerDamage(24);
            }
          }
        }
      } else {
        searchlightLock = Math.max(0, searchlightLock - dt * 1.5);
        if (searchlightLock > 0) {
          searchlightTelegraph.update(px, pz, searchlightLock / 2.5, 5.5);
        } else {
          searchlightTelegraph.setVisible(false);
        }
      }
      state.searchlightLock = searchlightLock;
    } else {
      searchlightTelegraph.setVisible(false);
    }

    tank.update(ctx.timeSeconds, chargeProgress, chargeProgress, targetAngle);
  }

  public onDeath(enemy: ActiveEnemy, ctx: EnemyContext): void {
    ctx.audio.playExplosion(2.5);
    ctx.particles.spawnExplosion(enemy.x, 0.5, enemy.z, 4.0);
    ctx.particles.spawnExplosion(enemy.x + 1.2, 0.8, enemy.z - 1.0, 3.0);
    ctx.particles.spawnEnemyDebris(enemy.x, 0.5, enemy.z, 16);
    ctx.emit('camera:shake', { trauma: 0.8 });
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
    const mortarTelegraph = this.telegraphs.get(enemy.id);
    if (mortarTelegraph) {
      ctx.group.remove(mortarTelegraph.group);
      mortarTelegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
    const searchlightTelegraph = this.searchlightTelegraphs.get(enemy.id);
    if (searchlightTelegraph) {
      ctx.group.remove(searchlightTelegraph.group);
      searchlightTelegraph.dispose();
      this.searchlightTelegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const tank of this.meshes.values()) {
      tank.group.removeFromParent();
      tank.dispose();
    }
    this.meshes.clear();

    for (const telegraph of this.telegraphs.values()) {
      telegraph.group.removeFromParent();
      telegraph.dispose();
    }
    this.telegraphs.clear();

    for (const st of this.searchlightTelegraphs.values()) {
      st.group.removeFromParent();
      st.dispose();
    }
    this.searchlightTelegraphs.clear();
  }
}
