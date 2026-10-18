import { test, expect } from '@playwright/test';

test.describe('P11-09 Run configuration and deploy flow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed save data with tutorial completed and 1 victory so threat levels are accessible
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'TERMINATOR_SURVIVORS_SAVE_V1',
        JSON.stringify({
          version: 3,
          alloyScrap: 500,
          totalKills: 200,
          bestTimeSeconds: 400,
          victories: 1,
          unlockedLoadouts: ['reese_2029', 'reese_1984'],
          selectedLoadout: 'reese_2029',
          tutorialCompleted: true,
          stageBestTimes: {
            la_2029_wasteland: 400
          }
        })
      );
    });
  });

  test('clicking Deploy opens DeployModal, allows picking unlocked stage and loadout, and starts configured run', async ({ page }) => {
    await page.goto('/');

    const startBtn = page.locator('#btn-start-run');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    const deployModal = page.locator('#deploy-modal');
    await expect(deployModal).toBeVisible();

    // Check step 1: Theater of Operations
    const stepIndicator = page.locator('#deploy-step-indicator');
    await expect(stepIndicator).toContainText('STEP 1/3: THEATER OF OPERATIONS');

    // la_2029_wasteland is unlocked by default
    const wastelandCard = page.locator('[data-testid="stage-card-la_2029_wasteland"]');
    await expect(wastelandCard).toBeEnabled();

    // cyberdyne_factory requires survive 5m (300s) in wasteland.
    // Our seeded save has 400s in wasteland, so cyberdyne is unlocked!
    const cyberdyneCard = page.locator('[data-testid="stage-card-cyberdyne_factory"]');
    await expect(cyberdyneCard).toBeEnabled();

    // tech_noir_1984 requires 7m in cyberdyne, which has 0s in save, so it should be locked (disabled)
    const techNoirCard = page.locator('[data-testid="stage-card-tech_noir_1984"]');
    await expect(techNoirCard).toBeDisabled();

    // Select Cyberdyne Systems Factory
    await cyberdyneCard.click();

    // Click Proceed to Operative
    const nextBtn = page.locator('#btn-deploy-next');
    await nextBtn.click();

    // Check step 2: Operative Selection
    await expect(stepIndicator).toContainText('STEP 2/3: ACTIVE RESISTANCE OPERATIVE');
    const reese1984Card = page.locator('[data-testid="loadout-card-reese_1984"]');
    await expect(reese1984Card).toBeEnabled();
    await reese1984Card.click();

    // Proceed to Step 3: Threat Modifiers
    await nextBtn.click();
    await expect(stepIndicator).toContainText('STEP 3/3: TACTICAL THREAT LEVEL MODIFIERS');

    // Engage terminator_reinforcements threat
    const threatCard = page.locator('[data-testid="threat-card-terminator_reinforcements"]');
    await threatCard.click();
    await expect(threatCard).toContainText('ENGAGED [X]');

    // Initiate deployment
    await nextBtn.click();

    // Modal should close and game start
    await expect(deployModal).toBeHidden();

    // Verify game state matches selected stage and threats
    await page.waitForFunction(() => {
      const state = window.__GAME_DEBUG__?.getState();
      return state && state.mode === 'playing';
    });

    const state = await page.evaluate(() => window.__GAME_DEBUG__!.getState());
    expect(state.stageId).toBe('cyberdyne_factory');
    expect(state.threats).toContain('terminator_reinforcements');
  });

  test('locked stage cannot be selected or started through DeployModal', async ({ page }) => {
    await page.goto('/');

    const startBtn = page.locator('#btn-start-run');
    await startBtn.click();

    const techNoirCard = page.locator('[data-testid="stage-card-tech_noir_1984"]');
    await expect(techNoirCard).toBeDisabled();
  });
});
