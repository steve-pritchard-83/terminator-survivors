import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ParticleSystem } from './ParticleSystem';
import type { PickupSystem } from './PickupSystem';
import type { EnemySystem } from './EnemySystem';
import type { ActiveEnemy, SpatialEntity } from '../core/types';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import { disposeObject3D } from '../graphics/dispose';
import type { IEnvironment } from '../graphics/environments/IEnvironment';

export interface FuelDrum extends SpatialEntity {
  type: 'crate';
  hp: number;
  maxHp: number;
  mesh: THREE.Group;
  isDetonating: boolean;
}

export interface DestructibleCar {
  id: number;
  x: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  mesh: THREE.Group;
  isDestroyed: boolean;
}

export interface SupplyDropFlare {
  x: number;
  z: number;
  timeRemaining: number;
  beaconMesh: THREE.Group;
  active: boolean;
}

export class InteractiveEnvironmentSystem {
  public readonly group = new THREE.Group();
  public readonly fuelDrums: FuelDrum[] = [];
  public readonly cars: DestructibleCar[] = [];
  public activeFlare: SupplyDropFlare | null = null;

  private nextEntityId = 50000;
  private lastFlareDropTime = 0;
  private readonly unbinds: Array<() => void> = [];

  constructor(
    private readonly runState: RunState,
    private readonly grid: SpatialHashGrid,
    scene: THREE.Scene,
    private readonly audio: AudioEngine,
    private readonly particles: ParticleSystem,
    private readonly pickupSystem: PickupSystem,
    private readonly enemySystem: EnemySystem
  ) {
    scene.add(this.group);

    // Initial spawn of fuel drums and destructible cars around the battlefield
    this.spawnInitialInteractables();

    // Listen for crate destruction events (player weapons shooting fuel drums)
    this.unbinds.push(
      globalEvents.on('crate:destroyed', ({ crateId }) => {
        const drum = this.fuelDrums.find((d) => d.id === crateId && !d.isDetonating);
        if (drum) {
          this.detonateFuelDrum(drum);
        }
      })
    );
  }

  private spawnInitialInteractables(): void {
    // Spawn 12 explosive fuel drums in strategic clusters (enabling chain reactions)
    const drumClusters = [
      { cx: -8, cz: 10, count: 3 },
      { cx: 12, cz: -14, count: 3 },
      { cx: -15, cz: -12, count: 3 },
      { cx: 10, cz: 16, count: 3 }
    ];

    for (const cluster of drumClusters) {
      for (let i = 0; i < cluster.count; i++) {
        const offsetDist = i * 2.2; // Within 4.8m chain reaction radius!
        const angle = (i / cluster.count) * Math.PI * 2;
        const x = cluster.cx + Math.cos(angle) * offsetDist;
        const z = cluster.cz + Math.sin(angle) * offsetDist;
        this.spawnFuelDrum(x, z);
      }
    }

    // Spawn 8 destructible car wrecks that provide cover
    const carPositions = [
      { x: -6, z: 6 },
      { x: 7, z: -8 },
      { x: -12, z: -6 },
      { x: 14, z: 10 },
      { x: -16, z: 14 },
      { x: 18, z: -16 },
      { x: -8, z: -20 },
      { x: 8, z: 22 }
    ];

    for (const pos of carPositions) {
      this.spawnDestructibleCar(pos.x, pos.z);
    }
  }

