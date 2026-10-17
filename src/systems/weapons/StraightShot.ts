import type { WeaponDefinition, WeaponLevelStats } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';

export class StraightShot implements WeaponPattern {
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

    const isHeavy = params.sfx === 'plasma_heavy';
    ctx.audio.playPlasmaShot(isHeavy);
    ctx.playerMesh.pulseMuzzleFlash(params.flashColor ?? 0xd400ff);

    const visual = params.projectileVisual ?? 'plasma';
    const radius = (params.projectileRadius ?? 0.35) * areaMult;

    for (let i = 0; i < amount; i++) {
      let spawnX = px;
      let spawnZ = pz;
      let a = targetAngle;

      if (params.parallelOffset) {
        const offset = (i - (amount - 1) / 2) * params.parallelOffset;
        spawnX += Math.cos(targetAngle) * offset;
        spawnZ -= Math.sin(targetAngle) * offset;
      }
      if (params.jitterAngle) {
        a += (ctx.rng.next() - 0.5) * params.jitterAngle;
      }
      if (params.jitterPos) {
        spawnX += (ctx.rng.next() - 0.5) * params.jitterPos;
        spawnZ += (ctx.rng.next() - 0.5) * params.jitterPos;
      }

      ctx.spawnProjectile({
        weaponId: def.id,
        meshCategory: visual,
        x: spawnX,
        y: 0.85,
        z: spawnZ,
        vx: Math.sin(a) * stats.speed,
        vy: 0,
        vz: Math.cos(a) * stats.speed,
        rotY: a,
        damage: dmg,
        radius,
        pierceLeft: stats.pierce,
        life: 0,
        maxLife: stats.duration
      });
    }
  }
}
