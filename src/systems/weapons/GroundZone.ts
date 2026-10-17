import type { WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';

export class GroundZone implements WeaponPattern {
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
    const amount = stats.amount + ctx.runState.computedStats.bonusAmount;

    const baseRadius = params.baseRadius ?? 2.0;
    const minDist = params.minDist ?? 4;
    const maxDist = params.maxDist ?? 7;

    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      const dist = minDist + ctx.rng.next() * (maxDist - minDist);
      ctx.spawnGroundZone(
        px + Math.cos(angle) * dist,
        pz + Math.sin(angle) * dist,
        baseRadius * areaMult,
        dmg,
        stats.duration,
        def.knockback
      );
    }
  }
}
