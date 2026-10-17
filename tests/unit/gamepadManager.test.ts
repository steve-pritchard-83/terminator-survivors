import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamepadManager, XBOX_BUTTON, XBOX_AXIS } from '../../src/input/GamepadManager';

describe('GamepadManager - Xbox Controller & Haptics', () => {
  let manager: GamepadManager;
  let mockVibrationActuator: {
    playEffect: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockVibrationActuator = {
      playEffect: vi.fn().mockResolvedValue('complete'),
      reset: vi.fn().mockResolvedValue('complete')
    };
    manager = new GamepadManager();
  });

  function createMockXboxGamepad(overrides: Partial<any> = {}) {
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      value: 0
    }));
    const axes = [0, 0, 0, 0];

    return {
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)',
      index: 0,
      connected: true,
      mapping: 'standard',
      buttons,
      axes,
      vibrationActuator: mockVibrationActuator,
      ...overrides
    };
  }

  it('detects Xbox Controller connection and identifies as Xbox', () => {
    const mockGp = createMockXboxGamepad();
    manager.setMockGamepadForTest(mockGp);

    const status = manager.getControllerStatus();
    expect(status.connected).toBe(true);
    expect(status.isXbox).toBe(true);
    expect(status.name).toBe('XBOX WIRELESS CONTROLLER');
    expect(manager.hasActiveController).toBe(true);
  });

  it('applies radial deadzone to left stick movement', () => {
    const mockGp = createMockXboxGamepad();
    // Sub-deadzone drift (0.10)
    mockGp.axes[XBOX_AXIS.LEFT_X] = 0.10;
    mockGp.axes[XBOX_AXIS.LEFT_Y] = 0.10;
    manager.setMockGamepadForTest(mockGp);
    manager.update(1 / 60);

    expect(manager.getMovement()).toBeNull();

    // Definite input beyond deadzone (0.75, 0.0)
    mockGp.axes[XBOX_AXIS.LEFT_X] = 0.75;
    mockGp.axes[XBOX_AXIS.LEFT_Y] = 0.0;
    manager.update(1 / 60);

    const move = manager.getMovement();
    expect(move).not.toBeNull();
    expect(move!.x).toBeGreaterThan(0.6);
    expect(move!.z).toBe(0);
  });

  it('combines D-Pad buttons with left stick movement', () => {
    const mockGp = createMockXboxGamepad();
    mockGp.buttons[XBOX_BUTTON.DPAD_UP] = { pressed: true, value: 1 };
    mockGp.buttons[XBOX_BUTTON.DPAD_RIGHT] = { pressed: true, value: 1 };
    manager.setMockGamepadForTest(mockGp);
    manager.update(1 / 60);

    const move = manager.getMovement();
    expect(move).not.toBeNull();
    expect(move!.x).toBeGreaterThan(0.5);
    expect(move!.z).toBeLessThan(-0.5);
  });

  it('provides twin-stick right stick aiming', () => {
    const mockGp = createMockXboxGamepad();
    // Small drift
    mockGp.axes[XBOX_AXIS.RIGHT_X] = 0.05;
    mockGp.axes[XBOX_AXIS.RIGHT_Y] = 0.05;
    manager.setMockGamepadForTest(mockGp);
    manager.update(1 / 60);
    expect(manager.getAimAngle()).toBeNull();

    // Aiming directly right (+X: 1.0, Z: 0.0)
    mockGp.axes[XBOX_AXIS.RIGHT_X] = 1.0;
    mockGp.axes[XBOX_AXIS.RIGHT_Y] = 0.0;
    manager.update(1 / 60);

    const angle = manager.getAimAngle();
    expect(angle).not.toBeNull();
    // Math.atan2(1, 0) is Math.PI / 2
    expect(angle).toBeCloseTo(Math.PI / 2, 2);
  });

  it('triggers Combat Dive with A, B, LB, LT, and L3', () => {
    const onDash = vi.fn();
    manager.onDashCallback = onDash;

    const mockGp = createMockXboxGamepad();
    manager.setMockGamepadForTest(mockGp);

    // Frame 1: Button A pressed
    mockGp.buttons[XBOX_BUTTON.A] = { pressed: true, value: 1 };
    manager.update(1 / 60);
    expect(manager.consumeDash()).toBe(true);
    expect(onDash).toHaveBeenCalledTimes(1);

    // Frame 2: Hold A (no edge)
    manager.update(1 / 60);
    expect(manager.consumeDash()).toBe(false);

    // Frame 3: Release A
    mockGp.buttons[XBOX_BUTTON.A] = { pressed: false, value: 0 };
    manager.update(1 / 60);

    // Frame 4: LT pulled past threshold
    mockGp.buttons[XBOX_BUTTON.LT] = { pressed: true, value: 0.85 };
    manager.update(1 / 60);
    expect(manager.consumeDash()).toBe(true);
    expect(onDash).toHaveBeenCalledTimes(2);
  });

  it('triggers Pause with Start/Menu or View/Back button', () => {
    const onPause = vi.fn();
    manager.onPauseCallback = onPause;

    const mockGp = createMockXboxGamepad();
    mockGp.buttons[XBOX_BUTTON.MENU] = { pressed: true, value: 1 };
    manager.setMockGamepadForTest(mockGp);
    manager.update(1 / 60);

    expect(manager.consumePause()).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('handles menu discrete navigation with repeating hold delay', () => {
    const mockGp = createMockXboxGamepad();
    mockGp.buttons[XBOX_BUTTON.DPAD_DOWN] = { pressed: true, value: 1 };
    manager.setMockGamepadForTest(mockGp);

    // First press gives immediate 1 tick
    manager.update(1 / 60);
    let nav = manager.getMenuNavigation(1 / 60);
    expect(nav.y).toBe(1);

    // Immediate next frame before repeat timer fires returns 0
    manager.update(1 / 60);
    nav = manager.getMenuNavigation(1 / 60);
    expect(nav.y).toBe(0);

    // Advance beyond NAV_REPEAT_INITIAL_DELAY (0.28s)
    manager.update(0.30);
    nav = manager.getMenuNavigation(0.30);
    expect(nav.y).toBe(1);
  });

  it('drives Xbox dual-rumble haptics via vibrationActuator', () => {
    const mockGp = createMockXboxGamepad();
    manager.setMockGamepadForTest(mockGp);

    manager.playRumble(150, 0.8, 0.5);

    expect(mockVibrationActuator.playEffect).toHaveBeenCalledWith('dual-rumble', {
      startDelay: 0,
      duration: 150,
      strongMagnitude: 0.8,
      weakMagnitude: 0.5
    });
  });

  it('translates audio haptic patterns to rich dual-rumble parameters', () => {
    const mockGp = createMockXboxGamepad();
    manager.setMockGamepadForTest(mockGp);

    // Single number pattern (e.g. gunshot 12ms)
    manager.triggerRumblePattern(12);
    expect(mockVibrationActuator.playEffect).toHaveBeenCalledWith('dual-rumble', {
      startDelay: 0,
      duration: 55,
      strongMagnitude: 0.2,
      weakMagnitude: 0.42
    });

    // Heavy boss arrival array pattern [45, 60, 75, 90]
    manager.triggerRumblePattern([45, 60, 75, 90]);
    expect(mockVibrationActuator.playEffect).toHaveBeenLastCalledWith('dual-rumble', {
      startDelay: 0,
      duration: 340,
      strongMagnitude: 0.95,
      weakMagnitude: 0.85
    });

    // Player damage shudder [18, 25, 30]
    manager.triggerRumblePattern([18, 25, 30]);
    expect(mockVibrationActuator.playEffect).toHaveBeenLastCalledWith('dual-rumble', {
      startDelay: 0,
      duration: 175,
      strongMagnitude: 0.9,
      weakMagnitude: 0.7
    });
  });
});
