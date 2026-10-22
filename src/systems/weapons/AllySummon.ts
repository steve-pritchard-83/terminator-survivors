import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';
import { createReprogrammedT800Mesh } from '../../graphics/meshes/AllyMeshes';
import { ALL_WEAPONS } from '../../data/weapons';
import { disposeObject3D } from '../../graphics/dispose';

export class AllySummon implements WeaponPattern {
  public mesh: THREE.Group | null = null;
  public x = 0;
  public z = 0;
  public hp = 300;
  public maxHp = 300;
  public rebootTimer = 0;
  public shootTimer = 0;
  public tauntTimer = 0;
  public isGuardian = false;

  public fire(): void {
    // Persistent summon; actions driven in update()
  }

  public update(
    dt: number,
    px: number,
    pz: number,
    _enemies: ActiveEnemy[],
    ctx: WeaponFireContext
  ): void {
    const allySlot = ctx.runState.weapons.get('reprogrammed_t800');
    const guardianSlot = ctx.runState.weapons.get('guardian_protocol');
    const activeSlot = guardianSlot || allySlot;

    if (!activeSlot) {
      this.clear(ctx.group);
      return;
    }

    const isGuardianNow = !!guardianSlot;
    if (!this.mesh || this.isGuardian !== isGuardianNow) {
      if (this.mesh) {
        ctx.group.remove(this.mesh);
        disposeObject3D(this.mesh);
      }
      this.isGuardian = isGuardianNow;
      this.mesh = createReprogrammedT800Mesh(this.isGuardian);
      this.x = px - 2.0;
      this.z = pz;
      this.mesh.position.set(this.x, 0, this.z);
      ctx.group.add(this.mesh);
      this.maxHp = this.isGuardian ? 750 : 300;
      this.hp = this.maxHp;
    }

    // Reboot handling
    if (this.rebootTimer > 0) {
      this.rebootTimer -= dt;
      this.mesh.position.y = -0.3; // Kneeling
      if (this.rebootTimer <= 0) {
        this.hp = this.maxHp;
        this.mesh.position.y = 0;
        ctx.audio.playServo();
      }
      return;
    }

    const def = ALL_WEAPONS[activeSlot.id];
    const stats = def?.levels[Math.min(activeSlot.level - 1, def.levels.length - 1)] ?? {
      damage: 40,
      speed: 28,
      amount: 1,
      area: 1.0,
      cooldown: 0.65,
      duration: 1.0,
      pierce: 2,
      level: 1,
      description: ''
    };

    const might = ctx.runState.computedStats.mightMultiplier;
    const dmg = Math.round(stats.damage * might);

    // Follow player position at ~2.5m offset
    const followOffset = 2.4;
    const desiredX = px - Math.cos(ctx.runState.playerFacing) * followOffset;
    const desiredZ = pz + Math.sin(ctx.runState.playerFacing) * followOffset;

    const dx = desiredX - this.x;
    const dz = desiredZ - this.z;
    const distToDesired = Math.hypot(dx, dz);

    if (distToDesired > 0.3) {
      const moveSpeed = 7.5;
      const step = Math.min(distToDesired, moveSpeed * dt);
      this.x += (dx / distToDesired) * step;
      this.z += (dz / distToDesired) * step;
    }

    this.mesh.position.set(this.x, 0, this.z);

    // Periodic taunt: pull enemies toward T-800
    this.tauntTimer -= dt;
    if (this.tauntTimer <= 0) {
      this.tauntTimer = 0.45;
      const tauntRadius = this.isGuardian ? 9.5 : 6.0;
      const nearby = ctx.grid.queryRadius(this.x, this.z, tauntRadius, ctx.scratch.empHit);
      for (let i = 0; i < nearby.length; i++) {
        const ent = nearby[i];
        if (ent.type === 'enemy') {
          const enemy = ent as ActiveEnemy;
          const edx = this.x - enemy.x;
          const edz = this.z - enemy.z;
          const edist = Math.hypot(edx, edz);
          if (edist > 0.5) {
            // Slight taunt pull toward T-800
            enemy.vx = (enemy.vx || 0) + (edx / edist) * 2.2;
            enemy.vz = (enemy.vz || 0) + (edz / edist) * 2.2;
          }
        }
      }
    }

    // Contact damage absorption
    const contactCandidates = ctx.grid.queryRadius(this.x, this.z, 1.2, ctx.scratch.droneHit);
    for (let c = 0; c < contactCandidates.length; c++) {
      if (contactCandidates[c].type === 'enemy') {
        this.hp -= 12 * dt;
        if (this.hp <= 0) {
          this.rebootTimer = 6.0;
          break;
        }
      }
    }

    // Firing plasma bursts at nearest enemy
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      const nearest = ctx.grid.findNearest(this.x, this.z, 16.0, (e) => e.type === 'enemy' && ctx.isVisible(e.x, e.z)) as ActiveEnemy | null;
      if (nearest) {
        const fireAngle = Math.atan2(nearest.x - this.x, nearest.z - this.z);
        this.mesh.rotation.y = fireAngle;
        this.shootTimer = this.isGuardian ? 0.28 : stats.cooldown;

        ctx.audio.playPlasmaShot(this.isGuardian);
        ctx.spawnProjectile({
          weaponId: def.id,
          meshCategory: this.isGuardian ? 'heavy_plasma' : 'plasma',
          x: this.x,
          y: 1.0,
          z: this.z,
          vx: Math.sin(fireAngle) * stats.speed,
          vy: 0,
          vz: Math.cos(fireAngle) * stats.speed,
          rotY: fireAngle,
          damage: dmg,
          radius: this.isGuardian ? 0.45 : 0.35,
          pierceLeft: stats.pierce,
          life: 0,
          maxLife: stats.duration,
          knockback: def.knockback
        });
      }
    }
  }

  public clear(group: THREE.Group): void {
    if (this.mesh) {
      group.remove(this.mesh);
      disposeObject3D(this.mesh);
      this.mesh = null;
    }
    this.hp = this.maxHp;
    this.rebootTimer = 0;
  }
}
