import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true
});

test('Mobile gameplay: touch virtual joystick movement and mobile dash button', async ({
  page
}) => {
  await page.goto('/');

  await expect(page.getByTestId('btn-start-run')).toBeVisible();
  await page.getByTestId('btn-start-run').click();

  await expect(page.getByTestId('hud-container')).toBeVisible();
  await expect(page.getByTestId('touch-joystick-zone')).toBeVisible();
  await expect(page.getByTestId('btn-mobile-dash')).toBeVisible();

  // Initial player position
  const initialPos = await page.evaluate(() => window.__GAME_DEBUG__?.getState().playerPos);
  expect(initialPos).toBeDefined();

  // Simulate mobile virtual touch joystick drag
  const touchZone = page.getByTestId('touch-joystick-zone');
  const box = await touchZone.boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY + 40, { steps: 5 });
    await page.waitForTimeout(250);
    await page.mouse.up();
  }

  // Verify player position moved from (0, 0)
  const movedPos = await page.evaluate(() => window.__GAME_DEBUG__?.getState().playerPos);
  expect(movedPos).toBeDefined();
  const movedDist = Math.hypot(movedPos!.x - initialPos!.x, movedPos!.z - initialPos!.z);
  expect(movedDist).toBeGreaterThan(0.01);

  // Test Mobile DASH button
  await page.getByTestId('btn-mobile-dash').dispatchEvent('pointerdown');
  await page.waitForTimeout(50);
  const dashState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(dashState?.isDashing || (dashState?.dashCooldown ?? 0) > 0).toBe(true);
});
