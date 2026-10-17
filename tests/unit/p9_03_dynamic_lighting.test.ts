import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { DynamicLightingManager } from '../../src/graphics/DynamicLightingManager';
import { globalEvents } from '../../src/core/EventBus';

describe('P9-03: Dynamic Lighting Budget (8 PointLight Pool)', () => {
  let scene: THREE.Scene;
  let lightingManager: DynamicLightingManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    lightingManager = new DynamicLightingManager(scene);
    lightingManager.setPlayerPos(0, 0);
  });

  afterEach(() => {
    lightingManager.dispose();
  });

  it('allocates a fixed pool of exactly 8 PointLights added to the scene', () => {
    expect(lightingManager.getPoolSize()).toBe(8);
    const pointLights = scene.children.filter((child) => child instanceof THREE.PointLight);
    expect(pointLights.length).toBe(8);
    expect(lightingManager.getActiveCount()).toBe(0);
  });

  it('activates lights on demand up to the pool limit of 8', () => {
    for (let i = 0; i < 8; i++) {
      const success = lightingManager.requestLight(i * 2, 0.5, 0, 0xffaa00, 10, 10, 0.5);
      expect(success).toBe(true);
    }
    expect(lightingManager.getActiveCount()).toBe(8);
  });

  it('drops lower-priority light requests when all 8 slots are busy', () => {
    // Fill with high intensity near player
    for (let i = 0; i < 8; i++) {
      lightingManager.requestLight(0, 0.5, 0, 0xffffff, 20, 10, 1.0);
    }
    expect(lightingManager.getActiveCount()).toBe(8);

    // Request distant, weak light (far from player, low intensity)
    const success = lightingManager.requestLight(100, 0.5, 100, 0x00ffff, 2, 5, 0.5);
    expect(success).toBe(false);
    expect(lightingManager.getActiveCount()).toBe(8);
  });

  it('steals the lowest priority slot when a higher-priority light is requested ("largest/closest wins")', () => {
    // Fill with weak lights
    for (let i = 0; i < 7; i++) {
      lightingManager.requestLight(0, 0.5, 0, 0xffffff, 15, 10, 1.0);
    }
    // Slot 8 has very low priority
    lightingManager.requestLight(50, 0.5, 50, 0x333333, 1, 5, 1.0);
    expect(lightingManager.getActiveCount()).toBe(8);

    // Now request a massive, close explosion right at player position
    const stolen = lightingManager.flashExplosion(0, 0.5, 0, 2.5);
    expect(stolen).toBe(true);
    expect(lightingManager.getActiveCount()).toBe(8);
  });

  it('disables all dynamic lights when low quality mode is activated', () => {
    lightingManager.flashExplosion(0, 0, 0, 1.0);
    expect(lightingManager.getActiveCount()).toBe(1);

    // Disable (e.g. low quality preset)
    lightingManager.setEnabled(false);
    expect(lightingManager.isEnabled()).toBe(false);
    expect(lightingManager.getActiveCount()).toBe(0);

    // Subsequent requests are blocked
    const success = lightingManager.flashMuzzle(0, 0, 0);
    expect(success).toBe(false);
    expect(lightingManager.getActiveCount()).toBe(0);
  });

  it('smoothly fades lights and returns them to the pool after expiration', () => {
    lightingManager.requestLight(0, 0, 0, 0xff0000, 10, 10, 0.2);
    expect(lightingManager.getActiveCount()).toBe(1);

    // Advance 0.1s -> still active with reduced intensity
    lightingManager.update(0.1);
    expect(lightingManager.getActiveCount()).toBe(1);

    // Advance another 0.15s (total 0.25s >= 0.2s duration) -> returned to pool
    lightingManager.update(0.15);
    expect(lightingManager.getActiveCount()).toBe(0);
  });

  it('responds to global VFX events (vfx:explosion, vfx:plasma, vfx:muzzle)', () => {
    globalEvents.emit('vfx:explosion', { x: 5, y: 0.5, z: 5, scale: 1.2 });
    expect(lightingManager.getActiveCount()).toBe(1);

    globalEvents.emit('vfx:plasma', { x: -2, y: 0.3, z: 1, isHeavy: true });
    expect(lightingManager.getActiveCount()).toBe(2);

    globalEvents.emit('vfx:muzzle', { x: 0, y: 0.4, z: 0 });
    expect(lightingManager.getActiveCount()).toBe(3);
  });
});
