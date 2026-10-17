import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_VERSION, BUILD_HASH } from '../../src/core/version';
import { TitleScreen } from '../../src/ui/TitleScreen';
import { SaveManager } from '../../src/state/SaveManager';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ErrorReporter } from '../../src/core/ErrorReporter';

describe('P10-04 Versioning & Changelog', () => {
  let root: HTMLElement;
  let saveManager: SaveManager;
  let audioEngine: AudioEngine;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement('div');
    document.body.appendChild(root);
    saveManager = new SaveManager();
    audioEngine = new AudioEngine();
  });

  afterEach(() => {
    root.remove();
    localStorage.clear();
  });

  it('contains CHANGELOG.md adhering to Keep a Changelog standards with all phases', () => {
    const changelogPath = path.resolve(__dirname, '../../CHANGELOG.md');
    expect(fs.existsSync(changelogPath)).toBe(true);

    const content = fs.readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('# Changelog');
    expect(content).toContain('Keep a Changelog');
    expect(content).toContain('Semantic Versioning');
    expect(content).toContain('## [1.10.0]');
    expect(content).toContain('## [1.9.0]');
    expect(content).toContain('## [1.8.0]');
    expect(content).toContain('## [1.7.0]');
    expect(content).toContain('## [1.6.0]');
    expect(content).toContain('## [1.5.0]');
    expect(content).toContain('## [1.4.0]');
    expect(content).toContain('## [1.3.0]');
    expect(content).toContain('## [1.2.0]');
    expect(content).toContain('## [1.1.0]');
    expect(content).toContain('## [1.0.0]');
  });

  it('bumps package.json version to 1.10.0', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.version).toBe('1.10.0');
  });

  it('exports APP_VERSION and BUILD_HASH from version.ts', () => {
    expect(APP_VERSION).toBe('1.10.0');
    expect(typeof BUILD_HASH).toBe('string');
    expect(BUILD_HASH.length).toBeGreaterThan(0);
  });

  it('renders title screen version watermark with APP_VERSION and BUILD_HASH', () => {
    const titleScreen = new TitleScreen(root, saveManager, audioEngine, () => {});
    root.appendChild(titleScreen.container);

    const watermark = root.querySelector('#title-version-watermark');
    expect(watermark).not.toBeNull();
    expect(watermark?.textContent).toContain(`v${APP_VERSION}`);
    expect(watermark?.textContent).toContain(BUILD_HASH);
  });

  it('integrates APP_VERSION into ErrorReporter diagnostic fault output', () => {
    const reporter = new ErrorReporter();
    const fault = reporter.generateReport('Critical core malfunction');
    expect(fault.version).toBe(APP_VERSION);
    expect(fault.formattedText).toContain(`App Version: ${APP_VERSION}`);
  });
});
