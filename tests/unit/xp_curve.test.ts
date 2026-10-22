import { describe, it, expect } from 'vitest';
import { getXpForNextLevel } from '../../src/state/RunState';
import { LATE_XP } from '../../src/data/balance';

const original = (l: number) => Math.floor(14 + 6.5 * l + 1.55 * Math.pow(l, 1.62));

describe('XP curve', () => {
  it('is unchanged up to the late-game threshold', () => {
    for (let l = 3; l <= LATE_XP.fromLevel; l++) expect(getXpForNextLevel(l)).toBe(original(l));
  });

  it('gets steeper above the threshold and never falls as levels rise', () => {
    expect(getXpForNextLevel(40)).toBeGreaterThan(original(40) * 1.5);
    for (let l = 2; l < 80; l++) expect(getXpForNextLevel(l + 1)).toBeGreaterThanOrEqual(getXpForNextLevel(l));
  });
});
