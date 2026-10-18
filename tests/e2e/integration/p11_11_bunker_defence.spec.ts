import { test, expect } from '@playwright/test';

test.describe('P11-11 Bunker defence objective (E2E)', () => {
  test('in Century City Bunker, swarm at bunker damages it and bunker HP hitting 0 ends run as BUNKER BREACHED', async ({ page }) => {
    await page.goto('/');

    // Start a run in century_city_bunker
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        stageId: 'century_city_bunker',
        loadoutId: 'reese_2029'
      });
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    // Check bunker health is present and 1500
    const initialHealth = await page.evaluate(() => window.__GAME_DEBUG__?.getState().bunkerHealth?.current);
    expect(initialHealth).toBe(1500);

    // Bunker HUD bar should be visible
    const bunkerBarVisible = await page.evaluate(() => {
      const el = document.getElementById('hud-bunker-bar');
      return el && el.style.display !== 'none';
    });
    expect(bunkerBarVisible).toBe(true);

    // Spawn a large swarm directly at the bunker target
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.setGodMode(true); // Ensure player doesn't die from collateral
      window.__GAME_DEBUG__?.spawnSwarm('t600_rusted', 40, true);
    });

    // Assert bunker HP drops
    await page.waitForFunction(() => {
      const h = window.__GAME_DEBUG__?.getState().bunkerHealth?.current;
      return typeof h === 'number' && h < 1500;
    }, { timeout: 10000 });

    const damagedHp = await page.evaluate(() => window.__GAME_DEBUG__?.getState().bunkerHealth?.current);
    expect(damagedHp).toBeLessThan(1500);

    // Wait for the bunker to be destroyed (or spawn another swarm to accelerate)
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.spawnSwarm('t600_rusted', 60, true);
    });

    // Run must transition to gameover
    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'gameover';
    }, { timeout: 15000 });

    // End run title must show BUNKER BREACHED
    const endTitle = await page.evaluate(() => document.getElementById('end-title')?.textContent);
    expect(endTitle).toBe('BUNKER BREACHED');
  });
});
