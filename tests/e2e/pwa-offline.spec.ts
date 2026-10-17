import { test, expect } from '@playwright/test';

test('PWA registers Service Worker, caches Terminator font & music, and runs completely offline', async ({
  page,
  context
}) => {
  const failedRequests: string[] = [];
  page.on('requestfailed', (req) => failedRequests.push(req.url()));

  await page.goto('/');
  await expect(page.getByTestId('btn-start-run')).toBeVisible();

  // Wait for Workbox Service Worker to activate and claim the client
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
          setTimeout(resolve, 1500);
        });
      }
    }
  });

  // Switch browser context to strict Offline Mode and reload
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Verify game boots and plays offline with zero failed requests
  await expect(page.getByTestId('btn-start-run')).toBeVisible();
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(state?.mode).toBe('playing');
  expect(failedRequests).toEqual([]);

  await context.setOffline(false);
});
