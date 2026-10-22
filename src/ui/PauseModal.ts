import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { RunState } from '../state/RunState';
import type { GamepadManager } from '../input/GamepadManager';
import { BASE_WEAPONS, EVOLUTION_LEVEL, EVOLVED_WEAPONS, PASSIVES } from '../data/weapons';
import type { BaseWeaponId, WeaponId } from '../core/types';
import { ModalA11y } from './A11yHelper';
import { iconLabel, passiveIcon, weaponIcon } from './icons';

export class PauseModal {
  public readonly container: HTMLElement;
  private readonly masterSlider: HTMLInputElement;
  private readonly sfxSlider: HTMLInputElement;
  private readonly musicSlider: HTMLInputElement;
  private readonly crtCheckbox: HTMLInputElement;
  private readonly autoAimCheckbox: HTMLInputElement;
  private readonly resumeBtn: HTMLButtonElement;
  private readonly settingsBtn: HTMLButtonElement;
  private readonly abortBtn: HTMLButtonElement;

  public onResumeCallback: (() => void) | null = null;
  public onAbortCallback: (() => void) | null = null;
  public onOpenSettings?: () => void;

  private selectedRowIndex = 0;
  private readonly rows: HTMLElement[] = [];
  private readonly a11y: ModalA11y;

  constructor(
    root: HTMLElement,
    private readonly saveManager: SaveManager,
    private readonly audioEngine: AudioEngine,
    private readonly getRunState: () => RunState
  ) {
    this.container = document.createElement('div');
    this.container.id = 'pause-modal';
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'pause-modal');
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Paused');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box">
        <div class="t800-header">PAUSED</div>

        <div class="t-section-label">LOADOUT</div>
        <div id="pause-arsenal-list" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0 16px;"></div>

        <div class="t-section-label">EVOLUTIONS</div>
        <div id="pause-recipes-list" style="max-height:160px; overflow-y:auto; padding-right:4px;"></div>

        <div class="t-section-label">OPTIONS</div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div class="pause-setting-row" id="pause-row-0">
            <label for="pause-slider-master">MASTER</label>
            <input type="range" min="0" max="100" id="pause-slider-master" aria-label="Master Volume" />
          </div>
          <div class="pause-setting-row" id="pause-row-1">
            <label for="pause-slider-sfx">SFX</label>
            <input type="range" min="0" max="100" id="pause-slider-sfx" aria-label="SFX Volume" />
          </div>
          <div class="pause-setting-row" id="pause-row-2">
            <label for="pause-slider-music">MUSIC</label>
            <input type="range" min="0" max="100" id="pause-slider-music" aria-label="Music Volume" />
          </div>
          <div class="pause-setting-row" id="pause-row-3">
            <label for="pause-toggle-crt">SCANLINES</label>
            <input type="checkbox" id="pause-toggle-crt" aria-label="Scanlines" />
          </div>
          <div class="pause-setting-row" id="pause-row-4">
            <label for="pause-toggle-autoaim">AUTO-AIM</label>
            <input type="checkbox" id="pause-toggle-autoaim" aria-label="Auto-Aim" />
          </div>
        </div>

        <div class="btn-row">
          <button class="btn-primary" data-testid="btn-pause-resume" id="btn-pause-resume" aria-label="Resume">${iconLabel('resume', 'RESUME')}</button>
          <button class="btn-secondary" id="btn-pause-settings" aria-label="Settings">${iconLabel('settings', 'SETTINGS')}</button>
          <button class="btn-secondary" data-testid="btn-pause-abort" id="btn-pause-abort" aria-label="Abort Mission">${iconLabel('exit', 'ABORT')}</button>
        </div>

        <div class="t-hint" id="pause-controller-hint" style="display:none;">
          [D-PAD / ARROWS] NAVIGATE / ADJUST &nbsp; [A / ENTER] TOGGLE &nbsp; [B / START] RESUME
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
    this.settingsBtn = this.container.querySelector('#btn-pause-settings')!;
    this.abortBtn = this.container.querySelector('#btn-pause-abort')!;

    this.rows = [
      this.container.querySelector('#pause-row-0')!,
      this.container.querySelector('#pause-row-1')!,
      this.container.querySelector('#pause-row-2')!,
      this.container.querySelector('#pause-row-3')!,
      this.container.querySelector('#pause-row-4')!,
      this.resumeBtn,
      this.settingsBtn,
      this.abortBtn
    ];

    this.a11y = new ModalA11y(this.container, {
      onClose: () => {
        this.resumeBtn.click();
      },
      onNavigate: (dir) => {
        if (dir.y !== 0) {
          this.selectedRowIndex = (this.selectedRowIndex + dir.y + this.rows.length) % this.rows.length;
          this.updateRowHighlight();
          return true;
        }
        if (dir.x !== 0 && this.selectedRowIndex <= 2) {
          const slider = this.rows[this.selectedRowIndex].querySelector('input') as HTMLInputElement | null;
          if (slider) {
            const cur = parseInt(slider.value, 10);
            slider.value = Math.max(0, Math.min(100, cur + dir.x * 5)).toString();
            slider.dispatchEvent(new Event('input'));
            return true;
          }
        }
        return false;
      },
      onConfirm: () => {
        if (this.selectedRowIndex === 3) {
          this.crtCheckbox.checked = !this.crtCheckbox.checked;
          this.crtCheckbox.dispatchEvent(new Event('change'));
          return true;
        }
        if (this.selectedRowIndex === 4) {
          this.autoAimCheckbox.checked = !this.autoAimCheckbox.checked;
          this.autoAimCheckbox.dispatchEvent(new Event('change'));
          return true;
        }
        if (this.selectedRowIndex === 5) {
          this.resumeBtn.click();
          return true;
        }
        if (this.selectedRowIndex === 6) {
          this.settingsBtn.click();
          return true;
        }
        if (this.selectedRowIndex === 7) {
          this.abortBtn.click();
          return true;
        }
        return false;
      }
    });

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

