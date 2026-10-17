import type { WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';

export class SpreadShot implements WeaponPattern {
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

    ctx.audio.playShotgunBlast();
    ctx.playerMesh.pulseMuzzleFlash(params.flashColor ?? 0xff9900);

    const isRingFull = params.ringFull ?? false;
    const spreadAngle = params.spreadAngle ?? 0.42;
    const radius = (params.projectileRadius ?? 0.25) * areaMult;
    const visual = params.projectileVisual ?? 'pellet';

    for (let i = 0; i < amount; i++) {
      let a: number;
      if (isRingFull) {
        a = targetAngle + (i / amount) * Math.PI * 2;
      } else {
        const offset = (i / Math.max(1, amount - 1) - 0.5) * spreadAngle;
        a = targetAngle + offset;
      }

      ctx.spawnProjectile({
        weaponId: def.id,
        meshCategory: visual,
        x: px,
        y: 0.8,
        z: pz,
        vx: Math.sin(a) * stats.speed,
        vy: 0,
        vz: Math.cos(a) * stats.speed,
        rotY: 0,
        damage: dmg,
        radius,
        pierceLeft: stats.pierce,
        life: 0,
        maxLife: stats.duration
      });
    }
  }
}
