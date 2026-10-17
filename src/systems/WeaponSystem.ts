import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { ActiveEnemy, SpatialEntity } from '../core/types';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ParticleSystem } from './ParticleSystem';
import type { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { ALL_WEAPONS } from '../data/weapons';
import { globalEvents } from '../core/EventBus';

export type ProjectileMeshCategory = 'pellet' | 'plasma' | 'heavy_plasma' | 'bomb';

interface Projectile {
  id: number;
  weaponId: string;
  meshCategory?: ProjectileMeshCategory;
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  radius: number;
  pierceLeft: number;
  life: number;
  maxLife: number;
  hitEnemyIds: Set<number>;
  isAreaOnExpire?: boolean;
  areaRadius?: number;
}

interface GroundZone {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  radius: number;
  damagePerSec: number;
  life: number;
  maxLife: number;
  tickTimer: number;
}

interface TransientVfx {
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
  update: (progress: number, dt: number) => void;
}

export class WeaponSystem {
  public readonly group = new THREE.Group();
  private readonly runState: RunState;
  private readonly grid: SpatialHashGrid;
  private readonly audio: AudioEngine;
  private readonly particles: ParticleSystem;
  private readonly playerMesh: KyleReeseMesh;

  private projectiles: Projectile[] = [];
  private readonly projectilePool: Projectile[] = [];
  private readonly meshPools: Record<ProjectileMeshCategory, THREE.Mesh[]> = {
    pellet: [],
    plasma: [],
    heavy_plasma: [],
    bomb: []
  };
  private groundZones: GroundZone[] = [];
  private orbitalDrones: THREE.Mesh[] = [];
  private transientVfx: TransientVfx[] = [];
  private orbitalAngle = 0;
  private nextProjId = 1;

  // Reusable geometries & materials
  private readonly plasmaBoltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
  private readonly heavyPlasmaGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.4, 8);
  private readonly pelletGeo = new THREE.SphereGeometry(0.06, 6, 6);
  private readonly bombGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 8);
  private readonly droneGeo = new THREE.BoxGeometry(0.35, 0.12, 0.35);

  private readonly plasmaMat = new THREE.MeshBasicMaterial({ color: 0xd400ff });
  private readonly heavyPlasmaMat = new THREE.MeshBasicMaterial({ color: 0xff00cc });
  private readonly buckshotMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  private readonly bombMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
  private readonly droneMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00c4e6,
    emissiveIntensity: 3.5
  });

  constructor(
    runState: RunState,
    grid: SpatialHashGrid,
    audio: AudioEngine,
    particles: ParticleSystem,
    playerMesh: KyleReeseMesh
  ) {
    this.runState = runState;
    this.grid = grid;
    this.audio = audio;
    this.particles = particles;
    this.playerMesh = playerMesh;

    this.plasmaBoltGeo.rotateX(Math.PI / 2);
    this.heavyPlasmaGeo.rotateX(Math.PI / 2);

    // Pre-warm mesh pools to prevent GC churn during intense combat
    this.prefillMeshPool('pellet', 32);
    this.prefillMeshPool('plasma', 24);
    this.prefillMeshPool('heavy_plasma', 16);
    this.prefillMeshPool('bomb', 16);
  }

  private prefillMeshPool(category: ProjectileMeshCategory, count: number): void {
    for (let i = 0; i < count; i++) {
      let m: THREE.Mesh;
      switch (category) {
        case 'pellet':
          m = new THREE.Mesh(this.pelletGeo, this.buckshotMat);
          break;
        case 'plasma':
          m = new THREE.Mesh(this.plasmaBoltGeo, this.plasmaMat);
          break;
        case 'heavy_plasma':
          m = new THREE.Mesh(this.heavyPlasmaGeo, this.heavyPlasmaMat);
          break;
        case 'bomb':
          m = new THREE.Mesh(this.bombGeo, this.bombMat);
          break;
      }
      m.visible = false;
      this.group.add(m);
      this.meshPools[category].push(m);
    }
  }

  private acquireProjectileMesh(category: ProjectileMeshCategory): THREE.Mesh {
    const pool = this.meshPools[category];
    if (pool.length > 0) {
      const m = pool.pop()!;
      m.visible = true;
      return m;
    }
    let m: THREE.Mesh;
    switch (category) {
      case 'pellet':
        m = new THREE.Mesh(this.pelletGeo, this.buckshotMat);
        break;
      case 'plasma':
        m = new THREE.Mesh(this.plasmaBoltGeo, this.plasmaMat);
        break;
      case 'heavy_plasma':
        m = new THREE.Mesh(this.heavyPlasmaGeo, this.heavyPlasmaMat);
        break;
      case 'bomb':
        m = new THREE.Mesh(this.bombGeo, this.bombMat);
        break;
    }
    this.group.add(m);
    return m;
  }

  private releaseProjectile(p: Projectile): void {
    p.mesh.visible = false;
    if (p.meshCategory && p.mesh instanceof THREE.Mesh) {
      this.meshPools[p.meshCategory].push(p.mesh);
    } else {
      this.group.remove(p.mesh);
    }
    p.hitEnemyIds.clear();
    this.projectilePool.push(p);
  }

  public update(dt: number, enemies: ActiveEnemy[], aimAngle: number | null = null): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;

    // 1. Process weapon cooldowns & firing triggers
    for (const [wId, slot] of this.runState.weapons.entries()) {
      slot.cooldownTimer -= dt;
      if (slot.cooldownTimer <= 0) {
        const def = ALL_WEAPONS[wId];
        if (!def) continue;
        const stats = def.levels[Math.min(slot.level - 1, def.levels.length - 1)];
        if (!stats) continue;

        const effectiveCd = stats.cooldown * this.runState.computedStats.cooldownMultiplier;
        slot.cooldownTimer = effectiveCd;

        this.fireWeapon(wId, stats, px, pz, enemies, aimAngle);
      }
    }

    // 2. Update Orbiting Seeker Drones
    this.updateOrbitingDrones(dt, px, pz, enemies);

    // 3. Update Moving Projectiles
    this.updateProjectiles(dt);

    // 4. Update Lingering Ground Zones
    this.updateGroundZones(dt);

    // 5. Update Transient VFX (EMP shockwaves, Orbital Ion beams)
    for (let i = this.transientVfx.length - 1; i >= 0; i--) {
      const fx = this.transientVfx[i];
      fx.life += dt;
      const progress = Math.min(1, fx.life / fx.maxLife);
      fx.update(progress, dt);
      if (fx.life >= fx.maxLife) {
        this.group.remove(fx.mesh);
        this.transientVfx.splice(i, 1);
      }
    }
  }

  private fireWeapon(
    wId: string,
    stats: {
      damage: number;
      speed: number;
      amount: number;
      pierce: number;
      area: number;
      duration: number;
    },
    px: number,
    pz: number,
    enemies: ActiveEnemy[],
    aimAngle: number | null
  ): void {
    const might = this.runState.computedStats.mightMultiplier;
    const areaMult = this.runState.computedStats.areaMultiplier;
    const dmg = Math.round(stats.damage * might);
    const amount = stats.amount + this.runState.computedStats.bonusAmount;

    // Find nearest target for auto-targeted weapons (or fallback when mouse aim is not active)
    const nearest = this.runState.autoAimEnabled
      ? (this.grid.findNearest(px, pz, 28, (e) => e.type === 'enemy') as ActiveEnemy | null)
      : null;

    let targetAngle = this.runState.playerFacing;
    if (aimAngle !== null) {
      targetAngle = aimAngle;
    } else if (nearest) {
      targetAngle = Math.atan2(nearest.x - px, nearest.z - pz);
    }

    switch (wId) {
      case 'ithaca_37': {
        this.audio.playShotgunBlast();
        this.playerMesh.pulseMuzzleFlash(0xff9900);
        const spreadAngle = 0.42;
        for (let i = 0; i < amount; i++) {
          const angleOffset = (i / Math.max(1, amount - 1) - 0.5) * spreadAngle;
          const a = targetAngle + angleOffset;
          const mesh = this.acquireProjectileMesh('pellet');
          this.spawnProjectile({
            weaponId: wId,
            meshCategory: 'pellet',
            mesh,
            x: px,
            y: 0.8,
            z: pz,
            vx: Math.sin(a) * stats.speed,
            vy: 0,
            vz: Math.cos(a) * stats.speed,
            damage: dmg,
            radius: 0.25 * areaMult,
            pierceLeft: stats.pierce,
            life: 0,
            maxLife: stats.duration
          });
        }
        break;
      }

      case 'trench_sweeper': {
        this.audio.playShotgunBlast();
        this.playerMesh.pulseMuzzleFlash(0xff5500);
        // 360 ring of flechettes
        for (let i = 0; i < amount; i++) {
          const a = targetAngle + (i / amount) * Math.PI * 2;
          const mesh = this.acquireProjectileMesh('pellet');
          this.spawnProjectile({
            weaponId: wId,
            meshCategory: 'pellet',
            mesh,
            x: px,
            y: 0.8,
            z: pz,
            vx: Math.sin(a) * stats.speed,
            vy: 0,
            vz: Math.cos(a) * stats.speed,
            damage: dmg,
            radius: 0.4 * areaMult,
            pierceLeft: stats.pierce,
            life: 0,
            maxLife: stats.duration
          });
        }
        break;
      }

      case 'm25_plasma': {
        this.audio.playPlasmaShot(false);
        this.playerMesh.pulseMuzzleFlash(0xd400ff);
        for (let i = 0; i < amount; i++) {
          const offset = (i - (amount - 1) / 2) * 0.12;
          const boltMesh = this.acquireProjectileMesh('plasma');
          boltMesh.rotation.y = targetAngle;
          this.spawnProjectile({
            weaponId: wId,
            meshCategory: 'plasma',
            mesh: boltMesh,
            x: px + Math.cos(targetAngle) * offset,
            y: 0.85,
            z: pz - Math.sin(targetAngle) * offset,
            vx: Math.sin(targetAngle) * stats.speed,
            vy: 0,
            vz: Math.cos(targetAngle) * stats.speed,
            damage: dmg,
            radius: 0.35 * areaMult,
            pierceLeft: stats.pierce,
            life: 0,
            maxLife: stats.duration
          });
        }
        break;
      }

      case 'm95a1_plasma': {
        this.audio.playPlasmaShot(true);
        this.playerMesh.pulseMuzzleFlash(0xff00ea);
        for (let i = 0; i < amount; i++) {
          const a = targetAngle + (Math.random() - 0.5) * 0.1;
          const boltMesh = this.acquireProjectileMesh('heavy_plasma');
          boltMesh.rotation.y = a;
          this.spawnProjectile({
            weaponId: wId,
            meshCategory: 'heavy_plasma',
            mesh: boltMesh,
            x: px + (Math.random() - 0.5) * 0.4,
            y: 0.85,
            z: pz + (Math.random() - 0.5) * 0.4,
            vx: Math.sin(a) * stats.speed,
            vy: 0,
            vz: Math.cos(a) * stats.speed,
            damage: dmg,
            radius: 0.6 * areaMult,
            pierceLeft: stats.pierce,
            life: 0,
            maxLife: stats.duration
          });
        }
        break;
      }

      case 'pipe_bomb':
      case 'thermite_buster': {
        for (let i = 0; i < amount; i++) {
          const a = targetAngle + (Math.random() - 0.5) * 0.5;
          const dist = 5 + Math.random() * 8;
          const bombMesh = this.acquireProjectileMesh('bomb');
          this.spawnProjectile({
            weaponId: wId,
            meshCategory: 'bomb',
            mesh: bombMesh,
            x: px,
            y: 0.8,
            z: pz,
            vx: (Math.sin(a) * dist) / 0.8,
            vy: 4.5,
            vz: (Math.cos(a) * dist) / 0.8,
            damage: dmg,
            radius: 0.3,
            pierceLeft: 99,
            life: 0,
            maxLife: 0.8,
            isAreaOnExpire: true,
            areaRadius: (wId === 'thermite_buster' ? 4.2 : 2.5) * areaMult
          });
        }
        break;
      }

      case 'emp_emitter':
      case 'emp_supernova': {
        this.audio.playEmpBlast();
        const isSupernova = wId === 'emp_supernova';
        const empRadius = (isSupernova ? 6.5 : 3.8) * areaMult;
        this.spawnEmpShockwave(px, pz, empRadius, isSupernova);
        globalEvents.emit('camera:shake', { trauma: isSupernova ? 0.35 : 0.22 });
        const hitEnemies = this.grid.queryRadius(px, pz, empRadius);
        for (let i = 0; i < hitEnemies.length; i++) {
          const target = hitEnemies[i];
          const hit = this.applyDamageToTarget(target, dmg);
          if (hit && target.type === 'enemy') {
            const e = target as ActiveEnemy;
            e.slowTimer = 2.0;
            if (isSupernova) {
              e.armorStripMultiplier = Math.max(0.4, e.armorStripMultiplier - 0.3);
              this.runState.heal(1);
            }
          }
        }
        this.particles.spawnExplosion(px, 0.2, pz, 1.2);
        break;
      }

      case 'm79_thumper':
      case 'mm1_barrage': {
        for (let i = 0; i < amount; i++) {
          const a = Math.random() * Math.PI * 2;
          const dist = 6 + Math.random() * 9;
          const bombMesh = this.acquireProjectileMesh('bomb');
          this.spawnProjectile({
            weaponId: wId,
            meshCategory: 'bomb',
            mesh: bombMesh,
            x: px,
            y: 0.8,
            z: pz,
            vx: (Math.sin(a) * dist) / 0.7,
            vy: 5.5,
            vz: (Math.cos(a) * dist) / 0.7,
            damage: dmg,
            radius: 0.3,
            pierceLeft: 99,
            life: 0,
            maxLife: 0.7,
            isAreaOnExpire: true,
            areaRadius: 3.2 * areaMult
          });
        }
        break;
      }

      case 'napalm_canister':
      case 'firestorm_wall': {
        for (let i = 0; i < amount; i++) {
          const angle = (i / amount) * Math.PI * 2;
          const dist = 4 + Math.random() * 3;
          this.spawnGroundZone(
            px + Math.cos(angle) * dist,
            pz + Math.sin(angle) * dist,
            (wId === 'firestorm_wall' ? 3.2 : 2.0) * areaMult,
            dmg,
            stats.duration
          );
        }
        break;
      }

      case 'laser_designator':
      case 'orbital_ion': {
        const count = wId === 'orbital_ion' ? 3 : amount;
        for (let i = 0; i < count; i++) {
          const target = nearest ?? {
            x: px + (Math.random() - 0.5) * 16,
            z: pz + (Math.random() - 0.5) * 16
          };
          this.audio.playPlasmaShot(true);
          const ionRadius = (wId === 'orbital_ion' ? 3.5 : 2.5) * areaMult;
          this.spawnOrbitalIonBeam(target.x, target.z, ionRadius);
          globalEvents.emit('camera:shake', { trauma: 0.32 });
          const hit = this.grid.queryRadius(target.x, target.z, ionRadius);
          for (let h = 0; h < hit.length; h++) {
            this.applyDamageToTarget(hit[h], dmg);
          }
          this.particles.spawnExplosion(target.x, 0.2, target.z, 1.4);
        }
        break;
      }
    }
  }

  private spawnEmpShockwave(x: number, z: number, maxRadius: number, isSupernova = false): void {
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isSupernova ? 0x80ffff : 0x00e5ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.set(x, 0.15, z);
    this.group.add(mesh);

    this.transientVfx.push({
      mesh,
      life: 0,
      maxLife: 0.35,
      update: (progress) => {
        const r = THREE.MathUtils.lerp(0.2, maxRadius, progress);
        mesh.scale.set(r, 1, r);
        ringMat.opacity = (1 - progress) * 0.9;
      }
    });
  }

  private spawnOrbitalIonBeam(x: number, z: number, radius: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Inner bright core
    const coreGeo = new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 28, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 14;

    // Outer plasma glow
    const outerGeo = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 28, 12);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.y = 14;

    // Ground scorch ring
    const groundGeo = new THREE.RingGeometry(radius * 0.4, radius * 1.15, 24);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = 0.08;

    group.add(coreMesh, outerMesh, groundMesh);
    this.group.add(group);

    this.transientVfx.push({
      mesh: group,
      life: 0,
      maxLife: 0.42,
      update: (progress) => {
        const scaleX = 1 - progress * 0.7;
        coreMesh.scale.set(scaleX, 1, scaleX);
        outerMesh.scale.set(scaleX, 1, scaleX);
        const fade = 1 - progress;
        coreMat.opacity = fade * 0.95;
        outerMat.opacity = fade * 0.65;
        groundMat.opacity = fade * 0.85;
      }
    });
  }

  private applyDamageToTarget(entity: SpatialEntity, baseDamage: number): boolean {
    if (entity.type === 'crate') {
      globalEvents.emit('crate:destroyed', { crateId: entity.id, x: entity.x, z: entity.z });
      return true;
    }
    if (entity.type !== 'enemy') return false;

    const enemy = entity as ActiveEnemy;
    const isCrit = Math.random() < this.runState.computedStats.critChance;
    const vulnMult = 1 / Math.max(0.4, enemy.armorStripMultiplier);
    const finalDamage = Math.max(1, Math.round(baseDamage * vulnMult * (isCrit ? 1.75 : 1.0)));
    enemy.hp -= finalDamage;
    enemy.hitFlashTimer = isCrit ? 0.2 : 0.12;

    globalEvents.emit('enemy:damaged', {
      x: enemy.x,
      z: enemy.z,
      damage: finalDamage,
      isCrit
    });
    return true;
  }

  private spawnProjectile(p: Omit<Projectile, 'id' | 'hitEnemyIds'>): void {
    let proj: Projectile;
    if (this.projectilePool.length > 0) {
      proj = this.projectilePool.pop()!;
      proj.weaponId = p.weaponId;
      proj.meshCategory = p.meshCategory;
      proj.mesh = p.mesh;
      proj.x = p.x;
      proj.y = p.y;
      proj.z = p.z;
      proj.vx = p.vx;
      proj.vy = p.vy;
      proj.vz = p.vz;
      proj.damage = p.damage;
      proj.radius = p.radius;
      proj.pierceLeft = p.pierceLeft;
      proj.life = p.life;
      proj.maxLife = p.maxLife;
      proj.isAreaOnExpire = p.isAreaOnExpire;
      proj.areaRadius = p.areaRadius;
      proj.hitEnemyIds.clear();
    } else {
      proj = {
        ...p,
        id: this.nextProjId++,
        hitEnemyIds: new Set()
      };
    }
    proj.mesh.position.set(p.x, p.y, p.z);
    proj.mesh.visible = true;
    if (!proj.mesh.parent) {
      this.group.add(proj.mesh);
    }
    this.projectiles.push(proj);
  }

  private spawnGroundZone(
    x: number,
    z: number,
    radius: number,
    dps: number,
    duration: number
  ): void {
    const outerRingGeo = new THREE.RingGeometry(radius * 0.65, radius, 28);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(outerRingGeo, outerMat);
    mesh.position.set(x, 0.06, z);

    // Inner molten core ring
    const innerGeo = new THREE.CircleGeometry(radius * 0.72, 24);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.position.y = 0.01;
    mesh.add(innerMesh);

    this.group.add(mesh);

    this.groundZones.push({
      mesh,
      x,
      z,
      radius,
      damagePerSec: dps,
      life: 0,
      maxLife: duration,
      tickTimer: 0
    });
  }

  private updateOrbitingDrones(dt: number, px: number, pz: number, _enemies: ActiveEnemy[]): void {
    const seekerSlot = this.runState.weapons.get('seeker_drone');
    const ringSlot = this.runState.weapons.get('perimeter_ring');
    const activeSlot = ringSlot || seekerSlot;

    if (!activeSlot) {
      // Remove any existing drones
      for (const d of this.orbitalDrones) {
        this.group.remove(d);
      }
      this.orbitalDrones.length = 0;
      return;
    }

    const count = ringSlot ? 6 : Math.min(5, 2 + activeSlot.level);
    const orbitSpeed = ringSlot ? 5.5 : 3.2;
    const radius = ringSlot ? 3.8 : 2.8;
    this.orbitalAngle += dt * orbitSpeed;

    // Ensure correct drone mesh count
    while (this.orbitalDrones.length < count) {
      const drone = new THREE.Mesh(this.droneGeo, this.droneMat);
      this.group.add(drone);
      this.orbitalDrones.push(drone);
    }
    while (this.orbitalDrones.length > count) {
      const removed = this.orbitalDrones.pop()!;
      this.group.remove(removed);
    }

    const damage = ringSlot ? 48 : 18 + activeSlot.level * 4;

    for (let i = 0; i < count; i++) {
      const a = this.orbitalAngle + (i / count) * Math.PI * 2;
      const dx = px + Math.cos(a) * radius;
      const dz = pz + Math.sin(a) * radius;

      const dMesh = this.orbitalDrones[i];
      dMesh.position.set(dx, 0.75, dz);
      dMesh.rotation.y = -a;

      // Slice through enemies in contact
      const hit = this.grid.queryRadius(dx, dz, 0.6);
      for (let h = 0; h < hit.length; h++) {
        this.applyDamageToTarget(hit[h], damage * dt * 3.5);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.vy !== 0) {
        p.vy -= 9.8 * dt; // Gravity for arcing bombs
      }

      p.mesh.position.set(p.x, p.y, p.z);

      // Hit detection
      const hitCandidates = this.grid.queryRadius(p.x, p.z, p.radius);
      for (let c = 0; c < hitCandidates.length; c++) {
        const target = hitCandidates[c];
        if (!p.hitEnemyIds.has(target.id)) {
          p.hitEnemyIds.add(target.id);
          const hit = this.applyDamageToTarget(target, p.damage);
          if (hit) {
            this.audio.playEndoHit();
            this.particles.spawnPlasmaImpact(p.x, p.y, p.z);
            p.pierceLeft--;
            if (p.pierceLeft <= 0) break;
          }
        }
      }

      // Expire or ground hit
      if (p.life >= p.maxLife || p.pierceLeft <= 0 || (p.vy !== 0 && p.y <= 0.2)) {
        if (p.isAreaOnExpire && p.areaRadius) {
          this.audio.playExplosion(p.areaRadius > 3 ? 1.5 : 1.0);
          this.particles.spawnExplosion(p.x, 0.2, p.z, p.areaRadius > 3 ? 1.4 : 1.0);
          globalEvents.emit('camera:shake', { trauma: p.areaRadius > 3 ? 0.35 : 0.22 });
          const splash = this.grid.queryRadius(p.x, p.z, p.areaRadius);
          for (let s = 0; s < splash.length; s++) {
            this.applyDamageToTarget(splash[s], p.damage);
          }
        }
        this.releaseProjectile(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateGroundZones(dt: number): void {
    for (let i = this.groundZones.length - 1; i >= 0; i--) {
      const gz = this.groundZones[i];
      gz.life += dt;
      gz.tickTimer += dt;

      // Flickering flame pulse & rotation
      const flicker = 0.94 + Math.sin(gz.life * 18 + i) * 0.06;
      gz.mesh.scale.set(flicker, 1, flicker);
      gz.mesh.rotation.y += dt * 1.4;

      if (gz.tickTimer >= 0.25) {
        gz.tickTimer = 0;
        const targets = this.grid.queryRadius(gz.x, gz.z, gz.radius);
        for (let e = 0; e < targets.length; e++) {
          this.applyDamageToTarget(targets[e], gz.damagePerSec * 0.25);
        }
      }

      if (gz.life >= gz.maxLife) {
        this.group.remove(gz.mesh);
        gz.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        this.groundZones.splice(i, 1);
      }
    }
  }

  public clear(): void {
    for (const p of this.projectiles) {
      this.releaseProjectile(p);
    }
    this.projectiles.length = 0;

    for (const gz of this.groundZones) {
      this.group.remove(gz.mesh);
      gz.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    this.groundZones.length = 0;

    for (const d of this.orbitalDrones) {
      this.group.remove(d);
    }
    this.orbitalDrones.length = 0;

    for (const fx of this.transientVfx) {
      this.group.remove(fx.mesh);
    }
    this.transientVfx.length = 0;
  }
}
