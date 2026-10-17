import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InstancedPool, type PoolableUser } from '../../src/graphics/InstancedPool';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';

interface MockUser extends PoolableUser {
  id: string;
}

describe('P2-03 projectile instanced pooling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('InstancedPool mechanics', () => {
    it('acquires and releases slots with correct count tracking', () => {
      const geo = new THREE.SphereGeometry(1);
      const mat = new THREE.MeshBasicMaterial();
      const parent = new THREE.Group();
      const pool = new InstancedPool<MockUser>(geo, mat, 4, parent);

      expect(pool.count).toBe(0);
      expect(pool.mesh.count).toBe(0);
      expect(parent.children.includes(pool.mesh)).toBe(true);

      const userA: MockUser = { id: 'A', poolIndex: -1 };
      const userB: MockUser = { id: 'B', poolIndex: -1 };
      const userC: MockUser = { id: 'C', poolIndex: -1 };

      pool.acquire(userA);
      pool.acquire(userB);
      pool.acquire(userC);

      expect(userA.poolIndex).toBe(0);
      expect(userB.poolIndex).toBe(1);
      expect(userC.poolIndex).toBe(2);
      expect(pool.count).toBe(3);
      expect(pool.mesh.count).toBe(3);

      // Release middle item (userB at index 1) -> userC at index 2 swaps into index 1
      pool.release(userB.poolIndex);

      expect(pool.count).toBe(2);
      expect(pool.mesh.count).toBe(2);
      expect(userC.poolIndex).toBe(1); // C moved to index 1

      // Release last item (now userC at index 1)
      pool.release(userC.poolIndex);
      expect(pool.count).toBe(1);
      expect(userA.poolIndex).toBe(0);

      // Release remaining item (userA at index 0)
      pool.release(userA.poolIndex);
      expect(pool.count).toBe(0);
    });

    it('sets transforms and updates instance matrix', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const pool = new InstancedPool<MockUser>(geo, mat, 8);

      const user: MockUser = { id: 'U', poolIndex: -1 };
      pool.acquire(user);

      pool.setTransform(user.poolIndex, 10, 20, 30, Math.PI / 2, 0, 2, 3, 4);

      const mat4 = new THREE.Matrix4();
      pool.mesh.getMatrixAt(user.poolIndex, mat4);

      const pos = new THREE.Vector3();
      const rot = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      mat4.decompose(pos, rot, scale);

      expect(pos.x).toBeCloseTo(10);
      expect(pos.y).toBeCloseTo(20);
      expect(pos.z).toBeCloseTo(30);
      expect(scale.x).toBeCloseTo(2);
      expect(scale.y).toBeCloseTo(3);
      expect(scale.z).toBeCloseTo(4);
    });

    it('dynamically expands capacity when capacity limit is reached', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const parent = new THREE.Group();
      const pool = new InstancedPool<MockUser>(geo, mat, 2, parent);

      const users: MockUser[] = [
        { id: '1', poolIndex: -1 },
        { id: '2', poolIndex: -1 },
        { id: '3', poolIndex: -1 },
        { id: '4', poolIndex: -1 },
        { id: '5', poolIndex: -1 }
      ];

      for (const u of users) {
        pool.acquire(u);
        pool.setTransform(u.poolIndex, u.poolIndex * 2, 0, 0);
      }

      expect(pool.count).toBe(5);
      expect(pool.capacityLimit).toBeGreaterThanOrEqual(8);
      expect(parent.children.includes(pool.mesh)).toBe(true);

      // Verify matrices were preserved across reallocations
      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const rot = new THREE.Quaternion();
      const scale = new THREE.Vector3();

      for (let i = 0; i < 5; i++) {
        pool.mesh.getMatrixAt(i, mat4);
        mat4.decompose(pos, rot, scale);
        expect(pos.x).toBeCloseTo(i * 2);
      }
    });

    it('clears all active instances cleanly', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const pool = new InstancedPool<MockUser>(geo, mat, 16);

      for (let i = 0; i < 5; i++) {
        pool.acquire({ id: `${i}`, poolIndex: -1 });
      }
      expect(pool.count).toBe(5);

      pool.clear();
      expect(pool.count).toBe(0);
      expect(pool.mesh.count).toBe(0);
    });
  });

  describe('WeaponSystem projectile batching', () => {
    it('batches projectiles into 4 InstancedPool meshes (pellet, plasma, heavy_plasma, bomb)', () => {
      const runState = new RunState();
      const grid = new SpatialHashGrid(100);
      const audio = new AudioEngine();
      const particles = new ParticleSystem();
      const playerMesh = new KyleReeseMesh();

      const weapons = new WeaponSystem(runState, grid, audio, particles, playerMesh);

      // Verify exactly 4 InstancedMesh instances exist in weaponSystem.group for projectiles
      const instancedMeshes = weapons.group.children.filter((c) => c instanceof THREE.InstancedMesh);
      expect(instancedMeshes.length).toBe(4);

      // Equip shotgun (ithaca_37) and trigger update
      runState.mode = 'playing';
      runState.weapons.set('ithaca_37', {
        id: 'ithaca_37',
        level: 1,
        evolved: false,
        cooldownTimer: 0
      });
      const slot = runState.weapons.get('ithaca_37')!;
      slot.cooldownTimer = 0;

      weapons.update(0.016, []);

      // Pellet instanced pool should now have active instances
      const pelletPoolMesh = instancedMeshes[0] as THREE.InstancedMesh;
      expect(pelletPoolMesh.count).toBeGreaterThan(0);

      // Update for several ticks and then clear
      weapons.update(0.1, []);
      weapons.clear();
      expect(pelletPoolMesh.count).toBe(0);
    });
  });

  describe('EnemySystem projectile batching', () => {
    it('batches enemy projectiles into 1 InstancedMesh pool', () => {
      const runState = new RunState();
      const grid = new SpatialHashGrid(100);
      const audio = new AudioEngine();
      const particles = new ParticleSystem();
      const endoBatch = new EndoskeletonBatch(10);

      const enemies = new EnemySystem(runState, grid, audio, particles, endoBatch);

      const instancedMeshes = enemies.group.children.filter((c) => c instanceof THREE.InstancedMesh);
      expect(instancedMeshes.length).toBe(1);

      // Spawn an enemy infiltrator which fires plasma bursts
      const infiltrator = enemies.spawnEnemy('infiltrator_csm101', 5, 0);
      infiltrator.phaseState = 0; // Trigger firing burst

      enemies.update(0.016, 1.0);
      enemies.update(0.016, 1.016);

      const enemyPoolMesh = instancedMeshes[0] as THREE.InstancedMesh;
      expect(enemyPoolMesh.count).toBeGreaterThan(0);

      // Update until projectile expires
      for (let i = 0; i < 200; i++) {
        enemies.update(0.03, 1.0 + i * 0.03);
      }

      expect(enemyPoolMesh.count).toBe(0);
    });
  });
});
