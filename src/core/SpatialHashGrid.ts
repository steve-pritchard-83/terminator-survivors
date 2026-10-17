import type { SpatialEntity } from './types';

export class SpatialHashGrid {
  private readonly cellSize: number;
  private readonly grid = new Map<string, SpatialEntity[]>();
  private readonly entityCells = new Map<number, string[]>();

  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
  }

  private getKey(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }

  public clear(): void {
    this.grid.clear();
    this.entityCells.clear();
  }

  public insert(entity: SpatialEntity): void {
    const minCx = Math.floor((entity.x - entity.radius) / this.cellSize);
    const maxCx = Math.floor((entity.x + entity.radius) / this.cellSize);
    const minCz = Math.floor((entity.z - entity.radius) / this.cellSize);
    const maxCz = Math.floor((entity.z + entity.radius) / this.cellSize);

    const keys: string[] = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.getKey(cx, cz);
        keys.push(key);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(entity);
      }
    }
    this.entityCells.set(entity.id, keys);
  }

  public queryRadius(
    x: number,
    z: number,
    radius: number,
    outResults?: SpatialEntity[]
  ): SpatialEntity[] {
    const results = outResults ?? [];
    results.length = 0;
    const seen = new Set<number>();

    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const list = this.grid.get(this.getKey(cx, cz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          const dx = e.x - x;
          const dz = e.z - z;
          const totalR = radius + e.radius;
          if (dx * dx + dz * dz <= totalR * totalR) {
            results.push(e);
          }
        }
      }
    }
    return results;
  }

  public findNearest(
    x: number,
    z: number,
    maxRadius: number,
    filterFn?: (e: SpatialEntity) => boolean
  ): SpatialEntity | null {
    const candidates = this.queryRadius(x, z, maxRadius);
    let nearest: SpatialEntity | null = null;
    let nearestDistSq = maxRadius * maxRadius;

    for (let i = 0; i < candidates.length; i++) {
      const e = candidates[i];
      if (filterFn && !filterFn(e)) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDistSq) {
        nearestDistSq = d2;
        nearest = e;
      }
    }
    return nearest;
  }

  public findNearestN(
    x: number,
    z: number,
    count: number,
    maxRadius: number,
    filterFn?: (e: SpatialEntity) => boolean
  ): SpatialEntity[] {
    if (count <= 0) return [];
    const candidates = this.queryRadius(x, z, maxRadius);
    const filtered: Array<{ entity: SpatialEntity; distSq: number }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const e = candidates[i];
      if (filterFn && !filterFn(e)) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      filtered.push({ entity: e, distSq: dx * dx + dz * dz });
    }

    filtered.sort((a, b) => a.distSq - b.distSq);
    return filtered.slice(0, count).map((item) => item.entity);
  }
}
