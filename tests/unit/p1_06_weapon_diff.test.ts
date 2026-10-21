import { describe, it, expect } from 'vitest';
import { BASE_WEAPONS, formatWeaponStatDiff } from '../../src/data/weapons';
import type { BaseWeaponId } from '../../src/core/types';

describe('P1-06 weapon level text matches stats', () => {
  it('formats custom stat diff correctly with delimiters and custom noun', () => {
    const prev = {
      level: 1,
      damage: 100,
      cooldown: 1.0,
      area: 1.0,
      speed: 10,
      amount: 1,
      duration: 1.0,
      pierce: 1
    };
    const curr = {
      level: 2,
      damage: 122, // +22% DMG
      cooldown: 0.94, // -6% CD
      area: 1.0, // unchanged
      speed: 10, // unchanged
      amount: 2, // +1 PELLET
      duration: 1.0, // unchanged
      pierce: 1 // unchanged
    };

    const diff = formatWeaponStatDiff(curr, prev, 'PELLET');
    expect(diff).toBe('+22% DMG · +1 PELLET · -6% CD');
  });

  it('verifies for every base weapon, every level-up description mentions each stat that changed', () => {
    const weaponIds = Object.keys(BASE_WEAPONS) as BaseWeaponId[];
    expect(weaponIds).toHaveLength(11);

    for (const wId of weaponIds) {
      const weapon = BASE_WEAPONS[wId];
      expect(weapon.levels).toHaveLength(8);

      // Level 1: flavor text preserved
      expect(weapon.levels[0].description).toBeTruthy();
      expect(weapon.levels[0].description).not.toContain(' · ');

      // Levels 2 to 8: auto-generated diff mentions every changed stat
      for (let lv = 2; lv <= 8; lv++) {
        const curr = weapon.levels[lv - 1];
        const prev = weapon.levels[lv - 2];
        const desc = curr.description;

        expect(desc).toContain(' · ');

        if (curr.damage !== prev.damage) {
          expect(desc, `Weapon ${wId} lv ${lv} should mention DMG`).toContain('DMG');
        }
        if (curr.amount !== prev.amount) {
          expect(
            desc,
            `Weapon ${wId} lv ${lv} should mention amount noun`
          ).toMatch(/PELLET|BOMB|BOLT|DRONE|PULSE|GRENADE|CANISTER|STRIKE|PROJECTILE/);
        }
        if (curr.cooldown !== prev.cooldown) {
          expect(desc, `Weapon ${wId} lv ${lv} should mention CD`).toContain('CD');
        }
        if (curr.area !== prev.area) {
          expect(desc, `Weapon ${wId} lv ${lv} should mention AREA`).toContain('AREA');
        }
        if (curr.speed !== prev.speed) {
          expect(desc, `Weapon ${wId} lv ${lv} should mention SPEED`).toContain('SPEED');
        }
        if (curr.duration !== prev.duration) {
          expect(desc, `Weapon ${wId} lv ${lv} should mention DURATION`).toContain('DURATION');
        }
        if (curr.pierce !== prev.pierce) {
          expect(desc, `Weapon ${wId} lv ${lv} should mention PIERCE`).toContain('PIERCE');
        }
      }
    }
  });
});
