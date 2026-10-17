import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { SaveManager } from '../../src/state/SaveManager';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { PauseModal } from '../../src/ui/PauseModal';
import { LevelUpModal } from '../../src/ui/LevelUpModal';
import { RunController } from '../../src/core/RunController';

describe('P8-05: Quality of Life (Auto-pause, Evolution Index, Reroll/Skip/Banish)', () => {
  let root: HTMLElement;
  let saveManager: SaveManager;
  let audioEngine: AudioEngine;
  let runState: RunState;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement('div');
    document.body.appendChild(root);
    saveManager = new SaveManager();
    audioEngine = new AudioEngine();
    runState = new RunState();

    vi.spyOn(audioEngine, 'playHudScanOpen').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playHudScanClose').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUiClick').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUiBuy').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUiError').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playUpgradeApplied').mockImplementation(() => {});
    vi.spyOn(audioEngine, 'playLevelUp').mockImplementation(() => {});
  });

  it('meta upgrades grant reroll, skip, and banish counts to computedStats', () => {
    runState.initRun(
      'reese_2029',
      {
        reroll_protocol: 2,
        banish_protocol: 1,
        skip_protocol: 3
      }
    );

    expect(runState.computedStats.rerolls).toBe(2);
    expect(runState.computedStats.banishes).toBe(1);
    expect(runState.computedStats.skips).toBe(3);
    expect(runState.rerollsLeft).toBe(2);
    expect(runState.banishesLeft).toBe(1);
    expect(runState.skipsLeft).toBe(3);
  });

  it('reroll decrements rerollsLeft and generates new choices', () => {
    runState.initRun('reese_2029', { reroll_protocol: 1 });
    expect(runState.rerollsLeft).toBe(1);

    const firstChoices = runState.generateUpgradeChoices();
    expect(firstChoices.length).toBeGreaterThan(0);

    const success = runState.useReroll();
    expect(success).toBe(true);
    expect(runState.rerollsLeft).toBe(0);

    // Further reroll attempt fails
    expect(runState.useReroll()).toBe(false);
  });

  it('skip decrements skipsLeft and awards +25 Alloy Scrap', () => {
    runState.initRun('reese_2029', { skip_protocol: 2 });
    const initialScrap = runState.alloyScrapEarned;

    expect(runState.skipsLeft).toBe(2);
    const success = runState.useSkip();
    expect(success).toBe(true);
    expect(runState.skipsLeft).toBe(1);
    expect(runState.alloyScrapEarned).toBe(initialScrap + 25);
  });

  it('banish permanently removes item from subsequent upgrade rolls', () => {
    runState.initRun('reese_2029', { banish_protocol: 2 });
    expect(runState.banishesLeft).toBe(2);

    const targetWeaponId = 'rpg_launcher';
    expect(runState.banishedIds.has(targetWeaponId)).toBe(false);

    runState.banishUpgrade(targetWeaponId);
    expect(runState.banishedIds.has(targetWeaponId)).toBe(true);
    expect(runState.banishesLeft).toBe(1);

    // Verify target weapon never appears across 10 distinct choice generations
    for (let i = 0; i < 10; i++) {
      const choices = runState.generateUpgradeChoices();
      const found = choices.some((c) => c.id === targetWeaponId);
      expect(found).toBe(false);
    }
  });

  it('PauseModal renders active arsenal and evolution recipes index', () => {
    runState.initRun('reese_2029', {});
    // Give Kyle Lv 8 m25_plasma and Lv 1 phase_inductor (ready to evolve)
    runState.weapons.set('m25_plasma', {
      id: 'm25_plasma',
      level: 8,
      evolved: false,
      cooldownTimer: 0
    });
    runState.passives.set('phase_inductor', 1);

    const pauseModal = new PauseModal(root, saveManager, audioEngine, () => runState);
    pauseModal.show(() => {}, () => {});

    expect(pauseModal.isVisible()).toBe(true);

    const arsenalEl = pauseModal.container.querySelector('#pause-arsenal-list')!;
    expect(arsenalEl.textContent).toContain('M-25');
    expect(arsenalEl.textContent).toContain('LV 8/8');
    expect(arsenalEl.textContent).toContain('40-Watt Phase Inductor');

    const recipesEl = pauseModal.container.querySelector('#pause-recipes-list')!;
    expect(recipesEl.textContent).toContain('Westinghouse M-25');
    expect(recipesEl.textContent).toContain('Westinghouse M95A1 Heavy');
    expect(recipesEl.textContent).toContain('SYNTHESIS READY');

    pauseModal.hide();
    expect(pauseModal.isVisible()).toBe(false);
  });

  it('LevelUpModal renders reroll, skip, and banish buttons and hooks callbacks', () => {
    const levelUpModal = new LevelUpModal(root);
    let rerolled = false;
    let skipped = false;
    let banishedId = '';

    const choices: import('../../src/core/types').UpgradeChoice[] = [
      {
        kind: 'weapon',
        id: 'ithaca_37',
        title: 'Ithaca 37 Shotgun',
        subtitle: 'RIOT SHOTGUN // NEW',
        currentLevel: 0,
        nextLevel: 1,
        description: 'Fires high-impact spread shot.',
        accentColor: '#ff4400'
      }
    ];

    levelUpModal.show(
      2,
      choices,
      () => {},
      {
        rerollsLeft: 2,
        skipsLeft: 1,
        banishesLeft: 1,
        onReroll: () => {
          rerolled = true;
        },
        onSkip: () => {
          skipped = true;
        },
        onBanish: (c) => {
          banishedId = c.id;
        }
      }
    );

    const rerollBtn = levelUpModal.container.querySelector('#btn-levelup-reroll') as HTMLButtonElement;
    const skipBtn = levelUpModal.container.querySelector('#btn-levelup-skip') as HTMLButtonElement;
    const banishBtn = levelUpModal.container.querySelector('#btn-levelup-banish') as HTMLButtonElement;

    expect(rerollBtn.textContent).toContain('REROLL (2)');
    expect(skipBtn.textContent).toContain('SKIP (+25 SCRAP) (1)');
    expect(banishBtn.textContent).toContain('BANISH SELECTED (1)');

    rerollBtn.click();
    expect(rerolled).toBe(true);

    skipBtn.click();
    expect(skipped).toBe(true);

    banishBtn.click();
    expect(banishedId).toBe('ithaca_37');
  });

  it('auto-pauses on window blur and visibility change when in playing mode', () => {
    runState.initRun('reese_2029', {});
    runState.mode = 'playing';

    const mockHost: any = {
      runState,
      saveManager,
      audioEngine,
      uiManager: {
        pauseModal: {
          show: vi.fn(),
          hide: vi.fn()
        },
        hudView: {
          damageNumbers: { clear: vi.fn() },
          hide: vi.fn()
        },
        levelUpModal: { show: vi.fn() }
      },
      sceneManager: {
        addScreenShake: vi.fn(),
        postProcessing: { triggerDamageFlash: vi.fn() }
      },
      inputManager: { clearDashRequest: vi.fn() },
      weaponSystem: { clear: vi.fn() },
      enemySystem: { clear: vi.fn(), activeEnemies: [] },
      pickupSystem: { clear: vi.fn() },
      particles: { clear: vi.fn() },
      waveDirector: {},
      gameLoop: {}
    };

    const controller = new RunController(mockHost);

    // Simulate window blur
    window.dispatchEvent(new Event('blur'));
    expect(mockHost.uiManager.pauseModal.show).toHaveBeenCalledTimes(1);
    expect(runState.mode).toBe('paused');

    // Reset to playing
    runState.mode = 'playing';

    // Simulate gamepad disconnect
    window.dispatchEvent(new Event('gamepaddisconnected'));
    expect(mockHost.uiManager.pauseModal.show).toHaveBeenCalledTimes(2);
    expect(runState.mode).toBe('paused');

    controller.dispose();
  });
});
