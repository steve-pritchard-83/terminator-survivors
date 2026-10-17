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
import type { LoadoutId } from '../core/types';

export class UIManager {
  public readonly hudView: HUDView;
  public readonly titleScreen: TitleScreen;
  public readonly levelUpModal: LevelUpModal;
  public readonly vaultModal: VaultJackpotModal;
  public readonly endRunModal: EndRunModal;
  public readonly pauseModal: PauseModal;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    inputManager: InputManager,
    audioEngine: AudioEngine,
    onStartRun: (loadoutId: LoadoutId) => void,
    getRunState: () => RunState
  ) {
    this.hudView = new HUDView(root);
    this.endRunModal = new EndRunModal(root, saveManager, audioEngine);
    this.titleScreen = new TitleScreen(
      root,
      saveManager,
      audioEngine,
      onStartRun,
      () => this.endRunModal.showArchives(() => this.titleScreen.show())
    );
    this.levelUpModal = new LevelUpModal(root);
    this.vaultModal = new VaultJackpotModal(root);
    this.pauseModal = new PauseModal(root, saveManager, audioEngine, getRunState);

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

    if (touchZone && joystickBase && joystickKnob && dashBtn) {
      inputManager.setupTouchControls(touchZone, joystickBase, joystickKnob, dashBtn);
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

  public updateGamepad(gp: import('../input/GamepadManager').GamepadManager, dt: number): void {
    if (!gp.hasActiveController) return;

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
