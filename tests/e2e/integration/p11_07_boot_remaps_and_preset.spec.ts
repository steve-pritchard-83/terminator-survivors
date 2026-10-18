import { test, expect } from '@playwright/test';

test.describe('P11-07 Key remaps and quality preset respected at boot', () => {
  test('persists key remap and quality preset across reloads, ignoring auto-detect', async ({
    page
  }) => {
    test.setTimeout(45000);
    await page.goto('/');

    // 1. Seed save with dash bound to KeyQ and preset 'low'
    await page.evaluate(() => {
      const raw = localStorage.getItem('TERMINATOR_SURVIVORS_SAVE_V1');
      const data = raw ? JSON.parse(raw) : { version: 2, selectedLoadout: 'reese_2029', upgrades: {}, stats: {} };
      if (!data.settings) data.settings = {};
      data.settings.qualityPreset = 'low';

      if (!data.inputBindings) data.inputBindings = {};
      data.inputBindings.keyboard = {
        moveUp: ['KeyW', 'ArrowUp'],
        moveDown: ['KeyS', 'ArrowDown'],
        moveLeft: ['KeyA', 'ArrowLeft'],
        moveRight: ['KeyD', 'ArrowRight'],
        dash: ['KeyQ'],
        ability: ['KeyE'],
        pause: ['Escape']
      };

      localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', JSON.stringify(data));
    });

    // 2. Reload to verify boot-time application
    await page.reload();
    await expect(page.getByTestId('btn-start-run')).toBeVisible();

    // 3. Start a run (skip tutorial if shown)
    await page.getByTestId('btn-start-run').click();
    const skipBtn = page.locator('#btn-tutorial-skip');
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByTestId('hud-container')).toBeVisible();

    // 4. Press KeyQ and assert isDashing
    await page.keyboard.press('KeyQ');
    const dashingState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(dashingState?.isDashing).toBe(true);

    // 5. Wait 6 seconds to ensure the 5-second auto-detect does not overwrite preset
    await page.waitForTimeout(6000);

    // 6. Assert preset is still 'low' and pixelRatio <= 1
    const runtime = await page.evaluate(() => window.__GAME_DEBUG__?.getRuntimeSettings());
    expect(runtime?.qualityPreset).toBe('low');
    expect(runtime?.pixelRatio).toBeLessThanOrEqual(1.0);
  });
});
