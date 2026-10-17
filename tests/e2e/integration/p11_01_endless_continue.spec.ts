import { test, expect } from '@playwright/test';

test.describe('P11-01 Endless Continue and Result Banking', () => {
  test('continues after victory without soft-lock and banks total kills and history once', async ({
    page
  }) => {
    test.setTimeout(45000);
    await page.goto('/');
    await expect(page.getByTestId('btn-start-run')).toBeVisible();

    // Start a run (skipping tutorial if present)
    await page.getByTestId('btn-start-run').click();
    const skipBtn = page.locator('#btn-tutorial-skip');
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByTestId('hud-container')).toBeVisible();

    // Restart cleanly via startRunWith
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({ stageId: 'la_2029_wasteland' });
    });

    const initialSave = await page.evaluate(() => window.__GAME_DEBUG__?.getSave());
    expect(initialSave).toBeDefined();
    if (!initialSave) throw new Error('initialSave is undefined');
    const initialKills = initialSave.totalKills;
    const initialHistoryCount = initialSave.runHistory?.length ?? 0;

    // Fast-forward to minute 10 to trigger final boss wave
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.fastForward(600);
    });

    // Allow wave director to spawn skynet_tde_core
    await page.waitForTimeout(500);

    // Defeat Skynet TDE Core
    const hitBoss = await page.evaluate(() => window.__GAME_DEBUG__?.damageEnemy('boss', 1e9));
    expect(hitBoss).toBe(true);

    // Victory modal should be visible with Continue the War button
    const continueBtn = page.locator('#btn-continue-war');
    await expect(continueBtn).toBeVisible({ timeout: 5000 });

    // Click Continue the War
    await continueBtn.click();

    // Assert mode is playing and simulation advances
    const contState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(contState?.mode).toBe('playing');
    expect(contState?.isEndless).toBe(true);

    const t1 = contState?.timeSeconds ?? 0;
    await page.waitForTimeout(1500);
    const t2 = (await page.evaluate(() => window.__GAME_DEBUG__?.getState()))?.timeSeconds ?? 0;
    expect(t2).toBeGreaterThan(t1);

    // Now kill the player in endless mode
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.setPlayerHp(0);
    });

    // Wait for end-run modal to appear
    await expect(page.locator('#end-run-modal')).toBeVisible({ timeout: 5000 });

    // Check save data telemetry
    const finalSave = await page.evaluate(() => window.__GAME_DEBUG__?.getSave());
    const finalState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(finalSave).toBeDefined();
    if (!finalSave) throw new Error('finalSave is undefined');

    expect(finalState?.kills).toBeGreaterThanOrEqual(1);
    expect(finalSave.totalKills - initialKills).toBe(finalState?.kills);
    expect((finalSave.runHistory?.length ?? 0) - initialHistoryCount).toBe(1);
    expect(finalSave.runHistory?.[0].outcome).toBe('endless');
  });
});
