import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import type { SpatialEntity } from '../../src/core/types';

describe('SpatialHashGrid', () => {
  let grid: SpatialHashGrid;

  beforeEach(() => {
    grid = new SpatialHashGrid(4.0);
  });

  it('inserts and queries entities within radius correctly', () => {
    const e1: SpatialEntity = { id: 1, x: 0, z: 0, radius: 0.5, type: 'enemy' };
    const e2: SpatialEntity = { id: 2, x: 3, z: 0, radius: 0.5, type: 'enemy' };
    const e3: SpatialEntity = { id: 3, x: 20, z: 20, radius: 0.5, type: 'enemy' };

    grid.insert(e1);
    grid.insert(e2);
    grid.insert(e3);

    const results = grid.queryRadius(0, 0, 5);
    expect(results).toHaveLength(2);
    expect(results.map((e) => e.id)).toContain(1);
    expect(results.map((e) => e.id)).toContain(2);
    expect(results.map((e) => e.id)).not.toContain(3);
  });

  it('finds nearest entity matching predicate filter', () => {
    const e1: SpatialEntity = { id: 1, x: 5, z: 0, radius: 0.5, type: 'pickup' };
    const e2: SpatialEntity = { id: 2, x: 8, z: 0, radius: 0.5, type: 'enemy' };
    const e3: SpatialEntity = { id: 3, x: 2, z: 0, radius: 0.5, type: 'pickup' };

    grid.insert(e1);
    grid.insert(e2);
    grid.insert(e3);

    const nearestEnemy = grid.findNearest(0, 0, 15, (e) => e.type === 'enemy');
    expect(nearestEnemy).not.toBeNull();
    expect(nearestEnemy?.id).toBe(2);

    const nearestAny = grid.findNearest(0, 0, 15);
    expect(nearestAny?.id).toBe(3);
  });

  it('handles negative and boundary coordinates seamlessly', () => {
    const eNeg: SpatialEntity = { id: 10, x: -15, z: -25, radius: 1.0, type: 'enemy' };
    grid.insert(eNeg);

    const res = grid.queryRadius(-15, -25, 2);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(10);
  });

  it('clears all entities completely', () => {
    grid.insert({ id: 1, x: 0, z: 0, radius: 1, type: 'enemy' });
    expect(grid.queryRadius(0, 0, 5)).toHaveLength(1);
    grid.clear();
    expect(grid.queryRadius(0, 0, 5)).toHaveLength(0);
  });
});
