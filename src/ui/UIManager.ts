import type { SaveManager } from '../state/SaveManager';
import type { InputManager } from '../input/InputManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { HUDView } from './HUDView';
import { TitleScreen } from './TitleScreen';
import { LevelUpModal } from './LevelUpModal';
import { VaultJackpotModal } from './VaultJackpotModal';
import { EndRunModal } from './EndRunModal';
import type { LoadoutId } from '../core/types';

export class UIManager {
  public readonly hudView: HUDView;
  public readonly titleScreen: TitleScreen;
  public readonly levelUpModal: LevelUpModal;
  public readonly vaultModal: VaultJackpotModal;
  public readonly endRunModal: EndRunModal;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    inputManager: InputManager,
    audioEngine: AudioEngine,
    onStartRun: (loadoutId: LoadoutId) => void
  ) {
    this.hudView = new HUDView(root);
    this.titleScreen = new TitleScreen(root, saveManager, audioEngine, onStartRun);
    this.levelUpModal = new LevelUpModal(root);
    this.vaultModal = new VaultJackpotModal(root);
    this.endRunModal = new EndRunModal(root);

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
  }
}
