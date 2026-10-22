import type { ActiveEnemy, WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';

export class Nova implements WeaponPattern {
  public fire(
    def: WeaponDefinition,
    stats: WeaponLevelStats,
    px: number,
    pz: number,
    _targetAngle: number,
    ctx: WeaponFireContext
  ): void {
    const params = def.patternParams ?? {};
    const might = ctx.runState.computedStats.mightMultiplier;
    const areaMult = ctx.runState.computedStats.areaMultiplier;
    const dmg = Math.round(stats.damage * might);

    ctx.audio.playEmpBlast();
    const isSupernova = params.isSupernova ?? false;
    // The pulse stops at the screen edge
    const empRadius = Math.min((params.baseRadius ?? 3.8) * areaMult, ctx.reachRadius());

    ctx.spawnEmpShockwave(px, pz, empRadius, isSupernova);
    ctx.emit('camera:shake', { trauma: params.shakeTrauma ?? 0.22 });

    const hitEnemies = ctx.grid.queryRadius(px, pz, empRadius, ctx.scratch.empHit);
    for (let i = 0; i < hitEnemies.length; i++) {
      const target = hitEnemies[i];
      if (!ctx.isVisible(target.x, target.z)) continue;
      const hitDir = { x: target.x - px, z: target.z - pz };
      const hit = ctx.applyDamageToTarget(target, dmg, def.knockback, hitDir);
      if (hit && target.type === 'enemy') {
        const e = target as ActiveEnemy;
        e.slowTimer = params.slowDuration ?? 2.0;
        if (isSupernova) {
          const strip = params.armorStrip ?? 0.3;
          e.armorStripMultiplier = Math.max(0.4, e.armorStripMultiplier - strip);
          if (params.healAmount) {
            ctx.runState.heal(params.healAmount);
          }
        }
      }
    }
    ctx.particles.spawnExplosion(px, 0.2, pz, 1.2);
  }
}
