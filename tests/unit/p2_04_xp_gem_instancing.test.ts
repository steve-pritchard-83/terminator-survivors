import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { getGemTier } from '../../src/graphics/meshes/PickupMeshes';

describe('P2-04 XP gem instancing + merging', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let pickups: PickupSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    runState = new RunState();
    runState.mode = 'playing';
    audio = new AudioEngine();
    pickups = new PickupSystem(runState, audio);
  });

  it('batches data cores into exactly 6 InstancedMesh pools (3 crystal + 3 beam tiers)', () => {
    // Check initial instanced meshes attached to group
    const instancedMeshes = pickups.group.children.filter((c) => c instanceof THREE.InstancedMesh);
    expect(instancedMeshes.length).toBe(6); // 3 crystal tiers + 3 beam tiers = 6 draw calls max
  });

  it('spawning 1000 data cores results in <= 6 draw calls for gems and no individual meshes', () => {
    for (let i = 0; i < 1000; i++) {
      // Spawn gems spread out so they don't all merge
      pickups.spawnDataCore((i % 40) * 4.0, Math.floor(i / 40) * 4.0, 1);
    }

    // Individual mesh count in group should only be the 6 instanced pools (no child meshes)
    expect(pickups.group.children.length).toBe(6);

    const instancedMeshes = pickups.group.children.filter((c) => c instanceof THREE.InstancedMesh);
    expect(instancedMeshes.length).toBe(6);
  });

  it('merges oldest core into nearest core within 3m when cores exceed 250', () => {
    // Spawn 250 cores in a tight grid within 3m of each other
    for (let i = 0; i < 250; i++) {
      pickups.spawnDataCore((i % 10) * 0.2, Math.floor(i / 10) * 0.2, 1);
    }

    expect(pickups.pickups.filter((p) => p.kind === 'core').length).toBe(250);

    // Spawning 251st core triggers merge
    pickups.spawnDataCore(0.1, 0.1, 1);

    // Count should be capped at 250
    const cores = pickups.pickups.filter((p) => p.kind === 'core');
    expect(cores.length).toBe(250);

    // A core absorbed the XP of the merged core
    const highXpCore = cores.find((c) => c.xpValue > 1);
    expect(highXpCore).toBeDefined();
    expect(highXpCore!.xpValue).toBe(2);
  });

  it('upgrades gem tier visual when accumulated XP crosses tier thresholds', () => {
    expect(getGemTier(1)).toBe(1);
    expect(getGemTier(4)).toBe(1);
    expect(getGemTier(5)).toBe(2);
    expect(getGemTier(19)).toBe(2);
    expect(getGemTier(20)).toBe(3);

    // Spawn 250 cores, then spawn enough to merge multiple times into adjacent cores
    for (let i = 0; i < 250; i++) {
      pickups.spawnDataCore(0, 0, 1);
    }

    // Spawn 10 more cores at (0, 0) to force multiple merges
    for (let i = 0; i < 10; i++) {
      pickups.spawnDataCore(0, 0, 1);
    }

    const cores = pickups.pickups.filter((p) => p.kind === 'core');
    expect(cores.length).toBe(250);

    // One of the merged cores should have accumulated enough XP to advance to Tier 2 (xp >= 5)
    const tier2OrHigher = cores.some((c) => (c.tier ?? 1) >= 2);
    expect(tier2OrHigher).toBe(true);
  });

  it('allows player to collect data cores, releasing from pools and awarding XP', () => {
    pickups.spawnDataCore(0, 0, 10);
    expect(pickups.pickups.length).toBe(1);

    // Position player at (0, 0)
    runState.playerPos.x = 0;
    runState.playerPos.z = 0;

    const initialXp = runState.xp;
    pickups.update(0.016);

    expect(pickups.pickups.length).toBe(0);
    expect(runState.xp).toBeGreaterThan(initialXp);
  });

  it('preserves crates and vaults as individual interactive 3D meshes', () => {
    pickups.spawnSupplyCrate(5, 5);
    pickups.spawnBossVault(10, 10);

    const crate = pickups.pickups.find((p) => p.kind === 'crate');
    const vault = pickups.pickups.find((p) => p.kind === 'vault');

    expect(crate).toBeDefined();
    expect(crate?.mesh).toBeDefined();
    expect(pickups.group.children.includes(crate!.mesh!)).toBe(true);

    expect(vault).toBeDefined();
    expect(vault?.mesh).toBeDefined();
    expect(pickups.group.children.includes(vault!.mesh!)).toBe(true);

    pickups.clear();
    expect(pickups.pickups.length).toBe(0);
    expect(pickups.group.children.includes(crate!.mesh!)).toBe(false);
    expect(pickups.group.children.includes(vault!.mesh!)).toBe(false);
  });
});
