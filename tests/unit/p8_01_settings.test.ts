import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import { SettingsPanel } from '../../src/ui/SettingsPanel';
import { globalEvents } from '../../src/core/EventBus';
import type { GameSettings } from '../../src/core/types';

describe('P8-01 Settings Screen and System Calibration', () => {
  let saveManager: SaveManager;
  let mockAudio: any;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement('div');
    document.body.appendChild(root);

    mockAudio = {
      setMasterVolume: vi.fn(),
      setMusicVolume: vi.fn(),
      setSfxVolume: vi.fn(),
      playHudScanOpen: vi.fn(),
      playHudScanClose: vi.fn(),
      playUpgradeApplied: vi.fn(),
      playUiBuy: vi.fn()
    };

    saveManager = new SaveManager();
  });

  it('initializes default settings and sanitizes corrupted/out-of-bound values', () => {
    const s = saveManager.getData().settings;
    expect(s.masterVolume).toBe(0.8);
    expect(s.musicVolume).toBe(0.7);
    expect(s.sfxVolume).toBe(0.85);
    expect(s.screenShake).toBe(100);
    expect(s.flashIntensity).toBe(100);
    expect(s.damageNumbers).toBe('all');
    expect(s.colorBlindMode).toBe('none');
    expect(s.uiScale).toBe(100);

    // Corrupted save test
    const corrupted = {
      version: 2,
      settings: {
        masterVolume: -5,
        screenShake: 999,
        damageNumbers: 'invalid-mode',
        colorBlindMode: 'neon-cyberpunk',
        uiScale: 300
      }
    };

    const sanitized = saveManager.sanitizeAndMigrate(corrupted);
    expect(sanitized.settings.masterVolume).toBe(0);
    expect(sanitized.settings.screenShake).toBe(100);
    expect(sanitized.settings.damageNumbers).toBe('all');
    expect(sanitized.settings.colorBlindMode).toBe('none');
    expect(sanitized.settings.uiScale).toBe(150); // clamped to max 150
  });

  it('renders SettingsPanel and reads/writes settings accurately', () => {
    const panel = new SettingsPanel(root, saveManager, mockAudio);
    panel.show();

    expect(panel.isVisible()).toBe(true);

    const masterInput = panel.container.querySelector('#setting-master') as HTMLInputElement;
    expect(masterInput).toBeDefined();
    expect(masterInput.value).toBe('80');

    // Change master to 50% and screenShake to 40%
    masterInput.value = '50';
    const shakeInput = panel.container.querySelector('#setting-shake') as HTMLInputElement;
    shakeInput.value = '40';

    const colorBlindSelect = panel.container.querySelector('#setting-colorblind') as HTMLSelectElement;
    colorBlindSelect.value = 'deuteranopia';

    let emittedSettings: GameSettings | null = null;
    const unsub = globalEvents.on('settings:updated', (s) => {
      emittedSettings = s;
    });

    const applyBtn = panel.container.querySelector('#btn-apply-settings') as HTMLButtonElement;
    applyBtn.click();

    expect(panel.isVisible()).toBe(false);
    expect(saveManager.getData().settings.masterVolume).toBe(0.5);
    expect(saveManager.getData().settings.screenShake).toBe(40);
    expect(saveManager.getData().settings.colorBlindMode).toBe('deuteranopia');
    expect(emittedSettings).toBeDefined();
    expect(emittedSettings!.masterVolume).toBe(0.5);

    unsub();
  });

  it('applies color-blind attributes and UI scale to DOM', () => {
    const panel = new SettingsPanel(root, saveManager, mockAudio);
    panel.applyCurrentSettingsToDom({
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.85,
      screenShake: 100,
      flashIntensity: 100,
      reducedMotion: false,
      damageNumbers: 'all',
      crtScanlines: true,
      autoAim: true,
      showFps: false,
      colorBlindMode: 'tritanopia',
      uiScale: 125
    });

    expect(document.body.getAttribute('data-colorblind')).toBe('tritanopia');
    expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.25');
  });

  it('reduced motion automatically zeroes screen shake and disables scanlines', () => {
    const panel = new SettingsPanel(root, saveManager, mockAudio);
    panel.show();

    const reducedCheckbox = panel.container.querySelector('#setting-reduced-motion') as HTMLInputElement;
    reducedCheckbox.checked = true;
    reducedCheckbox.dispatchEvent(new Event('change'));

    const shakeInput = panel.container.querySelector('#setting-shake') as HTMLInputElement;
    const crtCheckbox = panel.container.querySelector('#setting-crt') as HTMLInputElement;

    expect(shakeInput.value).toBe('0');
    expect(crtCheckbox.checked).toBe(false);
  });
});
