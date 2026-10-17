import type { EnemyBehaviour } from './EnemyBehaviour';
import { T800Behaviour } from './T800Behaviour';
import { HKAerialBehaviour } from './HKAerialBehaviour';
import { HKTankBehaviour } from './HKTankBehaviour';
import { T1000Behaviour } from './T1000Behaviour';
import { InfiltratorBehaviour } from './InfiltratorBehaviour';
import { SkynetCoreBehaviour } from './SkynetCoreBehaviour';

export * from './EnemyBehaviour';
export * from './T800Behaviour';
export * from './HKAerialBehaviour';
export * from './HKTankBehaviour';
export * from './T1000Behaviour';
export * from './InfiltratorBehaviour';
export * from './SkynetCoreBehaviour';

export function createEnemyBehaviourRegistry(): Record<string, EnemyBehaviour> {
  const hkAerial = new HKAerialBehaviour();
  return {
    t800_endoskeleton: new T800Behaviour(),
    hk_aerial_patrol: hkAerial,
    hk_aerial_squadron_leader: hkAerial,
    hk_tank_goliath: new HKTankBehaviour(),
    t1000_prototype: new T1000Behaviour(),
    infiltrator_csm101: new InfiltratorBehaviour(),
    skynet_tde_core: new SkynetCoreBehaviour()
  };
}
