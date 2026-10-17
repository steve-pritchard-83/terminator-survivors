export class RNG {
  private state: number;

  constructor(seed: number = 0x19842029) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  public int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public chance(prob: number): boolean {
    return this.next() < prob;
  }

  public pick<T>(items: readonly T[]): T {
    const idx = Math.floor(this.next() * items.length);
    return items[idx];
  }
}

export const globalRNG = new RNG();
