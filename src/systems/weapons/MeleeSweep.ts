import type * as THREE from 'three';
import type { ActiveEnemy, WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';
import { createSlashArcMesh } from '../../graphics/meshes/AllyMeshes';
import { disposeObject3D } from '../../graphics/dispose';

const SLASH_FADE_SECONDS = 0.16;

export class MeleeSweep implements WeaponPattern {
  private readonly slashes: Array<{ mesh: THREE.Mesh; elapsed: number }> = [];

  public update(dt: number, _px: number, _pz: number, _enemies: ActiveEnemy[], ctx: WeaponFireContext): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.elapsed += dt;
      const progress = Math.min(1, s.elapsed / SLASH_FADE_SECONDS);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
      if (progress >= 1) {
        ctx.group.remove(s.mesh);
        disposeObject3D(s.mesh);
        this.slashes.splice(i, 1);
      }
    }
  }

  public clear(group: THREE.Group): void {
    for (const s of this.slashes) {
      group.remove(s.mesh);
      disposeObject3D(s.mesh);
    }
    this.slashes.length = 0;
  }

  public fire(
    def: WeaponDefinition,
    stats: WeaponLevelStats,
    px: number,
    pz: number,
    targetAngle: number,
    ctx: WeaponFireContext
  ): void {
    const params = def.patternParams ?? {};
    const might = ctx.runState.computedStats.mightMultiplier;
    const areaMult = ctx.runState.computedStats.areaMultiplier;
    const dmg = Math.round(stats.damage * might);

    const arcAngle = params.arcAngle ?? Math.PI * 0.65;
    const is360 = arcAngle >= Math.PI * 1.95;
    const reach = 2.4 * stats.area * areaMult;

    // Visual slash arc transient effect
    const slashColor = params.flashColor ?? (def.isEvolved ? 0xcc00ff : 0x00e5ff);
    const slashMesh = createSlashArcMesh(reach, arcAngle, slashColor);
    slashMesh.position.set(px, 0.45, pz);
    slashMesh.rotation.y = targetAngle;
    ctx.group.add(slashMesh);

    // Fades out over SLASH_FADE_SECONDS in simulated time (see update)
    this.slashes.push({ mesh: slashMesh, elapsed: 0 });

    ctx.audio.playEndoHit();
    ctx.playerMesh.pulseMuzzleFlash(slashColor);

    // Hit detection
    const candidates = ctx.grid.queryRadius(px, pz, reach, ctx.scratch.droneHit);
    for (let i = 0; i < candidates.length; i++) {
      const target = candidates[i];
      const dx = target.x - px;
      const dz = target.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > reach || dist < 0.001) continue;

      if (!is360) {
        // Check angular difference from targetAngle
        const angleToTarget = Math.atan2(dx, dz);
        let diff = Math.abs(angleToTarget - targetAngle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff > arcAngle / 2) continue;
      }

      const hitDir = { x: dx, z: dz };
      const hit = ctx.applyDamageToTarget(target, dmg, def.knockback, hitDir);
      if (hit) {
        ctx.particles.spawnPlasmaImpact(target.x, 0.6, target.z);
      }
    }
  }
}
