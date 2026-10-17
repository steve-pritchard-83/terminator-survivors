import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS, DEFAULT_UNLOCKED_WEAPONS } from '../../src/data/achievements';
import { SaveManager } from '../../src/state/SaveManager';
import { AchievementTracker } from '../../src/state/AchievementTracker';
import { RunState } from '../../src/state/RunState';
import { globalEvents } from '../../src/core/EventBus';
import type { ActiveEnemy } from '../../src/core/types';

describe('P7-01: Achievements System', () => {
  let saveManager: SaveManager;
  let runState: RunState;
  let tracker: AchievementTracker;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager();
    runState = new RunState();
    runState.initRun('reese_2029', {}, 1234, 'la_2029_wasteland', [], saveManager.getUnlockedWeapons());
    tracker = new AchievementTracker(saveManager, runState);
  });

  afterEach(() => {
    tracker.destroy();
    globalEvents.clear();
    localStorage.clear();
  });

  it('defines exactly 40 achievements across all designated categories', () => {
    expect(TOTAL_ACHIEVEMENTS).toBe(40);
    expect(Object.keys(ACHIEVEMENTS)).toHaveLength(40);

    const categories = new Set(Object.values(ACHIEVEMENTS).map((a) => a.category));
    expect(categories.has('kills')).toBe(true);
    expect(categories.has('survival')).toBe(true);
    expect(categories.has('progression')).toBe(true);
    expect(categories.has('combat')).toBe(true);
    expect(categories.has('stages')).toBe(true);
    expect(categories.has('threat')).toBe(true);
    expect(categories.has('mastery')).toBe(true);
  });

  it('provides default curated starter weapon pool', () => {
    const unlocked = saveManager.getUnlockedWeapons();
    expect(unlocked).toEqual(DEFAULT_UNLOCKED_WEAPONS);
    expect(unlocked).toContain('ithaca_37');
    expect(unlocked).toContain('pipe_bomb');
    expect(unlocked).toContain('m25_plasma');
    expect(saveManager.isWeaponUnlocked('m79_thumper')).toBe(false);
  });

  it('unlocks first_blood and skynet_threat on kill events and grants rewards', () => {
    expect(saveManager.isAchievementUnlocked('first_blood')).toBe(false);
    const initialScrap = saveManager.getData().alloyScrap;

    const mockEnemy: ActiveEnemy = {
      id: 1,
      type: 'enemy',
      archetype: 't800_endoskeleton',
      x: 0,
      z: 0,
      radius: 0.5,
      hp: 0,
      maxHp: 100,
      speed: 3,
      damage: 10,
      xpValue: 10,
      isBoss: false,
      isFlying: false,
      hitFlashTimer: 0,
      slowTimer: 0,
      armorStripMultiplier: 1,
      attackCooldown: 0
    };

    // Kill 1 machine
    globalEvents.emit('enemy:killed', { enemy: mockEnemy, x: 0, z: 0, xp: 10 });
    expect(saveManager.isAchievementUnlocked('first_blood')).toBe(true);
    expect(saveManager.getData().alloyScrap).toBe(initialScrap + 50);

    // Simulate 99 more kills
    for (let i = 0; i < 99; i++) {
      globalEvents.emit('enemy:killed', { enemy: mockEnemy, x: 0, z: 0, xp: 10 });
    }
    expect(saveManager.isAchievementUnlocked('skynet_threat')).toBe(true);
    expect(saveManager.getData().alloyScrap).toBe(initialScrap + 50 + 100);
  });

  it('unlocks survival achievements on wave:minute', () => {
    expect(saveManager.isAchievementUnlocked('survivor_1m')).toBe(false);
    expect(saveManager.isAchievementUnlocked('survivor_3m')).toBe(false);

    globalEvents.emit('wave:minute', { minute: 1 });
    expect(saveManager.isAchievementUnlocked('survivor_1m')).toBe(true);

    globalEvents.emit('wave:minute', { minute: 3 });
    expect(saveManager.isAchievementUnlocked('survivor_3m')).toBe(true);

    globalEvents.emit('wave:minute', { minute: 5 });
    expect(saveManager.isAchievementUnlocked('survivor_5m')).toBe(true);
    expect(saveManager.isWeaponUnlocked('m16_carbine')).toBe(true);
  });

  it('unlocks endless survival milestones when in Endless Mode', () => {
    runState.isEndless = true;
    expect(saveManager.isAchievementUnlocked('endless_veteran')).toBe(false);

    globalEvents.emit('wave:minute', { minute: 15 });
    expect(saveManager.isAchievementUnlocked('endless_veteran')).toBe(true);

    globalEvents.emit('wave:minute', { minute: 20 });
    expect(saveManager.isAchievementUnlocked('endless_master')).toBe(true);
  });

  it('tracks boss encounters and awards untouchable_boss if no damage taken', () => {
    // 1. Defeat boss with no damage
    globalEvents.emit('boss:spawned', {
      archetype: 'hk_tank_goliath',
      name: 'HK-Tank Goliath',
      maxHp: 1500
    });
    globalEvents.emit('boss:defeated', {
      archetype: 'hk_tank_goliath',
      x: 0,
      z: 0
    });

    expect(saveManager.isAchievementUnlocked('hk_tank_slayer')).toBe(true);
    expect(saveManager.isAchievementUnlocked('untouchable_boss')).toBe(true);
    expect(saveManager.isWeaponUnlocked('laser_designator')).toBe(true);

    // 2. Defeat boss after taking damage - untouchable should already be unlocked, but let's test damage flag
    tracker.resetRunCounters();
    globalEvents.emit('boss:spawned', {
      archetype: 't1000_prototype',
      name: 'T-1000 Prototype',
      maxHp: 2000
    });
    globalEvents.emit('player:damaged', { currentHp: 50, maxHp: 100, damage: 50 });
    globalEvents.emit('boss:defeated', {
      archetype: 't1000_prototype',
      x: 0,
      z: 0
    });
    expect(saveManager.isAchievementUnlocked('t1000_slayer')).toBe(true);
    expect(saveManager.isWeaponUnlocked('molotov')).toBe(true);
  });

  it('tracks weapon evolutions and unlocks arsenal_complete at 3 evolved weapons', () => {
    expect(saveManager.isAchievementUnlocked('first_evolution')).toBe(false);

    runState.weapons.set('ithaca_37', { id: 'ithaca_37', level: 8, evolved: true, cooldownTimer: 0 });
    globalEvents.emit('weapon:evolved', { from: 'ithaca_37', to: 'trench_sweeper', name: 'Trench Sweeper' });

    expect(saveManager.isAchievementUnlocked('first_evolution')).toBe(true);
    expect(saveManager.isAchievementUnlocked('trench_sweeper_evo')).toBe(true);
    expect(saveManager.isAchievementUnlocked('arsenal_complete')).toBe(false);

    runState.weapons.set('pipe_bomb', { id: 'pipe_bomb', level: 8, evolved: true, cooldownTimer: 0 });
    globalEvents.emit('weapon:evolved', { from: 'pipe_bomb', to: 'thermite_buster', name: 'Thermite Buster' });

    runState.weapons.set('m25_plasma', { id: 'm25_plasma', level: 8, evolved: true, cooldownTimer: 0 });
    globalEvents.emit('weapon:evolved', { from: 'm25_plasma', to: 'm95a1_plasma', name: 'M95A1 Heavy Plasma' });

    expect(saveManager.isAchievementUnlocked('arsenal_complete')).toBe(true);
  });

  it('awards level-based achievements on levelup:triggered', () => {
    expect(saveManager.isAchievementUnlocked('level_10')).toBe(false);

    globalEvents.emit('levelup:triggered', { level: 10, choices: [] });
    expect(saveManager.isAchievementUnlocked('level_10')).toBe(true);

    globalEvents.emit('levelup:triggered', { level: 20, choices: [] });
    expect(saveManager.isAchievementUnlocked('level_20')).toBe(true);
    expect(saveManager.isWeaponUnlocked('resistance_k9')).toBe(true);
  });

  it('awards stage clear and threat modifier achievements on run:completed', () => {
    globalEvents.emit('run:completed', {
      victory: true,
      timeSeconds: 600,
      kills: 450,
      alloyScrap: 1200,
      stageId: 'cyberdyne_factory',
      loadoutId: 'reese_2029',
      threatCount: 3
    });

    expect(saveManager.isAchievementUnlocked('judgment_survivor')).toBe(true);
    expect(saveManager.isAchievementUnlocked('clear_cyberdyne')).toBe(true);
    expect(saveManager.isAchievementUnlocked('threat_initiate')).toBe(true);
    expect(saveManager.isAchievementUnlocked('threat_veteran')).toBe(true);
    expect(saveManager.isAchievementUnlocked('scrap_collector_1k')).toBe(true);
  });

  it('filters weapon choices in RunState based on unlocked weapons pool', () => {
    // With default starter weapons, locked weapon (e.g. m79_thumper) should not appear in new choices
    const choices = runState.generateUpgradeChoices();
    const weaponChoices = choices.filter((c) => c.kind === 'weapon');
    const offeredIds = weaponChoices.map((c) => c.id);

    expect(offeredIds).not.toContain('m79_thumper');

    // Now unlock m79_thumper and re-init run with updated unlocked weapons
    saveManager.unlockWeapon('m79_thumper');
    runState.unlockedWeapons = saveManager.getUnlockedWeapons();

    const newChoices = runState.generateUpgradeChoices();
    const newOfferedIds = newChoices.filter((c) => c.kind === 'weapon').map((c) => c.id);
    expect(newOfferedIds).toContain('m79_thumper');
  });
});