    this.settingsBtn.addEventListener('click', () => {
      this.hide();
      this.onOpenSettings?.();
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

    this.renderArsenalAndRecipes();

    this.selectedRowIndex = 5; // Default focus on Resume Mission
    this.container.style.display = 'flex';
    this.updateRowHighlight();
    this.a11y.activate(this.resumeBtn);
  }

  private renderArsenalAndRecipes(): void {
    const runState = this.getRunState();
    const arsenalList = this.container.querySelector('#pause-arsenal-list');
    const recipesList = this.container.querySelector('#pause-recipes-list');
    if (!arsenalList || !recipesList) return;

    arsenalList.innerHTML = '';
    recipesList.innerHTML = '';

    // 1. Equipped Arsenal
    const weaponEntries = Array.from(runState.weapons.entries());
    const passiveEntries = Array.from(runState.passives.entries());

    if (weaponEntries.length === 0 && passiveEntries.length === 0) {
      arsenalList.innerHTML = '<div class="t-muted" style="font-size:12px;">NOTHING EQUIPPED</div>';
    } else {
      const addItem = (iconSvg: string, name: string, badge: string): void => {
        const item = document.createElement('div');
        item.className = 't-row';
        item.innerHTML = `
          <span style="display:flex; align-items:center; gap:6px;"><span class="t-accent">${iconSvg}</span>${name}</span>
          <span class="t-muted">${badge}</span>
        `;
        arsenalList.appendChild(item);
      };

      for (const [wId, slot] of weaponEntries) {
        const baseDef = BASE_WEAPONS[wId as BaseWeaponId];
        const evolvedDef = EVOLVED_WEAPONS[wId as keyof typeof EVOLVED_WEAPONS];
        const name = slot.evolved ? (evolvedDef?.name ?? wId) : (baseDef?.name ?? wId);
        addItem(weaponIcon(wId as WeaponId, { size: 16 }), name, slot.evolved ? 'EVOLVED' : `LV ${slot.level}/8`);
      }

      for (const [pId, lv] of passiveEntries) {
        const def = PASSIVES[pId];
        if (!def) continue;
        addItem(passiveIcon(pId, { size: 16 }), def.name, `LV ${lv}/${def.maxLevel}`);
      }
    }

    // 2. Evolution Recipes
    for (const [bId, bDef] of Object.entries(BASE_WEAPONS)) {
      if (!bDef.pairedPassive || !bDef.evolvesInto) continue;
      const pDef = PASSIVES[bDef.pairedPassive];
      const eDef = EVOLVED_WEAPONS[bDef.evolvesInto];
      if (!pDef || !eDef) continue;

      const weaponSlot = runState.weapons.get(bId as WeaponId);
      const weaponLv = weaponSlot?.level ?? 0;
      const isEvolved = weaponSlot?.evolved ?? false;
      const passiveLv = runState.passives.get(bDef.pairedPassive) ?? 0;
      const isReady = weaponLv >= EVOLUTION_LEVEL && passiveLv >= 1 && !isEvolved;

      const row = document.createElement('div');
      row.className = 't-row';
      row.style.fontSize = '11px';

      let statusBadge = '<span class="t-muted">—</span>';
      if (isEvolved) {
        statusBadge = '<span>EVOLVED</span>';
      } else if (isReady) {
        statusBadge = '<span class="t-tag t-tag-on">READY</span>';
      } else if (weaponLv > 0 || passiveLv > 0) {
        statusBadge = `<span class="t-muted">W ${weaponLv}/8 · P ${passiveLv}/1</span>`;
      }

      row.innerHTML = `
        <span>
          <span class="${weaponLv > 0 ? '' : 't-muted'}">${bDef.name}</span>
          <span class="t-muted">+</span>
          <span class="${passiveLv > 0 ? '' : 't-muted'}">${pDef.name}</span>
          <span class="t-muted">→</span>
          <span class="t-accent">${eDef.name}</span>
        </span>
        ${statusBadge}
      `;
      recipesList.appendChild(row);
    }
  }

  public updateRowHighlight(): void {
    this.rows.forEach((r, i) => {
      r.classList.toggle('controller-selected', i === this.selectedRowIndex);
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
      this.selectedRowIndex = (this.selectedRowIndex + nav.y + this.rows.length) % this.rows.length;
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
        this.settingsBtn.click();
        return true;
      }
      if (this.selectedRowIndex === 7) {
        gp.playRumble(60, 0.25, 0.4);
        this.abortBtn.click();
        return true;
      }
    }

    return true;
  }

  public hide(): void {
    this.a11y.deactivate();
    this.container.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }
}
