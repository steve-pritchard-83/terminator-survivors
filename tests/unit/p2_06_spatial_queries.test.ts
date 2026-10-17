import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import type { SpatialEntity } from '../../src/core/types';

describe('P2-06 spatial queries', () => {
  let grid: SpatialHashGrid;

  beforeEach(() => {
    grid = new SpatialHashGrid(4.0);
  });

  it('deduplicates entities spanning multiple grid cells using stamp-based deduplication', () => {
    // Large entity spanning multiple cells (cells -1..1 in both x and z)
    const largeEntity: SpatialEntity = { id: 100, x: 0, z: 0, radius: 5.0, type: 'enemy' };
    const smallEntity: SpatialEntity = { id: 101, x: 1, z: 1, radius: 0.5, type: 'enemy' };

    grid.insert(largeEntity);
    grid.insert(smallEntity);

    const scratch: SpatialEntity[] = [];
    const results = grid.queryRadiusInto(0, 0, 6.0, scratch);

    expect(results).toHaveLength(2);
    expect(results.filter((e) => e.id === 100)).toHaveLength(1);
    expect(results.filter((e) => e.id === 101)).toHaveLength(1);
    expect(results).toBe(scratch);
  });

  it('reuses scratch arrays across successive queries without retaining stale entries', () => {
    const e1: SpatialEntity = { id: 1, x: 0, z: 0, radius: 0.5, type: 'enemy' };
    const e2: SpatialEntity = { id: 2, x: 10, z: 10, radius: 0.5, type: 'enemy' };
    grid.insert(e1);
    grid.insert(e2);

    const scratch: SpatialEntity[] = [];

    // Query near e1
    grid.queryRadiusInto(0, 0, 2.0, scratch);
    expect(scratch).toHaveLength(1);
    expect(scratch[0].id).toBe(1);

    // Query near e2 using the SAME scratch array
    grid.queryRadiusInto(10, 10, 2.0, scratch);
    expect(scratch).toHaveLength(1);
    expect(scratch[0].id).toBe(2);

    // Query empty area using the SAME scratch array
    grid.queryRadiusInto(50, 50, 2.0, scratch);
    expect(scratch).toHaveLength(0);
  });

  it('increments stamp on each query ensuring subsequent queries visit all candidates', () => {
    const e1: SpatialEntity = { id: 42, x: 2, z: 2, radius: 1.0, type: 'enemy' };
    grid.insert(e1);

    const scratch: SpatialEntity[] = [];
    grid.queryRadiusInto(2, 2, 3.0, scratch);
    expect(scratch).toHaveLength(1);
    const firstStamp = e1._queryStamp;
    expect(firstStamp).toBeDefined();

    // Second query on same entity
    grid.queryRadiusInto(2, 2, 3.0, scratch);
    expect(scratch).toHaveLength(1);
    expect(e1._queryStamp).toBeGreaterThan(firstStamp!);
  });

  it('supports findNearest and findNearestN with internal or provided scratch arrays', () => {
    const e1: SpatialEntity = { id: 10, x: 1, z: 0, radius: 0.5, type: 'enemy' };
    const e2: SpatialEntity = { id: 20, x: 3, z: 0, radius: 0.5, type: 'enemy' };
    const e3: SpatialEntity = { id: 30, x: 5, z: 0, radius: 0.5, type: 'enemy' };
    grid.insert(e1);
    grid.insert(e2);
    grid.insert(e3);

    const nearest = grid.findNearest(0, 0, 10);
    expect(nearest?.id).toBe(10);

    const scratchN: SpatialEntity[] = [];
    const nearest2 = grid.findNearestN(0, 0, 2, 10, undefined, scratchN);
    expect(nearest2).toHaveLength(2);
    expect(nearest2[0].id).toBe(10);
    expect(nearest2[1].id).toBe(20);
    expect(nearest2).toBe(scratchN);
  });
});
