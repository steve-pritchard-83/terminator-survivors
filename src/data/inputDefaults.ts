import type { GamepadBindings, InputAction, InputMappingConfig, KeyBindings } from '../core/types';

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  ability: ['KeyE'],
  pause: ['Escape']
};

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  ability: [3, 2, 5] // Button Y (3), Button X (2), RB (5); pause is fixed to Start (9)
};

export const DEFAULT_INPUT_MAPPINGS: InputMappingConfig = {
  keyboard: { ...DEFAULT_KEY_BINDINGS },
  gamepad: { ...DEFAULT_GAMEPAD_BINDINGS }
};

export function detectKeyConflict(
  keyboard: KeyBindings,
  targetAction: InputAction,
  newKey: string
): { hasConflict: boolean; conflictedAction?: InputAction } {
  for (const [action, keys] of Object.entries(keyboard)) {
    if (action !== targetAction && keys.includes(newKey)) {
      return { hasConflict: true, conflictedAction: action as InputAction };
    }
  }
  return { hasConflict: false };
}

export function formatKeyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return '↑ ' + code.slice(5).toUpperCase();
  if (code === 'Space') return 'SPACE';
  if (code === 'ShiftLeft') return 'L-SHIFT';
  if (code === 'ShiftRight') return 'R-SHIFT';
  if (code === 'ControlLeft') return 'L-CTRL';
  if (code === 'ControlRight') return 'R-CTRL';
  if (code === 'Escape') return 'ESC';
  return code.toUpperCase();
}

export function formatButtonLabel(btn: number): string {
  switch (btn) {
    case 0:
      return 'BUTTON A';
    case 1:
      return 'BUTTON B';
    case 2:
      return 'BUTTON X';
    case 3:
      return 'BUTTON Y';
    case 4:
      return 'LB (L-BUMPER)';
    case 5:
      return 'RB (R-BUMPER)';
    case 6:
      return 'LT (L-TRIGGER)';
    case 7:
      return 'RT (R-TRIGGER)';
    case 8:
      return 'VIEW / SELECT';
    case 9:
      return 'MENU / START';
    case 10:
      return 'L3 (STICK CLICK)';
    case 11:
      return 'R3 (STICK CLICK)';
    default:
      return `BTN ${btn}`;
  }
}
