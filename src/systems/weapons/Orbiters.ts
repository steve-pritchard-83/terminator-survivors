import * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';
import { ALL_WEAPONS } from '../../data/weapons';
import { disposeObject3D } from '../../graphics/dispose';

type DroneVariant = 'seeker' | 'ring';

interface DroneLook {
  glow: number;
  eyeMat: THREE.MeshStandardMaterial;
  rotorMat: THREE.MeshStandardMaterial;
  haloMat: THREE.MeshBasicMaterial;
  trailMat: THREE.MeshBasicMaterial;
}

export class Orbiters implements WeaponPattern {
  public orbitalDrones: THREE.Group[] = [];
  public droneHitCooldowns = new Map<number, number>();
  public orbitalAngle = 0;

  private variant: DroneVariant | null = null;
  private orbitTrail: THREE.Mesh | null = null;
  private spinTime = 0;

  // Shared geometry: one set for every drone
  private readonly hullGeo = new THREE.OctahedronGeometry(0.24, 0);
  private readonly eyeGeo = new THREE.SphereGeometry(0.085, 12, 8);
  private readonly rotorGeo = new THREE.TorusGeometry(0.34, 0.022, 6, 24);
  private readonly finGeo = new THREE.BoxGeometry(0.34, 0.03, 0.09);
  private readonly haloGeo = new THREE.SphereGeometry(0.42, 12, 8);
  private readonly trailGeo = new THREE.RingGeometry(0.985, 1.0, 96);
  private readonly hullMat = new THREE.MeshStandardMaterial({
    color: 0x2a3540,
    metalness: 0.9,
    roughness: 0.35
  });
  private readonly looks: Record<DroneVariant, DroneLook> = {
    seeker: Orbiters.makeLook(0x00e5ff),
    ring: Orbiters.makeLook(0xff4dd2)
  };

  private static makeLook(color: number): DroneLook {
    return {
      glow: color,
      eyeMat: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 4 }),
      rotorMat: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }),
      haloMat: new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      trailMat: new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    };
  }

  constructor() {
    const shared = [
      this.hullGeo, this.eyeGeo, this.rotorGeo, this.finGeo, this.haloGeo, this.trailGeo, this.hullMat
    ];
    for (const o of shared) o.userData = { shared: true };
    for (const look of Object.values(this.looks)) {
      look.eyeMat.userData = { shared: true };
      look.rotorMat.userData = { shared: true };
      look.haloMat.userData = { shared: true };
      look.trailMat.userData = { shared: true };
    }
  }

  private createDrone(variant: DroneVariant): THREE.Group {
    const look = this.looks[variant];
    const g = new THREE.Group();
    const hull = new THREE.Mesh(this.hullGeo, this.hullMat);
    hull.scale.set(1, 0.6, 1.25);
    const eye = new THREE.Mesh(this.eyeGeo, look.eyeMat);
    eye.position.set(0, 0, 0.26);
    const rotor = new THREE.Mesh(this.rotorGeo, look.rotorMat);
    rotor.rotation.x = Math.PI / 2;
    rotor.name = 'rotor';
    const finL = new THREE.Mesh(this.finGeo, this.hullMat);
    finL.position.set(-0.26, 0, -0.1);
    finL.rotation.z = 0.35;
    const finR = new THREE.Mesh(this.finGeo, this.hullMat);
    finR.position.set(0.26, 0, -0.1);
    finR.rotation.z = -0.35;
    const halo = new THREE.Mesh(this.haloGeo, look.haloMat);
    g.add(hull, eye, rotor, finL, finR, halo);
    if (variant === 'ring') g.scale.setScalar(1.2);
    return g;
  }

  private clearVisuals(group: THREE.Group): void {
    for (const d of this.orbitalDrones) {
      group.remove(d);
      disposeObject3D(d);
    }
    this.orbitalDrones.length = 0;
    if (this.orbitTrail) {
      group.remove(this.orbitTrail);
      this.orbitTrail = null;
    }
    this.variant = null;
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
      this.clearVisuals(ctx.group);
      this.droneHitCooldowns.clear();
      return;
    }

    const variant: DroneVariant = ringSlot ? 'ring' : 'seeker';
    if (this.variant !== variant) {
      // Weapon evolved (or first spawn): rebuild with the matching look
      this.clearVisuals(ctx.group);
      this.variant = variant;
      this.orbitTrail = new THREE.Mesh(this.trailGeo, this.looks[variant].trailMat);
      this.orbitTrail.rotation.x = -Math.PI / 2;
      ctx.group.add(this.orbitTrail);
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
    const orbitSpeed = stats.speed * ctx.runState.computedStats.speedMultiplier;
    const radius = (ringSlot ? 3.8 : 2.8) * stats.area * areaMult;
    const hitRadius = 0.6 * areaMult;

    this.orbitalAngle += dt * orbitSpeed;
    this.spinTime += dt;
    if (this.orbitTrail) {
      this.orbitTrail.position.set(px, 0.06, pz);
      this.orbitTrail.scale.setScalar(radius);
    }

    while (this.orbitalDrones.length < count) {
      const drone = this.createDrone(variant);
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
      dMesh.position.set(dx, 0.75 + Math.sin(this.spinTime * 3 + i) * 0.06, dz);
      dMesh.rotation.y = -a; // eye faces the direction of travel
      const rotor = dMesh.getObjectByName('rotor');
      if (rotor) rotor.rotation.z = this.spinTime * 14 + i;

      const hit = ctx.grid.queryRadius(dx, dz, hitRadius, ctx.scratch.droneHit);
      for (let h = 0; h < hit.length; h++) {
        const target = hit[h];
        if (target.type !== 'enemy') continue;
        if (!this.droneHitCooldowns.has(target.id)) {
          this.droneHitCooldowns.set(target.id, 0.35);
          const hitDir = { x: target.x - px, z: target.z - pz };
          ctx.applyDamageToTarget(target, damage, def?.knockback, hitDir, def?.id);
          ctx.audio.playDroneZap();
          ctx.particles.spawnPlasmaImpact(dx, 0.75, dz);
        }
      }
    }
  }

  public clear(group: THREE.Group): void {
    this.clearVisuals(group);
    this.droneHitCooldowns.clear();
    this.orbitalAngle = 0;
  }
}
