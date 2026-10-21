import { describe, it, expect } from 'vitest';
import {
  buildBoneGeometry,
  buildFlameGeometry,
  buildSkullGeometry
} from '../../src/graphics/EnvironmentDetail';

const tris = (g: { getAttribute(n: string): { count: number } }): number => g.getAttribute('position').count / 3;

describe('mesh triangle budgets', () => {
  // Thousands of these are instanced across the wasteland.
  it('keeps instanced wasteland props small', () => {
    expect(tris(buildSkullGeometry())).toBeLessThan(200);
    expect(tris(buildBoneGeometry())).toBeLessThan(140);
    expect(tris(buildFlameGeometry())).toBeLessThan(80);
  });
});
