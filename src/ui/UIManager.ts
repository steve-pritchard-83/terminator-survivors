import type { SaveManager } from '../state/SaveManager';
import type { InputManager } from '../input/InputManager';
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
    onStartRun: (loadoutId: LoadoutId) => void
  ) {
    this.hudView = new HUDView(root);
    this.titleScreen = new TitleScreen(root, saveManager, onStartRun);
    this.levelUpModal = new LevelUpModal(root);
    this.vaultModal = new VaultJackpotModal(root);
    this.endRunModal = new EndRunModal(root);

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
