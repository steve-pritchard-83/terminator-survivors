import * as THREE from 'three';
import type { RunState } from '../state/RunState';
import type { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';

export class PlayerSystem {
  private readonly runState: RunState;
  private readonly playerMesh: KyleReeseMesh;

  constructor(runState: RunState, playerMesh: KyleReeseMesh) {
    this.runState = runState;
    this.playerMesh = playerMesh;
  }

  public update(
    dt: number,
    moveInput: { x: number; z: number },
    targetAngle: number | null,
    obstacles: Array<{ x: number; z: number; radius: number }>
  ): void {
    this.runState.updateTimers(dt);

    let speed = this.runState.computedStats.moveSpeed;
    if (this.runState.isDashing) {
      speed *= 2.6; // Combat dive burst speed
    }

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
    if (targetAngle !== null) {
      facing = targetAngle;
    } else if (inputLen > 0.05) {
      facing = Math.atan2(moveInput.x, moveInput.z);
    }
    this.runState.playerFacing = facing;

    // Update 3D mesh
    this.playerMesh.group.position.set(nextX, 0, nextZ);
    this.playerMesh.updateAnimation(dt, inputLen > 0.05 ? speed : 0, facing, this.runState.isDashing);
  }
}
