import { describe, it, expect } from 'vitest';
import { buildEndoChassis, buildEndoLeg, buildEndoOptics } from '../../src/graphics/meshes/EndoskeletonGeometry';
import { buildTankLower, buildTankTurret, buildTankGlow } from '../../src/graphics/meshes/HKTankGeometry';
import { buildAerialHull, buildAerialNacelle } from '../../src/graphics/meshes/HKAerialGeometry';
import {
  buildBoneGeometry,
  buildFlameGeometry,
  buildSkullGeometry
} from '../../src/graphics/EnvironmentDetail';

const tris = (g: { getAttribute(n: string): { count: number } }): number => g.getAttribute('position').count / 3;

describe('mesh triangle budgets', () => {
  // Hundreds of endoskeletons can be on screen at once, so one must stay cheap.
  it('keeps one T-800 endoskeleton (chassis + both legs + optics) under 4000 triangles', () => {
    const total =
      tris(buildEndoChassis()) + tris(buildEndoLeg(-0.15)) + tris(buildEndoLeg(0.15)) + tris(buildEndoOptics());
    expect(total).toBeLessThan(4000);
  });

  it('keeps the HK Tank under 12000 triangles', () => {
    expect(tris(buildTankLower()) + tris(buildTankTurret()) + tris(buildTankGlow())).toBeLessThan(12000);
  });

  it('keeps an HK Aerial hull and two nacelles under 4000 triangles', () => {
    expect(tris(buildAerialHull()) + 2 * tris(buildAerialNacelle())).toBeLessThan(4000);
  });

  // Thousands of these are instanced across the wasteland.
  it('keeps instanced wasteland props small', () => {
    expect(tris(buildSkullGeometry())).toBeLessThan(200);
    expect(tris(buildBoneGeometry())).toBeLessThan(140);
    expect(tris(buildFlameGeometry())).toBeLessThan(80);
  });
});
