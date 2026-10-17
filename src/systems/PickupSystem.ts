import * as THREE from 'three';
import { disposeObject3D } from '../graphics/dispose';
import { InstancedPool, type PoolableUser } from '../graphics/InstancedPool';
import type { RunState } from '../state/RunState';
import type { AudioEngine } from '../audio/AudioEngine';
import type { SpatialEntity } from '../core/types';
import { PickupMeshFactory, type GemTier, getGemTier } from '../graphics/meshes/PickupMeshes';
import { globalEvents } from '../core/EventBus';
import { globalRNG } from '../core/RNG';
import type { ParticleSystem } from './ParticleSystem';

export interface ActivePickup extends SpatialEntity, PoolableUser {
  mesh?: THREE.Object3D;
  kind: 'core' | 'crate' | 'vault';
  tier?: GemTier;
  poolIndex: number;
  rotationY: number;
  xpValue: number;
  attracted: boolean;
  attractTime: number;
  popVx?: number;
  popVz?: number;
}

export class PickupSystem {
  public readonly group = new THREE.Group();
  public readonly pickups: ActivePickup[] = [];
  private nextPickupId = 10000;

  private readonly runState: RunState;
  private readonly audio: AudioEngine;
  private readonly particles?: ParticleSystem;

  private readonly crystalPools: Record<GemTier, InstancedPool<ActivePickup>>;
  private readonly beamPools: Record<GemTier, InstancedPool>;
  private coreCount = 0;

  private comboCount = 0;
  private comboTimer = 0;
  private readonly unbinds: Array<() => void> = [];

  constructor(runState: RunState, audio: AudioEngine, particles?: ParticleSystem) {
    this.runState = runState;
    this.audio = audio;
    this.particles = particles;

    this.crystalPools = {
      1: new InstancedPool<ActivePickup>(
        PickupMeshFactory.crystalGeo,
        PickupMeshFactory.emeraldMat,
        512,
        this.group
      ),
      2: new InstancedPool<ActivePickup>(
        PickupMeshFactory.crystalGeo,
        PickupMeshFactory.goldMat,
        256,
        this.group
      ),
      3: new InstancedPool<ActivePickup>(
        PickupMeshFactory.crystalGeo,
        PickupMeshFactory.rubyMat,
        128,
        this.group
      )
    };

    this.beamPools = {
      1: new InstancedPool(
        PickupMeshFactory.beamGeo,
        PickupMeshFactory.emeraldBeamMat,
        512,
        this.group
      ),
      2: new InstancedPool(
        PickupMeshFactory.beamGeo,
        PickupMeshFactory.goldBeamMat,
        256,
        this.group
      ),
      3: new InstancedPool(
        PickupMeshFactory.beamGeo,
        PickupMeshFactory.rubyBeamMat,
        128,
        this.group
      )
    };

    this.unbinds.push(
      // Listen for enemy kill events to drop data cores or crates
      globalEvents.on('enemy:killed', ({ enemy, x, z, xp }) => {
        if (enemy.isBoss) {
          this.spawnBossVault(x, z);
          this.runState.addScrap(75);
        } else {
          this.spawnDataCore(x, z, xp);
          // 25% chance to award alloy scrap on normal enemy kills
          if (globalRNG.chance(0.25)) {
            this.runState.addScrap(2);
          }
          // 7% chance to drop destructible supply crate in condensed 10-minute runs
          if (globalRNG.chance(0.07)) {
            this.spawnSupplyCrate(
              x + (globalRNG.next() - 0.5) * 2,
              z + (globalRNG.next() - 0.5) * 2
            );
          }
        }
      }),

      // Listen for weapons destroying supply crates
      globalEvents.on('crate:destroyed', ({ crateId }) => {
        const idx = this.pickups.findIndex((p) => p.id === crateId && p.kind === 'crate');
        if (idx !== -1) {
          this.collectPickup(this.pickups[idx], idx);
        }
      })
    );
  }

  public spawnDataCore(x: number, z: number, xpValue: number): void {
    const tier = getGemTier(xpValue);
    const pickup: ActivePickup = {
      id: this.nextPickupId++,
      type: 'pickup',
      kind: 'core',
      tier,
      poolIndex: 0,
      rotationY: globalRNG.next() * Math.PI * 2,
      x,
      z,
      radius: 0.5,
      xpValue,
      attracted: false,
      attractTime: 0
    };

    pickup.poolIndex = this.crystalPools[tier].acquire(pickup);
    this.beamPools[tier].acquire();

    const scale = tier === 3 ? 1.38 : tier === 2 ? 1.18 : 1.0;
    this.crystalPools[tier].setTransform(
      pickup.poolIndex,
      x,
      0.35,
      z,
      pickup.rotationY,
      0,
      scale,
      scale,
      scale
    );
    this.beamPools[tier].setTransform(pickup.poolIndex, x, 0.9, z, 0, 0, scale, 1, scale);

    this.pickups.push(pickup);
    this.coreCount++;

    if (this.coreCount > 250) {
      this.mergeOldestCore();
    }
  }

