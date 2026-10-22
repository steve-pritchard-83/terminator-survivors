import { test, expect } from '@playwright/test';

test('Desktop gameplay: title, bunker shop, deploy and level up', async ({
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

  // 5. Test level up modal (level 1 -> 2 requires 20 XP; grantXp(20) triggers exactly 1 level-up)
  await page.evaluate(() => window.__GAME_DEBUG__?.grantXp(20));
  await expect(page.getByTestId('levelup-modal')).toBeVisible();
  await expect(page.getByTestId('upgrade-card-0')).toBeVisible();

  // Select upgrade card
  await page.getByTestId('upgrade-card-0').click();
  await expect(page.getByTestId('levelup-modal')).toBeHidden();
  await page.waitForTimeout(100);

});

// Playtest substitute: spawns every enemy and boss type, lets the simulation run, and fails on any
// runtime error. Catches crashes in enemy behaviours, telegraphs, drones and elite visuals.
test('Every enemy and boss type runs without runtime errors', async ({ page }) => {
  test.setTimeout(90_000); // spawns every enemy and boss under software rendering
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto('/');
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  const archetypes = [
    't600_rusted', 't800_endoskeleton', 'hk_aerial_patrol',
    't1_minigun_tracked', 'moto_terminator', 'plasma_turret'
  ];
  const bosses = [
    'infiltrator_csm101', 'hk_tank_goliath', 'hk_aerial_squadron_leader', 't1000_prototype',
    'skynet_tde_core'
  ];

  await page.evaluate(
    ({ archetypes, bosses }) => {
      const api = window.__GAME_DEBUG__!;
      api.setGodMode(true);
      for (const a of archetypes) api.spawnSwarm(a as never, 3);
      for (const b of bosses) api.spawnBoss(b as never);
      api.fastForward(60 * 8); // late-game wave pools, elites and phase thresholds
    },
    { archetypes, bosses }
  );

  await page.waitForTimeout(6000);

  const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(state?.mode).toBe('playing');
  expect(state?.activeEnemies).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

// The victory movie plays over the results. It can be skipped after a short lock; the results
// (MISSION ACCOMPLISHED) must follow either way.
test('Defeating the final boss plays the victory movie, which can be skipped to the results', async ({ page }) => {
  test.setTimeout(90_000); // software rendering is slow; the movie flow involves several waits
  await page.goto('/');
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  await page.evaluate(() => {
    const api = window.__GAME_DEBUG__!;
    api.setGodMode(true);
    api.spawnBoss('skynet_tde_core');
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__GAME_DEBUG__!.damageEnemy('boss', 1e9));

  await expect(page.getByTestId('victory-video')).toBeVisible({ timeout: 15000 });
  // Skipping is locked for the first 1.5 s so button-mashing at the win does not skip it
  await page.waitForTimeout(1800);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('victory-video')).toBeHidden();
  await expect(page.locator('#end-title')).toContainText('MISSION ACCOMPLISHED', { timeout: 5000 });
});

// Dying plays the defeat movie after a short lead-in, and it can be skipped to the results.
test('Dying plays the defeat movie, which can be skipped to the results', async ({ page }) => {
  test.setTimeout(90_000); // software rendering is slow; the movie flow involves several waits
  await page.goto('/');
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  await page.waitForTimeout(800); // let the run settle before killing the player
  await page.evaluate(() => window.__GAME_DEBUG__!.setPlayerHp(0));

  await expect(page.getByTestId('defeat-video')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1800);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('defeat-video')).toBeHidden();
  await expect(page.locator('#end-title')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('victory-video')).toBeHidden();
});
