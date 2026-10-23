import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { globalRNG } from '../../src/core/RNG';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { BASE_WEAPONS, EVOLVED_WEAPONS } from '../../src/data/weapons';
import { OPENING_GRACE, UPGRADE_OFFERS } from '../../src/data/balance';

describe('level-up offers', () => {
  it('always offers the missing evolution passive once a weapon is far enough along', () => {
    for (let seed = 1; seed <= 25; seed++) {
      globalRNG.setSeed(seed);
      const rs = new RunState();
      rs.initRun('reese_2029', {});
      rs.weapons.set('m25_plasma', { id: 'm25_plasma', level: UPGRADE_OFFERS.guaranteePassiveAtLevel, evolved: false, cooldownTimer: 0 });
      const offered = rs.generateUpgradeChoices();
      const passive = offered.find((c) => c.id === BASE_WEAPONS.m25_plasma.pairedPassive);
      expect(passive).toBeDefined();
      expect(passive?.synergyHint).toContain('COMPLETES EVOLUTION');
    }
  });

  it('shows multi-weapon synergy hints for might_shells (ithaca_37 and coltan_knife)', () => {
    globalRNG.setSeed(42);
    const rs = new RunState();
    rs.initRun('reese_2029', {});
    rs.weapons.set('coltan_knife', { id: 'coltan_knife', level: UPGRADE_OFFERS.guaranteePassiveAtLevel, evolved: false, cooldownTimer: 0 });
    const offered = rs.generateUpgradeChoices();
    const passive = offered.find((c) => c.id === 'might_shells');
    expect(passive).toBeDefined();
    expect(passive?.synergyHint).toContain('COMPLETES EVOLUTION');
    expect(passive?.synergyHint).toContain('Hyperalloy Combat Blade');
  });

  it('favours upgrades to owned items over new ones', () => {
    let withOwned = 0;
    const runs = 300;
    for (let seed = 1; seed <= runs; seed++) {
      globalRNG.setSeed(seed);
      const rs = new RunState();
      rs.initRun('reese_2029', {});
      for (const id of ['ithaca_37', 'pipe_bomb'] as const) rs.weapons.set(id, { id, level: 1, evolved: false, cooldownTimer: 0 });
      if (rs.generateUpgradeChoices().some((c) => c.subtitle !== 'NEW')) withOwned++;
    }
    // Three owned weapons among about 21 choices: a uniform draw of three includes one about 39% of the time
    expect(withOwned / runs).toBeGreaterThan(0.55);
  });

  it('always offers a new weapon while the arsenal is small', () => {
    for (let seed = 1; seed <= 50; seed++) {
      globalRNG.setSeed(seed);
      const rs = new RunState();
      rs.initRun('reese_2029', {});
      rs.passives.set('might_shells', 1);
      rs.passives.set('blast_radius', 1);
      expect(rs.generateUpgradeChoices().some((c) => c.kind === 'weapon' && c.subtitle === 'NEW')).toBe(true);
    }
  });
});

describe('evolutions', () => {
  it('are always a clear step up from the level-8 base weapon', () => {
    const dps = (l: { damage: number; amount: number; cooldown: number }) => (l.damage * l.amount) / l.cooldown;
    for (const evo of Object.values(EVOLVED_WEAPONS)) {
      const base = BASE_WEAPONS[evo.evolvesFrom as keyof typeof BASE_WEAPONS];
      expect(dps(evo.levels[0])).toBeGreaterThanOrEqual(1.5 * dps(base.levels[7]) - 1);
    }
  });
});

describe('opening grace', () => {
  it('softens enemy damage early in the run only', () => {
    const rs = new RunState();
    rs.initRun('reese_2029', {});
    const enemySystem = new EnemySystem(rs, new SpatialHashGrid(4.0), new AudioEngine(), new ParticleSystem(), new EndoskeletonBatch(8));
    const enemy = enemySystem.spawnEnemy('t800_endoskeleton', 0, 0);
    rs.playerPos = { x: 0, z: 0 };

    const start = rs.hp;
    enemySystem.update(0.016, 0.016, []);
    const earlyHit = start - rs.hp;
    expect(earlyHit).toBe(Math.round(enemy.damage * OPENING_GRACE.damageScale));

    rs.timeSeconds = OPENING_GRACE.seconds + 1;
    rs.invulnerabilityTimer = 0;
    enemy.attackCooldown = 0;
    const before = rs.hp;
    enemySystem.update(0.016, 0.016, []);
    expect(before - rs.hp).toBe(enemy.damage);
  });
});
