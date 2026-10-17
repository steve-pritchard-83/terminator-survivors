import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TitleScreen } from '../../src/ui/TitleScreen';
import { UIManager } from '../../src/ui/UIManager';
import { SaveManager } from '../../src/state/SaveManager';
import { InputManager } from '../../src/input/InputManager';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { RunState } from '../../src/state/RunState';

describe('P10-02 Code splitting', () => {
  let root: HTMLElement;
  let saveManager: SaveManager;
  let audioEngine: AudioEngine;
  let inputManager: InputManager;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    saveManager = new SaveManager();
    audioEngine = new AudioEngine();
    inputManager = new InputManager();
  });

  it('lazy-loads CodexModal on demand via getOrLoadCodexModal in TitleScreen', async () => {
    const titleScreen = new TitleScreen(
      root,
      saveManager,
      audioEngine,
      () => {},
      () => {},
      () => {}
    );

    // Initial state before opening codex: not yet instantiated
    expect(titleScreen.codexModal).toBeNull();

    // On-demand load
    const modal = await titleScreen.getOrLoadCodexModal();
    expect(modal).toBeDefined();
    expect(titleScreen.codexModal).toBe(modal);

    // Repeated calls return cached instance
    const modal2 = await titleScreen.getOrLoadCodexModal();
    expect(modal2).toBe(modal);
  });

  it('lazy-loads SettingsPanel on demand via getOrLoadSettingsPanel in UIManager', async () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    const ui = new UIManager(
      root,
      saveManager,
      inputManager,
      audioEngine,
      () => {},
      () => runState
    );

    // Initial state: not yet instantiated
    expect(ui.settingsPanel).toBeNull();

    // On-demand load
    const panel = await ui.getOrLoadSettingsPanel();
    expect(panel).toBeDefined();
    expect(ui.settingsPanel).toBe(panel);

    // Repeated calls return cached instance
    const panel2 = await ui.getOrLoadSettingsPanel();
    expect(panel2).toBe(panel);
  });

  it('configures chunk code splitting in vite.config.ts', () => {
    const viteConfig = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('manualChunks');
    expect(viteConfig).toContain('three-vendor');
    expect(viteConfig).toContain('stage-environments');
    expect(viteConfig).toContain('codex');
    expect(viteConfig).toContain('settings');
  });

  it('achieves initial main JS bundle size < 450 KB', () => {
    const distAssetsDir = path.resolve('dist', 'assets');
    if (!fs.existsSync(distAssetsDir)) return; // Skipped if not built

    const files = fs.readdirSync(distAssetsDir);
    const jsFiles = files.filter((f) => f.endsWith('.js'));
    const mainChunk = jsFiles.find((f) => f.startsWith('index-'));
    expect(mainChunk).toBeDefined();

    if (mainChunk) {
      const stats = fs.statSync(path.join(distAssetsDir, mainChunk));
      const sizeKb = stats.size / 1024;
      // Must be strictly less than 450 KB
      expect(sizeKb).toBeLessThan(450);
    }
  });
});
