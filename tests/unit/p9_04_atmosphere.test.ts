import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { AtmosphereSystem } from '../../src/graphics/AtmosphereSystem';
import { globalEvents } from '../../src/core/EventBus';

describe('P9-04: Atmosphere (Falling Ash, Skyline Lightning, 64 Pooled Scorch Decals)', () => {
  let scene: THREE.Scene;
  let atmosphere: AtmosphereSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x162840, 20, 50);
    atmosphere = new AtmosphereSystem(scene);
  });

  afterEach(() => {
    atmosphere.dispose();
  });

  it('allocates 240 falling ash particles in a single Points draw call', () => {
    const points = scene.children[0].children.find((c) => c instanceof THREE.Points) as THREE.Points;
    expect(points).toBeDefined();
    const posAttr = points.geometry.getAttribute('position');
    expect(posAttr.count).toBe(240);
  });

  it('pre-allocates a fixed pool of exactly 64 scorch decals', () => {
    const meshes = scene.children[0].children.filter((c) => c instanceof THREE.Mesh);
    expect(meshes.length).toBe(64);
    expect(atmosphere.getActiveDecalCount()).toBe(0);
  });

  it('spawns a scorch decal at the specified position and rotation', () => {
    atmosphere.spawnScorchDecal(12, -8, 2.5);
    expect(atmosphere.getActiveDecalCount()).toBe(1);

    const activeMesh = scene.children[0].children.find(
      (c) => c instanceof THREE.Mesh && c.visible
    ) as THREE.Mesh;
    expect(activeMesh).toBeDefined();
    expect(activeMesh.position.x).toBe(12);
    expect(activeMesh.position.z).toBe(-8);
    expect(activeMesh.scale.x).toBe(5.0); // radius * 2
  });

  it('automatically spawns scorch decals on vfx:explosion events', () => {
    globalEvents.emit('vfx:explosion', { x: -4, y: 0.5, z: 9, scale: 1.5 });
    expect(atmosphere.getActiveDecalCount()).toBe(1);

    const activeMesh = scene.children[0].children.find(
      (c) => c instanceof THREE.Mesh && c.visible
    ) as THREE.Mesh;
    expect(activeMesh.position.x).toBe(-4);
    expect(activeMesh.position.z).toBe(9);
  });

  it('enforces 20-second decal persistence with gradual 4-second fadeout before expiry', () => {
    atmosphere.spawnScorchDecal(0, 0, 2.0);
    expect(atmosphere.getActiveDecalCount()).toBe(1);

    // After 10s: still active and fully opaque
    atmosphere.update(10.0);
    expect(atmosphere.getActiveDecalCount()).toBe(1);

    // After 18s (total): in fadeout window [16s, 20s]
    atmosphere.update(8.0);
    expect(atmosphere.getActiveDecalCount()).toBe(1);

    // After 21s (total): expired and returned to pool
    atmosphere.update(3.0);
    expect(atmosphere.getActiveDecalCount()).toBe(0);
  });

  it('reuses oldest decals when exceeding the 64-decal budget (circular ring buffer)', () => {
    for (let i = 0; i < 70; i++) {
      atmosphere.spawnScorchDecal(i, i, 2.0);
    }
    // At most 64 active decals can exist simultaneously
    expect(atmosphere.getActiveDecalCount()).toBe(64);
  });

  it('triggers skyline lightning flash and modulates fog color', () => {
    const initialFog = scene.fog!.color.getHex();
    atmosphere.triggerLightningFlash(1.0);

    // Update 0.016s -> fog shifts toward electrical storm flash color
    atmosphere.update(0.016);
    expect(scene.fog!.color.getHex()).not.toBe(initialFog);

    // After 0.4s -> flash decays back toward base fog
    atmosphere.update(0.4);
    expect(scene.fog!.color.getHex()).toBe(initialFog);
  });

  it('disables rendering when quality setting is turned off', () => {
    atmosphere.spawnScorchDecal(0, 0);
    atmosphere.setEnabled(false);
    expect(atmosphere.isEnabled()).toBe(false);

    atmosphere.spawnScorchDecal(5, 5);
    // When disabled, group is hidden
    expect(scene.children[0].visible).toBe(false);
  });
});