  private mergeOldestCore(): void {
    // Find the oldest core that has another core within 3m
    for (let i = 0; i < this.pickups.length; i++) {
      const oldest = this.pickups[i];
      if (oldest.kind !== 'core') continue;

      let nearestTarget: ActivePickup | null = null;
      let minDistSq = 9.0; // 3m * 3m

      for (let j = 0; j < this.pickups.length; j++) {
        const other = this.pickups[j];
        if (i === j || other.kind !== 'core') continue;
        const dx = other.x - oldest.x;
        const dz = other.z - oldest.z;
        const distSq = dx * dx + dz * dz;
        if (
          distSq < minDistSq ||
          (distSq === minDistSq && other.xpValue > (nearestTarget?.xpValue ?? 0))
        ) {
          minDistSq = distSq;
          nearestTarget = other;
        }
      }

      if (nearestTarget) {
        // Merge oldest into nearestTarget
        nearestTarget.xpValue += oldest.xpValue;

        const oldTier = nearestTarget.tier!;
        const newTier = getGemTier(nearestTarget.xpValue);
        if (newTier !== oldTier) {
          this.crystalPools[oldTier].release(nearestTarget.poolIndex);
          this.beamPools[oldTier].release(nearestTarget.poolIndex);
          nearestTarget.tier = newTier;
          nearestTarget.poolIndex = this.crystalPools[newTier].acquire(nearestTarget);
          this.beamPools[newTier].acquire();

          const scale = newTier === 3 ? 1.38 : newTier === 2 ? 1.18 : 1.0;
          this.crystalPools[newTier].setTransform(
            nearestTarget.poolIndex,
            nearestTarget.x,
            0.35,
            nearestTarget.z,
            nearestTarget.rotationY,
            0,
            scale,
            scale,
            scale
          );
          this.beamPools[newTier].setTransform(
            nearestTarget.poolIndex,
            nearestTarget.x,
            0.9,
            nearestTarget.z,
            0,
            0,
            scale,
            1,
            scale
          );
        }

        // Release oldest core from pool and array
        const oldestTier = oldest.tier!;
        this.crystalPools[oldestTier].release(oldest.poolIndex);
        this.beamPools[oldestTier].release(oldest.poolIndex);
        this.pickups.splice(i, 1);
        this.coreCount--;
        return;
      }
    }
  }

  public spawnSupplyCrate(x: number, z: number): void {
    const mesh = PickupMeshFactory.createSupplyCrate();
    mesh.position.set(x, 0, z);
    this.group.add(mesh);

    this.pickups.push({
      id: this.nextPickupId++,
      type: 'crate',
      kind: 'crate',
      poolIndex: 0,
      rotationY: 0,
      x,
      z,
      radius: 0.8,
      xpValue: 0,
      attracted: false,
      attractTime: 0,
      mesh
    });
  }

  public spawnBossVault(x: number, z: number): void {
    const mesh = PickupMeshFactory.createBossVault();
    mesh.position.set(x, 0, z);
    this.group.add(mesh);

    this.pickups.push({
      id: this.nextPickupId++,
      type: 'pickup',
      kind: 'vault',
      poolIndex: 0,
      rotationY: 0,
      x,
      z,
      radius: 1.2,
      xpValue: 0,
      attracted: false,
      attractTime: 0,
      mesh
    });
  }

  public update(dt: number): void {
    if (this.runState.mode !== 'playing') return;

    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    const magnetRadius = this.runState.computedStats.magnetRadius;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        globalEvents.emit('pickup:combo_reset');
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.runState.mode !== 'playing') break;
      const p = this.pickups[i];
      p.rotationY += dt * 2.8; // Spin animation
      if (p.mesh) {
        p.mesh.rotation.y = p.rotationY;
      }

      const dx = px - p.x;
      const dz = pz - p.z;
      const dist = Math.hypot(dx, dz);

