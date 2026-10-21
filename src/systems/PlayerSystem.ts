import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import type { ParticleSystem } from './ParticleSystem';
import { disposeObject3D } from '../graphics/dispose';

export class PlayerSystem {
  public readonly group = new THREE.Group();
  private readonly runState: RunState;
  private readonly playerMesh: KyleReeseMesh;
  private readonly particles?: ParticleSystem;

  // Ground aim reticle
  public readonly reticleGroup = new THREE.Group();
  public readonly reticleMat: THREE.MeshBasicMaterial;

  constructor(runState: RunState, playerMesh: KyleReeseMesh, particles?: ParticleSystem) {
    this.runState = runState;
    this.playerMesh = playerMesh;
    this.particles = particles;

    // Ground aim reticle
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const outerRingGeo = new THREE.RingGeometry(0.38, 0.45, 24);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRing = new THREE.Mesh(outerRingGeo, this.reticleMat);

    const centerGeo = new THREE.CircleGeometry(0.06, 12);
    centerGeo.rotateX(-Math.PI / 2);
    const centerDot = new THREE.Mesh(centerGeo, this.reticleMat);

    const tickGeoN = new THREE.PlaneGeometry(0.04, 0.22);
    tickGeoN.rotateX(-Math.PI / 2);
    const tickN = new THREE.Mesh(tickGeoN, this.reticleMat);
    tickN.position.z = 0.42;

    const tickS = new THREE.Mesh(tickGeoN, this.reticleMat);
    tickS.position.z = -0.42;

    const tickGeoE = new THREE.PlaneGeometry(0.22, 0.04);
    tickGeoE.rotateX(-Math.PI / 2);
    const tickE = new THREE.Mesh(tickGeoE, this.reticleMat);
    tickE.position.x = 0.42;

    const tickW = new THREE.Mesh(tickGeoE, this.reticleMat);
    tickW.position.x = -0.42;

    this.reticleGroup.add(outerRing, centerDot, tickN, tickS, tickE, tickW);
    this.reticleGroup.visible = false;
    this.group.add(this.reticleGroup);
  }

  public setInterpolatedPosition(
    alpha: number,
    prevPos: { x: number; z: number }
  ): { x: number; z: number } {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    const interpX = prevPos.x + (this.runState.playerPos.x - prevPos.x) * clampedAlpha;
    const interpZ = prevPos.z + (this.runState.playerPos.z - prevPos.z) * clampedAlpha;
    this.playerMesh.group.position.set(interpX, 0, interpZ);
    return { x: interpX, z: interpZ };
  }

  public update(
    dt: number,
    moveInput: { x: number; z: number },
    targetAngle: number | null,
    obstacles: Array<{ x: number; z: number; radius: number }>,
    aimPos?: { x: number; z: number } | null
  ): void {
    this.runState.updateTimers(dt);

    const speed = this.runState.computedStats.moveSpeed;

    const inputLen = Math.hypot(moveInput.x, moveInput.z);
    let vx = 0;
    let vz = 0;
    if (inputLen > 0.05) {
      const normX = moveInput.x / inputLen;
      const normZ = moveInput.z / inputLen;
      vx = normX * speed * dt;
      vz = normZ * speed * dt;
    }

    let nextX = this.runState.playerPos.x + vx;
    let nextZ = this.runState.playerPos.z + vz;

    // Obstacle circle-circle collision pushback
    const playerRadius = 0.55;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dx = nextX - obs.x;
      const dz = nextZ - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = playerRadius + obs.radius;
      if (dist < minDist && dist > 0.001) {
        const overlap = minDist - dist;
        nextX += (dx / dist) * overlap;
        nextZ += (dz / dist) * overlap;
      }
    }

    this.runState.playerPos.x = nextX;
    this.runState.playerPos.z = nextZ;

    // Facing angle: prioritize aiming angle if provided, otherwise movement direction
    let facing = this.runState.playerFacing;
    if (inputLen > 0.05) {
      this.runState.playerMoveAngle = Math.atan2(moveInput.x, moveInput.z);
      this.runState.isMoving = true;
    } else {
      this.runState.isMoving = false;
    }

    if (targetAngle !== null) {
      facing = targetAngle;
    } else if (this.runState.isMoving) {
      facing = this.runState.playerMoveAngle;
    }
    this.runState.playerFacing = facing;

    // Update 3D mesh
    this.playerMesh.group.position.set(nextX, 0, nextZ);
    this.playerMesh.updateAnimation(
      dt,
      inputLen > 0.05 ? speed : 0,
      facing
    );

    // i-frame flicker after damage
    if (this.runState.invulnerabilityTimer > 0) {
      this.playerMesh.group.visible = Math.floor(this.runState.invulnerabilityTimer * 24) % 2 === 0;
    } else {
      this.playerMesh.group.visible = true;
    }

    // Ground aim reticle
    if (aimPos) {
      this.reticleGroup.visible = true;
      this.reticleGroup.position.set(aimPos.x, 0.02, aimPos.z);
    } else if (targetAngle !== null) {
      this.reticleGroup.visible = true;
      const aimDist = 5.0;
      this.reticleGroup.position.set(
        nextX + Math.sin(targetAngle) * aimDist,
        0.02,
        nextZ + Math.cos(targetAngle) * aimDist
      );
    } else {
      this.reticleGroup.visible = false;
    }

  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
