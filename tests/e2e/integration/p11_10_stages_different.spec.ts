import { test, expect } from '@playwright/test';

test.describe('P11-10 Stages are actually different (E2E)', () => {
  test('in Tech Noir, Infiltrator spawns at 0:30, takes 0 damage before minute 8, and is killable at minute 8', async ({ page }) => {
    await page.goto('/');

    // Start a run in tech_noir_1984
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        stageId: 'tech_noir_1984',
        loadoutId: 'reese_1984'
      });
    });

    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    // Advance to 31s
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.fastForward(31);
    });

    // Wait for the next tick for waveDirector to spawn the stalker
    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return Boolean(state?.activeBoss && (state.activeBoss.name.includes('INFILTRATOR') || state.activeBoss.name.includes('CSM-101')));
    });

    const activeBossAt31 = await page.evaluate(() => window.__GAME_DEBUG__?.getState().activeBoss);
    expect(activeBossAt31).not.toBeNull();
    const initialHp = activeBossAt31!.hp;
    expect(initialHp).toBeGreaterThan(0);

    // Call damageEnemy on the infiltrator at minute 0:31
    const dmgResult = await page.evaluate(() => {
      return window.__GAME_DEBUG__?.damageEnemy('boss', 500);
    });
    expect(dmgResult).toBe(false);

    // HP must be unchanged before minute 8
    const hpAfterHit = await page.evaluate(() => window.__GAME_DEBUG__?.getState().activeBoss?.hp);
    expect(hpAfterHit).toBe(initialHp);

    // Now fast-forward to minute 8 (480 seconds)
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.fastForward(480);
    });

    // Wait a tick
    await page.waitForTimeout(100);

    // Attempt to damage Infiltrator now that minute >= 8
    const dmgResultAt8 = await page.evaluate(() => {
      return window.__GAME_DEBUG__?.damageEnemy('boss', 100);
    });
    expect(dmgResultAt8).toBe(true);

    const hpAfterHitAt8 = await page.evaluate(() => window.__GAME_DEBUG__?.getState().activeBoss?.hp);
    expect(hpAfterHitAt8).toBeLessThan(initialHp);
  });
});
