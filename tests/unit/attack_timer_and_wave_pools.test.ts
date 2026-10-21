import { describe, it, expect } from 'vitest';
import { tickCooldown } from '../../src/systems/enemies/attackTimer';
import { buildWaveTimeline } from '../../src/data/waves';

describe('tickCooldown', () => {
  it('counts down normally while the target is in range', () => {
    expect(tickCooldown(1.0, 0.25, true, 0.5)).toBeCloseTo(0.75);
    expect(tickCooldown(0.1, 0.25, true, 0.5)).toBeLessThan(0);
  });

  it('never drops below the telegraph window while out of range', () => {
    let cd = 2.0;
    for (let i = 0; i < 600; i++) cd = tickCooldown(cd, 1 / 60, false, 0.5);
    expect(cd).toBeGreaterThan(0.5);
  });

  it('gives a full warning when the target re-enters range', () => {
    let cd = 2.0;
    for (let i = 0; i < 600; i++) cd = tickCooldown(cd, 1 / 60, false, 0.5);
    // Back in range: the attack must not fire before the 0.5 s telegraph has played out
    let elapsed = 0;
    while (cd > 0) {
      cd = tickCooldown(cd, 1 / 60, true, 0.5);
      elapsed += 1 / 60;
    }
    expect(elapsed).toBeGreaterThanOrEqual(0.5);
  });
});

describe('wave pool start minutes', () => {
  const timeline = buildWaveTimeline();
  const archetypesAt = (minute: number) => timeline[minute].pool.map((p) => p.archetype);

  it('holds the T-1 back until minute 3', () => {
    for (const minute of [0, 1, 2]) {
      expect(archetypesAt(minute)).not.toContain('t1_minigun_tracked');
    }
    expect(archetypesAt(3)).toContain('t1_minigun_tracked');
  });

  it('replaces the minute-9 boss with an elite surge', () => {
    expect(timeline[9].boss).toBeUndefined();
    expect(timeline[9].eliteChance).toBeGreaterThan(timeline[8].eliteChance);
  });
});
