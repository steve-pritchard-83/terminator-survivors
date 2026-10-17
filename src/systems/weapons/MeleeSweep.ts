import type * as THREE from 'three';
import type { WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';
import { createSlashArcMesh } from '../../graphics/meshes/AllyMeshes';
import { disposeObject3D } from '../../graphics/dispose';

export class MeleeSweep implements WeaponPattern {
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

    // Fade out slash arc over 0.16s
    let elapsed = 0;
    const duration = 0.16;
    const interval = setInterval(() => {
      elapsed += 0.032;
      const progress = Math.min(1, elapsed / duration);
      (slashMesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
      if (progress >= 1) {
        clearInterval(interval);
        ctx.group.remove(slashMesh);
        disposeObject3D(slashMesh);
      }
    }, 32);

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