      // Magnet attraction & floating bob for data cores
      if (p.kind === 'core') {
        const bobY = 0.36 + Math.sin(this.runState.timeSeconds * 4.5 + p.id) * 0.08;
        if (dist <= magnetRadius || p.attracted) {
          if (!p.attracted) {
            p.attracted = true;
            p.attractTime = 0;
            const awayAngle = Math.atan2(-dx, -dz) + (globalRNG.next() - 0.5) * 0.6;
            const popSpeed = 4.2;
            p.popVx = Math.sin(awayAngle) * popSpeed;
            p.popVz = Math.cos(awayAngle) * popSpeed;
          }

          p.attractTime += dt;

          if (p.attractTime < 0.15) {
            // Outward pop phase with smooth decay
            const popDecay = 1.0 - p.attractTime / 0.15;
            p.x += (p.popVx ?? 0) * popDecay * dt;
            p.z += (p.popVz ?? 0) * popDecay * dt;
          } else {
            // Acceleration phase: speed = 6 + 30 * t
            const t = p.attractTime - 0.15;
            const speed = 6.0 + 30.0 * t;
            const curDist = Math.max(0.01, Math.hypot(dx, dz));
            p.x += (dx / curDist) * speed * dt;
            p.z += (dz / curDist) * speed * dt;

            // Short trail effect
            if (this.particles && t > 0.04 && (p.id % 2 === 0)) {
              this.particles.spawnDashAfterimage(p.x, bobY, p.z);
            }
          }
        }

        if (p.tier !== undefined) {
          const scale = p.tier === 3 ? 1.38 : p.tier === 2 ? 1.18 : 1.0;
          this.crystalPools[p.tier].setTransform(
            p.poolIndex,
            p.x,
            bobY,
            p.z,
            p.rotationY,
            0,
            scale,
            scale,
            scale
          );
          this.beamPools[p.tier].setTransform(
            p.poolIndex,
            p.x,
            bobY + 0.55,
            p.z,
            0,
            0,
            scale,
            1,
            scale
          );
        }
      }

      // Collect pickup if player reaches it
      if (dist <= 0.75 + p.radius) {
        this.collectPickup(p, i);
      }
    }
  }

  public getComboCount(): number {
    return this.comboCount;
  }

  private collectPickup(p: ActivePickup, index: number): void {
    this.pickups.splice(index, 1);
    if (p.mesh) {
      this.group.remove(p.mesh);
      disposeObject3D(p.mesh);
    }

    if (p.kind === 'core') {
      this.coreCount--;
      if (p.tier !== undefined) {
        this.crystalPools[p.tier].release(p.poolIndex);
        this.beamPools[p.tier].release(p.poolIndex);
      }
      this.comboCount++;
      this.comboTimer = 1.2;
      this.audio.playPickupGem(this.comboCount);
      globalEvents.emit('pickup:combo', { combo: this.comboCount });
      const levelsGained = this.runState.addXp(p.xpValue);
      if (levelsGained > 0) {
        this.runState.pendingLevelUps += levelsGained;
      }
    } else if (p.kind === 'crate') {
      this.audio.playExplosion(0.8);
      // Random crate rewards: Heal, EMP blast, or Alloy Scrap
      const roll = globalRNG.next();
      if (roll < 0.4) {
        this.runState.heal(35);
        globalEvents.emit('pickup:reward', {
          x: p.x,
          z: p.z,
          text: '+35 HP',
          color: 'var(--color-green)'
        });
      } else if (roll < 0.7) {
        const gained = this.runState.addScrap(45);
        globalEvents.emit('pickup:reward', {
          x: p.x,
          z: p.z,
          text: `+${gained} SCRAP`,
          color: 'var(--color-cyan)'
        });
      } else {
        // Vacuum all cores on screen
        for (const core of this.pickups) {
          if (core.kind === 'core') core.attracted = true;
        }
        globalEvents.emit('pickup:reward', {
          x: p.x,
          z: p.z,
          text: 'CORE VACUUM!',
          color: 'var(--color-amber)'
        });
      }
    } else if (p.kind === 'vault') {
      // Boss Data Vault
      this.audio.playVaultJackpot();
      const evolvedWeapon = this.runState.checkAndEvolveWeapon();
      const alloyBonus = 220;
      this.runState.addScrap(alloyBonus);

      globalEvents.emit('vault:opened', {
        upgradesAwarded: evolvedWeapon ? 1 : 3,
        evolvedWeapon: evolvedWeapon ?? undefined,
        alloyBonus
      });
    }
  }

  public clear(): void {
    for (const p of this.pickups) {
      if (p.mesh) {
        this.group.remove(p.mesh);
        disposeObject3D(p.mesh);
      }
    }
    this.pickups.length = 0;
    this.coreCount = 0;
    for (const pool of Object.values(this.crystalPools)) pool.clear();
    for (const pool of Object.values(this.beamPools)) pool.clear();
  }

  public dispose(): void {
    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;
    this.clear();
  }
}
