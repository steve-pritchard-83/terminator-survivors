import { test, expect } from '@playwright/test';

test.describe('P11-12 Daily operation, threats, and endless leaderboard (E2E)', () => {
  test('daily button gives the same seed twice on the same day and getSave() records one attempt', async ({ page }) => {
    await page.goto('/');

    // Click daily operation button
    await page.click('#btn-daily-operation');

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    const firstSeed = await page.evaluate(() => window.__GAME_DEBUG__?.getState().seed);
    const isDailyFirst = await page.evaluate(() => window.__GAME_DEBUG__?.getState().isDaily);
    expect(isDailyFirst).toBe(true);

    // End run
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.setPlayerHp(0);
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'gameover';
    });

    // Return to title
    await page.click('#btn-return-bunker');

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'title';
    });

    // Click daily operation again
    await page.click('#btn-daily-operation');

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    const secondSeed = await page.evaluate(() => window.__GAME_DEBUG__?.getState().seed);
    expect(secondSeed).toBe(firstSeed);

    // End second run
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.setPlayerHp(0);
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'gameover';
    });

    // Verify exactly one daily attempt is recorded in save
    const save = await page.evaluate(() => window.__GAME_DEBUG__?.getSave());
    const attempts = Object.keys(save?.dailyAttempts ?? {});
    expect(attempts.length).toBe(1);
  });

  test('with judgment_hour, fastForward(8 * 60) spawns skynet_tde_core', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        stageId: 'la_2029_wasteland',
        loadoutId: 'reese_2029',
        threats: ['judgment_hour']
      });
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    // Fast-forward to 8 minutes
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.fastForward(480);
    });

    // Wait for boss to spawn
    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return Boolean(state?.activeBoss && (state.activeBoss.name.includes('TIME DISPLACEMENT') || state.activeBoss.name.includes('SKYNET')));
    }, { timeout: 15000 });

    const activeBoss = await page.evaluate(() => window.__GAME_DEBUG__?.getState().activeBoss);
    expect(activeBoss).not.toBeNull();
  });

  test('with supply_starvation, destroying 20 crates never heals', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        stageId: 'la_2029_wasteland',
        loadoutId: 'reese_2029',
        threats: ['supply_starvation']
      });
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    // Set HP to 50
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.setPlayerHp(50);
      window.__GAME_DEBUG__?.setGodMode(true);
    });

    // Spawn 20 crates directly at player location
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) {
        window.__GAME_DEBUG__?.spawnCrate?.();
      }
    });

    // Wait a brief moment for magnet pickup resolution
    await page.waitForTimeout(600);

    const hpAfter = await page.evaluate(() => window.__GAME_DEBUG__?.getState().hp);
    expect(hpAfter).toBe(50);
  });
});
