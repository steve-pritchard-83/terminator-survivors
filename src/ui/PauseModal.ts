import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { RunState } from '../state/RunState';
import type { GamepadManager } from '../input/GamepadManager';

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

  private selectedRowIndex = 0;
  private readonly rows: HTMLElement[] = [];

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
          <div class="pause-setting-row" id="pause-row-0" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:3px; transition:background 0.15s ease;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">MASTER AUDIO</label>
            <input type="range" min="0" max="100" id="pause-slider-master" style="width:160px; accent-color:var(--color-cyan); cursor:pointer;" />
          </div>

          <!-- SFX Volume -->
          <div class="pause-setting-row" id="pause-row-1" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:3px; transition:background 0.15s ease;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">SFX WEAPONS</label>
            <input type="range" min="0" max="100" id="pause-slider-sfx" style="width:160px; accent-color:var(--color-red); cursor:pointer;" />
          </div>

          <!-- Music Volume -->
          <div class="pause-setting-row" id="pause-row-2" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:3px; transition:background 0.15s ease;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">SYNTHWAVE BGM</label>
            <input type="range" min="0" max="100" id="pause-slider-music" style="width:160px; accent-color:var(--color-amber); cursor:pointer;" />
          </div>

          <!-- CRT Scanlines -->
          <div class="pause-setting-row" id="pause-row-3" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:3px; transition:background 0.15s ease;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">CRT SCANLINE EMULATION</label>
            <input type="checkbox" id="pause-toggle-crt" style="width:20px; height:20px; accent-color:var(--color-cyan); cursor:pointer;" />
          </div>

          <!-- Auto-Aim -->
          <div class="pause-setting-row" id="pause-row-4" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:3px; transition:background 0.15s ease;">
            <label style="color:var(--color-chrome); font-size:14px; letter-spacing:1px;">TARGET LOCK AUTO-AIM</label>
            <input type="checkbox" id="pause-toggle-autoaim" style="width:20px; height:20px; accent-color:var(--color-cyan); cursor:pointer;" />
          </div>
        </div>

        <div style="display:flex; gap:16px; justify-content:center; margin-top:8px;">
          <button class="btn-primary" data-testid="btn-pause-resume" id="btn-pause-resume" style="flex:1;">RESUME MISSION</button>
          <button class="btn-secondary" data-testid="btn-pause-abort" id="btn-pause-abort" style="flex:1; border-color:var(--color-red); color:var(--color-red);">ABORT MISSION</button>
        </div>

        <div id="pause-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:14px; text-align:center; display:none;">
          [D-PAD] NAVIGATE / ADJUST &nbsp;//&nbsp; [A] TOGGLE &nbsp;//&nbsp; [B / START] RESUME
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

    this.rows = [
      this.container.querySelector('#pause-row-0')!,
      this.container.querySelector('#pause-row-1')!,
      this.container.querySelector('#pause-row-2')!,
      this.container.querySelector('#pause-row-3')!,
      this.container.querySelector('#pause-row-4')!,
      this.resumeBtn,
      this.abortBtn
    ];

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

    this.selectedRowIndex = 5; // Default focus on Resume Mission
    this.container.style.display = 'flex';
    this.updateRowHighlight();
  }

  public updateRowHighlight(): void {
    this.rows.forEach((r, i) => {
      if (i === this.selectedRowIndex) {
        r.classList.add('controller-selected');
        if (i < 5) {
          r.style.background = 'rgba(77, 210, 255, 0.15)';
          r.style.border = '1px solid var(--color-cyan)';
        }
      } else {
        r.classList.remove('controller-selected');
        if (i < 5) {
          r.style.background = 'transparent';
          r.style.border = '1px solid transparent';
        }
      }
    });
  }

  public handleGamepad(gp: GamepadManager, dt: number): boolean {
    if (!this.isVisible()) return false;

    // Show controller hint if connected
    const hintEl = this.container.querySelector('#pause-controller-hint') as HTMLElement | null;
    if (hintEl) {
      hintEl.style.display = gp.hasActiveController ? 'block' : 'none';
    }

    // B Button or Menu/Start Button resumes mission
    if (gp.isMenuCancelPressed() || gp.consumePause()) {
      gp.playRumble(40, 0.15, 0.3);
      this.resumeBtn.click();
      return true;
    }

    const nav = gp.getMenuNavigation(dt);
    if (nav.y !== 0) {
      this.selectedRowIndex =
        (this.selectedRowIndex + nav.y + this.rows.length) % this.rows.length;
      this.updateRowHighlight();
      gp.playRumble(25, 0.05, 0.2);
      return true;
    }

    // Slider adjustment with left / right
    if (nav.x !== 0 && this.selectedRowIndex <= 2) {
      let slider: HTMLInputElement | null = null;
      if (this.selectedRowIndex === 0) slider = this.masterSlider;
      else if (this.selectedRowIndex === 1) slider = this.sfxSlider;
      else if (this.selectedRowIndex === 2) slider = this.musicSlider;

      if (slider) {
        const cur = parseInt(slider.value, 10);
        const next = Math.max(0, Math.min(100, cur + nav.x * 5));
        slider.value = next.toString();
        slider.dispatchEvent(new Event('input'));
        gp.playRumble(20, 0.05, 0.25);
        return true;
      }
    }

    // Confirm button (A)
    if (gp.isMenuConfirmPressed()) {
      if (this.selectedRowIndex === 3) {
        this.crtCheckbox.checked = !this.crtCheckbox.checked;
        this.crtCheckbox.dispatchEvent(new Event('change'));
        gp.playRumble(45, 0.15, 0.35);
        return true;
      }
      if (this.selectedRowIndex === 4) {
        this.autoAimCheckbox.checked = !this.autoAimCheckbox.checked;
        this.autoAimCheckbox.dispatchEvent(new Event('change'));
        gp.playRumble(45, 0.15, 0.35);
        return true;
      }
      if (this.selectedRowIndex === 5) {
        gp.playRumble(60, 0.25, 0.4);
        this.resumeBtn.click();
        return true;
      }
      if (this.selectedRowIndex === 6) {
        gp.playRumble(60, 0.25, 0.4);
        this.abortBtn.click();
        return true;
      }
    }

    return true;
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }
}
