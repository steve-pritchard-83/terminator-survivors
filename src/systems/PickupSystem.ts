import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { AudioEngine } from '../audio/AudioEngine';
import type { SpatialEntity } from '../core/types';
import { PickupMeshFactory } from '../graphics/meshes/PickupMeshes';
import { globalEvents } from '../core/EventBus';

export interface ActivePickup extends SpatialEntity {
  mesh: THREE.Object3D;
  kind: 'core' | 'crate' | 'vault';
  xpValue: number;
  attracted: boolean;
}

export class PickupSystem {
  public readonly group = new THREE.Group();
  public readonly pickups: ActivePickup[] = [];
  private nextPickupId = 10000;

  private readonly runState: RunState;
  private readonly audio: AudioEngine;

  private comboCount = 0;
  private comboTimer = 0;

  constructor(runState: RunState, audio: AudioEngine) {
    this.runState = runState;
    this.audio = audio;

    // Listen for enemy kill events to drop data cores or crates
    globalEvents.on('enemy:killed', ({ enemy, x, z, xp }) => {
      if (enemy.isBoss) {
        this.spawnBossVault(x, z);
        this.runState.addScrap(75);
      } else {
        this.spawnDataCore(x, z, xp);
        // 25% chance to award alloy scrap on normal enemy kills
        if (Math.random() < 0.25) {
          this.runState.addScrap(2);
        }
        // 7% chance to drop destructible supply crate in condensed 10-minute runs
        if (Math.random() < 0.07) {
          this.spawnSupplyCrate(x + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 2);
        }
      }
    });

    // Listen for weapons destroying supply crates
    globalEvents.on('crate:destroyed', ({ crateId }) => {
      const idx = this.pickups.findIndex((p) => p.id === crateId && p.kind === 'crate');
      if (idx !== -1) {
        this.collectPickup(this.pickups[idx], idx);
      }
    });
  }

  public spawnDataCore(x: number, z: number, xpValue: number): void {
    const mesh = PickupMeshFactory.createDataCore(xpValue);
    mesh.position.set(x, 0.35, z);
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
      p.mesh.rotation.y += dt * 2.8; // Spin animation

      const dx = px - p.x;
      const dz = pz - p.z;
      const dist = Math.hypot(dx, dz);

      // Magnet attraction & floating bob for data cores
      if (p.kind === 'core') {
        const bobY = 0.36 + Math.sin(this.runState.timeSeconds * 4.5 + p.id) * 0.08;
        if (dist <= magnetRadius || p.attracted) {
          p.attracted = true;
          const pullSpeed = 16.0;
          p.x += (dx / dist) * pullSpeed * dt;
          p.z += (dz / dist) * pullSpeed * dt;
        }
        p.mesh.position.set(p.x, bobY, p.z);
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
        this.runState.heal(35);
        globalEvents.emit('pickup:reward', { x: p.x, z: p.z, text: '+35 HP', color: 'var(--color-green)' });
      } else if (roll < 0.7) {
        const gained = this.runState.addScrap(45);
        globalEvents.emit('pickup:reward', { x: p.x, z: p.z, text: `+${gained} SCRAP`, color: 'var(--color-cyan)' });
      } else {
        // Vacuum all cores on screen
        for (const core of this.pickups) {
          if (core.kind === 'core') core.attracted = true;
        }
        globalEvents.emit('pickup:reward', { x: p.x, z: p.z, text: 'CORE VACUUM!', color: 'var(--color-amber)' });
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
      const alloyBonus = 220;
      this.runState.addScrap(alloyBonus);

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
