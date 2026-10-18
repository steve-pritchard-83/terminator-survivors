import { test, expect } from '@playwright/test';

test.describe('P11-02 Boss & special enemy mesh leak across runs', () => {
  test('scene mesh count before first run equals mesh count after restart across 3 runs', async ({
    page
  }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await expect(page.getByTestId('btn-start-run')).toBeVisible();

    // Start initial run (skipping tutorial if present)
    await page.getByTestId('btn-start-run').click();
    const skipBtn = page.locator('#btn-tutorial-skip');
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByTestId('hud-container')).toBeVisible();

    // Start with standardized stage
    await page.evaluate(() => {
      window.__GAME_DEBUG__?.startRunWith({ stageId: 'la_2029_wasteland', seed: 12345 });
    });
    await page.waitForTimeout(400);

    const baselineCensus = await page.evaluate(() => window.__GAME_DEBUG__?.getSceneCensus());
    expect(baselineCensus).toBeDefined();
    if (!baselineCensus) throw new Error('baselineCensus is undefined');

    const baselineEnemyGroupChildren = baselineCensus.enemyGroupChildren;
    const baselineTotalMeshes = baselineCensus.totalMeshes;

    // Run 3 spawn-and-restart cycles
    for (let run = 1; run <= 3; run++) {
      // Spawn bosses and special enemies
      await page.evaluate(() => {
        window.__GAME_DEBUG__?.spawnBoss('hk_aerial_squadron_leader');
        window.__GAME_DEBUG__?.spawnBoss('hk_tank_goliath');
        window.__GAME_DEBUG__?.spawnSwarm('t1_minigun_tracked', 3);
        window.__GAME_DEBUG__?.spawnSwarm('moto_terminator', 3);
      });

      await page.waitForTimeout(500);

      const midRunCensus = await page.evaluate(() => window.__GAME_DEBUG__?.getSceneCensus());
      expect(midRunCensus?.enemyGroupChildren).toBeGreaterThan(baselineEnemyGroupChildren);

      // Restart run via debug API (which invokes RunController.resetRun -> enemySystem.clear())
      await page.evaluate(() => {
        window.__GAME_DEBUG__?.startRunWith({ stageId: 'la_2029_wasteland', seed: 12345 });
      });
      await page.waitForTimeout(400);

      const postRestartCensus = await page.evaluate(() => window.__GAME_DEBUG__?.getSceneCensus());
      expect(postRestartCensus?.enemyGroupChildren).toBe(baselineEnemyGroupChildren);
      if (baselineTotalMeshes !== undefined) {
        expect(postRestartCensus?.totalMeshes).toBe(baselineTotalMeshes);
      }
    }
  });
});
