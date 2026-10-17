import type { WeaponPatternId } from '../../core/types';
import type { WeaponPattern } from './WeaponPattern';
import { SpreadShot } from './SpreadShot';
import { StraightShot } from './StraightShot';
import { Lobbed } from './Lobbed';
import { Nova } from './Nova';
import { Orbiters } from './Orbiters';
import { GroundZone } from './GroundZone';
import { Strike } from './Strike';
import { MeleeSweep } from './MeleeSweep';
import { DogUnit } from './DogUnit';
import { AllySummon } from './AllySummon';

export * from './WeaponPattern';
export * from './SpreadShot';
export * from './StraightShot';
export * from './Lobbed';
export * from './Nova';
export * from './Orbiters';
export * from './GroundZone';
export * from './Strike';
export * from './MeleeSweep';
export * from './DogUnit';
export * from './AllySummon';

export function createWeaponPatternRegistry(): {
  registry: Record<WeaponPatternId, WeaponPattern>;
  orbiters: Orbiters;
  dogUnit: DogUnit;
  allySummon: AllySummon;
} {
  const orbiters = new Orbiters();
  const dogUnit = new DogUnit();
  const allySummon = new AllySummon();
  const registry: Record<WeaponPatternId, WeaponPattern> = {
    SpreadShot: new SpreadShot(),
    StraightShot: new StraightShot(),
    Lobbed: new Lobbed(),
    Nova: new Nova(),
    Orbiters: orbiters,
    GroundZone: new GroundZone(),
    Strike: new Strike(),
    MeleeSweep: new MeleeSweep(),
    DogUnit: dogUnit,
    AllySummon: allySummon
  };
  return { registry, orbiters, dogUnit, allySummon };
}
