import type { AudioEngine } from '../audio/AudioEngine';
import type { GameSettings } from '../core/types';

export class SettingsApplier {
  public static apply(settings: GameSettings, audioEngine?: AudioEngine): void {
    if (audioEngine) {
      audioEngine.setMasterVolume(settings.masterVolume);
      audioEngine.setMusicVolume(settings.musicVolume);
      audioEngine.setSfxVolume(settings.sfxVolume);
    }

    if (typeof document === 'undefined') return;

    // Colorblind mode: set both data attribute and body class
    document.body.setAttribute('data-colorblind', settings.colorBlindMode);
    document.body.classList.remove('deuteranopia', 'protanopia', 'tritanopia');
    if (settings.colorBlindMode && settings.colorBlindMode !== 'none') {
      document.body.classList.add(settings.colorBlindMode);
    }

    // UI Scale variable
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale / 100));
  }
}
