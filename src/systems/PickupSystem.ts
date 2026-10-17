import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { SpatialHashGrid } from '../core/SpatialHashGrid';
import type { AudioEngine } from '../audio/AudioEngine';
import type { SpatialEntity } from '../core/types';
import { PickupMeshFactory } from '../graphics/meshes/PickupMeshes';
import { globalEvents } from '../core/EventBus';

export interface ActivePickup extends SpatialEntity {
  mesh: THREE.Object3D;
  kind: 'core' | 'crate' | 'vault';
  xpValue: number;
  attracted: boolean;
  vx: number;
  vz: number;
}

export class PickupSystem {
  public readonly group = new THREE.Group();
  public readonly pickups: ActivePickup[] = [];
  private nextPickupId = 10000;

  private readonly runState: RunState;
  private readonly grid: SpatialHashGrid;
  private readonly audio: AudioEngine;

  private comboCount = 0;
  private comboTimer = 0;

  constructor(runState: RunState, grid: SpatialHashGrid, audio: AudioEngine) {
    this.runState = runState;
    this.grid = grid;
    this.audio = audio;

    // Listen for enemy kill events to drop data cores or crates
    globalEvents.on('enemy:killed', ({ enemy, x, z, xp }) => {
      if (enemy.isBoss) {
        this.spawnBossVault(x, z);
      } else {
        this.spawnDataCore(x, z, xp);
        // 4% chance to drop destructible supply crate
        if (Math.random() < 0.04) {
          this.spawnSupplyCrate(x + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 2);
        }
      }
    });
  }

  public spawnDataCore(x: number, z: number, xpValue: number): void {
    const mesh = PickupMeshFactory.createDataCore(xpValue);
    mesh.position.set(x, 0.25, z);
    this.group.add(mesh);

    this.pickups.push({
      id: this.nextPickupId++,
      type: 'pickup',
      kind: 'core',
      x,
      z,
      radius: 0.5,
      xpValue,
      attracted: false,
      vx: 0,
      vz: 0,
      mesh
    });
  }

  public spawnSupplyCrate(x: number, z: number): void {
    const mesh = PickupMeshFactory.createSupplyCrate();
    mesh.position.set(x, 0, z);
    this.group.add(mesh);

    this.pickups.push({
      id: this.nextPickupId++,
      type: 'crate',
      kind: 'crate',
      x,
      z,
      radius: 0.8,
      xpValue: 0,
      attracted: false,
      vx: 0,
      vz: 0,
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
      x,
      z,
      radius: 1.2,
      xpValue: 0,
      attracted: false,
      vx: 0,
      vz: 0,
      mesh
    });
  }

  public update(dt: number): void {
    const px = this.runState.playerPos.x;
    const pz = this.runState.playerPos.z;
    const magnetRadius = this.runState.computedStats.magnetRadius;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.mesh.rotation.y += dt * 2.5; // Spin animation

      const dx = px - p.x;
      const dz = pz - p.z;
      const dist = Math.hypot(dx, dz);

      // Magnet attraction for data cores
      if (p.kind === 'core') {
        if (dist <= magnetRadius || p.attracted) {
          p.attracted = true;
          const pullSpeed = 16.0;
          p.x += (dx / dist) * pullSpeed * dt;
          p.z += (dz / dist) * pullSpeed * dt;
          p.mesh.position.set(p.x, 0.25, p.z);
        }
      }

      // Collect pickup if player reaches it
      if (dist <= 0.75 + p.radius) {
        this.collectPickup(p, i);
      }
    }
  }

  private collectPickup(p: ActivePickup, index: number): void {
    this.pickups.splice(index, 1);
    this.group.remove(p.mesh);

    if (p.kind === 'core') {
      this.comboCount++;
      this.comboTimer = 1.2;
      this.audio.playPickupGem(this.comboCount);
      const leveledUp = this.runState.addXp(p.xpValue);
      if (leveledUp) {
        this.audio.playLevelUp();
        const choices = this.runState.generateUpgradeChoices();
        globalEvents.emit('levelup:triggered', { level: this.runState.level, choices });
      }
    } else if (p.kind === 'crate') {
      this.audio.playExplosion(0.8);
      // Random crate rewards: Heal, EMP blast, or Alloy Scrap
      const roll = Math.random();
      if (roll < 0.4) {
        this.runState.heal(30);
      } else if (roll < 0.7) {
        this.runState.alloyScrapEarned += 25;
      } else {
        // Vacuum all cores on screen
        for (const core of this.pickups) {
          if (core.kind === 'core') core.attracted = true;
        }
      }
    } else if (p.kind === 'vault') {
      // Boss Data Vault
      this.audio.playVaultJackpot();
      const evolvedWeapon = this.runState.checkAndEvolveWeapon();
      let upgradesAwarded = 1;
      if (!evolvedWeapon) {
        upgradesAwarded = 0;
        for (let u = 0; u < 3; u++) {
          const choices = this.runState.generateUpgradeChoices();
          if (choices.length > 0) {
            this.runState.applyUpgrade(choices[0]);
            upgradesAwarded++;
          }
        }
        if (upgradesAwarded === 0) upgradesAwarded = 3;
      }
      const alloyBonus = 150;
      this.runState.alloyScrapEarned += alloyBonus;

      globalEvents.emit('vault:opened', {
        upgradesAwarded,
        evolvedWeapon: evolvedWeapon ?? undefined,
        alloyBonus
      });
    }
  }

  public clear(): void {
    for (const p of this.pickups) {
      this.group.remove(p.mesh);
    }
    this.pickups.length = 0;
  }
}
