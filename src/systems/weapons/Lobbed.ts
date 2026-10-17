import type { WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';

export class Lobbed implements WeaponPattern {
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
    const amount = stats.amount + ctx.runState.computedStats.bonusAmount;

    const minDist = params.minDist ?? 5;
    const maxDist = params.maxDist ?? 13;
    const vy = params.vy ?? 4.5;
    const flightTime = params.flightTime ?? 0.8;
    const baseArea = params.areaRadius ?? 2.5;
    const is360 = params.arcSpread === Math.PI * 2;

    for (let i = 0; i < amount; i++) {
      let a: number;
      if (is360) {
        a = ctx.rng.next() * Math.PI * 2;
      } else {
        const spread = params.arcSpread ?? 0.5;
        a = targetAngle + (ctx.rng.next() - 0.5) * spread;
      }
      const dist = minDist + ctx.rng.next() * (maxDist - minDist);

      ctx.spawnProjectile({
        weaponId: def.id,
        meshCategory: 'bomb',
        x: px,
        y: 0.8,
        z: pz,
        vx: (Math.sin(a) * dist) / flightTime,
        vy,
        vz: (Math.cos(a) * dist) / flightTime,
        rotY: a,
        pitchX: 0,
        damage: dmg,
        radius: 0.3,
        pierceLeft: 99,
        life: 0,
        maxLife: flightTime,
        isAreaOnExpire: true,
        areaRadius: baseArea * areaMult
      });
    }
  }
}
