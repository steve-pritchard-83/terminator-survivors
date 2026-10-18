import { test, expect } from '@playwright/test';

test.describe('P11-06 Apply saved settings at boot', () => {
  test('applies saved settings on boot without opening Settings panel', async ({ page }) => {
    // 1. Navigate to page to allow localStorage access
    await page.goto('/');

    // 2. Seed localStorage with custom settings: reducedMotion=true, colorBlindMode='deuteranopia', uiScale=130
    await page.evaluate(() => {
      const raw = localStorage.getItem('TERMINATOR_SURVIVORS_SAVE_V1');
      const data = raw ? JSON.parse(raw) : { version: 2, selectedLoadout: 'reese_2029', upgrades: {}, stats: {} };
      data.settings = {
        masterVolume: 0.8,
        musicVolume: 0.7,
        sfxVolume: 0.85,
        screenShake: 100,
        flashIntensity: 100,
        reducedMotion: true,
        damageNumbers: 'all',
        crtScanlines: true,
        autoAim: true,
        qualityPreset: 'high',
        showFps: false,
        colorBlindMode: 'deuteranopia',
        uiScale: 130
      };
      localStorage.setItem('TERMINATOR_SURVIVORS_SAVE_V1', JSON.stringify(data));
    });

    // 3. Reload page to test boot-time settings application
    await page.reload();
    await expect(page.getByTestId('btn-start-run')).toBeVisible();

    // 4. Assert runtime settings without opening Settings modal
    const runtime = await page.evaluate(() => window.__GAME_DEBUG__?.getRuntimeSettings());
    expect(runtime).toBeDefined();
    expect(runtime?.hitStopEnabled).toBe(false);
    expect(runtime?.shakeScale).toBe(0);
    expect(runtime?.bodyClasses).toContain('deuteranopia');

    // 5. Assert CRT overlay is hidden due to reducedMotion: true
    const crtDisplay = await page.evaluate(() => {
      const crtEl = document.querySelector('.crt-overlay') as HTMLElement | null;
      return crtEl ? window.getComputedStyle(crtEl).display : null;
    });
    expect(crtDisplay).toBe('none');

    // 6. Assert UI scale variable is set to 1.3
    const uiScale = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--ui-scale');
    });
    expect(uiScale).toBe('1.3');
  });
});
