import * as THREE from 'three';
import { disposeObject3D } from './dispose';

export interface PoolableUser {
  poolIndex: number;
}

export class InstancedPool<T extends PoolableUser = PoolableUser> {
  public mesh: THREE.InstancedMesh;
  public readonly geometry: THREE.BufferGeometry;
  public readonly material: THREE.Material | THREE.Material[];
  private capacity: number;
  private activeCount = 0;
  private readonly users: (T | null)[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly tempMatrix = new THREE.Matrix4();
  private parentGroup: THREE.Group | null = null;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    capacity = 256,
    parentGroup?: THREE.Group
  ) {
    this.geometry = geometry;
    this.material = material;
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.users = new Array(capacity).fill(null);

    if (parentGroup) {
      this.parentGroup = parentGroup;
      this.parentGroup.add(this.mesh);
    }
  }

  public get count(): number {
    return this.activeCount;
  }

  public get capacityLimit(): number {
    return this.capacity;
  }

  public acquire(user?: T): number {
    this.ensureCapacity();
    const index = this.activeCount++;
    this.mesh.count = this.activeCount;
    if (user) {
      user.poolIndex = index;
      this.users[index] = user;
    } else {
      this.users[index] = null;
    }
    return index;
  }

  public release(index: number): void {
    if (index < 0 || index >= this.activeCount) return;
    const lastIndex = this.activeCount - 1;

    if (index < lastIndex) {
      // Copy matrix of lastIndex into slot index
      this.mesh.getMatrixAt(lastIndex, this.tempMatrix);
      this.mesh.setMatrixAt(index, this.tempMatrix);

      // Swap user tracking
      const movedUser = this.users[lastIndex];
      this.users[index] = movedUser;
      if (movedUser) {
        movedUser.poolIndex = index;
      }
    }

    this.users[lastIndex] = null;
    this.activeCount--;
    this.mesh.count = this.activeCount;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public setTransform(
    index: number,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    pitchX = 0,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1
  ): void {
    if (index < 0 || index >= this.activeCount) return;
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(pitchX, rotY, 0);
    this.dummy.scale.set(scaleX, scaleY, scaleZ);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public clear(): void {
    for (let i = 0; i < this.activeCount; i++) {
      this.users[i] = null;
    }
    this.activeCount = 0;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    if (this.parentGroup) {
      this.parentGroup.remove(this.mesh);
    }
    disposeObject3D(this.mesh);
  }

  private ensureCapacity(): void {
    if (this.activeCount < this.capacity) return;
    const newCapacity = this.capacity * 2;
    const newMesh = new THREE.InstancedMesh(this.geometry, this.material, newCapacity);
    newMesh.count = this.activeCount;
    newMesh.frustumCulled = false;

    for (let i = 0; i < this.activeCount; i++) {
      this.mesh.getMatrixAt(i, this.tempMatrix);
      newMesh.setMatrixAt(i, this.tempMatrix);
    }
    newMesh.instanceMatrix.needsUpdate = true;

    if (this.parentGroup) {
      this.parentGroup.remove(this.mesh);
      this.parentGroup.add(newMesh);
    }

    disposeObject3D(this.mesh);
    this.mesh = newMesh;
    this.capacity = newCapacity;
    while (this.users.length < newCapacity) {
      this.users.push(null);
    }
  }
}
