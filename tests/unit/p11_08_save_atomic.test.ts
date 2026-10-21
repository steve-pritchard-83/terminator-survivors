import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import saveV1 from '../fixtures/save_v1.json';
import saveV2 from '../fixtures/save_v2.json';

describe('P11-08: Save migration to v3 and throttled writes', () => {
  let saveManager: SaveManager;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    if (saveManager) {
      saveManager.dispose();
    }
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('migrates v1 fixture to v3 with grandfathered weapon rewards', () => {
    saveManager = new SaveManager();
    const migrated = saveManager.sanitizeAndMigrate(saveV1);

    expect(migrated.version).toBe(3);
    // Since saveV1 had victories = 1 > 0:
    // Achievement reward weapons are granted; weapons since cut from the game are dropped
    expect(migrated.unlockedWeapons).not.toContain('m79_thumper');
    expect(migrated.unlockedWeapons).toContain('rpg_launcher');
    expect(migrated.alloyScrap).toBe(350);
  });

  it('migrates v2 fixture to v3 with grandfathered weapon rewards', () => {
    saveManager = new SaveManager();
    const migrated = saveManager.sanitizeAndMigrate(saveV2);

    expect(migrated.version).toBe(3);
    expect(migrated.unlockedWeapons).toContain('ithaca_37');
    expect(migrated.unlockedWeapons).not.toContain('plasma_rifle');
    expect(migrated.unlockedWeapons).not.toContain('m79_thumper');
    expect(migrated.unlockedWeapons).toContain('rpg_launcher');
    expect(migrated.alloyScrap).toBe(800);
  });

  it('throttles recordEnemyKill writes to localStorage until flushed', () => {
    saveManager = new SaveManager();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    // Rapid kill events (500 kills)
    for (let i = 0; i < 500; i++) {
      saveManager.recordEnemyKill('skynet_infantry');
    }

    // recordEnemyKill only marks dirty; it does not synchronously call setItem
    expect(setItemSpy).not.toHaveBeenCalled();

    // Calling flush persists the state
    saveManager.flush();
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    const savedRaw = localStorage.getItem('TERMINATOR_SURVIVORS_SAVE_V1');
    expect(savedRaw).not.toBeNull();
    const parsed = JSON.parse(savedRaw!);
    expect(parsed.bestiaryKills['skynet_infantry']).toBe(500);

    // Calling flush again without new dirty changes does not write again
    saveManager.flush();
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes on dispose', () => {
    saveManager = new SaveManager();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    saveManager.recordEnemyKill('terminator_t800');
    expect(setItemSpy).not.toHaveBeenCalled();

    saveManager.dispose();
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(saveManager.getBestiaryKills('terminator_t800')).toBe(1);
  });
});
