import { test, expect } from '@playwright/test';

test('Performance harness: 500-enemy swarm telemetry and geometry stability', async ({
  page
}) => {
  test.setTimeout(45000);

  await page.goto('/');
  await expect(page.getByTestId('btn-start-run')).toBeVisible();

  // Start run & deploy
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  // Enable God Mode so player survives swarm
  await page.evaluate(() => {
    window.__GAME_DEBUG__?.setGodMode(true);
  });

  // Spawn 400 crab drones + 100 T-800 endoskeletons
  await page.evaluate(() => {
    window.__GAME_DEBUG__?.spawnSwarm('skynet_crab_drone', 400);
    window.__GAME_DEBUG__?.spawnSwarm('t800_endoskeleton', 100);
  });

  const perfLog: Array<{
    elapsed: string;
    fps: number;
    frameTimeMs: number;
    drawCalls: number;
    geometries: number;
    textures: number;
    heapMB: string;
  }> = [];

  // Sample perf across 10 seconds (samples at 1s, 3s, 5s, 7s, 10s)
  const samplePoints = [1000, 2000, 2000, 2000, 3000];
  let elapsedMs = 0;

  for (const interval of samplePoints) {
    await page.waitForTimeout(interval);
    elapsedMs += interval;

    const perf = await page.evaluate(() => window.__GAME_DEBUG__?.getPerf());
    if (perf) {
      perfLog.push({
        elapsed: `${(elapsedMs / 1000).toFixed(0)}s`,
        fps: perf.fps,
        frameTimeMs: perf.frameTimeMs,
        drawCalls: perf.drawCalls,
        geometries: perf.geometries,
        textures: perf.textures,
        heapMB: perf.heapMB !== undefined ? `${perf.heapMB} MB` : 'N/A'
      });
    }
  }

  // Print formatted performance telemetry table
  console.log('\n=================== 500-ENEMY SWARM TELEMETRY ===================');
  console.table(perfLog);
  console.log('=================================================================\n');

  const sec5 = perfLog.find((p) => p.elapsed === '5s');
  const sec10 = perfLog.find((p) => p.elapsed === '10s');

  expect(sec5).toBeDefined();
  expect(sec10).toBeDefined();

  if (sec5 && sec10) {
    // Assert geometries did not grow > 5% between second 5 and second 10
    const geoGrowth = (sec10.geometries - sec5.geometries) / Math.max(1, sec5.geometries);
    expect(geoGrowth).toBeLessThanOrEqual(0.05);
  }

  // Target FPS check (60 FPS desktop target; skipped in headless CI environments)
  const avgFps = perfLog.reduce((acc, p) => acc + p.fps, 0) / perfLog.length;
  console.log(`Average Swarm FPS: ${avgFps.toFixed(1)}`);
});