  public spawnFuelDrum(x: number, z: number): FuelDrum {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Red drum body
    const drumGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.85, 12);
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0xcc1100,
      roughness: 0.5,
      metalness: 0.6
    });
    const drumMesh = new THREE.Mesh(drumGeo, drumMat);
    drumMesh.position.y = 0.425;
    group.add(drumMesh);

    // Yellow hazard bands
    const bandGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.12, 12);
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const topBand = new THREE.Mesh(bandGeo, bandMat);
    topBand.position.y = 0.65;
    const botBand = new THREE.Mesh(bandGeo, bandMat);
    botBand.position.y = 0.2;
    group.add(topBand, botBand);

    this.group.add(group);

    const drum: FuelDrum = {
      id: this.nextEntityId++,
      type: 'crate',
      x,
      z,
      radius: 0.55,
      hp: 20,
      maxHp: 20,
      mesh: group,
      isDetonating: false
    };

    this.fuelDrums.push(drum);
    this.grid.insert(drum);
    return drum;
  }

  public detonateFuelDrum(drum: FuelDrum): void {
    if (drum.isDetonating) return;
    drum.isDetonating = true;

    const x = drum.x;
    const z = drum.z;
    const blastRadius = 4.8;
    const blastDamage = 220;

    // Visual & Audio effects
    this.audio.playDrumExplosion(x, z, this.runState.playerPos.x, this.runState.playerPos.z);
    this.particles.spawnExplosion(x, 0.4, z, 1.6);
    globalEvents.emit('camera:shake', { trauma: 0.38 });

    // Damage enemies in blast radius
    const candidates: SpatialEntity[] = [];
    this.grid.queryRadius(x, z, blastRadius, candidates);

    for (let i = 0; i < candidates.length; i++) {
      const ent = candidates[i];
      if (ent.type === 'enemy') {
        const enemy = ent as ActiveEnemy;
        const edx = enemy.x - x;
        const edz = enemy.z - z;
        const edist = Math.max(0.001, Math.hypot(edx, edz));

        // Outward impulse knockback
        const impulse = 25 / Math.max(0.1, enemy.mass || 1.0);
        enemy.vx = (enemy.vx || 0) + (edx / edist) * impulse;
        enemy.vz = (enemy.vz || 0) + (edz / edist) * impulse;

        enemy.hp -= blastDamage;
        enemy.hitFlashTimer = 0.2;
        this.particles.spawnPlasmaImpact(enemy.x, 0.5, enemy.z);

        globalEvents.emit('enemy:damaged', {
          x: enemy.x,
          z: enemy.z,
          damage: blastDamage,
          isCrit: true,
          enemyId: enemy.id
        });

        // Enemies at hp <= 0 are killed once by EnemySystem.update; do not emit enemy:killed here.
      }
    }

    // Damage destructible cars caught in the blast
    for (const car of this.cars) {
      if (!car.isDestroyed && Math.hypot(car.x - x, car.z - z) <= blastRadius + car.radius) {
        this.damageCar(car, blastDamage * 0.75);
      }
    }

    // Chain reaction: detonate neighboring fuel drums within blast radius
    for (const other of this.fuelDrums) {
      if (other.id !== drum.id && !other.isDetonating) {
        const dist = Math.hypot(other.x - x, other.z - z);
        if (dist <= blastRadius) {
          this.detonateFuelDrum(other);
        }
      }
    }

    // Remove drum from scene & collection
    const idx = this.fuelDrums.indexOf(drum);
    if (idx !== -1) {
      this.fuelDrums.splice(idx, 1);
    }
    this.group.remove(drum.mesh);
    disposeObject3D(drum.mesh);
  }

  public spawnDestructibleCar(x: number, z: number): DestructibleCar {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Car chassis body
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.7, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x735e4b, // Burnt rust metal (light enough to read from the top-down camera)
      roughness: 0.9,
      metalness: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45;
    group.add(body);

    // Cabin roof
    const roofGeo = new THREE.BoxGeometry(1.8, 0.55, 2.0);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.0, -0.2);
    group.add(roof);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });

    const wFL = new THREE.Mesh(wheelGeo, wheelMat);
    wFL.position.set(-1.1, 0.35, 1.2);
    const wFR = new THREE.Mesh(wheelGeo, wheelMat);
    wFR.position.set(1.1, 0.35, 1.2);
    const wBL = new THREE.Mesh(wheelGeo, wheelMat);
    wBL.position.set(-1.1, 0.35, -1.2);
    const wBR = new THREE.Mesh(wheelGeo, wheelMat);
    wBR.position.set(1.1, 0.35, -1.2);
    group.add(wFL, wFR, wBL, wBR);

    this.group.add(group);

    const car: DestructibleCar = {
      id: this.nextEntityId++,
      x,
      z,
      radius: 1.85,
      hp: 120,
      maxHp: 120,
      mesh: group,
      isDestroyed: false
    };

    this.cars.push(car);
    return car;
  }

  public damageCar(car: DestructibleCar, dmg: number): void {
    if (car.isDestroyed) return;
    car.hp -= dmg;
    this.particles.spawnPlasmaImpact(car.x, 0.8, car.z);

    if (car.hp <= 0) {
      car.isDestroyed = true;
      this.audio.playExplosion(1.2, car.x, car.z, this.runState.playerPos.x, this.runState.playerPos.z);
      this.particles.spawnExplosion(car.x, 0.5, car.z, 1.3);
      globalEvents.emit('camera:shake', { trauma: 0.25 });

      const idx = this.cars.indexOf(car);
      if (idx !== -1) {
        this.cars.splice(idx, 1);
      }
      this.group.remove(car.mesh);
      disposeObject3D(car.mesh);
    }
  }

  public triggerSupplyDropFlare(px: number, pz: number): void {
    if (this.activeFlare) return;

    // Place flare 16-20m from player
    const angle = globalRNG.next() * Math.PI * 2;
    const dist = 16.0 + globalRNG.next() * 4.0;
    const x = px + Math.cos(angle) * dist;
    const z = pz + Math.sin(angle) * dist;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Glowing vertical flare beacon beam
    const beamGeo = new THREE.CylinderGeometry(0.25, 0.25, 26, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 13;
    group.add(beam);

    // Ground landing beacon ring
    const ringGeo = new THREE.RingGeometry(1.6, 2.2, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.08;
    group.add(ring);

    this.group.add(group);

    this.activeFlare = {
      x,
      z,
      timeRemaining: 20.0,
      beaconMesh: group,
      active: true
    };

    globalEvents.emit('pickup:reward', {
      x,
      z,
      text: 'TECH-COM AIRDROP // REACH FLARE (20s)',
      color: '#ff6600'
    });
    this.audio.playFlareLaunch();
  }

  public update(dt: number, environment?: IEnvironment): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    const time = this.runState.timeSeconds;

    // 1. Re-insert active fuel drums into grid so weapon hits detect them
    for (const drum of this.fuelDrums) {
      if (!drum.isDetonating) {
        this.grid.insert(drum);
      }
    }

    // 2. Destructible cars block enemy plasma bolts
    const enemyProjs = this.enemySystem.enemyProjectiles;
    for (let c = 0; c < this.cars.length; c++) {
      const car = this.cars[c];
      if (car.isDestroyed) continue;

      for (let pIdx = enemyProjs.length - 1; pIdx >= 0; pIdx--) {
        const p = enemyProjs[pIdx];
        if (p.life < p.maxLife && Math.hypot(p.x - car.x, p.z - car.z) < car.radius + p.radius) {
          // Block projectile and damage car cover!
          p.life = p.maxLife; // Expire bolt
          this.damageCar(car, p.damage);
          break;
        }
      }
    }

    // 3. Tech-Com Supply Drop: triggered every 3 minutes (180s)
    if (time >= 180 && time - this.lastFlareDropTime >= 180 && !this.activeFlare) {
      this.lastFlareDropTime = time;
      this.triggerSupplyDropFlare(px, pz);
    }

    // 4. Update Active Supply Drop Flare
    if (this.activeFlare && this.activeFlare.active) {
      this.activeFlare.timeRemaining -= dt;

      // Animate pulsing flare light
      const pulse = 0.8 + Math.sin(time * 8.0) * 0.2;
      this.activeFlare.beaconMesh.scale.set(pulse, 1, pulse);

      const distToPlayer = Math.hypot(px - this.activeFlare.x, pz - this.activeFlare.z);

      if (distToPlayer <= 2.2) {
        // Player reached the supply drop in time!
        const fx = this.activeFlare.x;
        const fz = this.activeFlare.z;

        this.pickupSystem.spawnSupplyCrate(fx, fz);
        this.runState.heal(35);
        this.runState.addScrap(50);
        this.audio.playVaultJackpot();
        this.particles.spawnExplosion(fx, 0.5, fz, 1.0);

        globalEvents.emit('pickup:reward', {
          x: fx,
          z: fz,
          text: '+50 ALLOY // CACHE RECOVERED',
          color: '#00e5ff'
        });

        this.dismissFlare();
      } else if (this.activeFlare.timeRemaining <= 0) {
        // Timed out
        this.dismissFlare();
      }
    }
  }

  private dismissFlare(): void {
    if (this.activeFlare) {
      this.group.remove(this.activeFlare.beaconMesh);
      disposeObject3D(this.activeFlare.beaconMesh);
      this.activeFlare = null;
    }
  }

  public getCarColliders(): Array<{ x: number; z: number; radius: number }> {
    return this.cars
      .filter((c) => !c.isDestroyed)
      .map((c) => ({ x: c.x, z: c.z, radius: c.radius }));
  }

  public clear(): void {
    for (const d of this.fuelDrums) {
      this.group.remove(d.mesh);
      disposeObject3D(d.mesh);
    }
    this.fuelDrums.length = 0;

    for (const c of this.cars) {
      this.group.remove(c.mesh);
      disposeObject3D(c.mesh);
    }
    this.cars.length = 0;

    this.dismissFlare();
  }

  /** Called at the start of every run: clears, respawns drums and cars, and resets the flare timer. */
  public reset(): void {
    this.clear();
    this.lastFlareDropTime = 0;
    this.spawnInitialInteractables();
  }

  public dispose(): void {
    this.clear();
    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;
  }
}
