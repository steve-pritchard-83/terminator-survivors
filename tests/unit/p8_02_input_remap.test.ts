import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../../src/state/SaveManager';
import { InputManager } from '../../src/input/InputManager';
import { GamepadManager } from '../../src/input/GamepadManager';
import { SettingsPanel } from '../../src/ui/SettingsPanel';
import { globalEvents } from '../../src/core/EventBus';
import {
  DEFAULT_INPUT_MAPPINGS,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  detectKeyConflict,
  formatButtonLabel,
  formatKeyLabel
} from '../../src/data/inputDefaults';

describe('P8-02: Keyboard and Gamepad Input Remapping with Conflict Detection', () => {
  let saveManager: SaveManager;
  let audioEngineMock: any;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager();
    audioEngineMock = {
      playUpgradeApplied: vi.fn(),
      playUiBuy: vi.fn(),
      playHudScanOpen: vi.fn(),
      playHudScanClose: vi.fn(),
      setMasterVolume: vi.fn(),
      setMusicVolume: vi.fn(),
      setSfxVolume: vi.fn()
    };
  });

  describe('1. Default Bindings & Formatting', () => {
    it('initializes SaveManager with default input bindings', () => {
      const bindings = saveManager.getInputBindings();
      expect(bindings.keyboard.moveUp).toEqual(DEFAULT_KEY_BINDINGS.moveUp);
      expect(bindings.keyboard.dash).toEqual(DEFAULT_KEY_BINDINGS.dash);
      expect(bindings.gamepad.dash).toEqual(DEFAULT_GAMEPAD_BINDINGS.dash);
    });

    it('formats key codes and button labels cleanly', () => {
      expect(formatKeyLabel('KeyW')).toBe('W');
      expect(formatKeyLabel('Space')).toBe('SPACE');
      expect(formatKeyLabel('ShiftLeft')).toBe('L-SHIFT');
      expect(formatKeyLabel('ArrowUp')).toContain('↑');

      expect(formatButtonLabel(0)).toBe('BUTTON A');
      expect(formatButtonLabel(1)).toBe('BUTTON B');
      expect(formatButtonLabel(4)).toBe('LB (L-BUMPER)');
      expect(formatButtonLabel(9)).toBe('MENU / START');
    });
  });

  describe('2. Conflict Detection Logic', () => {
    it('detects when a key conflicts with a different action', () => {
      const keyboard = { ...DEFAULT_KEY_BINDINGS };
      // KeyW is in moveUp; testing conflict when trying to bind to dash
      const conflict = detectKeyConflict(keyboard, 'dash', 'KeyW');
      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictedAction).toBe('moveUp');
    });

    it('returns no conflict when key is rebound to same action or is free', () => {
      const keyboard = { ...DEFAULT_KEY_BINDINGS };
      const sameAction = detectKeyConflict(keyboard, 'moveUp', 'KeyW');
      expect(sameAction.hasConflict).toBe(false);

      const freeKey = detectKeyConflict(keyboard, 'dash', 'KeyZ');
      expect(freeKey.hasConflict).toBe(false);
    });
  });

  describe('3. SaveManager Input Persistence', () => {
    it('updates and persists input bindings', () => {
      saveManager.updateInputBindings({
        keyboard: {
          ...DEFAULT_KEY_BINDINGS,
          dash: ['KeyF']
        }
      });

      const updated = saveManager.getInputBindings();
      expect(updated.keyboard.dash).toEqual(['KeyF']);

      // Create new instance from localStorage
      const reloaded = new SaveManager();
      expect(reloaded.getInputBindings().keyboard.dash).toEqual(['KeyF']);
    });
  });

  describe('4. InputManager Runtime Custom Bindings', () => {
    it('reacts to input:rebound event and updates active keys', () => {
      const inputManager = new InputManager();
      expect(inputManager.getKeyBindings().dash).toEqual(DEFAULT_KEY_BINDINGS.dash);

      // Fire event
      const customBindings = JSON.parse(JSON.stringify(DEFAULT_INPUT_MAPPINGS));
      customBindings.keyboard.dash = ['KeyZ'];
      customBindings.keyboard.moveUp = ['KeyI'];
      globalEvents.emit('input:rebound', customBindings);

      expect(inputManager.getKeyBindings().dash).toEqual(['KeyZ']);
      expect(inputManager.getKeyBindings().moveUp).toEqual(['KeyI']);
    });

    it('triggers dash callback when custom bound key is pressed', () => {
      const inputManager = new InputManager();
      inputManager.setKeyBindings({
        ...DEFAULT_KEY_BINDINGS,
        dash: ['KeyJ']
      });

      let dashTriggered = false;
      inputManager.onDashCallback = () => {
        dashTriggered = true;
      };

      // Dispatch custom keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
      expect(dashTriggered).toBe(true);
    });
  });

  describe('5. GamepadManager Runtime Custom Bindings', () => {
    it('respects custom gamepad bindings for dash, ability, and pause', () => {
      const gp = new GamepadManager();
      gp.setGamepadBindings({
        dash: [5], // RB
        ability: [4], // LB
        pause: [8] // View
      });

      const mockGp = {
        id: 'Xbox Controller',
        connected: true,
        mapping: 'standard',
        buttons: new Array(16).fill(null).map(() => ({ pressed: false, value: 0 })),
        axes: [0, 0, 0, 0]
      };
      gp.setMockGamepadForTest(mockGp);

      let dashCalled = false;
      gp.onDashCallback = () => {
        dashCalled = true;
      };

      // Press RB (index 5)
      mockGp.buttons[5] = { pressed: true, value: 1.0 };
      gp.update(1 / 60);

      expect(dashCalled).toBe(true);
      expect(gp.consumeDash()).toBe(true);
    });
  });

  describe('6. SettingsPanel Input Remapping UI', () => {
    it('renders remapping buttons with correct current key labels', () => {
      const root = document.createElement('div');
      const panel = new SettingsPanel(root, saveManager, audioEngineMock);

      panel.show();
      const moveUpBtn = root.querySelector('.remap-key-btn[data-action="moveUp"]') as HTMLButtonElement;
      expect(moveUpBtn).not.toBeNull();
      expect(moveUpBtn.textContent).toContain('W');
    });

    it('rebinds key, resolves conflict, and updates SaveManager upon keydown', () => {
      const root = document.createElement('div');
      const panel = new SettingsPanel(root, saveManager, audioEngineMock);
      panel.show();

      // Start listening for Dash
      panel.startListeningKey('dash');
      const dashBtn = root.querySelector('.remap-key-btn[data-action="dash"]') as HTMLButtonElement;
      expect(dashBtn.textContent).toBe('[PRESS KEY...]');

      // Send KeyW (which conflicts with moveUp)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));

      // KeyW should now be dash
      const bindings = saveManager.getInputBindings();
      expect(bindings.keyboard.dash).toEqual(['KeyW']);
      // moveUp should have KeyW removed
      expect(bindings.keyboard.moveUp).not.toContain('KeyW');
      expect(audioEngineMock.playUpgradeApplied).toHaveBeenCalled();
    });

    it('intercepts gamepad button press when remapping gamepad action', () => {
      const root = document.createElement('div');
      const panel = new SettingsPanel(root, saveManager, audioEngineMock);
      panel.show();

      panel.startListeningGamepad('dash');

      const gp = new GamepadManager();
      const mockGp = {
        id: 'Xbox Controller',
        connected: true,
        mapping: 'standard',
        buttons: new Array(16).fill(null).map(() => ({ pressed: false, value: 0 })),
        axes: [0, 0, 0, 0]
      };
      gp.setMockGamepadForTest(mockGp);

      // Button RT (index 7) pressed
      mockGp.buttons[7] = { pressed: true, value: 1.0 };
      gp.update(1 / 60);

      const handled = panel.handleGamepadMenuNavigation(gp, 1 / 60);
      expect(handled).toBe(true);

      const bindings = saveManager.getInputBindings();
      expect(bindings.gamepad.dash).toEqual([7]);
    });

    it('resets controls to factory preset on reset button click', () => {
      // Modify bindings
      saveManager.updateInputBindings({
        keyboard: {
          ...DEFAULT_KEY_BINDINGS,
          dash: ['KeyP']
        }
      });
      expect(saveManager.getInputBindings().keyboard.dash).toEqual(['KeyP']);

      const root = document.createElement('div');
      const panel = new SettingsPanel(root, saveManager, audioEngineMock);
      panel.show();

      const resetBtn = root.querySelector('#btn-reset-inputs') as HTMLButtonElement;
      resetBtn.click();

      expect(saveManager.getInputBindings().keyboard.dash).toEqual(DEFAULT_KEY_BINDINGS.dash);
      expect(audioEngineMock.playUiBuy).toHaveBeenCalled();
    });
  });
});
