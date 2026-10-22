import { describe, it, expect } from 'vitest';
import { BASE_WEAPONS, EVOLUTION_LEVEL, EVOLVED_WEAPONS, canEvolveWeapon } from '../../src/data/weapons';
import type { BaseWeaponId, PassiveId } from '../../src/core/types';

describe('Weapon Progression and Evolutions', () => {
  const baseWeaponIds = Object.keys(BASE_WEAPONS) as BaseWeaponId[];

  it('verifies all 11 base weapons have exactly 8 defined levels', () => {
    expect(baseWeaponIds).toHaveLength(11);
    for (const wId of baseWeaponIds) {
      const def = BASE_WEAPONS[wId];
      expect(def.levels).toHaveLength(8);
      for (let lv = 1; lv <= 8; lv++) {
        const stats = def.levels[lv - 1];
        expect(stats.level).toBe(lv);
        expect(stats.damage).toBeGreaterThan(0);
        expect(stats.cooldown).toBeGreaterThan(0);
        expect(stats.area).toBeGreaterThan(0);
      }
    }
  });

  it('verifies all 11 evolved superweapons exist and pair with correct base weapons', () => {
    for (const wId of baseWeaponIds) {
      const baseDef = BASE_WEAPONS[wId];
      expect(baseDef.pairedPassive).toBeDefined();
      expect(baseDef.evolvesInto).toBeDefined();

      const evoDef = EVOLVED_WEAPONS[baseDef.evolvesInto!];
      expect(evoDef).toBeDefined();
      expect(evoDef.isEvolved).toBe(true);
      expect(evoDef.evolvesFrom).toBe(wId);
      expect(evoDef.levels[0].damage).toBeGreaterThan(baseDef.levels[7].damage);
    }
  });

  it('rejects evolution below the evolution level', () => {
    const passives = new Map<PassiveId, number>([['might_shells', 1]]);
    expect(canEvolveWeapon('ithaca_37', EVOLUTION_LEVEL - 1, passives)).toBeNull();
  });

  it('rejects evolution if paired passive is absent or level 0', () => {
    const emptyPassives = new Map<PassiveId, number>();
    expect(canEvolveWeapon('ithaca_37', 8, emptyPassives)).toBeNull();

    const zeroPassives = new Map<PassiveId, number>([['might_shells', 0]]);
    expect(canEvolveWeapon('ithaca_37', 8, zeroPassives)).toBeNull();
  });

  it('evolves all 11 weapons at the evolution level with the passive', () => {
    for (const wId of baseWeaponIds) {
      const baseDef = BASE_WEAPONS[wId];
      const passives = new Map<PassiveId, number>([[baseDef.pairedPassive!, 1]]);
      const evolvedId = canEvolveWeapon(wId, EVOLUTION_LEVEL, passives);
      expect(evolvedId).toBe(baseDef.evolvesInto);
    }
  });
});
