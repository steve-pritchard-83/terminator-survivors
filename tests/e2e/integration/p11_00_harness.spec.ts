import { test, expect } from '@playwright/test';

test.describe('P11-00 Integration Harness', () => {
  test('starts a run, calls each new debug action, and validates return shapes', async ({
    page
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('btn-start-run')).toBeVisible();

    // Start a run (handles first-run tutorial modal if presented)
    await page.getByTestId('btn-start-run').click();
    const skipBtn = page.locator('#btn-tutorial-skip');
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByTestId('hud-container')).toBeVisible();

    // 1. Validate extended getState()
    const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(state).toBeDefined();
    expect(state?.mode).toBe('playing');
    expect(state?.stageId).toBe('la_2029_wasteland');
    expect(Array.isArray(state?.threats)).toBe(true);
    expect(typeof state?.isDaily).toBe('boolean');
    expect(typeof state?.isEndless).toBe('boolean');
    expect(typeof state?.revivalsLeft).toBe('number');
    expect(typeof state?.invulnerabilityTimer).toBe('number');

    // 2. Validate getSceneCensus()
    const census = await page.evaluate(() => window.__GAME_DEBUG__?.getSceneCensus());
    expect(census).toBeDefined();
    expect(typeof census?.enemyGroupChildren).toBe('number');
    expect(typeof census?.weaponGroupChildren).toBe('number');
    expect(typeof census?.pickupGroupChildren).toBe('number');
    expect(typeof census?.fuelDrums).toBe('number');
    expect(typeof census?.cars).toBe('number');
    expect(typeof census?.obstacleColliders).toBe('number');
    expect(typeof census?.visibleLights).toBe('number');

    // 3. Validate getRuntimeSettings()
    const runtimeSettings = await page.evaluate(() => window.__GAME_DEBUG__?.getRuntimeSettings());
    expect(runtimeSettings).toBeDefined();
    expect(typeof runtimeSettings?.shakeScale).toBe('number');
    expect(typeof runtimeSettings?.flashScale).toBe('number');
    expect(typeof runtimeSettings?.hitStopEnabled).toBe('boolean');
    expect(['all', 'crits', 'off']).toContain(runtimeSettings?.damageNumbersMode);
    expect(['low', 'medium', 'high', 'ultra']).toContain(runtimeSettings?.qualityPreset);
    expect(typeof runtimeSettings?.pixelRatio).toBe('number');
    expect(typeof runtimeSettings?.lightsEnabled).toBe('boolean');
    expect(runtimeSettings?.keyBindings).toBeDefined();
    expect(Array.isArray(runtimeSettings?.bodyClasses)).toBe(true);

    // 4. Validate getSave()
    const save = await page.evaluate(() => window.__GAME_DEBUG__?.getSave());
    expect(save).toBeDefined();
    expect(save?.version).toBeGreaterThanOrEqual(2);
    expect(save?.settings).toBeDefined();

    // 5. Validate setPlayerHp()
    await page.evaluate(() => window.__GAME_DEBUG__?.setPlayerHp(42));
    const hpState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(hpState?.hp).toBe(42);

    // 6. Validate damageEnemy() and killAllEnemies()
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.spawnBoss('hk_tank_goliath');
    });
    const bossHit = await page.evaluate(() => window.__GAME_DEBUG__?.damageEnemy('boss', 50, true));
    expect(bossHit).toBe(true);

    await page.evaluate(() => window.__GAME_DEBUG__?.killAllEnemies());
    const clearedState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(clearedState?.activeEnemies).toBe(0);

    // 7. Validate startRunWith()
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({
        loadoutId: 'reese_2029',
        stageId: 'la_2029_wasteland',
        isEndless: true
      });
    });
    const endlessState = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
    expect(endlessState?.isEndless).toBe(true);
    expect(endlessState?.stageId).toBe('la_2029_wasteland');
  });
});
