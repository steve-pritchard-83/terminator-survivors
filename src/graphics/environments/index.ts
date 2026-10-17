import type { StageId } from '../../core/types';
import type { IEnvironment } from './IEnvironment';
import { Environment2029 } from '../Environment2029';
import { CyberdyneEnvironment } from './CyberdyneEnvironment';
import { TechNoirEnvironment } from './TechNoirEnvironment';
import { SkynetCentralEnvironment } from './SkynetCentralEnvironment';
import { BunkerEnvironment } from './BunkerEnvironment';

export { type IEnvironment, type ConveyorZone, type EnvironmentalHazard } from './IEnvironment';
export { Environment2029 as Wasteland2029Environment } from '../Environment2029';
export { CyberdyneEnvironment } from './CyberdyneEnvironment';
export { TechNoirEnvironment } from './TechNoirEnvironment';
export { SkynetCentralEnvironment } from './SkynetCentralEnvironment';
export { BunkerEnvironment } from './BunkerEnvironment';

export function createEnvironment(stageId: StageId): IEnvironment {
  switch (stageId) {
    case 'cyberdyne_factory':
      return new CyberdyneEnvironment();
    case 'tech_noir_1984':
      return new TechNoirEnvironment();
    case 'skynet_central_tde':
      return new SkynetCentralEnvironment();
    case 'century_city_bunker':
      return new BunkerEnvironment();
    case 'la_2029_wasteland':
    default:
      return new Environment2029();
  }
}
