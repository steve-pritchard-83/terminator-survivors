import type { SaveManager } from '../state/SaveManager';
import type { InputManager } from '../input/InputManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { RunState } from '../state/RunState';
import { HUDView } from './HUDView';
import { TitleScreen } from './TitleScreen';
import { LevelUpModal } from './LevelUpModal';
import { VaultJackpotModal } from './VaultJackpotModal';
import { EndRunModal } from './EndRunModal';
import { PauseModal } from './PauseModal';
import type { SettingsPanel } from './SettingsPanel';
import type { RunConfig } from '../core/types';

export class UIManager {
  public readonly hudView: HUDView;
  public readonly titleScreen: TitleScreen;
  public readonly levelUpModal: LevelUpModal;
  public readonly vaultModal: VaultJackpotModal;
  public readonly endRunModal: EndRunModal;
  public readonly pauseModal: PauseModal;
  public settingsPanel: SettingsPanel | null = null;
  private readonly root: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    inputManager: InputManager,
    audioEngine: AudioEngine,
    onStartRun: (config: RunConfig) => void,
    getRunState: () => RunState
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;
    this.hudView = new HUDView(root);
    this.endRunModal = new EndRunModal(root, saveManager, audioEngine);
    this.titleScreen = new TitleScreen(
      root,
      saveManager,
      audioEngine,
      onStartRun,
      () => this.endRunModal.showArchives(() => this.titleScreen.show()),
      () => this.openSettings(() => this.titleScreen.show())
    );
    this.levelUpModal = new LevelUpModal(root);
    this.vaultModal = new VaultJackpotModal(root);
    this.pauseModal = new PauseModal(root, saveManager, audioEngine, getRunState);
    this.pauseModal.onOpenSettings = () => {
      this.openSettings(() => {
        if (this.pauseModal.onResumeCallback && this.pauseModal.onAbortCallback) {
          this.pauseModal.show(this.pauseModal.onResumeCallback, this.pauseModal.onAbortCallback);
        }
      });
    };

    // Global UI Hover Beep & Button Click WAV Sound Hooks
    let lastHoveredEl: Element | null = null;
    root.addEventListener('pointerover', (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const target = (e.target as HTMLElement | null)?.closest?.(
        'button, .upgrade-card, [data-loadout-card]'
      );
      if (target && target !== lastHoveredEl) {
        lastHoveredEl = target;
        audioEngine.playUiBeep();
      } else if (!target) {
        lastHoveredEl = null;
      }
    });

    root.addEventListener('click', (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('button');
      if (btn) {
        audioEngine.playUiClick();
      }
    });

    // Setup Mobile Touch Joystick with HUD elements
    const touchZone = root.querySelector('#touch-zone-left') as HTMLElement;
    const joystickBase = root.querySelector('#joystick-base') as HTMLElement;
    const joystickKnob = root.querySelector('#joystick-knob') as HTMLElement;
    const dashBtn = root.querySelector('#btn-mobile-dash') as HTMLElement;
    const abilityBtn = root.querySelector('#btn-mobile-ability') as HTMLElement | null;

    if (touchZone && joystickBase && joystickKnob && dashBtn) {
      inputManager.setupTouchControls(touchZone, joystickBase, joystickKnob, dashBtn, abilityBtn ?? undefined);
    }

    // 7. Mobile Portrait-to-Landscape Enforcer Overlay
    this.setupLandscapeEnforcer(root);
  }

  private setupLandscapeEnforcer(root: HTMLElement): void {
    if (typeof window === 'undefined' || navigator.webdriver === true) return;

    const overlay = document.createElement('div');
    overlay.id = 'landscape-enforcer';
    overlay.className = 'landscape-enforcer';
    overlay.innerHTML = `
      <div class="landscape-phone-icon">📱↻</div>
      <div class="t800-header" style="font-size:20px; margin-top:12px;">ROTATE DEVICE TO LANDSCAPE</div>
      <div style="font-family:var(--font-telemetry); font-size:13px; color:var(--color-cyan); max-width:300px; text-align:center; line-height:1.5;">
        TECH-COM TACTICAL HUD REQUIRES WIDESCREEN LANDSCAPE ORIENTATION TO ENGAGE SKYNET FORCES.
      </div>
    `;
    root.appendChild(overlay);

    const checkOrientation = () => {
      const isMobileTouch =
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (window.matchMedia?.('(pointer: coarse)')?.matches ?? false);
      const isPortrait = window.innerHeight > window.innerWidth;
      overlay.style.display = isMobileTouch && isPortrait ? 'flex' : 'none';
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  public async getOrLoadSettingsPanel(): Promise<SettingsPanel> {
    if (!this.settingsPanel) {
      const { SettingsPanel } = await import('./SettingsPanel');
      this.settingsPanel = new SettingsPanel(this.root, this.saveManager, this.audioEngine);
    }
    return this.settingsPanel;
  }

  public async openSettings(onClose?: () => void): Promise<void> {
    const panel = await this.getOrLoadSettingsPanel();
    panel.show(onClose);
  }

  public updateGamepad(gp: import('../input/GamepadManager').GamepadManager, dt: number): void {
    if (!gp.hasActiveController) return;

    // 0. Settings Panel
    if (this.settingsPanel?.handleGamepadMenuNavigation(gp, dt)) return;

    // 1. Level Up Requisition Modal
    if (this.levelUpModal.handleGamepad(gp, dt)) return;

    // 2. Vault Decryption Modal
    if (this.vaultModal.handleGamepad(gp)) return;

    // 3. Pause Modal
    if (this.pauseModal.handleGamepad(gp, dt)) return;

    // 4. End Run Modal (Victory / Defeat)
    if (this.endRunModal.handleGamepad(gp)) return;

    // 5. Title Screen & Tech-Com Bunker Modal
    if (this.titleScreen.handleGamepad(gp, dt)) return;
  }
}
