import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ColorBlindMode, DamageNumberSetting, GameSettings, InputAction, InputMappingConfig, QualityPreset } from '../core/types';
import { globalEvents } from '../core/EventBus';
import type { GamepadManager } from '../input/GamepadManager';
import {
  DEFAULT_INPUT_MAPPINGS,
  detectKeyConflict,
  formatButtonLabel,
  formatKeyLabel
} from '../data/inputDefaults';
import { ModalA11y } from './A11yHelper';
import { SettingsApplier } from './SettingsApplier';

export class SettingsPanel {
  public readonly container: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private onCloseCallback?: () => void;
  private readonly a11y: ModalA11y;

  // Form controls
  private masterSlider!: HTMLInputElement;
  private musicSlider!: HTMLInputElement;
  private sfxSlider!: HTMLInputElement;
  private shakeSlider!: HTMLInputElement;
  private flashSlider!: HTMLInputElement;
  private reducedMotionCheckbox!: HTMLInputElement;
  private damageNumbersSelect!: HTMLSelectElement;
  private crtCheckbox!: HTMLInputElement;
  private qualityPresetSelect!: HTMLSelectElement;
  private autoAimCheckbox!: HTMLInputElement;
  private showFpsCheckbox!: HTMLInputElement;
  private colorBlindSelect!: HTMLSelectElement;
  private uiScaleSlider!: HTMLInputElement;

  // Labels for value display
  private masterVal!: HTMLElement;
  private musicVal!: HTMLElement;
  private sfxVal!: HTMLElement;
  private shakeVal!: HTMLElement;
  private flashVal!: HTMLElement;
  private uiScaleVal!: HTMLElement;

  private applyBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;

  private currentBindings: InputMappingConfig = JSON.parse(JSON.stringify(DEFAULT_INPUT_MAPPINGS));
  private listeningKeyAction: InputAction | null = null;
  private listeningGamepadAction: 'ability' | null = null;
  private keyRemapButtons: Map<InputAction, HTMLButtonElement> = new Map();
  private gpRemapButtons: Map<'ability', HTMLButtonElement> = new Map();
  private resetInputsBtn!: HTMLButtonElement;
  private remapFeedbackEl!: HTMLElement;
  private keydownHandler?: (e: KeyboardEvent) => void;

  private selectables: HTMLElement[] = [];
  private selectedIndex = 0;

  constructor(root: HTMLElement, saveManager: SaveManager, audioEngine: AudioEngine) {
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;

    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.id = 'settings-modal';
    this.container.style.display = 'none';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'System Settings');

    this.renderMarkup();
    root.appendChild(this.container);
    this.cacheElements();
    this.setupListeners();
    this.applyCurrentSettingsToDom(this.saveManager.getData().settings);

