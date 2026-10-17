import { test, expect } from '@playwright/test';

test('Desktop gameplay: title, bunker shop, deploy, level up, and combat dive', async ({
  page
}) => {
  await page.goto('/');

  // 1. Title Screen verification
  await expect(page.getByTestId('btn-start-run')).toBeVisible();
  await expect(page.getByTestId('btn-bunker-shop')).toBeVisible();

  // 2. Bunker shop open & close
  await page.getByTestId('btn-bunker-shop').click();
  await expect(page.locator('#bunker-modal')).toBeVisible();
  await page.locator('#btn-close-bunker').click();
  await expect(page.locator('#bunker-modal')).toBeHidden();

  // 3. Start Run & Deploy
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  // 4. Verify WebGL state via debug interface
  const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(state?.mode).toBe('playing');
  expect(state?.weapons.length).toBeGreaterThan(0);
  expect(state?.hp).toBe(100);

  // 5. Test level up modal
  await page.evaluate(() => window.__GAME_DEBUG__?.grantXp(100));
  await expect(page.getByTestId('levelup-modal')).toBeVisible();
  await expect(page.getByTestId('upgrade-card-0')).toBeVisible();

  // Select upgrade card
  await page.getByTestId('upgrade-card-0').click();
  await expect(page.getByTestId('levelup-modal')).toBeHidden();
  await page.waitForTimeout(100);

  // 6. Test Combat Dive (Dash)
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);
  const dashState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(dashState?.isDashing || (dashState?.dashCooldown ?? 0) > 0).toBe(true);
});
