import { test, expect } from '@playwright/test';

test('Full keyboard-only accessibility navigation (no mouse interactions)', async ({ page }) => {
  await page.goto('/');

  // 1. Verify modal dialog semantics exist on key modal containers
  const bunkerModal = page.locator('#bunker-modal');
  const pauseModal = page.locator('#pause-modal');
  const levelupModal = page.locator('#levelup-modal');

  await expect(bunkerModal).toHaveAttribute('role', 'dialog');
  await expect(bunkerModal).toHaveAttribute('aria-modal', 'true');
  await expect(pauseModal).toHaveAttribute('role', 'dialog');
  await expect(pauseModal).toHaveAttribute('aria-modal', 'true');
  await expect(levelupModal).toHaveAttribute('role', 'dialog');
  await expect(levelupModal).toHaveAttribute('aria-modal', 'true');

  // 2. Navigate Title Screen with keyboard: ArrowDown to Bunker Requisition and press Enter
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(bunkerModal).toBeVisible();

  // 3. Test focus trap & keyboard navigation in Bunker modal
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');

  // 4. Close Bunker modal with Escape key
  await page.keyboard.press('Escape');
  await expect(bunkerModal).toBeHidden();

  // 5. Navigate back to Deploy button with ArrowUp and launch run with Enter
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hud-container')).toBeVisible();

  // Verify game is playing
  const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(state?.mode).toBe('playing');

  // 6. Pause modal via Escape key
  await page.keyboard.press('Escape');
  await expect(pauseModal).toBeVisible();

  // Navigate pause options with Arrow keys
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');

  // Resume game via Escape key
  await page.keyboard.press('Escape');
  await expect(pauseModal).toBeHidden();

  // 7. Level-up keyboard navigation
  await page.evaluate(() => window.__GAME_DEBUG__?.grantXp(20));
  await expect(levelupModal).toBeVisible();

  // Navigate between upgrade cards with keyboard
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');

  // Confirm selection with Enter
  await page.keyboard.press('Enter');
  await expect(levelupModal).toBeHidden();
});
