import * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';
import { ALL_WEAPONS } from '../../data/weapons';
import { disposeObject3D } from '../../graphics/dispose';

export class Orbiters implements WeaponPattern {
  public orbitalDrones: THREE.Mesh[] = [];
  public droneHitCooldowns = new Map<number, number>();
  public orbitalAngle = 0;

  private readonly droneGeo = new THREE.BoxGeometry(0.35, 0.12, 0.35);
  private readonly droneMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00c4e6,
    emissiveIntensity: 3.5
  });

  constructor() {
    this.droneGeo.userData = { shared: true };
    this.droneMat.userData = { shared: true };
  }

  public fire(): void {
    // Persistent orbiters do not fire discretely; continuous motion is driven via update
  }

  public update(
    dt: number,
    px: number,
    pz: number,
    _enemies: ActiveEnemy[],
    ctx: WeaponFireContext
  ): void {
    const seekerSlot = ctx.runState.weapons.get('seeker_drone');
    const ringSlot = ctx.runState.weapons.get('perimeter_ring');
    const activeSlot = ringSlot || seekerSlot;

    if (!activeSlot) {
      for (const d of this.orbitalDrones) {
        ctx.group.remove(d);
        disposeObject3D(d);
      }
      this.orbitalDrones.length = 0;
      this.droneHitCooldowns.clear();
      return;
    }

    for (const [id, cd] of this.droneHitCooldowns.entries()) {
      const nextCd = cd - dt;
      if (nextCd <= 0) {
        this.droneHitCooldowns.delete(id);
      } else {
        this.droneHitCooldowns.set(id, nextCd);
      }
    }

    const def = ALL_WEAPONS[activeSlot.id];
    const stats = def?.levels[Math.min(activeSlot.level - 1, def.levels.length - 1)] ?? {
      damage: 18,
      speed: 4.2,
      amount: 2,
      area: 1.1,
      cooldown: 3.2,
      duration: 2.6,
      pierce: 99,
      level: 1,
      description: ''
    };

    const might = ctx.runState.computedStats.mightMultiplier;
    const areaMult = ctx.runState.computedStats.areaMultiplier;
    const damage = Math.round(stats.damage * might);
    const count = Math.min(8, Math.max(1, stats.amount + ctx.runState.computedStats.bonusAmount));
    const orbitSpeed = stats.speed;
    const radius = (ringSlot ? 3.8 : 2.8) * areaMult;
    const hitRadius = 0.6 * areaMult;

    this.orbitalAngle += dt * orbitSpeed;

    while (this.orbitalDrones.length < count) {
      const drone = new THREE.Mesh(this.droneGeo, this.droneMat);
      ctx.group.add(drone);
      this.orbitalDrones.push(drone);
    }
    while (this.orbitalDrones.length > count) {
      const removed = this.orbitalDrones.pop()!;
      ctx.group.remove(removed);
      disposeObject3D(removed);
    }

    for (let i = 0; i < count; i++) {
      const a = this.orbitalAngle + (i / count) * Math.PI * 2;
      const dx = px + Math.cos(a) * radius;
      const dz = pz + Math.sin(a) * radius;

      const dMesh = this.orbitalDrones[i];
      dMesh.position.set(dx, 0.75, dz);
      dMesh.rotation.y = -a;

      const hit = ctx.grid.queryRadius(dx, dz, hitRadius, ctx.scratch.droneHit);
      for (let h = 0; h < hit.length; h++) {
        const target = hit[h];
        if (target.type !== 'enemy') continue;
        if (!this.droneHitCooldowns.has(target.id)) {
          this.droneHitCooldowns.set(target.id, 0.35);
          const hitDir = { x: target.x - px, z: target.z - pz };
          ctx.applyDamageToTarget(target, damage, def?.knockback, hitDir);
          ctx.audio.playEndoHit();
          ctx.particles.spawnPlasmaImpact(dx, 0.75, dz);
        }
      }
    }
  }

  public clear(group: THREE.Group): void {
    for (const d of this.orbitalDrones) {
      group.remove(d);
      disposeObject3D(d);
    }
    this.orbitalDrones.length = 0;
    this.droneHitCooldowns.clear();
    this.orbitalAngle = 0;
  }
}
