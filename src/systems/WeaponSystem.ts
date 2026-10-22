import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { ActiveEnemy, SpatialEntity, WeaponId, WeaponLevelStats, WeaponPatternId } from '../core/types';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ParticleSystem } from './ParticleSystem';
import type { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { ALL_WEAPONS } from '../data/weapons';
import { globalEvents } from '../core/EventBus';
import { globalRNG, vfxRNG } from '../core/RNG';
import { disposeObject3D } from '../graphics/dispose';
import { InstancedPool, type PoolableUser } from '../graphics/InstancedPool';
import {
  type WeaponPattern,
  type WeaponFireContext,
  type Orbiters,
  type ProjectileMeshCategory,
  type SpawnProjectileParams,
  createWeaponPatternRegistry
} from './weapons';
import { buildBoltGeometry, createBoltMaterial } from '../graphics/PlasmaBolts';
import { PALETTE } from '../data/artDirection';
import { AUTO_AIM_RANGE, BOSS_FOCUS } from '../data/balance';
import { ProceduralTextures } from '../graphics/ProceduralTextures';
import { buildFlameGeometry } from '../graphics/EnvironmentDetail';
import { BOSS_MIN_FIGHT_SECONDS } from '../data/balance';

export type { ProjectileMeshCategory };

interface Projectile extends PoolableUser {
  id: number;
  weaponId: string;
  meshCategory: ProjectileMeshCategory;
  poolIndex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  pitchX?: number;
  damage: number;
  radius: number;
  pierceLeft: number;
  life: number;
  maxLife: number;
  hitEnemyIds: Set<number>;
  isAreaOnExpire?: boolean;
  areaRadius?: number;
  knockback: number;
}

interface GroundZone {
  mesh: THREE.Mesh;
  weaponId?: WeaponId;
  x: number;
  z: number;
  radius: number;
  damagePerSec: number;
  knockback: number;
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

const WEAPON_RECOIL_SCALES: Record<string, number> = {
  ithaca_37: 1.8,
  trench_sweeper: 1.9,
  rpg_launcher: 2.0,
  tandem_warhead: 2.2,
  m25_plasma: 0.9,
  m95a1_plasma: 1.1,
  pipe_bomb: 1.2,
  thermite_buster: 1.4,
  firestorm_lane: 0.9,
  emp_emitter: 0.4,
  emp_supernova: 0.5,
  coltan_knife: 0.7,
  hyperalloy_blade: 0.8,
  seeker_drone: 0,
  perimeter_ring: 0,
  laser_designator: 0,
  orbital_ion: 0,
  resistance_k9: 0,
  k9_pack: 0,
  reprogrammed_t800: 0,
  guardian_protocol: 0
};

export class WeaponSystem {
  public readonly group = new THREE.Group();
  private readonly runState: RunState;
  /** Off only while the debug API deals damage */
  public bossCapEnabled = true;
  private readonly grid: SpatialHashGrid;
  private readonly audio: AudioEngine;
  private readonly particles: ParticleSystem;
  private readonly playerMesh: KyleReeseMesh;

  public readonly patterns: Record<WeaponPatternId, WeaponPattern>;
  public readonly damageByWeapon = new Map<WeaponId, number>();
  private currentFiringWeaponId: WeaponId | null = null;
  public readonly orbitersPattern: Orbiters;
  private readonly fireContext: WeaponFireContext;
  /** On-screen test and screen reach from the camera: weapons only hit what the player can see */
  public visibilityTest: ((x: number, z: number, margin?: number) => boolean) | null = null;
  public reachFn: (() => number) | null = null;
  public reachAlongFn: ((angle: number) => number) | null = null;

  private projectiles: Projectile[] = [];
  private readonly projectilePool: Projectile[] = [];
  private readonly pools: Record<ProjectileMeshCategory, InstancedPool<Projectile>>;
  private groundZones: GroundZone[] = [];
  private transientVfx: TransientVfx[] = [];
  private nextProjId = 1;

  // Spatial query scratch arrays for allocation-free updates
  private readonly projectileHitScratch: SpatialEntity[] = [];
  private readonly projectileSplashScratch: SpatialEntity[] = [];
  private readonly droneHitScratch: SpatialEntity[] = [];
  private readonly groundZoneScratch: SpatialEntity[] = [];
  private readonly empHitScratch: SpatialEntity[] = [];
  private readonly orbitalHitScratch: SpatialEntity[] = [];
  private readonly orbitalTargetsScratch: SpatialEntity[] = [];

  // Reusable geometries & materials
  // Resistance plasma: pink-violet streaks with white-hot cores; buckshot: short hot tracers
  private readonly plasmaBoltGeo = buildBoltGeometry(1.7, 0.035, 0.11, PALETTE.plasmaResistanceCore, PALETTE.plasmaResistance);
  private readonly heavyPlasmaGeo = buildBoltGeometry(2.4, 0.07, 0.22, PALETTE.plasmaResistanceCore, PALETTE.plasmaResistance);
  private readonly pelletGeo = buildBoltGeometry(0.55, 0.025, 0.06, 0xfff2d0, PALETTE.fire);
  private readonly bombGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 8);

  private readonly plasmaMat = createBoltMaterial(2.6);
  private readonly heavyPlasmaMat = createBoltMaterial(3.2);
  private readonly buckshotMat = createBoltMaterial(2.2);
  private readonly bombMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
  private readonly fireZoneGlowGeo = new THREE.PlaneGeometry(2.3, 2.3).rotateX(-Math.PI / 2);
  private readonly fireZoneGlowMat = new THREE.MeshBasicMaterial({
    map: typeof document !== 'undefined' ? ProceduralTextures.getSoftGlowSprite() : null,
    color: new THREE.Color(PALETTE.fire).multiplyScalar(1.6),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  private readonly fireZoneFlameGeo = buildFlameGeometry();
  private readonly fireZoneFlameMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
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

    const { registry, orbiters } = createWeaponPatternRegistry();
    this.patterns = registry;
    this.orbitersPattern = orbiters;

    this.plasmaBoltGeo.userData = { shared: true };
    this.heavyPlasmaGeo.userData = { shared: true };
    this.pelletGeo.userData = { shared: true };
    this.bombGeo.userData = { shared: true };

    this.plasmaMat.userData = { shared: true };
    this.heavyPlasmaMat.userData = { shared: true };
    this.buckshotMat.userData = { shared: true };
    this.bombMat.userData = { shared: true };
    for (const shared of [this.fireZoneGlowGeo, this.fireZoneGlowMat, this.fireZoneFlameGeo, this.fireZoneFlameMat]) {
      shared.userData = { shared: true };
    }

    this.pools = {
      pellet: new InstancedPool<Projectile>(this.pelletGeo, this.buckshotMat, 512, this.group),
      plasma: new InstancedPool<Projectile>(this.plasmaBoltGeo, this.plasmaMat, 256, this.group),
      heavy_plasma: new InstancedPool<Projectile>(
        this.heavyPlasmaGeo,
        this.heavyPlasmaMat,
        256,
        this.group
      ),
      bomb: new InstancedPool<Projectile>(this.bombGeo, this.bombMat, 128, this.group)
    };

    this.fireContext = {
      runState: this.runState,
      audio: this.audio,
      particles: this.particles,
      playerMesh: this.playerMesh,
      grid: this.grid,
      group: this.group,
      spawnProjectile: (params) => this.spawnProjectile(params),
      spawnEmpShockwave: (x, z, maxRadius, isSupernova) =>
        this.spawnEmpShockwave(x, z, maxRadius, isSupernova),
      spawnGroundZone: (x, z, radius, dmg, dur, knockback, weaponId) =>
        this.spawnGroundZone(x, z, radius, dmg, dur, knockback, weaponId),
      spawnOrbitalIonBeam: (x, z, radius) =>
        this.spawnOrbitalIonBeam(x, z, radius),
      applyDamageToTarget: (target, damage, knockback, hitDir, weaponId) =>
        this.applyDamageToTarget(target, damage, knockback, hitDir, weaponId),
      emit: (evt, payload) => globalEvents.emit(evt, payload),
      isVisible: (x, z, margin) => (this.visibilityTest ? this.visibilityTest(x, z, margin) : true),
      reachRadius: () => (this.reachFn ? this.reachFn() : AUTO_AIM_RANGE),
      reachAlong: (angle) => (this.reachAlongFn ? this.reachAlongFn(angle) : AUTO_AIM_RANGE),
      rng: globalRNG,
      scratch: {
        empHit: this.empHitScratch,
        orbitalHit: this.orbitalHitScratch,
        orbitalTargets: this.orbitalTargetsScratch,
        droneHit: this.droneHitScratch
      }
    };
  }

  private releaseProjectile(p: Projectile): void {
    this.pools[p.meshCategory].release(p.poolIndex);
    p.hitEnemyIds.clear();
    this.projectilePool.push(p);
  }

  public update(dt: number, enemies: ActiveEnemy[], aimAngle: number | null = null): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;

    // Auto-aim target, found once per tick: weapons fire at it and the player turns to face it
    let nearest = this.runState.autoAimEnabled
      ? (this.grid.findNearest(px, pz, AUTO_AIM_RANGE, (e) => e.type === 'enemy' && this.fireContext.isVisible(e.x, e.z)) as ActiveEnemy | null)
      : null;
    if (nearest && !nearest.isBoss && Math.hypot(nearest.x - px, nearest.z - pz) > BOSS_FOCUS.selfDefence) {
      const boss = enemies.find((e) => e.isBoss && e.hp > 0);
      if (boss && Math.hypot(boss.x - px, boss.z - pz) <= BOSS_FOCUS.range && this.fireContext.isVisible(boss.x, boss.z)) nearest = boss;
    }
    this.runState.autoAimAngle = nearest ? Math.atan2(nearest.x - px, nearest.z - pz) : null;

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

    // 2. Update Continuous Weapon Patterns (Orbiters, DogUnit, AllySummon)
    for (const p of Object.values(this.patterns)) {
      p.update?.(dt, px, pz, enemies, this.fireContext);
    }

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
        disposeObject3D(fx.mesh);
        this.transientVfx.splice(i, 1);
      }
    }
  }

  private fireWeapon(
    wId: string,
    stats: WeaponLevelStats,
    px: number,
    pz: number,
    _enemies: ActiveEnemy[],
    aimAngle: number | null
  ): void {
    // Manual aim wins; otherwise the auto-aim target; otherwise straight ahead
    const targetAngle = aimAngle ?? this.runState.autoAimAngle ?? this.runState.playerFacing;

    const def = ALL_WEAPONS[wId as WeaponId];
    if (def?.pattern) {
      this.currentFiringWeaponId = wId as WeaponId;
      try {
        const recoilIntensity = WEAPON_RECOIL_SCALES[wId] ?? 1.0;
        if (recoilIntensity > 0) {
          this.playerMesh.triggerRecoil(recoilIntensity);
        }
        this.patterns[def.pattern]?.fire(def, stats, px, pz, targetAngle, this.fireContext);
      } finally {
        this.currentFiringWeaponId = null;
      }
    }
  }

  public spawnEmpShockwave(x: number, z: number, maxRadius: number, isSupernova = false): void {
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isSupernova ? 0xe6f2ff : 0xb4d6ff,
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
      color: 0xa8c8ff,
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
      color: 0xbcd6ff,
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

  public applyDamageToTarget(
    entity: SpatialEntity,
    baseDamage: number,
    knockback = 0,
    hitDir?: { x: number; z: number },
    weaponId?: WeaponId,
    forcedCrit?: boolean
  ): boolean {
    if (entity.type === 'crate') {
      globalEvents.emit('crate:destroyed', { crateId: entity.id, x: entity.x, z: entity.z });
      return true;
    }
    if (entity.type !== 'enemy') return false;

    const enemy = entity as ActiveEnemy;
    // T-1000 in liquid puddle form cannot be targeted
    if (enemy.state?.isPuddle === 1) return false;

    const isCrit = forcedCrit !== undefined ? forcedCrit : globalRNG.chance(this.runState.computedStats.critChance);
    const vulnMult = 1 / Math.max(0.4, enemy.armorStripMultiplier);
    const critMult = this.runState.computedStats.critMultiplier ?? 1.75;
    let finalDamage = Math.max(1, Math.round(baseDamage * vulnMult * (isCrit ? critMult : 1.0)));

    if (enemy.affix === 'Armored' && enemy.armorStripMultiplier >= 1.0) {
      finalDamage = Math.max(1, Math.round(finalDamage * 0.5));
    }

    // Bosses lose health no faster than their minimum fight length allows
    const minFight = enemy.isBoss && this.bossCapEnabled ? BOSS_MIN_FIGHT_SECONDS[enemy.archetype] : undefined;
    if (minFight) {
      const state = (enemy.state = enemy.state ?? {});
      const now = this.runState.timeSeconds;
      const rate = enemy.maxHp / minFight;
      const budget = Math.min(rate * 2, (state.damageBudget ?? rate) + (now - (state.damageBudgetTime ?? now)) * rate);
      state.damageBudgetTime = now;
      finalDamage = Math.max(0, Math.min(finalDamage, Math.floor(budget)));
      state.damageBudget = budget - finalDamage;
      if (finalDamage <= 0) return false;
    }

    enemy.hp -= finalDamage;
    enemy.hitFlashTimer = isCrit ? 0.2 : 0.12;

    const sourceWeaponId = weaponId ?? this.currentFiringWeaponId;
    // Fire (ground-zone weapons such as the molotov) stops T-1000 regeneration
    if (sourceWeaponId && ALL_WEAPONS[sourceWeaponId]?.pattern === 'GroundZone') {
      enemy.state = enemy.state ?? {};
      enemy.state.burnTimer = 1.5;
    }
    if (sourceWeaponId) {
      this.damageByWeapon.set(
        sourceWeaponId,
        (this.damageByWeapon.get(sourceWeaponId) ?? 0) + finalDamage
      );
    }

    if (knockback > 0 && hitDir) {
      const dist = Math.hypot(hitDir.x, hitDir.z);
      const nx = dist > 0.0001 ? hitDir.x / dist : (globalRNG.next() - 0.5) || 1;
      const nz = dist > 0.0001 ? hitDir.z / dist : (globalRNG.next() - 0.5);
      const len = Math.hypot(nx, nz) || 1;
      const mass = Math.max(0.1, enemy.mass || 1.0);
      const impulse = knockback / mass;
      enemy.vx = (enemy.vx || 0) + (nx / len) * impulse;
      enemy.vz = (enemy.vz || 0) + (nz / len) * impulse;
    }

    globalEvents.emit('enemy:damaged', {
      x: enemy.x,
      z: enemy.z,
      damage: finalDamage,
      isCrit,
      enemyId: enemy.id
    });
    return true;
  }

  public spawnProjectile(p: SpawnProjectileParams): void {
    let proj: Projectile;
    if (this.projectilePool.length > 0) {
      proj = this.projectilePool.pop()!;
      proj.weaponId = p.weaponId;
      proj.meshCategory = p.meshCategory;
      proj.x = p.x;
      proj.y = p.y;
      proj.z = p.z;
      proj.vx = p.vx;
      proj.vy = p.vy;
      proj.vz = p.vz;
      proj.rotY = p.rotY;
      proj.pitchX = p.pitchX;
      proj.damage = p.damage;
      proj.radius = p.radius;
      proj.pierceLeft = p.pierceLeft;
      proj.life = p.life;
      proj.maxLife = p.maxLife;
      proj.isAreaOnExpire = p.isAreaOnExpire;
      proj.areaRadius = p.areaRadius;
      proj.knockback = p.knockback ?? 0;
      proj.hitEnemyIds.clear();
    } else {
      proj = {
        ...p,
        knockback: p.knockback ?? 0,
        id: this.nextProjId++,
        poolIndex: 0,
        hitEnemyIds: new Set()
      };
    }
    const pool = this.pools[proj.meshCategory];
    pool.acquire(proj);
    pool.setTransform(proj.poolIndex, proj.x, proj.y, proj.z, proj.rotY, proj.pitchX ?? 0);
    this.projectiles.push(proj);
  }

  public spawnGroundZone(
    x: number,
    z: number,
    radius: number,
    dps: number,
    duration: number,
    knockback = 0,
    weaponId?: WeaponId
  ): void {
    // Burning patch: a soft ember glow on the ground with flame tongues around it (all shared resources)
    const mesh = new THREE.Mesh(this.fireZoneGlowGeo, this.fireZoneGlowMat);
    mesh.position.set(x, 0.06, z);
    mesh.scale.set(radius, 1, radius);
    const flames = Math.max(3, Math.round(radius * 2));
    for (let f = 0; f < flames; f++) {
      const a = (f / flames) * Math.PI * 2 + vfxRNG.next() * 0.6;
      const r = 0.25 + vfxRNG.next() * 0.45;
      const flame = new THREE.Mesh(this.fireZoneFlameGeo, this.fireZoneFlameMat);
      flame.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      // The parent is scaled by the radius on x/z only, so undo that for the flame's width
      flame.scale.set(0.45 / radius, 0.3 + vfxRNG.next() * 0.35, 0.45 / radius);
      mesh.add(flame);
    }

    this.group.add(mesh);

    this.groundZones.push({
      mesh,
      weaponId: weaponId ?? this.currentFiringWeaponId ?? undefined,
      x,
      z,
      radius,
      damagePerSec: dps,
      knockback,
      life: 0,
      maxLife: duration,
      tickTimer: 0
    });
  }

  private updateOrbitingDrones(dt: number, px: number, pz: number, enemies: ActiveEnemy[]): void {
    this.orbitersPattern.update(dt, px, pz, enemies, this.fireContext);
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
        if (p.pitchX !== undefined) {
          p.pitchX += dt * 6.0;
        }
      }

      this.pools[p.meshCategory].setTransform(
        p.poolIndex,
        p.x,
        p.y,
        p.z,
        p.rotY,
        p.pitchX ?? 0
      );

      // A bullet that leaves the screen is gone; it never hits anything the player cannot see
      const culled = !p.isAreaOnExpire && !this.fireContext.isVisible(p.x, p.z, 1.1);
      if (culled) p.life = p.maxLife;

      // Hit detection
      const hitCandidates = culled ? [] : this.grid.queryRadius(p.x, p.z, p.radius, this.projectileHitScratch);
      for (let c = 0; c < hitCandidates.length; c++) {
        const target = hitCandidates[c];
        if (!p.hitEnemyIds.has(target.id)) {
          p.hitEnemyIds.add(target.id);
          const hitDir = Math.hypot(p.vx, p.vz) > 0.001
            ? { x: p.vx, z: p.vz }
            : { x: target.x - p.x, z: target.z - p.z };
          const hit = this.applyDamageToTarget(
            target,
            p.damage,
            p.knockback,
            hitDir,
            p.weaponId as WeaponId
          );
          if (hit) {
            this.audio.playEndoHit(
              p.x,
              p.z,
              this.runState.playerPos.x,
              this.runState.playerPos.z,
              target.type === 'enemy' && (target as ActiveEnemy).archetype === 't1000_prototype'
            );
            this.particles.spawnPlasmaImpact(p.x, p.y, p.z);
            p.pierceLeft--;
            if (p.pierceLeft <= 0) break;
          }
        }
      }

      // Expire or ground hit
      if (p.life >= p.maxLife || p.pierceLeft <= 0 || (p.vy !== 0 && p.y <= 0.2)) {
        if (p.isAreaOnExpire && p.areaRadius) {
          this.audio.playExplosion(
            p.areaRadius > 3 ? 1.5 : 1.0,
            p.x,
            p.z,
            this.runState.playerPos.x,
            this.runState.playerPos.z
          );
          this.particles.spawnExplosion(p.x, 0.2, p.z, p.areaRadius > 3 ? 1.4 : 1.0);
          globalEvents.emit('camera:shake', { trauma: p.areaRadius > 3 ? 0.35 : 0.22 });
          const splash = this.grid.queryRadius(p.x, p.z, p.areaRadius, this.projectileSplashScratch);
          for (let s = 0; s < splash.length; s++) {
            const target = splash[s];
            const hitDir = { x: target.x - p.x, z: target.z - p.z };
            this.applyDamageToTarget(
              target,
              p.damage,
              p.knockback,
              hitDir,
              p.weaponId as WeaponId
            );
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
      gz.mesh.rotation.y += dt * 0.3;

      if (gz.tickTimer >= 0.25) {
        gz.tickTimer = 0;
        const targets = this.grid.queryRadius(gz.x, gz.z, gz.radius, this.groundZoneScratch);
        for (let e = 0; e < targets.length; e++) {
          const target = targets[e];
          const hitDir = { x: target.x - gz.x, z: target.z - gz.z };
          this.applyDamageToTarget(
            target,
            gz.damagePerSec * 0.25,
            gz.knockback,
            hitDir,
            gz.weaponId
          );
        }
      }

      if (gz.life >= gz.maxLife) {
        this.group.remove(gz.mesh);
        disposeObject3D(gz.mesh);
        this.groundZones.splice(i, 1);
      }
    }
  }

  public getDamageByWeapon(): Record<string, number> {
    const record: Record<string, number> = {};
    for (const [k, v] of this.damageByWeapon.entries()) {
      record[k] = v;
    }
    return record;
  }

  public clear(): void {
    this.damageByWeapon.clear();
    for (const p of this.projectiles) {
      this.releaseProjectile(p);
    }
    this.projectiles.length = 0;
    for (const pool of Object.values(this.pools)) {
      pool.clear();
    }

    for (const gz of this.groundZones) {
      this.group.remove(gz.mesh);
      disposeObject3D(gz.mesh);
    }
    this.groundZones.length = 0;

    for (const p of Object.values(this.patterns)) {
      p.clear?.(this.group);
    }

    for (const fx of this.transientVfx) {
      this.group.remove(fx.mesh);
      disposeObject3D(fx.mesh);
    }
    this.transientVfx.length = 0;
  }
}
