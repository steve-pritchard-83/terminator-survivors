import type { WeaponPatternId } from '../../core/types';
import type { WeaponPattern } from './WeaponPattern';
import { SpreadShot } from './SpreadShot';
import { StraightShot } from './StraightShot';
import { Lobbed } from './Lobbed';
import { Nova } from './Nova';
import { Orbiters } from './Orbiters';
import { GroundZone } from './GroundZone';
import { Strike } from './Strike';

export * from './WeaponPattern';
export * from './SpreadShot';
export * from './StraightShot';
export * from './Lobbed';
export * from './Nova';
export * from './Orbiters';
export * from './GroundZone';
export * from './Strike';

export function createWeaponPatternRegistry(): {
  registry: Record<WeaponPatternId, WeaponPattern>;
  orbiters: Orbiters;
} {
  const orbiters = new Orbiters();
  const registry: Record<WeaponPatternId, WeaponPattern> = {
    SpreadShot: new SpreadShot(),
    StraightShot: new StraightShot(),
    Lobbed: new Lobbed(),
    Nova: new Nova(),
    Orbiters: orbiters,
    GroundZone: new GroundZone(),
    Strike: new Strike()
  };
  return { registry, orbiters };
}
