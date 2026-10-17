import * as THREE from 'three';
import { globalEvents } from '../core/EventBus';

export interface LightSlot {
  light: THREE.PointLight;
  active: boolean;
  priority: number;
  initialIntensity: number;
  duration: number;
  elapsed: number;
}

export class DynamicLightingManager {
  public static readonly POOL_SIZE = 8;
  private readonly slots: LightSlot[] = [];
  private enabled = true;
  private playerX = 0;
  private playerZ = 0;
  private readonly unbinds: (() => void)[] = [];

  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < DynamicLightingManager.POOL_SIZE; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      light.visible = false;
      light.castShadow = false; // PointLight shadows disabled for performance
      this.scene.add(light);
      this.slots.push({
        light,
        active: false,
        priority: 0,
        initialIntensity: 0,
        duration: 0,
        elapsed: 0
      });
    }

    // Event hooks for explosive & plasma illumination
    this.unbinds.push(
      globalEvents.on('vfx:explosion', (data) => {
        this.flashExplosion(data.x, data.y ?? 0.5, data.z, data.scale ?? 1.0);
      }),
      globalEvents.on('vfx:plasma', (data) => {
        this.flashPlasmaBolt(data.x, data.y ?? 0.3, data.z, data.isHeavy ?? false);
      }),
      globalEvents.on('vfx:muzzle', (data) => {
        this.flashMuzzle(data.x, data.y ?? 0.4, data.z, data.color ?? 0x4dd2ff);
      })
    );
  }

  public setPlayerPos(px: number, pz: number): void {
    this.playerX = px;
    this.playerZ = pz;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getPoolSize(): number {
    return DynamicLightingManager.POOL_SIZE;
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].active) count++;
    }
    return count;
  }

  /**
   * Request a point light from the 8-light budget pool.
   * Priority is determined by intensity and proximity to the player: "largest / closest wins".
   */
  public requestLight(
    x: number,
    y: number,
    z: number,
    color: THREE.ColorRepresentation,
    intensity: number,
    distance: number,
    duration: number,
    playerX = this.playerX,
    playerZ = this.playerZ
  ): boolean {
    if (!this.enabled || intensity <= 0 || duration <= 0) {
      return false;
    }

    const distToPlayer = Math.hypot(x - playerX, z - playerZ);
    // Larger intensity and closer distance yield higher priority
    const priority = intensity * (1.0 / (1.0 + distToPlayer * 0.06));

    // 1. Try finding an idle slot
    let targetSlot: LightSlot | null = null;
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i].active) {
        targetSlot = this.slots[i];
        break;
      }
    }

    // 2. If all 8 slots are busy, lowest priority active light is stolen if candidate priority is higher
    if (!targetSlot) {
      let lowestPriority = Infinity;
      let lowestIdx = -1;
      for (let i = 0; i < this.slots.length; i++) {
        if (this.slots[i].priority < lowestPriority) {
          lowestPriority = this.slots[i].priority;
          lowestIdx = i;
        }
      }

      if (lowestIdx !== -1 && priority > lowestPriority) {
        targetSlot = this.slots[lowestIdx];
      }
    }

    if (!targetSlot) {
      return false; // Dropped to preserve strict 8-light budget
    }

    targetSlot.active = true;
    targetSlot.priority = priority;
    targetSlot.initialIntensity = intensity;
    targetSlot.duration = duration;
    targetSlot.elapsed = 0;

    targetSlot.light.color.set(color);
    targetSlot.light.intensity = intensity;
    targetSlot.light.distance = distance;
    targetSlot.light.position.set(x, y, z);
    targetSlot.light.visible = true;

    return true;
  }

  public flashMuzzle(
    x: number,
    y: number,
    z: number,
    color = 0x4dd2ff,
    playerX = this.playerX,
    playerZ = this.playerZ
  ): boolean {
    return this.requestLight(x, y, z, color, 8.5, 11.0, 0.08, playerX, playerZ);
  }

  public flashExplosion(
    x: number,
    y: number,
    z: number,
    scale = 1.0,
    playerX = this.playerX,
    playerZ = this.playerZ
  ): boolean {
    const intensity = Math.min(24.0, 15.0 * scale);
    const radius = Math.min(22.0, 14.0 * scale);
    const duration = Math.min(0.45, 0.28 * Math.sqrt(scale));
    return this.requestLight(x, y, z, 0xff7722, intensity, radius, duration, playerX, playerZ);
  }

  public flashPlasmaBolt(
    x: number,
    y: number,
    z: number,
    isHeavy = false,
    playerX = this.playerX,
    playerZ = this.playerZ
  ): boolean {
    const color = isHeavy ? 0xcc22ff : 0x00e5ff;
    const intensity = isHeavy ? 10.0 : 6.0;
    const distance = isHeavy ? 13.0 : 9.5;
    const duration = isHeavy ? 0.16 : 0.09;
    return this.requestLight(x, y, z, color, intensity, distance, duration, playerX, playerZ);
  }

  public update(dt: number): void {
    if (!this.enabled) return;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.active) continue;

      slot.elapsed += dt;
      if (slot.elapsed >= slot.duration) {
        slot.active = false;
        slot.priority = 0;
        slot.light.visible = false;
        slot.light.intensity = 0;
      } else {
        // Quadratic fade out for natural light dissipation
        const progress = slot.elapsed / slot.duration;
        const fade = (1.0 - progress) * (1.0 - progress);
        slot.light.intensity = slot.initialIntensity * fade;
      }
    }
  }

  public clear(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.active = false;
      slot.priority = 0;
      slot.light.visible = false;
      slot.light.intensity = 0;
    }
  }

  public dispose(): void {
    this.clear();
    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;

    for (let i = 0; i < this.slots.length; i++) {
      this.scene.remove(this.slots[i].light);
      this.slots[i].light.dispose();
    }
    this.slots.length = 0;
  }
}
