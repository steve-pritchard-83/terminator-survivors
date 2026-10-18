import { test, expect } from '@playwright/test';

test.describe('P11-13 Event emitters from real code (E2E)', () => {
  test('spawnBoss infiltrator_csm101 then damageEnemy kills it and awards untouchable_boss in save', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        stageId: 'la_2029_wasteland',
        loadoutId: 'reese_2029'
      });
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    // Boss spawns
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.spawnBoss('infiltrator_csm101');
    });

    // Wait for activeBoss to be present
    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.activeBoss !== null;
    });

    // Kill boss with massive damage
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.damageEnemy('boss', 1e9);
    });

    // Verify boss is defeated and untouchable_boss is in getSave()
    await page.waitForFunction(() => {
      const save = window.__GAME_DEBUG__?.getSave();
      return save && save.achievements && save.achievements.includes('untouchable_boss');
    }, { timeout: 10000 });

    const save = await page.evaluate(() => window.__GAME_DEBUG__?.getSave());
    expect(save?.achievements).toContain('untouchable_boss');
  });

  test('grant level-8 Ithaca + paired passive, triggerVault and collect it marks evolution discovered', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        stageId: 'la_2029_wasteland',
        loadoutId: 'reese_2029'
      });
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    // Grant Ithaca-37 level 8 and might_shells passive
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.grantWeapon?.('ithaca_37', 8);
      window.__GAME_DEBUG__?.grantPassive?.('might_shells', 1);
      window.__GAME_DEBUG__?.triggerVault();
    });

    // Wait for discoveredEvolutions to contain trench_sweeper
    await page.waitForFunction(() => {
      const save = window.__GAME_DEBUG__?.getSave();
      return save && save.discoveredEvolutions && save.discoveredEvolutions.includes('trench_sweeper');
    }, { timeout: 10000 });

    const save = await page.evaluate(() => window.__GAME_DEBUG__?.getSave());
    expect(save?.discoveredEvolutions).toContain('trench_sweeper');
    expect(save?.achievements).toContain('first_evolution');
    expect(save?.achievements).toContain('trench_sweeper_evo');
  });
});
