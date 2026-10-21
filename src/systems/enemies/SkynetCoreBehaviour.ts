import type * as THREE from 'three';
import { ENEMY_ATTACK_DAMAGE } from '../../data/balance';
import type { ActiveEnemy } from '../../core/types';
import type { EnemyBehaviour, EnemyContext } from './EnemyBehaviour';
import { SkynetCoreMesh } from '../../graphics/meshes/SkynetCoreMesh';
import { CircleTelegraph, LineTelegraph } from '../../graphics/Telegraphs';

export class SkynetCoreBehaviour implements EnemyBehaviour {
  private readonly meshes = new Map<number, SkynetCoreMesh>();
  private readonly telegraphs = new Map<number, CircleTelegraph>();
  private readonly pullTelegraphs = new Map<number, CircleTelegraph>();
  private readonly spokeTelegraphs = new Map<number, LineTelegraph[]>();

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

    const px = ctx.runState.playerPos.x;
    const pz = ctx.runState.playerPos.z;

    core.group.position.set(enemy.x, 0, enemy.z);

    // Multi-phase threshold calculation
    let phase = 1;
    if (enemy.hp < enemy.maxHp * 0.20) {
      phase = 3;
    } else if (enemy.hp < enemy.maxHp * 0.50) {
      phase = 2;
    }
    enemy.phase = phase;

    const isEnraged = phase >= 2;
    core.updateAnimation(dt, ctx.timeSeconds, isEnraged);

    const state = (enemy.state = enemy.state ?? {});

    // Phase 2 trigger: Spawn wave of 4 T-800 Endoskeletons
    if (phase >= 2 && !state.t800WaveSpawned) {
      state.t800WaveSpawned = 1;
      ctx.audio.playSearchlightAlert();
      ctx.emit('camera:shake', { trauma: 0.65 });
      if (ctx.spawnEnemy) {
        for (let t = 0; t < 4; t++) {
          const angle = (t * Math.PI * 2) / 4;
          ctx.spawnEnemy('t800_endoskeleton', enemy.x + Math.sin(angle) * 4.5, enemy.z + Math.cos(angle) * 4.5);
        }
      }
    }

    // Telegraph setups
    let novaTelegraph = this.telegraphs.get(enemy.id);
    if (!novaTelegraph) {
      novaTelegraph = new CircleTelegraph(12.0, 0x00e5ff);
      ctx.group.add(novaTelegraph.group);
      this.telegraphs.set(enemy.id, novaTelegraph);
    }

    let pullTelegraph = this.pullTelegraphs.get(enemy.id);
    if (!pullTelegraph) {
      pullTelegraph = new CircleTelegraph(16.0, 0x7700ff);
      ctx.group.add(pullTelegraph.group);
      this.pullTelegraphs.set(enemy.id, pullTelegraph);
    }

    // ATTACK 1: Rotating plasma spokes (every 1.8s fires a 4-bolt spoke rotating in an X/+)
    const spokeTimer = (state.spokeTimer ?? 1.8) - dt;
    state.spokeTimer = spokeTimer;
    let spokeLines = this.spokeTelegraphs.get(enemy.id);
    if (!spokeLines) {
      spokeLines = [];
      for (let s = 0; s < 4; s++) {
        const line = new LineTelegraph(0.35, 0xff2288);
        ctx.group.add(line.group);
        spokeLines.push(line);
      }
      this.spokeTelegraphs.set(enemy.id, spokeLines);
    }
    if (spokeTimer <= 0.5 && spokeTimer > 0) {
      // The spokes fire along baseAngle = (time at fire) * 0.8, so the warning can predict it
      const fireAngle = (ctx.timeSeconds + spokeTimer) * 0.8;
      for (let s = 0; s < 4; s++) {
        const a = fireAngle + (s * Math.PI) / 2;
        spokeLines[s].update(enemy.x, enemy.z, enemy.x + Math.sin(a) * 14.0, enemy.z + Math.cos(a) * 14.0, (0.5 - spokeTimer) / 0.5, 1.0);
      }
    } else {
      for (const l of spokeLines) l.setVisible(false);
    }
    if (spokeTimer <= 0) {
      state.spokeTimer = 1.8;
      const baseAngle = ctx.timeSeconds * 0.8;
      for (let s = 0; s < 4; s++) {
        const spokeAngle = baseAngle + (s * Math.PI) / 2;
        const tx = enemy.x + Math.sin(spokeAngle) * 14.0;
        const tz = enemy.z + Math.cos(spokeAngle) * 14.0;
        ctx.spawnEnemyProjectile(enemy.x, 2.5, enemy.z, tx, tz, 9.0, ENEMY_ATTACK_DAMAGE.coreSpoke);
      }
      ctx.audio.playEnemyShot('light');
    }

