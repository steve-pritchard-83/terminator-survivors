import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialModal, TUTORIAL_PHASES } from '../../src/ui/TutorialModal';
import { TitleScreen } from '../../src/ui/TitleScreen';
import { SaveManager } from '../../src/state/SaveManager';
import { AudioEngine } from '../../src/audio/AudioEngine';

describe('P8-04: First-Run Boot Camp Tutorial', () => {
  let root: HTMLElement;
  let saveManager: SaveManager;
  let audioEngine: AudioEngine;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement('div');
    document.body.appendChild(root);
    saveManager = new SaveManager();
    audioEngine = new AudioEngine();
    // Stub audio methods
    vi.spyOn(audioEngine, 'playHudScanOpen').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playHudScanClose').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUiClick').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUiBeep').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUpgradeApplied').mockImplementation(() => {});
  });

  it('SaveManager defaults tutorialCompleted to false and persists updates', () => {
    expect(saveManager.isTutorialCompleted()).toBe(false);
    saveManager.setTutorialCompleted(true);
    expect(saveManager.isTutorialCompleted()).toBe(true);

    // Verify persistence across new instance
    const reloaded = new SaveManager();
    expect(reloaded.isTutorialCompleted()).toBe(true);
  });

  it('TutorialModal has 6 complete tactical boot camp phases with accessibility attributes', () => {
    const modal = new TutorialModal(root, saveManager, audioEngine);
    expect(TUTORIAL_PHASES.length).toBe(6);
    expect(modal.container.getAttribute('role')).toBe('dialog');
    expect(modal.container.getAttribute('aria-modal')).toBe('true');
    expect(modal.container.getAttribute('aria-label')).toBe('Tech-Com Tactical Boot Camp');

    // Verify phase contents
    expect(TUTORIAL_PHASES[0].title).toBe('TACTICAL MOVEMENT');
    expect(TUTORIAL_PHASES[1].title).toContain('TARGET ACQUISITION');
    expect(TUTORIAL_PHASES[2].title).toContain('COMBAT DIVE');
    expect(TUTORIAL_PHASES[3].title).toContain('DATA CORES');
    expect(TUTORIAL_PHASES[4].title).toContain('LEVEL-UP REQUISITION');
    expect(TUTORIAL_PHASES[5].title).toContain('MILITARY WEAPON EVOLUTION');
  });

  it('advances through phases with next() and handles previous() bounds correctly', () => {
    const modal = new TutorialModal(root, saveManager, audioEngine);
    modal.show();

    expect(modal.isVisible()).toBe(true);
    const prevBtn = modal.container.querySelector('#btn-tutorial-prev') as HTMLButtonElement;
    const nextBtn = modal.container.querySelector('#btn-tutorial-next') as HTMLButtonElement;
    const tagEl = modal.container.querySelector('#tutorial-phase-tag')!;

    // Step 0: prev is disabled
    expect(prevBtn.disabled).toBe(true);
    expect(tagEl.textContent).toBe('PHASE 01 // 06');

    // Step 1
    modal.next();
    expect(prevBtn.disabled).toBe(false);
    expect(tagEl.textContent).toBe('PHASE 02 // 06');

    // Back to Step 0
    modal.prev();
    expect(prevBtn.disabled).toBe(true);
    expect(tagEl.textContent).toBe('PHASE 01 // 06');

    // Step 0 prev does not underflow
    modal.prev();
    expect(tagEl.textContent).toBe('PHASE 01 // 06');

    // Advance to final step (Phase 6)
    for (let i = 0; i < 5; i++) {
      modal.next();
    }
    expect(tagEl.textContent).toBe('PHASE 06 // 06');
    expect(nextBtn.textContent).toBe('COMPLETE BOOT CAMP ✓');
  });

  it('completes the tutorial on the final next() call and triggers callback', () => {
    const modal = new TutorialModal(root, saveManager, audioEngine);
    let finished = false;
    modal.show(() => {
      finished = true;
    });

    // Advance to final phase
    for (let i = 0; i < 5; i++) {
      modal.next();
    }

    // Final click completes
    modal.next();
    expect(finished).toBe(true);
    expect(modal.isVisible()).toBe(false);
    expect(saveManager.isTutorialCompleted()).toBe(true);
  });

  it('allows skipping tutorial at any time and sets tutorialCompleted to true', () => {
    const modal = new TutorialModal(root, saveManager, audioEngine);
    let finished = false;
    modal.show(() => {
      finished = true;
    });

    expect(modal.isVisible()).toBe(true);
    modal.skip();
    expect(finished).toBe(true);
    expect(modal.isVisible()).toBe(false);
    expect(saveManager.isTutorialCompleted()).toBe(true);
  });

  it('handles gamepad input for next and skip', () => {
    const modal = new TutorialModal(root, saveManager, audioEngine);
    let finished = false;
    modal.show(() => {
      finished = true;
    });

    const mockGpConfirm = {
      isMenuConfirmPressed: () => true,
      isMenuCancelPressed: () => false,
      playRumble: vi.fn()
    } as any;

    // Advance via gamepad confirm
    modal.handleGamepad(mockGpConfirm);
    const tagEl = modal.container.querySelector('#tutorial-phase-tag')!;
    expect(tagEl.textContent).toBe('PHASE 02 // 06');

    const mockGpCancel = {
      isMenuConfirmPressed: () => false,
      isMenuCancelPressed: () => true,
      playRumble: vi.fn()
    } as any;

    // Skip via gamepad cancel
    modal.handleGamepad(mockGpCancel);
    expect(finished).toBe(true);
    expect(modal.isVisible()).toBe(false);
    expect(saveManager.isTutorialCompleted()).toBe(true);
  });

  it('TitleScreen prompts tutorial on first launch and allows replay from title button', () => {
    let runStarted = false;
    const title = new TitleScreen(
      root,
      saveManager,
      audioEngine,
      () => {
        runStarted = true;
      }
    );

    // Initial state: tutorial not completed
    expect(saveManager.isTutorialCompleted()).toBe(false);

    // Clicking Deploy triggers tutorial modal first
    const startBtn = title.container.querySelector('#btn-start-run') as HTMLButtonElement;
    startBtn.click();

    expect(title.tutorialModal.isVisible()).toBe(true);
    expect(runStarted).toBe(false);

    // Skipping completes and opens deploy modal (or launches run)
    title.tutorialModal.skip();
    expect(title.tutorialModal.isVisible()).toBe(false);
    expect(saveManager.isTutorialCompleted()).toBe(true);
    while ((title as any).deployModal?.isVisible()) {
      (root.querySelector('#btn-deploy-next') as HTMLButtonElement | null)?.click();
    }
    expect(runStarted).toBe(true);

    // Subsequent click directly opens deploy modal without tutorial
    runStarted = false;
    startBtn.click();
    expect(title.tutorialModal.isVisible()).toBe(false);
    while ((title as any).deployModal?.isVisible()) {
      (root.querySelector('#btn-deploy-next') as HTMLButtonElement | null)?.click();
    }
    expect(runStarted).toBe(true);

    // Replay button on TitleScreen opens tutorial explicitly in replay mode
    const bootCampBtn = title.container.querySelector('#btn-boot-camp') as HTMLButtonElement;
    bootCampBtn.click();
    expect(title.tutorialModal.isVisible()).toBe(true);
    const skipBtn = title.tutorialModal.container.querySelector('#btn-tutorial-skip') as HTMLButtonElement;
    expect(skipBtn.textContent).toBe('EXIT TUTORIAL');
  });
});
