import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PauseModal } from '../../src/ui/PauseModal';
import { SaveManager } from '../../src/state/SaveManager';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { RunState } from '../../src/state/RunState';

describe('PauseModal and Tactical Pause Settings', () => {
  let root: HTMLElement;
  let saveManager: SaveManager;
  let audioEngine: AudioEngine;
  let runState: RunState;

  beforeEach(() => {
    window.localStorage.clear();
    root = document.createElement('div');
    saveManager = new SaveManager();
    audioEngine = new AudioEngine();
    runState = new RunState();
  });

  it('renders modal with required data-testids', () => {
    const modal = new PauseModal(root, saveManager, audioEngine, () => runState);
    expect(root.querySelector('[data-testid="pause-modal"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="btn-pause-resume"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="btn-pause-abort"]')).not.toBeNull();
    expect(modal.isVisible()).toBe(false);
  });

  it('shows and hides with resume and abort callbacks', () => {
    const modal = new PauseModal(root, saveManager, audioEngine, () => runState);
    const onResume = vi.fn();
    const onAbort = vi.fn();

    modal.show(onResume, onAbort);
    expect(modal.isVisible()).toBe(true);

    const resumeBtn = root.querySelector('#btn-pause-resume') as HTMLButtonElement;
    resumeBtn.click();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(modal.isVisible()).toBe(false);

    modal.show(onResume, onAbort);
    const abortBtn = root.querySelector('#btn-pause-abort') as HTMLButtonElement;
    abortBtn.click();
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(modal.isVisible()).toBe(false);
  });

  it('adjusts volume live and persists to SaveManager', () => {
    const modal = new PauseModal(root, saveManager, audioEngine, () => runState);
    const setMasterSpy = vi.spyOn(audioEngine, 'setMasterVolume');

    modal.show(vi.fn(), vi.fn());
    const slider = root.querySelector('#pause-slider-master') as HTMLInputElement;
    slider.value = '45';
    slider.dispatchEvent(new Event('input'));

    expect(setMasterSpy).toHaveBeenCalledWith(0.45);
    expect(saveManager.getData().settings.masterVolume).toBe(0.45);
  });

  it('toggles auto-aim on RunState and persists to SaveManager', () => {
    const modal = new PauseModal(root, saveManager, audioEngine, () => runState);
    runState.autoAimEnabled = true;

    modal.show(vi.fn(), vi.fn());
    const autoAimToggle = root.querySelector('#pause-toggle-autoaim') as HTMLInputElement;
    expect(autoAimToggle.checked).toBe(true);

    autoAimToggle.checked = false;
    autoAimToggle.dispatchEvent(new Event('change'));

    expect(runState.autoAimEnabled).toBe(false);
    expect(saveManager.getData().settings.autoAim).toBe(false);
  });
});