    this.a11y = new ModalA11y(this.container, {
      onClose: () => {
        this.closeBtn.click();
      },
      onNavigate: (dir) => {
        if (dir.y !== 0) {
          this.selectedIndex = (this.selectedIndex + dir.y + this.selectables.length) % this.selectables.length;
          this.updateHighlight();
          return true;
        }
        const curEl = this.selectables[this.selectedIndex];
        if (dir.x !== 0 && curEl instanceof HTMLInputElement && curEl.type === 'range') {
          const step = Number(curEl.step) || 5;
          const min = Number(curEl.min) || 0;
          const max = Number(curEl.max) || 100;
          const cur = Number(curEl.value);
          const next = Math.max(min, Math.min(max, cur + dir.x * step));
          curEl.value = next.toString();
          curEl.dispatchEvent(new Event('input'));
          return true;
        }
        return false;
      },
      onConfirm: () => {
        const curEl = this.selectables[this.selectedIndex];
        if (curEl instanceof HTMLInputElement && curEl.type === 'checkbox') {
          curEl.checked = !curEl.checked;
          curEl.dispatchEvent(new Event('change'));
          return true;
        }
        if (curEl instanceof HTMLButtonElement) {
          curEl.click();
          return true;
        }
        return false;
      }
    });
  }

  private renderMarkup(): void {
    this.container.innerHTML = `
      <div class="t800-modal-box" style="max-width:720px; max-height:90vh; overflow-y:auto; padding:24px;">
        <div class="t800-header" style="font-size:18px; margin-bottom:4px;">SYSTEM CALIBRATION // FIELD SETTINGS</div>
        <div class="t800-ticker" style="font-size:11px; margin-bottom:16px;">CONFIGURE AUDIO, VISUAL ACCESSIBILITY & TELEMETRY PROTOCOLS</div>

        <div style="display:flex; flex-direction:column; gap:14px; font-family:var(--font-tactical);">
          <!-- AUDIO SECTION -->
          <div style="border:1px solid rgba(77,210,255,0.25); border-radius:4px; padding:12px; background:rgba(10,20,32,0.6);">
            <div style="font-family:var(--font-display); font-size:12px; color:var(--color-cyan); margin-bottom:8px;">[AUDIO SYSTEMS]</div>
            
            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-master" style="font-size:13px;">Master Volume</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="setting-master" aria-label="Master Volume" min="0" max="100" step="5" style="width:140px;" />
                <span id="setting-master-val" style="font-family:var(--font-telemetry); font-size:12px; width:36px; text-align:right;">80%</span>
              </div>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-music" style="font-size:13px;">Music Intensity</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="setting-music" aria-label="Music Intensity" min="0" max="100" step="5" style="width:140px;" />
                <span id="setting-music-val" style="font-family:var(--font-telemetry); font-size:12px; width:36px; text-align:right;">70%</span>
              </div>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
              <label for="setting-sfx" style="font-size:13px;">Sound Effects</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="setting-sfx" aria-label="Sound Effects" min="0" max="100" step="5" style="width:140px;" />
                <span id="setting-sfx-val" style="font-family:var(--font-telemetry); font-size:12px; width:36px; text-align:right;">85%</span>
              </div>
            </div>
          </div>

          <!-- VISUAL & COMBAT FEEL SECTION -->
          <div style="border:1px solid rgba(255,153,0,0.25); border-radius:4px; padding:12px; background:rgba(10,20,32,0.6);">
            <div style="font-family:var(--font-display); font-size:12px; color:var(--color-amber); margin-bottom:8px;">[VISUAL & COMBAT FEEL]</div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-shake" style="font-size:13px;">Screen Shake Intensity</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="setting-shake" aria-label="Screen Shake Intensity" min="0" max="100" step="5" style="width:140px;" />
                <span id="setting-shake-val" style="font-family:var(--font-telemetry); font-size:12px; width:36px; text-align:right;">100%</span>
              </div>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-flash" style="font-size:13px;">Damage Flash Intensity</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="setting-flash" aria-label="Damage Flash Intensity" min="0" max="100" step="5" style="width:140px;" />
                <span id="setting-flash-val" style="font-family:var(--font-telemetry); font-size:12px; width:36px; text-align:right;">100%</span>
              </div>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-damage-numbers" style="font-size:13px;">Damage Numbers</label>
              <select id="setting-damage-numbers" aria-label="Damage Numbers" style="background:#0f1926; color:#fff; border:1px solid rgba(77,210,255,0.4); padding:4px 8px; border-radius:3px;">
                <option value="all">ALL (Standard)</option>
                <option value="crits">CRITICAL HITS ONLY</option>
                <option value="off">OFF (Clean HUD)</option>
              </select>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-crt" style="font-size:13px;">CRT Scanlines & Phosphor Glow</label>
              <input type="checkbox" id="setting-crt" aria-label="CRT Scanlines and Phosphor Glow" style="width:18px; height:18px;" />
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-quality" style="font-size:13px;">Graphics Quality Preset</label>
              <select id="setting-quality" aria-label="Graphics Quality Preset" style="background:#0f1926; color:#fff; border:1px solid rgba(77,210,255,0.4); padding:4px 8px; border-radius:3px;">
                <option value="low">LOW (720p / Min VFX)</option>
                <option value="medium">MEDIUM (Balanced / Bloom)</option>
                <option value="high">HIGH (1080p / Lights & Shadows)</option>
                <option value="ultra">ULTRA (1440p+ / Max Debris & Lights)</option>
              </select>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
              <label for="setting-autoaim" style="font-size:13px;">Auto-Aim Assist (Locks Nearest Threat)</label>
              <input type="checkbox" id="setting-autoaim" aria-label="Auto-Aim Assist" style="width:18px; height:18px;" />
            </div>
          </div>

          <!-- ACCESSIBILITY SECTION -->
          <div style="border:1px solid rgba(0,255,136,0.25); border-radius:4px; padding:12px; background:rgba(10,20,32,0.6);">
            <div style="font-family:var(--font-display); font-size:12px; color:#00ff88; margin-bottom:8px;">[ACCESSIBILITY & TELEMETRY]</div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div>
                <label for="setting-reduced-motion" style="font-size:13px; font-weight:700;">Reduced Motion</label>
                <div style="font-size:11px; color:#88a0b8;">Disables camera shake, hit-stop, and CRT pulsing.</div>
              </div>
              <input type="checkbox" id="setting-reduced-motion" aria-label="Reduced Motion" style="width:18px; height:18px;" />
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-colorblind" style="font-size:13px;">Color-Blind Filter Palette</label>
              <select id="setting-colorblind" aria-label="Color-Blind Filter Palette" style="background:#0f1926; color:#fff; border:1px solid rgba(77,210,255,0.4); padding:4px 8px; border-radius:3px;">
                <option value="none">STANDARD CYBERDYNE</option>
                <option value="deuteranopia">DEUTERANOPIA (Green-Weak)</option>
                <option value="protanopia">PROTANOPIA (Red-Weak)</option>
                <option value="tritanopia">TRITANOPIA (Blue-Weak)</option>
              </select>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label for="setting-ui-scale" style="font-size:13px;">UI Scale</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="setting-ui-scale" aria-label="UI Scale" min="80" max="150" step="5" style="width:140px;" />
                <span id="setting-ui-scale-val" style="font-family:var(--font-telemetry); font-size:12px; width:36px; text-align:right;">100%</span>
              </div>
            </div>

            <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
              <label for="setting-fps" style="font-size:13px;">Show Performance Telemetry (FPS / Frame Time)</label>
              <input type="checkbox" id="setting-fps" aria-label="Show Performance Telemetry" style="width:18px; height:18px;" />
            </div>
          </div>

          <!-- INPUT REMAPPING SECTION -->
          <div style="border:1px solid rgba(255,0,85,0.35); border-radius:4px; padding:12px; background:rgba(10,20,32,0.6);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-family:var(--font-display); font-size:12px; color:var(--color-danger);">[TACTICAL CONTROLS & INPUT REMAPPING]</div>
              <button class="btn-secondary" id="btn-reset-inputs" aria-label="Reset Controls" style="font-size:11px; padding:2px 8px;">RESET CONTROLS</button>
            </div>
            <div id="remap-feedback" style="display:none; font-family:var(--font-telemetry); font-size:11px; padding:4px 8px; margin-bottom:8px; border-radius:3px; background:rgba(255,153,0,0.15); border:1px solid var(--color-amber); color:var(--color-amber);"></div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px 16px; font-size:12px;">
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Move Up</span>
                <button class="remap-key-btn" data-action="moveUp" aria-label="Remap Move Up key" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">W</button>
              </div>
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Move Down</span>
                <button class="remap-key-btn" data-action="moveDown" aria-label="Remap Move Down key" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">S</button>
              </div>
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Move Left</span>
                <button class="remap-key-btn" data-action="moveLeft" aria-label="Remap Move Left key" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">A</button>
              </div>
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Move Right</span>
                <button class="remap-key-btn" data-action="moveRight" aria-label="Remap Move Right key" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">D</button>
              </div>
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Tactical Ability / EMP</span>
                <button class="remap-key-btn" data-action="ability" aria-label="Remap Ability key" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">E</button>
              </div>
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Pause / Tactical HUD</span>
                <button class="remap-key-btn" data-action="pause" aria-label="Remap Pause key" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">ESC</button>
              </div>
              <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Gamepad Ability</span>
                <button class="remap-gp-btn" data-gp-action="ability" aria-label="Remap Gamepad Ability button" style="min-width:85px; font-family:var(--font-telemetry); font-size:11px; padding:3px 6px; background:#142233; color:#fff; border:1px solid #3d6088; cursor:pointer;">BUTTON Y</button>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:20px;">
          <button class="btn-primary" id="btn-apply-settings" aria-label="Apply and Save Settings" style="min-width:140px;">APPLY & SAVE</button>
          <button class="btn-secondary" id="btn-reset-settings" aria-label="Reset Defaults" style="min-width:140px;">RESET DEFAULTS</button>
          <button class="btn-secondary" id="btn-close-settings" aria-label="Back to Previous Screen" style="min-width:100px;">BACK</button>
        </div>
        <div id="settings-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:8px; text-align:center;">
          [D-PAD] NAVIGATE &nbsp;//&nbsp; [LEFT/RIGHT] ADJUST &nbsp;//&nbsp; [A] CONFIRM &nbsp;//&nbsp; [B] BACK
        </div>
      </div>
    `;
  }

  private cacheElements(): void {
    this.masterSlider = this.container.querySelector('#setting-master')!;
    this.musicSlider = this.container.querySelector('#setting-music')!;
    this.sfxSlider = this.container.querySelector('#setting-sfx')!;
    this.shakeSlider = this.container.querySelector('#setting-shake')!;
    this.flashSlider = this.container.querySelector('#setting-flash')!;
    this.reducedMotionCheckbox = this.container.querySelector('#setting-reduced-motion')!;
    this.damageNumbersSelect = this.container.querySelector('#setting-damage-numbers')!;
    this.crtCheckbox = this.container.querySelector('#setting-crt')!;
    this.qualityPresetSelect = this.container.querySelector('#setting-quality')!;
    this.autoAimCheckbox = this.container.querySelector('#setting-autoaim')!;
    this.showFpsCheckbox = this.container.querySelector('#setting-fps')!;
    this.colorBlindSelect = this.container.querySelector('#setting-colorblind')!;
    this.uiScaleSlider = this.container.querySelector('#setting-ui-scale')!;

    this.masterVal = this.container.querySelector('#setting-master-val')!;
    this.musicVal = this.container.querySelector('#setting-music-val')!;
    this.sfxVal = this.container.querySelector('#setting-sfx-val')!;
    this.shakeVal = this.container.querySelector('#setting-shake-val')!;
    this.flashVal = this.container.querySelector('#setting-flash-val')!;
    this.uiScaleVal = this.container.querySelector('#setting-ui-scale-val')!;

    this.applyBtn = this.container.querySelector('#btn-apply-settings')!;
    this.resetBtn = this.container.querySelector('#btn-reset-settings')!;
    this.closeBtn = this.container.querySelector('#btn-close-settings')!;

    this.resetInputsBtn = this.container.querySelector('#btn-reset-inputs')!;
    this.remapFeedbackEl = this.container.querySelector('#remap-feedback')!;

    this.keyRemapButtons.clear();
    const keyBtns = this.container.querySelectorAll<HTMLButtonElement>('.remap-key-btn');
    keyBtns.forEach((btn) => {
      const act = btn.getAttribute('data-action') as InputAction;
      if (act) this.keyRemapButtons.set(act, btn);
    });

    this.gpRemapButtons.clear();
    const gpBtns = this.container.querySelectorAll<HTMLButtonElement>('.remap-gp-btn');
    gpBtns.forEach((btn) => {
      const act = btn.getAttribute('data-gp-action') as 'ability';
      if (act) this.gpRemapButtons.set(act, btn);
    });

    this.selectables = [
      this.masterSlider,
      this.musicSlider,
      this.sfxSlider,
      this.shakeSlider,
      this.flashSlider,
      this.damageNumbersSelect,
      this.crtCheckbox,
      this.qualityPresetSelect,
      this.autoAimCheckbox,
      this.reducedMotionCheckbox,
      this.colorBlindSelect,
      this.uiScaleSlider,
      this.showFpsCheckbox,
      this.resetInputsBtn,
      ...Array.from(this.keyRemapButtons.values()),
      ...Array.from(this.gpRemapButtons.values()),
      this.applyBtn,
      this.resetBtn,
      this.closeBtn
    ];
  }

  private setupListeners(): void {
    const updateLabels = () => {
      this.masterVal.textContent = `${this.masterSlider.value}%`;
      this.musicVal.textContent = `${this.musicSlider.value}%`;
      this.sfxVal.textContent = `${this.sfxSlider.value}%`;
      this.shakeVal.textContent = `${this.shakeSlider.value}%`;
      this.flashVal.textContent = `${this.flashSlider.value}%`;
      this.uiScaleVal.textContent = `${this.uiScaleSlider.value}%`;
    };

    this.masterSlider.addEventListener('input', updateLabels);
    this.musicSlider.addEventListener('input', updateLabels);
    this.sfxSlider.addEventListener('input', updateLabels);
    this.shakeSlider.addEventListener('input', updateLabels);
    this.flashSlider.addEventListener('input', updateLabels);
    this.uiScaleSlider.addEventListener('input', updateLabels);

    this.reducedMotionCheckbox.addEventListener('change', () => {
      if (this.reducedMotionCheckbox.checked) {
        this.shakeSlider.value = '0';
        this.crtCheckbox.checked = false;
        updateLabels();
      }
    });

    this.applyBtn.addEventListener('click', () => {
      this.saveFromInputs();
      this.audioEngine.playUpgradeApplied();
      this.hide();
      this.onCloseCallback?.();
    });

    this.resetBtn.addEventListener('click', () => {
      this.audioEngine.playUiBuy();
      this.loadDefaults();
      updateLabels();
    });

    this.closeBtn.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.hide();
      this.onCloseCallback?.();
    });

    // Input remapping listeners
    for (const [action, btn] of this.keyRemapButtons.entries()) {
      btn.addEventListener('click', () => this.startListeningKey(action));
    }

    for (const [action, btn] of this.gpRemapButtons.entries()) {
      btn.addEventListener('click', () => this.startListeningGamepad(action));
    }

    this.resetInputsBtn.addEventListener('click', () => {
      this.audioEngine.playUiBuy();
      this.currentBindings = JSON.parse(JSON.stringify(DEFAULT_INPUT_MAPPINGS));
      this.saveManager.updateInputBindings(this.currentBindings);
      globalEvents.emit('input:rebound', this.currentBindings);
      this.cancelListening();
      this.showFeedback('Tactical control mappings restored to factory preset.');
    });
  }

  public show(onClose?: () => void): void {
    this.onCloseCallback = onClose;
    this.audioEngine.playHudScanOpen();
    this.loadCurrentSettings();
    this.currentBindings = JSON.parse(JSON.stringify(this.saveManager.getInputBindings()));
    this.updateInputButtonLabels();
    if (this.remapFeedbackEl) this.remapFeedbackEl.style.display = 'none';
    this.container.style.display = 'flex';
    this.selectedIndex = 0;
    this.updateHighlight();
    this.a11y.activate(this.masterSlider);
  }

  public hide(): void {
    this.cancelListening();
    this.a11y.deactivate();
    this.container.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  private loadCurrentSettings(): void {
    const s = this.saveManager.getData().settings;
    this.masterSlider.value = Math.round(s.masterVolume * 100).toString();
    this.musicSlider.value = Math.round(s.musicVolume * 100).toString();
    this.sfxSlider.value = Math.round(s.sfxVolume * 100).toString();
    this.shakeSlider.value = s.screenShake.toString();
    this.flashSlider.value = s.flashIntensity.toString();
    this.reducedMotionCheckbox.checked = s.reducedMotion;
    this.damageNumbersSelect.value = s.damageNumbers;
    this.crtCheckbox.checked = s.crtScanlines;
    this.autoAimCheckbox.checked = s.autoAim;
    this.qualityPresetSelect.value = s.qualityPreset || 'high';
    this.showFpsCheckbox.checked = s.showFps;
    this.colorBlindSelect.value = s.colorBlindMode;
    this.uiScaleSlider.value = s.uiScale.toString();

    this.masterVal.textContent = `${this.masterSlider.value}%`;
    this.musicVal.textContent = `${this.musicSlider.value}%`;
    this.sfxVal.textContent = `${this.sfxSlider.value}%`;
    this.shakeVal.textContent = `${this.shakeSlider.value}%`;
    this.flashVal.textContent = `${this.flashSlider.value}%`;
    this.uiScaleVal.textContent = `${this.uiScaleSlider.value}%`;
  }

  private loadDefaults(): void {
    const isReduced = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    this.masterSlider.value = '80';
    this.musicSlider.value = '70';
    this.sfxSlider.value = '85';
    this.shakeSlider.value = isReduced ? '0' : '100';
    this.flashSlider.value = '100';
    this.reducedMotionCheckbox.checked = isReduced;
    this.damageNumbersSelect.value = 'all';
    this.crtCheckbox.checked = !isReduced;
    this.qualityPresetSelect.value = 'high';
    this.autoAimCheckbox.checked = true;
    this.showFpsCheckbox.checked = false;
    this.colorBlindSelect.value = 'none';
    this.uiScaleSlider.value = '100';
  }

  private saveFromInputs(): void {
    const s: GameSettings = {
      masterVolume: parseInt(this.masterSlider.value, 10) / 100,
      musicVolume: parseInt(this.musicSlider.value, 10) / 100,
      sfxVolume: parseInt(this.sfxSlider.value, 10) / 100,
      screenShake: parseInt(this.shakeSlider.value, 10),
      flashIntensity: parseInt(this.flashSlider.value, 10),
      reducedMotion: this.reducedMotionCheckbox.checked,
      damageNumbers: this.damageNumbersSelect.value as DamageNumberSetting,
      crtScanlines: this.crtCheckbox.checked,
      qualityPreset: (this.qualityPresetSelect.value as QualityPreset) || 'high',
      autoAim: this.autoAimCheckbox.checked,
      showFps: this.showFpsCheckbox.checked,
      colorBlindMode: this.colorBlindSelect.value as ColorBlindMode,
      uiScale: parseInt(this.uiScaleSlider.value, 10)
    };

    this.saveManager.updateSettings(s);
    this.applyCurrentSettingsToDom(s);
    globalEvents.emit('settings:updated', s);
  }

  public applyCurrentSettingsToDom(s: GameSettings): void {
    SettingsApplier.apply(s, this.audioEngine);
  }

  public handleGamepadMenuNavigation(gp: GamepadManager, dt: number): boolean {
    if (!this.isVisible()) return false;

    // If currently remapping a gamepad action, intercept the next button pressed
    if (this.listeningGamepadAction) {
      if (gp.isMenuCancelPressed()) {
        this.showFeedback('Gamepad remapping canceled.');
        this.cancelListening();
        return true;
      }
      for (let b = 0; b <= 15; b++) {
        if (gp.isButtonJustPressed(b)) {
          const act = this.listeningGamepadAction;
          this.currentBindings.gamepad[act] = [b];
          this.saveManager.updateInputBindings(this.currentBindings);
          globalEvents.emit('input:rebound', this.currentBindings);
          this.showFeedback(`Bound [${formatButtonLabel(b)}] to gamepad ${act}.`);
          gp.playRumble(50, 0.25, 0.4);
          this.cancelListening();
          return true;
        }
      }
      return true;
    }

    const nav = gp.getMenuNavigation(dt);
    if (nav.y !== 0) {
      this.selectedIndex = (this.selectedIndex + nav.y + this.selectables.length) % this.selectables.length;
      this.updateHighlight();
      gp.playRumble(25, 0.05, 0.2);
      return true;
    }

    const curEl = this.selectables[this.selectedIndex];
    if (nav.x !== 0 && curEl instanceof HTMLInputElement && curEl.type === 'range') {
      const step = Number(curEl.step) || 5;
      const min = Number(curEl.min) || 0;
      const max = Number(curEl.max) || 100;
      const cur = Number(curEl.value);
      const next = Math.max(min, Math.min(max, cur + nav.x * step));
      curEl.value = next.toString();
      curEl.dispatchEvent(new Event('input'));
      gp.playRumble(15, 0.03, 0.15);
      return true;
    }

    if (gp.isMenuConfirmPressed()) {
      if (curEl instanceof HTMLInputElement && curEl.type === 'checkbox') {
        curEl.checked = !curEl.checked;
        curEl.dispatchEvent(new Event('change'));
      } else if (curEl instanceof HTMLButtonElement) {
        curEl.click();
      }
      gp.playRumble(50, 0.2, 0.3);
      return true;
    }

    if (gp.isMenuCancelPressed()) {
      this.closeBtn.click();
      gp.playRumble(30, 0.1, 0.2);
      return true;
    }

    return true;
  }

  public updateInputButtonLabels(): void {
    for (const [action, btn] of this.keyRemapButtons.entries()) {
      if (this.listeningKeyAction === action) {
        btn.textContent = '[PRESS KEY...]';
        btn.style.borderColor = 'var(--color-cyan)';
        btn.style.color = 'var(--color-cyan)';
      } else {
        const keys = this.currentBindings.keyboard[action] || [];
        btn.textContent = keys.length > 0 ? keys.map(formatKeyLabel).join(' / ') : 'NONE';
        btn.style.borderColor = '#3d6088';
        btn.style.color = '#fff';
      }
    }

    for (const [action, btn] of this.gpRemapButtons.entries()) {
      if (this.listeningGamepadAction === action) {
        btn.textContent = '[PRESS BTN...]';
        btn.style.borderColor = 'var(--color-cyan)';
        btn.style.color = 'var(--color-cyan)';
      } else {
        const btns = this.currentBindings.gamepad[action] || [];
        btn.textContent = btns.length > 0 ? btns.map(formatButtonLabel).join(' / ') : 'NONE';
        btn.style.borderColor = '#3d6088';
        btn.style.color = '#fff';
      }
    }
  }

  private showFeedback(msg: string, isError = false): void {
    if (!this.remapFeedbackEl) return;
    this.remapFeedbackEl.style.display = 'block';
    this.remapFeedbackEl.textContent = msg;
    this.remapFeedbackEl.style.color = isError ? 'var(--color-danger)' : 'var(--color-amber)';
    this.remapFeedbackEl.style.borderColor = isError ? 'var(--color-danger)' : 'var(--color-amber)';
  }

  public startListeningKey(action: InputAction): void {
    this.cancelListening();
    this.listeningKeyAction = action;
    this.updateInputButtonLabels();
    this.showFeedback(`Awaiting key assignment for [${action.toUpperCase()}]. Press any key or ESC to cancel.`);

    this.keydownHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape' && action !== 'pause') {
        this.showFeedback('Key remapping canceled.');
        this.cancelListening();
        return;
      }

      // Check conflict
      const conflict = detectKeyConflict(this.currentBindings.keyboard, action, e.code);
      if (conflict.hasConflict && conflict.conflictedAction) {
        this.currentBindings.keyboard[conflict.conflictedAction] = this.currentBindings.keyboard[conflict.conflictedAction].filter((k) => k !== e.code);
        this.showFeedback(`Reassigned [${formatKeyLabel(e.code)}] from ${conflict.conflictedAction} to ${action}.`);
      } else {
        this.showFeedback(`Bound [${formatKeyLabel(e.code)}] to ${action}.`);
      }

      this.currentBindings.keyboard[action] = [e.code];
      this.saveManager.updateInputBindings(this.currentBindings);
      globalEvents.emit('input:rebound', this.currentBindings);
      this.audioEngine.playUpgradeApplied();
      this.cancelListening();
    };

    window.addEventListener('keydown', this.keydownHandler, { capture: true, once: true });
  }

  public startListeningGamepad(action: 'ability'): void {
    this.cancelListening();
    this.listeningGamepadAction = action;
    this.updateInputButtonLabels();
    this.showFeedback(`Awaiting controller button for [${action.toUpperCase()}]. Press any button...`);
  }

  public cancelListening(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = undefined;
    }
    this.listeningKeyAction = null;
    this.listeningGamepadAction = null;
    this.updateInputButtonLabels();
  }

  private updateHighlight(): void {
    for (let i = 0; i < this.selectables.length; i++) {
      const el = this.selectables[i];
      if (i === this.selectedIndex) {
        el.style.outline = '2px solid var(--color-cyan)';
        el.style.outlineOffset = '2px';
        el.focus();
      } else {
        el.style.outline = 'none';
      }
    }
  }
}
