import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { HKAerialMesh } from '../../graphics/meshes/HKAerialMesh';
import { CircleTelegraph, LineTelegraph } from '../../graphics/Telegraphs';

export class HKAerialBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, HKAerialMesh>();
  private readonly telegraphs = new Map<number, CircleTelegraph>();
  private readonly strafeTelegraphs = new Map<number, LineTelegraph>();
  private readonly salvoTelegraphs = new Map<number, CircleTelegraph[]>();
  private readonly diveTelegraphs = new Map<number, CircleTelegraph>();

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

    const isBoss = enemy.archetype === 'hk_aerial_squadron_leader';

    // Multi-phase threshold calculation
    let phase = 1;
    if (isBoss) {
      if (enemy.hp < enemy.maxHp * 0.20) {
        phase = 3;
      } else if (enemy.hp < enemy.maxHp * 0.50) {
        phase = 2;
      }
      enemy.phase = phase;
    }

    const state = (enemy.state = enemy.state ?? {});

    // Phase 2 trigger: Call 2 HK patrol escorts
    if (isBoss && phase >= 2 && !state.escortsCalled) {
      state.escortsCalled = 1;
      ctx.audio.playSearchlightAlert();
      ctx.emit('camera:shake', { trauma: 0.5 });
      if (ctx.spawnEnemy) {
        ctx.spawnEnemy('hk_aerial_patrol', enemy.x - 5.0, enemy.z + 4.0);
        ctx.spawnEnemy('hk_aerial_patrol', enemy.x + 5.0, enemy.z + 4.0);
      }
    }

    let currentY = 6.5;

    // ATTACK 4 (Phase 3 Kamikaze dive): dives towards ground
    let diveTelegraph = this.diveTelegraphs.get(enemy.id);
    if (isBoss && phase === 3) {
      if (!diveTelegraph) {
        diveTelegraph = new CircleTelegraph(8.0, 0xff0044);
        ctx.group.add(diveTelegraph.group);
        this.diveTelegraphs.set(enemy.id, diveTelegraph);
      }

      const diveTimer = (state.diveTimer ?? 8.0) - dt;
      state.diveTimer = diveTimer;

      if (diveTimer <= 1.2 && diveTimer > 0) {
        const progress = (1.2 - diveTimer) / 1.2;
        diveTelegraph.update(enemy.x, enemy.z, progress, 8.0);
        currentY = 6.5 - progress * 5.0; // descends
      } else if (diveTimer <= 0) {
        diveTelegraph.setVisible(false);
        state.diveTimer = 9.0;
        ctx.audio.playExplosion(2.4);
        ctx.particles.spawnExplosion(enemy.x, 0.5, enemy.z, 3.5);
        ctx.emit('camera:shake', { trauma: 0.75 });
        if (Math.hypot(px - enemy.x, pz - enemy.z) < 8.0) {
          ctx.applyPlayerDamage(45);
        }
      } else {
        diveTelegraph.setVisible(false);
      }
    } else if (diveTelegraph) {
      diveTelegraph.setVisible(false);
    }

    hk.group.position.set(enemy.x, currentY, enemy.z);
    hk.group.rotation.y = Math.atan2(px - enemy.x, pz - enemy.z);

    // ATTACK 1: Searchlight tracking laser
    const searchlightTargetZ = enemy.z + Math.cos(hk.group.rotation.y) * 8.5;
    const searchlightTargetX = enemy.x + Math.sin(hk.group.rotation.y) * 8.5;
    const distToSearchlight = Math.hypot(px - searchlightTargetX, pz - searchlightTargetZ);

    let alertTimer = state.searchlightAlert ?? enemy.searchlightAlertTimer ?? 0;
    let searchlightTelegraph = this.telegraphs.get(enemy.id);
    if (!searchlightTelegraph) {
      searchlightTelegraph = new CircleTelegraph(3.8, 0xff1744);
      ctx.group.add(searchlightTelegraph.group);
      this.telegraphs.set(enemy.id, searchlightTelegraph);
    }

    if (distToSearchlight < 3.8) {
      alertTimer += dt;
      searchlightTelegraph.update(searchlightTargetX, searchlightTargetZ, alertTimer / 1.2, 3.8);
      if (alertTimer >= 1.2) {
        ctx.audio.playSearchlightAlert();
        ctx.audio.playPlasmaShot(true);
        ctx.applyPlayerDamage(isBoss ? 28 : 18);
        alertTimer = 0;
        searchlightTelegraph.setVisible(false);
      }
    } else {
      alertTimer = Math.max(0, alertTimer - dt * 1.5);
      if (alertTimer > 0) {
        searchlightTelegraph.update(searchlightTargetX, searchlightTargetZ, alertTimer / 1.2, 3.8);
      } else {
        searchlightTelegraph.setVisible(false);
      }
    }
    state.searchlightAlert = alertTimer;
    enemy.searchlightAlertTimer = alertTimer;

    // ATTACK 2: Strafing run with line telegraph (boss only)
    if (isBoss) {
      let strafeTelegraph = this.strafeTelegraphs.get(enemy.id);
      if (!strafeTelegraph) {
        strafeTelegraph = new LineTelegraph(2.4, 0xff3300);
        ctx.group.add(strafeTelegraph.group);
        this.strafeTelegraphs.set(enemy.id, strafeTelegraph);
      }

      const strafeTimer = (state.strafeTimer ?? 4.5) - dt;
      state.strafeTimer = strafeTimer;

      if (strafeTimer <= 0.8 && strafeTimer > 0) {
        const progress = (0.8 - strafeTimer) / 0.8;
        const aheadX = enemy.x + Math.sin(hk.group.rotation.y) * 16.0;
        const aheadZ = enemy.z + Math.cos(hk.group.rotation.y) * 16.0;
        strafeTelegraph.update(enemy.x, enemy.z, aheadX, aheadZ, progress, 2.0);
      } else if (strafeTimer <= 0) {
        strafeTelegraph.setVisible(false);
        state.strafeTimer = 5.2;
        ctx.audio.playPlasmaShot(true);
        // Carpet bombing 4 plasma bombs along the line
        for (let s = 1; s <= 4; s++) {
          const bx = enemy.x + Math.sin(hk.group.rotation.y) * (s * 3.8);
          const bz = enemy.z + Math.cos(hk.group.rotation.y) * (s * 3.8);
          ctx.particles.spawnExplosion(bx, 0.2, bz, 1.4);
          if (Math.hypot(px - bx, pz - bz) < 2.4) {
            ctx.applyPlayerDamage(22);
          }
        }
      } else {
        strafeTelegraph.setVisible(false);
      }

      // ATTACK 3 (Phase 2+): Missile salvo (6 circles)
      if (phase >= 2) {
        let salvoList = this.salvoTelegraphs.get(enemy.id);
        if (!salvoList) {
          salvoList = [];
          for (let m = 0; m < 6; m++) {
            const ct = new CircleTelegraph(2.2, 0xff2200);
            ctx.group.add(ct.group);
            salvoList.push(ct);
          }
          this.salvoTelegraphs.set(enemy.id, salvoList);
        }

        const salvoTimer = (state.salvoTimer ?? 6.0) - dt;
        state.salvoTimer = salvoTimer;

        if (salvoTimer <= 1.0 && salvoTimer > 0) {
          const progress = (1.0 - salvoTimer) / 1.0;
          for (let m = 0; m < 6; m++) {
            const angle = (m * Math.PI * 2) / 6;
            const mx = px + Math.sin(angle) * 3.8;
            const mz = pz + Math.cos(angle) * 3.8;
            salvoList[m].update(mx, mz, progress, 2.2);
          }
        } else if (salvoTimer <= 0) {
          for (const s of salvoList) s.setVisible(false);
          state.salvoTimer = 7.0;
          ctx.audio.playExplosion(1.8);
          for (let m = 0; m < 6; m++) {
            const angle = (m * Math.PI * 2) / 6;
            const mx = px + Math.sin(angle) * 3.8;
            const mz = pz + Math.cos(angle) * 3.8;
            ctx.particles.spawnExplosion(mx, 0.2, mz, 1.6);
            if (Math.hypot(px - mx, pz - mz) < 2.2) {
              ctx.applyPlayerDamage(20);
            }
          }
        } else {
          for (const s of salvoList) s.setVisible(false);
        }
      }
    }

    hk.update(ctx.timeSeconds, alertTimer / 1.2, 0);
  }

  public onDeath(enemy: ActiveEnemy, ctx: EnemyContext): void {
    ctx.audio.playExplosion(2.5);
    ctx.particles.spawnExplosion(enemy.x, 4.0, enemy.z, 4.0);
    ctx.particles.spawnEnemyDebris(enemy.x, 2.0, enemy.z, 16);
    ctx.emit('camera:shake', { trauma: 0.8 });
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
    const searchlightTelegraph = this.telegraphs.get(enemy.id);
    if (searchlightTelegraph) {
      ctx.group.remove(searchlightTelegraph.group);
      searchlightTelegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
    const strafeTelegraph = this.strafeTelegraphs.get(enemy.id);
    if (strafeTelegraph) {
      ctx.group.remove(strafeTelegraph.group);
      strafeTelegraph.dispose();
      this.strafeTelegraphs.delete(enemy.id);
    }
    const salvoList = this.salvoTelegraphs.get(enemy.id);
    if (salvoList) {
      for (const s of salvoList) {
        ctx.group.remove(s.group);
        s.dispose();
      }
      this.salvoTelegraphs.delete(enemy.id);
    }
    const diveTelegraph = this.diveTelegraphs.get(enemy.id);
    if (diveTelegraph) {
      ctx.group.remove(diveTelegraph.group);
      diveTelegraph.dispose();
      this.diveTelegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const hk of this.meshes.values()) {
      hk.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.dispose();
    }
    this.telegraphs.clear();

    for (const st of this.strafeTelegraphs.values()) {
      st.dispose();
    }
    this.strafeTelegraphs.clear();

    for (const sl of this.salvoTelegraphs.values()) {
      for (const s of sl) s.dispose();
    }
    this.salvoTelegraphs.clear();

    for (const d of this.diveTelegraphs.values()) {
      d.dispose();
    }
    this.diveTelegraphs.clear();
  }
}
