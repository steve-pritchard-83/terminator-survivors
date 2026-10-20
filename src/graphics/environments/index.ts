import type { IEnvironment } from './IEnvironment';
import { Environment2029 } from '../Environment2029';

export { type IEnvironment } from './IEnvironment';
export { Environment2029 as Wasteland2029Environment } from '../Environment2029';

export function createEnvironment(): IEnvironment {
  return new Environment2029();
}