    // ATTACK 2 (Phase 2+): Temporal Nova radial burst
    if (phase >= 2) {
      const novaCd = (state.novaCooldown ?? 3.5) - dt;
      state.novaCooldown = novaCd;

      if (novaCd <= 0.6 && novaCd > 0) {
        if (!state.novaCued) {
          state.novaCued = 1;
          ctx.audio.playTelegraph('charge', 0.6);
        }
        const progress = (0.6 - novaCd) / 0.6;
        novaTelegraph.update(enemy.x, enemy.z, progress, 12.0);
      } else if (novaCd <= 0) {
        state.novaCooldown = 4.8;
        state.novaCued = 0;
        novaTelegraph.setVisible(false);
        ctx.emit('camera:shake', { trauma: 0.5 });
        ctx.audio.playEnemyShot('heavy');

        const boltCount = 10;
        const baseAngle = ctx.timeSeconds * 1.8;
        for (let b = 0; b < boltCount; b++) {
          const angle = baseAngle + (b * Math.PI * 2) / boltCount;
          const targetX = enemy.x + Math.sin(angle) * 12.0;
          const targetZ = enemy.z + Math.cos(angle) * 12.0;
          ctx.spawnEnemyProjectile(enemy.x, 3.6, enemy.z, targetX, targetZ, 8.5, ENEMY_ATTACK_DAMAGE.coreNova);
        }
      } else {
        novaTelegraph.setVisible(false);
      }
    } else {
      novaTelegraph.setVisible(false);
    }

    // ATTACK 3 (Phase 3 Singularity Pulse): Gravitational pull toward core center
    if (phase === 3) {
      const pullTimer = (state.pullTimer ?? 3.0) - dt;
      state.pullTimer = pullTimer;

      if (pullTimer <= 1.0 && pullTimer > 0) {
        if (!state.pullCued) {
          state.pullCued = 1;
          ctx.audio.playTelegraph('charge', 1.0);
        }
        const progress = (1.0 - pullTimer) / 1.0;
        pullTelegraph.update(enemy.x, enemy.z, progress, 16.0);
      } else if (pullTimer <= 0) {
        pullTelegraph.setVisible(false);
        state.pullTimer = 3.5;
        state.pullCued = 0;
        ctx.audio.playEmpBlast();
        ctx.emit('camera:shake', { trauma: 0.7 });

        // Pull player towards core
        const distToCore = Math.hypot(px - enemy.x, pz - enemy.z);
        if (distToCore < 16.0 && distToCore > 0.5) {
          const pullForce = 4.0;
          ctx.runState.playerPos.x += ((enemy.x - px) / distToCore) * pullForce;
          ctx.runState.playerPos.z += ((enemy.z - pz) / distToCore) * pullForce;
          ctx.applyPlayerDamage(ENEMY_ATTACK_DAMAGE.corePull);
        }
      } else {
        pullTelegraph.setVisible(false);
      }
    } else {
      pullTelegraph.setVisible(false);
    }
  }

  public onDeath(enemy: ActiveEnemy, ctx: EnemyContext): void {
    ctx.audio.playExplosion(2.8);
    ctx.particles.spawnExplosion(enemy.x, 1.5, enemy.z, 5.0);
    ctx.particles.spawnEnemyDebris(enemy.x, 1.5, enemy.z, 24);
    ctx.emit('camera:shake', { trauma: 0.95 });
  }

  public dispose(enemy: ActiveEnemy, ctx: EnemyContext): void {
    const core = this.meshes.get(enemy.id);
    if (core) {
      ctx.group.remove(core.group);
      core.dispose();
      this.meshes.delete(enemy.id);
    }
    const novaTelegraph = this.telegraphs.get(enemy.id);
    if (novaTelegraph) {
      ctx.group.remove(novaTelegraph.group);
      novaTelegraph.dispose();
      this.telegraphs.delete(enemy.id);
    }
    const pullTelegraph = this.pullTelegraphs.get(enemy.id);
    if (pullTelegraph) {
      ctx.group.remove(pullTelegraph.group);
      pullTelegraph.dispose();
      this.pullTelegraphs.delete(enemy.id);
    }
    const spokeLines = this.spokeTelegraphs.get(enemy.id);
    if (spokeLines) {
      for (const l of spokeLines) {
        ctx.group.remove(l.group);
        l.dispose();
      }
      this.spokeTelegraphs.delete(enemy.id);
    }
  }

  public clear(): void {
    for (const core of this.meshes.values()) {
      core.group.removeFromParent();
      core.dispose();
    }
    this.meshes.clear();

    for (const t of this.telegraphs.values()) {
      t.group.removeFromParent();
      t.dispose();
    }
    this.telegraphs.clear();

    for (const p of this.pullTelegraphs.values()) {
      p.group.removeFromParent();
      p.dispose();
    }
    this.pullTelegraphs.clear();

    for (const lines of this.spokeTelegraphs.values()) {
      for (const l of lines) {
        l.group.removeFromParent();
        l.dispose();
      }
    }
    this.spokeTelegraphs.clear();
  }
}
