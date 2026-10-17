import type { ActiveEnemy, WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';

export class Strike implements WeaponPattern {
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
    const count = stats.amount + ctx.runState.computedStats.bonusAmount;

    const targets = ctx.runState.autoAimEnabled
      ? (ctx.grid.findNearestN(
          px,
          pz,
          count,
          28,
          (e) => e.type === 'enemy',
          ctx.scratch.orbitalTargets
        ) as ActiveEnemy[])
      : [];

    const baseRadius = params.baseRadius ?? 2.5;

    for (let i = 0; i < count; i++) {
      const target = targets[i] ?? {
        x: px + (ctx.rng.next() - 0.5) * 16,
        z: pz + (ctx.rng.next() - 0.5) * 16
      };
      ctx.audio.playPlasmaShot(true);
      const ionRadius = baseRadius * areaMult;
      ctx.spawnOrbitalIonBeam(target.x, target.z, ionRadius);
      ctx.emit('camera:shake', { trauma: params.shakeTrauma ?? 0.32 });

      const hit = ctx.grid.queryRadius(target.x, target.z, ionRadius, ctx.scratch.orbitalHit);
      for (let h = 0; h < hit.length; h++) {
        ctx.applyDamageToTarget(hit[h], dmg);
      }
      ctx.particles.spawnExplosion(target.x, 0.2, target.z, 1.4);
    }
  }
}
