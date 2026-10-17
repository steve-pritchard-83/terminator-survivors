import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { RunState } from '../state/RunState';

export class PauseModal {
  public readonly container: HTMLElement;
  private readonly masterSlider: HTMLInputElement;
  private readonly sfxSlider: HTMLInputElement;
  private readonly musicSlider: HTMLInputElement;
  private readonly crtCheckbox: HTMLInputElement;
  private readonly autoAimCheckbox: HTMLInputElement;
  private readonly resumeBtn: HTMLButtonElement;
  private readonly abortBtn: HTMLButtonElement;

  private onResumeCallback: (() => void) | null = null;
  private onAbortCallback: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    private readonly saveManager: SaveManager,
    private readonly audioEngine: AudioEngine,
    private readonly getRunState: () => RunState
  ) {
    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'pause-modal');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="max-width: 520px;">
        <div class="t800-header">MISSION PAUSED</div>
        <div class="t800-ticker" style="margin-bottom:18px;">TACTICAL TELEMETRY // OVERRIDE MODE ACTIVE</div>

        <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px; font-family:var(--font-telemetry);">
          <!-- Master Volume -->
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">MASTER AUDIO</label>
            <input type="range" min="0" max="100" id="pause-slider-master" style="width:160px; accent-color:var(--color-cyan); cursor:pointer;" />
          </div>

          <!-- SFX Volume -->
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">SFX WEAPONS</label>
            <input type="range" min="0" max="100" id="pause-slider-sfx" style="width:160px; accent-color:var(--color-red); cursor:pointer;" />
          </div>

          <!-- Music Volume -->
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">SYNTHWAVE BGM</label>
            <input type="range" min="0" max="100" id="pause-slider-music" style="width:160px; accent-color:var(--color-amber); cursor:pointer;" />
          </div>

          <!-- CRT Scanlines -->
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">CRT SCANLINE EMULATION</label>
            <input type="checkbox" id="pause-toggle-crt" style="width:20px; height:20px; accent-color:var(--color-cyan); cursor:pointer;" />
          </div>

          <!-- Auto-Aim -->
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">TARGET LOCK AUTO-AIM</label>
            <input type="checkbox" id="pause-toggle-autoaim" style="width:20px; height:20px; accent-color:var(--color-cyan); cursor:pointer;" />
          </div>
        </div>

        <div style="display:flex; gap:16px; justify-content:center; margin-top:8px;">
          <button class="btn-primary" data-testid="btn-pause-resume" id="btn-pause-resume" style="flex:1;">RESUME MISSION</button>
          <button class="btn-secondary" data-testid="btn-pause-abort" id="btn-pause-abort" style="flex:1; border-color:var(--color-red); color:var(--color-red);">ABORT MISSION</button>
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.masterSlider = this.container.querySelector('#pause-slider-master')!;
    this.sfxSlider = this.container.querySelector('#pause-slider-sfx')!;
    this.musicSlider = this.container.querySelector('#pause-slider-music')!;
    this.crtCheckbox = this.container.querySelector('#pause-toggle-crt')!;
    this.autoAimCheckbox = this.container.querySelector('#pause-toggle-autoaim')!;
    this.resumeBtn = this.container.querySelector('#btn-pause-resume')!;
    this.abortBtn = this.container.querySelector('#btn-pause-abort')!;

    this.setupListeners();
  }

  private setupListeners(): void {
    this.masterSlider.addEventListener('input', () => {
      const val = parseFloat(this.masterSlider.value) / 100;
      this.audioEngine.setMasterVolume(val);
      const data = this.saveManager.getData();
      data.settings.masterVolume = val;
      this.saveManager.save();
    });

    this.sfxSlider.addEventListener('input', () => {
      const val = parseFloat(this.sfxSlider.value) / 100;
      this.audioEngine.setSfxVolume(val);
      const data = this.saveManager.getData();
      data.settings.sfxVolume = val;
      this.saveManager.save();
    });

    this.musicSlider.addEventListener('input', () => {
      const val = parseFloat(this.musicSlider.value) / 100;
      this.audioEngine.setMusicVolume(val);
      const data = this.saveManager.getData();
      data.settings.musicVolume = val;
      this.saveManager.save();
    });

    this.crtCheckbox.addEventListener('change', () => {
      const enabled = this.crtCheckbox.checked;
      const crtEl = document.querySelector('.crt-overlay') as HTMLElement | null;
      if (crtEl) {
        crtEl.style.display = enabled ? 'block' : 'none';
      }
      const data = this.saveManager.getData();
      data.settings.crtScanlines = enabled;
      this.saveManager.save();
    });

    this.autoAimCheckbox.addEventListener('change', () => {
      const enabled = this.autoAimCheckbox.checked;
      this.getRunState().autoAimEnabled = enabled;
      const data = this.saveManager.getData();
      data.settings.autoAim = enabled;
      this.saveManager.save();
    });

    this.resumeBtn.addEventListener('click', () => {
      this.hide();
      this.onResumeCallback?.();
    });

    this.abortBtn.addEventListener('click', () => {
      this.hide();
      this.onAbortCallback?.();
    });
  }

  public show(onResume: () => void, onAbort: () => void): void {
    this.onResumeCallback = onResume;
    this.onAbortCallback = onAbort;

    const settings = this.saveManager.getData().settings;
    this.masterSlider.value = Math.round(settings.masterVolume * 100).toString();
    this.sfxSlider.value = Math.round(settings.sfxVolume * 100).toString();
    this.musicSlider.value = Math.round(settings.musicVolume * 100).toString();
    this.crtCheckbox.checked = settings.crtScanlines;
    this.autoAimCheckbox.checked = this.getRunState().autoAimEnabled;

    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }
}
