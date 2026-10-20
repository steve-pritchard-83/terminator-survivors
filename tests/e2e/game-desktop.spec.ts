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

// Playtest substitute: spawns every enemy and boss type, lets the simulation run, and fails on any
// runtime error. Catches crashes in enemy behaviours, telegraphs, drones and elite visuals.
test('Every enemy and boss type runs without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto('/');
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  const archetypes = [
    'skynet_crab_drone', 't600_rusted', 't700_scout', 't800_endoskeleton', 'hk_aerial_patrol',
    't1_minigun_tracked', 'moto_terminator', 'hydrobot_swarm', 'aerostat_scout', 'plasma_turret',
    't600_minigunner'
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
