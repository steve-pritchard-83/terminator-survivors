import type * as THREE from 'three';
import { HKAerialMesh } from './meshes/HKAerialMesh';

const ALTITUDE = 4;
const ORBIT_AHEAD = 10;
const ORBIT_RADIUS_X = 11;
const ORBIT_RADIUS_Z = 4;

/**
 * Behind the title screen: the camera drifts slowly across the night battlefield while a
 * Hunter-Killer circles ahead of it, sweeping the ground with its searchlights.
 */
export class TitleFlyover {
  public readonly panPos = { x: 0, z: 0 };
  private readonly hk = new HKAerialMesh(false);
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.hk.group.visible = false;
    scene.add(this.hk.group);
  }

  public update(dt: number, active: boolean): void {
    this.hk.group.visible = active;
    if (!active) return;
    this.time += dt;

    this.panPos.x = Math.sin(this.time * 0.05) * 18;
    this.panPos.z = -this.time * 1.2;

    // Orbit well ahead of the camera and low over the ground: any nearer and the hull fills the
    // screen as a dark slab (the compact phone camera sits only ~12 m up)
    const a = this.time * 0.22;
    const orbitX = Math.cos(a) * ORBIT_RADIUS_X;
    const orbitZ = Math.sin(a) * ORBIT_RADIUS_Z;
    this.hk.group.position.set(this.panPos.x + orbitX, ALTITUDE, this.panPos.z - ORBIT_AHEAD + orbitZ);
    const vx = -Math.sin(a) * ORBIT_RADIUS_X * 0.22;
    const vz = Math.cos(a) * ORBIT_RADIUS_Z * 0.22 - 1.2;
    this.hk.group.rotation.y = Math.atan2(vx, vz);
    this.hk.update(this.time, 0, 0, vx, vz, dt);
  }

  public dispose(): void {
    this.hk.dispose();
  }
}
