import { test, expect } from '@playwright/test';

test('Desktop gameplay: title, bunker shop, deploy, level up, and combat dive', async ({
  page
}) => {
  // Skip the first-run tutorial so Deploy opens the deploy modal directly
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'TERMINATOR_SURVIVORS_SAVE_V1',
      JSON.stringify({ version: 3, tutorialCompleted: true, totalKills: 1 })
    );
  });
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
  await expect(page.locator('#deploy-modal')).toBeVisible();
  await page.locator('#btn-deploy-next').click(); // stage -> operative
  await page.locator('#btn-deploy-next').click(); // operative -> deploy (no threats before first victory)
  await expect(page.getByTestId('hud-container')).toBeVisible();

  // 4. Verify WebGL state via debug interface
  const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(state?.mode).toBe('playing');
  expect(state?.weapons.length).toBeGreaterThan(0);
  expect(state?.hp).toBe(100);

  // 5. Test level up modal (level 1 -> 2 requires 20 XP; grantXp(20) triggers exactly 1 level-up)
  await page.evaluate(() => window.__GAME_DEBUG__?.grantXp(20));
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
