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
    this.container.setAttribute('aria-label', 'Settings');

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
      <div class="t800-modal-box" style="max-width:720px;">
        <div class="t800-header">SETTINGS</div>

        <div class="settings-section">
          <div class="t-section-label">AUDIO</div>
          <div class="settings-row">
            <label for="setting-master">MASTER</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="setting-master" aria-label="Master Volume" min="0" max="100" step="5" />
              <span id="setting-master-val" class="settings-val">80%</span>
            </div>
          </div>
          <div class="settings-row">
            <label for="setting-music">MUSIC</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="setting-music" aria-label="Music Volume" min="0" max="100" step="5" />
              <span id="setting-music-val" class="settings-val">70%</span>
            </div>
          </div>
          <div class="settings-row">
            <label for="setting-sfx">SFX</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="setting-sfx" aria-label="Sound Effects" min="0" max="100" step="5" />
              <span id="setting-sfx-val" class="settings-val">85%</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="t-section-label">VISUAL</div>
          <div class="settings-row">
            <label for="setting-shake">SCREEN SHAKE</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="setting-shake" aria-label="Screen Shake Intensity" min="0" max="100" step="5" />
              <span id="setting-shake-val" class="settings-val">100%</span>
            </div>
          </div>
          <div class="settings-row">
            <label for="setting-flash">DAMAGE FLASH</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="setting-flash" aria-label="Damage Flash Intensity" min="0" max="100" step="5" />
              <span id="setting-flash-val" class="settings-val">100%</span>
            </div>
          </div>
          <div class="settings-row">
            <label for="setting-damage-numbers">DAMAGE NUMBERS</label>
            <select id="setting-damage-numbers" aria-label="Damage Numbers">
              <option value="all">ALL</option>
              <option value="crits">CRITS ONLY</option>
              <option value="off">OFF</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="setting-crt">SCANLINES</label>
            <input type="checkbox" id="setting-crt" aria-label="Scanlines" />
          </div>
          <div class="settings-row">
            <label for="setting-quality">QUALITY</label>
            <select id="setting-quality" aria-label="Graphics Quality Preset">
              <option value="low">LOW</option>
              <option value="medium">MEDIUM</option>
              <option value="high">HIGH</option>
              <option value="ultra">ULTRA</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="setting-autoaim">AUTO-AIM</label>
            <input type="checkbox" id="setting-autoaim" aria-label="Auto-Aim Assist" />
          </div>
        </div>

        <div class="settings-section">
          <div class="t-section-label">ACCESSIBILITY</div>
          <div class="settings-row">
            <div>
              <label for="setting-reduced-motion">REDUCED MOTION</label>
              <div class="t-muted" style="font-size:10px;">NO SHAKE, HIT-STOP OR SCANLINES</div>
            </div>
            <input type="checkbox" id="setting-reduced-motion" aria-label="Reduced Motion" />
          </div>
          <div class="settings-row">
            <label for="setting-colorblind">COLOUR PALETTE</label>
            <select id="setting-colorblind" aria-label="Colour-Blind Palette">
              <option value="none">STANDARD</option>
              <option value="deuteranopia">DEUTERANOPIA</option>
              <option value="protanopia">PROTANOPIA</option>
              <option value="tritanopia">TRITANOPIA</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="setting-ui-scale">UI SCALE</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="setting-ui-scale" aria-label="UI Scale" min="80" max="150" step="5" />
              <span id="setting-ui-scale-val" class="settings-val">100%</span>
            </div>
          </div>
          <div class="settings-row">
            <label for="setting-fps">SHOW FPS</label>
            <input type="checkbox" id="setting-fps" aria-label="Show FPS" />
          </div>
        </div>

        <div class="settings-section">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="t-section-label">CONTROLS</div>
            <button class="btn-secondary btn-sm" id="btn-reset-inputs" aria-label="Reset Controls">RESET</button>
          </div>
          <div id="remap-feedback" class="remap-feedback"></div>
          <div class="remap-grid">
            <div class="settings-row"><span>MOVE UP</span><button class="remap-key-btn" data-action="moveUp" aria-label="Remap Move Up key">W</button></div>
            <div class="settings-row"><span>MOVE DOWN</span><button class="remap-key-btn" data-action="moveDown" aria-label="Remap Move Down key">S</button></div>
            <div class="settings-row"><span>MOVE LEFT</span><button class="remap-key-btn" data-action="moveLeft" aria-label="Remap Move Left key">A</button></div>
            <div class="settings-row"><span>MOVE RIGHT</span><button class="remap-key-btn" data-action="moveRight" aria-label="Remap Move Right key">D</button></div>
            <div class="settings-row"><span>ABILITY</span><button class="remap-key-btn" data-action="ability" aria-label="Remap Ability key">E</button></div>
            <div class="settings-row"><span>PAUSE</span><button class="remap-key-btn" data-action="pause" aria-label="Remap Pause key">ESC</button></div>
            <div class="settings-row"><span>GAMEPAD ABILITY</span><button class="remap-gp-btn" data-gp-action="ability" aria-label="Remap Gamepad Ability button">BUTTON Y</button></div>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn-primary" id="btn-apply-settings" aria-label="Apply and Save Settings">APPLY</button>
          <button class="btn-secondary" id="btn-reset-settings" aria-label="Reset Defaults">DEFAULTS</button>
          <button class="btn-secondary" id="btn-close-settings" aria-label="Back">BACK</button>
        </div>
        <div class="t-hint" id="settings-controller-hint">
          [D-PAD] NAVIGATE &nbsp; [LEFT / RIGHT] ADJUST &nbsp; [A] CONFIRM &nbsp; [B] BACK
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
      this.showFeedback('Controls reset to defaults.');
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
      const listening = this.listeningKeyAction === action;
      btn.classList.toggle('is-listening', listening);
      if (listening) {
        btn.textContent = 'PRESS KEY';
      } else {
        const keys = this.currentBindings.keyboard[action] || [];
        btn.textContent = keys.length > 0 ? keys.map(formatKeyLabel).join(' / ') : 'NONE';
      }
    }

    for (const [action, btn] of this.gpRemapButtons.entries()) {
      const listening = this.listeningGamepadAction === action;
      btn.classList.toggle('is-listening', listening);
      if (listening) {
        btn.textContent = 'PRESS BUTTON';
      } else {
        const btns = this.currentBindings.gamepad[action] || [];
        btn.textContent = btns.length > 0 ? btns.map(formatButtonLabel).join(' / ') : 'NONE';
      }
    }
  }

  private showFeedback(msg: string, isError = false): void {
    if (!this.remapFeedbackEl) return;
    this.remapFeedbackEl.style.display = 'block';
    this.remapFeedbackEl.textContent = msg;
    this.remapFeedbackEl.classList.toggle('t-red', isError);
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
      el.classList.toggle('controller-selected', i === this.selectedIndex);
      if (i === this.selectedIndex) el.focus();
    }
  }
}
