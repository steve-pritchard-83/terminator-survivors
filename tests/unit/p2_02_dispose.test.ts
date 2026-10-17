import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D } from '../../src/graphics/dispose';
import { HKAerialMesh } from '../../src/graphics/meshes/HKAerialMesh';
import { HKTankMesh } from '../../src/graphics/meshes/HKTankMesh';
import { InfiltratorMesh } from '../../src/graphics/meshes/InfiltratorMesh';
import { T1000Mesh } from '../../src/graphics/meshes/T1000Mesh';
import { SkynetCoreMesh } from '../../src/graphics/meshes/SkynetCoreMesh';
import { PickupMeshFactory } from '../../src/graphics/meshes/PickupMeshes';

describe('P2-02 dispose', () => {
  it('disposes non-shared geometries and materials in an Object3D hierarchy', () => {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    const geoDisposeSpy = vi.spyOn(geo, 'dispose');
    const matDisposeSpy = vi.spyOn(mat, 'dispose');

    disposeObject3D(group);

    expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
    expect(matDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves shared geometries and materials with userData.shared = true', () => {
    const group = new THREE.Group();
    const sharedGeo = new THREE.BoxGeometry(1, 1, 1);
    sharedGeo.userData = { shared: true };
    const sharedMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    sharedMat.userData = { shared: true };

    const mesh = new THREE.Mesh(sharedGeo, sharedMat);
    group.add(mesh);

    const geoDisposeSpy = vi.spyOn(sharedGeo, 'dispose');
    const matDisposeSpy = vi.spyOn(sharedMat, 'dispose');

    disposeObject3D(group);

    expect(geoDisposeSpy).not.toHaveBeenCalled();
    expect(matDisposeSpy).not.toHaveBeenCalled();
  });

  it('spawning and despawning 50 HK Aerial meshes leaves 0 undisposed geometries', () => {
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const initialCallCount = disposeSpy.mock.calls.length;

    const meshes: HKAerialMesh[] = [];
    const geometriesToTrack = new Set<THREE.BufferGeometry>();

    for (let i = 0; i < 50; i++) {
      const hk = new HKAerialMesh();
      meshes.push(hk);

      hk.group.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.geometry && !m.geometry.userData?.shared) {
          geometriesToTrack.add(m.geometry);
        }
      });
    }

    expect(geometriesToTrack.size).toBeGreaterThan(0);

    // Despawn and dispose all 50 HK meshes
    for (const hk of meshes) {
      hk.dispose();
    }

    const callsAfter = disposeSpy.mock.calls.length - initialCallCount;
    expect(callsAfter).toBeGreaterThanOrEqual(geometriesToTrack.size);

    disposeSpy.mockRestore();
  });

  it('spawning and despawning 50 HK Tank meshes leaves 0 undisposed geometries', () => {
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const initialCallCount = disposeSpy.mock.calls.length;

    const meshes: HKTankMesh[] = [];
    const geometriesToTrack = new Set<THREE.BufferGeometry>();

    for (let i = 0; i < 50; i++) {
      const tank = new HKTankMesh();
      meshes.push(tank);

      tank.group.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.geometry && !m.geometry.userData?.shared) {
          geometriesToTrack.add(m.geometry);
        }
      });
    }

    expect(geometriesToTrack.size).toBeGreaterThan(0);

    for (const tank of meshes) {
      tank.dispose();
    }

    const callsAfter = disposeSpy.mock.calls.length - initialCallCount;
    expect(callsAfter).toBeGreaterThanOrEqual(geometriesToTrack.size);

    disposeSpy.mockRestore();
  });

  it('disposes Infiltrator, T1000, and SkynetCore meshes cleanly', () => {
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    const infiltrator = new InfiltratorMesh();
    let inflGeoCount = 0;
    infiltrator.group.traverse((c) => {
      if ((c as THREE.Mesh).geometry && !(c as THREE.Mesh).geometry.userData?.shared) inflGeoCount++;
    });
    infiltrator.dispose();

    const t1000 = new T1000Mesh();
    let t1000GeoCount = 0;
    t1000.group.traverse((c) => {
      if ((c as THREE.Mesh).geometry && !(c as THREE.Mesh).geometry.userData?.shared) t1000GeoCount++;
    });
    t1000.dispose();

    const skynet = new SkynetCoreMesh();
    let skynetGeoCount = 0;
    skynet.group.traverse((c) => {
      if ((c as THREE.Mesh).geometry && !(c as THREE.Mesh).geometry.userData?.shared) skynetGeoCount++;
    });
    skynet.dispose();

    expect(inflGeoCount).toBeGreaterThan(0);
    expect(t1000GeoCount).toBeGreaterThan(0);
    expect(skynetGeoCount).toBeGreaterThan(0);
    expect(disposeSpy.mock.calls.length).toBeGreaterThanOrEqual(
      inflGeoCount + t1000GeoCount + skynetGeoCount
    );

    disposeSpy.mockRestore();
  });

  it('PickupMeshFactory geometries and materials are protected by userData.shared', () => {
    const core = PickupMeshFactory.createDataCore(10);
    const crate = PickupMeshFactory.createSupplyCrate();
    const vault = PickupMeshFactory.createBossVault();

    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    disposeObject3D(core);
    disposeObject3D(crate);
    disposeObject3D(vault);

    // None of the shared geometries in pickups should be disposed
    expect(disposeSpy).not.toHaveBeenCalled();

    disposeSpy.mockRestore();
  });
});
