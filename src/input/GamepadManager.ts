import type { GamepadBindings } from '../core/types';
import { DEFAULT_GAMEPAD_BINDINGS } from '../data/inputDefaults';

export const XBOX_BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8,
  MENU: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  GUIDE: 16
} as const;

export const XBOX_AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3
} as const;

export interface GamepadStatus {
  connected: boolean;
  id: string;
  isXbox: boolean;
  name: string;
}

export class GamepadManager {
  private lastButtons: boolean[] = [];
  private currentButtons: boolean[] = [];
  private buttonValues: number[] = [];
  private currentAxes: number[] = [0, 0, 0, 0];

  private activeGamepadIndex: number | null = null;
  private isXbox = false;
  private gamepadName = '';
  private isConnected = false;

  private pauseRequested = false;
  private menuIndex: number = XBOX_BUTTON.MENU;
  private viewIndex: number = XBOX_BUTTON.VIEW;

  // Repeat timer for menu navigation
  private navRepeatTimer = 0;
  private lastNavDirection = { x: 0, y: 0 };
  private static readonly NAV_REPEAT_INITIAL_DELAY = 0.28;
  private static readonly NAV_REPEAT_RATE = 0.13;

  public onConnectCallback: ((status: GamepadStatus) => void) | null = null;
  public onDisconnectCallback: ((status: GamepadStatus) => void) | null = null;
  public onAbilityCallback: (() => void) | null = null;
  public onPauseCallback: (() => void) | null = null;

  private gamepadBindings: GamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };

  public setGamepadBindings(bindings: GamepadBindings): void {
    this.gamepadBindings = { ...bindings };
  }

  public getGamepadBindings(): GamepadBindings {
    return { ...this.gamepadBindings };
  }

  private abilityRequested = false;

  // Test override mock
  private mockGamepad: Gamepad | null = null;
  private xrSessionProvider: (() => XRSession | null) | null = null;

  public setXrSessionProvider(provider: () => XRSession | null): void {
    this.xrSessionProvider = provider;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onGamepadConnected);
      window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    }
  }

  private isXboxId(id: string): boolean {
    return /xbox|x-input|xinput|045e|microsoft/i.test(id);
  }

  private isQuestTouchId(id: string): boolean {
    return /oculus|quest|meta|touch|xr-standard/i.test(id);
  }

  private cleanGamepadName(id: string): string {
    if (this.isQuestTouchId(id)) return 'META QUEST TOUCH';
    if (this.isXboxId(id)) {
      if (/wireless|series|one/i.test(id)) return 'XBOX WIRELESS CONTROLLER';
      if (/360/i.test(id)) return 'XBOX 360 CONTROLLER';
      return 'XBOX CONTROLLER';
    }
    if (/playstation|dualshock|dualsense|054c/i.test(id)) return 'PLAYSTATION CONTROLLER';
    if (/nintendo|switch|057e/i.test(id)) return 'SWITCH PRO CONTROLLER';
    return 'GAMEPAD CONTROLLER';
  }

  private onGamepadConnected = (e: GamepadEvent): void => {
    const gp = e.gamepad;
    if (!gp) return;
    this.activeGamepadIndex = gp.index;
    this.isXbox = this.isXboxId(gp.id) || gp.mapping === 'standard';
    this.gamepadName = this.cleanGamepadName(gp.id);
    this.isConnected = true;

    const status: GamepadStatus = {
      connected: true,
      id: gp.id,
      isXbox: this.isXbox,
      name: this.gamepadName
    };

    this.onConnectCallback?.(status);

    // Welcome rumble pulse so the user instantly feels their controller
    this.playRumble(180, 0.35, 0.2);
  };

  private onGamepadDisconnected = (e: GamepadEvent): void => {
    if (this.activeGamepadIndex === e.gamepad?.index) {
      this.isConnected = false;
      const status: GamepadStatus = {
        connected: false,
        id: e.gamepad.id,
        isXbox: this.isXbox,
        name: this.gamepadName
      };
      this.activeGamepadIndex = null;
      this.onDisconnectCallback?.(status);
    }
  };

  private getActiveGamepad(): Gamepad | null {
    if (this.mockGamepad) return this.mockGamepad;
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }

    const gamepads = navigator.getGamepads();
    if (!gamepads) return null;

    // First try the remembered active index
    if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
      const gp = gamepads[this.activeGamepadIndex];
      if (gp && gp.connected) return gp;
    }

    // Otherwise find the first connected gamepad (prioritize Xbox/Standard)
    let bestGamepad: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        if (!bestGamepad || this.isXboxId(gp.id)) {
          bestGamepad = gp;
        }
      }
    }

    if (bestGamepad) {
      if (this.activeGamepadIndex !== bestGamepad.index || !this.isConnected) {
        this.activeGamepadIndex = bestGamepad.index;
        this.isXbox = this.isXboxId(bestGamepad.id) || bestGamepad.mapping === 'standard';
        this.gamepadName = this.cleanGamepadName(bestGamepad.id);
        this.isConnected = true;
        this.onConnectCallback?.({
          connected: true,
          id: bestGamepad.id,
          isXbox: this.isXbox,
          name: this.gamepadName
        });
      }
      return bestGamepad;
    }

    if (this.isConnected && !bestGamepad) {
      this.isConnected = false;
      this.activeGamepadIndex = null;
      this.onDisconnectCallback?.({
        connected: false,
        id: '',
        isXbox: this.isXbox,
        name: this.gamepadName
      });
    }

    return null;
  }

  public update(_dt: number): void {
    // 1. Check active WebXR session inputSources first (Meta Quest 2 Touch controllers in immersive-vr)
    const xrSession = this.xrSessionProvider?.() ?? null;
    if (xrSession && xrSession.inputSources && xrSession.inputSources.length > 0) {
      this.updateFromXrInputSources(xrSession.inputSources);
      return;
    }

    const gp = this.getActiveGamepad();
    if (!gp) {
      this.lastButtons = [];
      this.currentButtons = [];
      this.buttonValues = [];
      this.currentAxes = [0, 0, 0, 0];
      return;
    }

    // Menu / View button positions: standard-mapped pads use 9 / 8; Xbox pads that report a
    // non-standard (raw XInput) layout use 7 / 6, where 8 and 9 are the stick clicks.
    const standardMapping = gp.mapping === 'standard';
    this.menuIndex = standardMapping || !this.isXboxId(gp.id) ? XBOX_BUTTON.MENU : 7;
    this.viewIndex = standardMapping || !this.isXboxId(gp.id) ? XBOX_BUTTON.VIEW : 6;

    // Save previous button states for edge detection
    this.lastButtons = [...this.currentButtons];

    this.currentButtons = [];
    this.buttonValues = [];
    for (let i = 0; i < gp.buttons.length; i++) {
      const btn = gp.buttons[i];
      const isDown = typeof btn === 'object' ? btn.pressed || btn.value > 0.25 : Boolean(btn);
      const val = typeof btn === 'object' ? btn.value : isDown ? 1.0 : 0.0;
      this.currentButtons.push(isDown);
      this.buttonValues.push(val);
    }

    this.currentAxes = [];
    for (let i = 0; i < gp.axes.length; i++) {
      this.currentAxes.push(gp.axes[i] || 0);
    }

    // Meta Quest Touch dual-controller synthesis: if two Quest Touch controllers are connected,
    // combine Left Touch thumbstick (move) and Right Touch thumbstick (aim) + buttons across both hands.
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const allPads = navigator.getGamepads();
      if (allPads) {
        for (let p = 0; p < allPads.length; p++) {
          const other = allPads[p];
          if (!other || !other.connected || other.index === gp.index) continue;
          if (this.isQuestTouchId(other.id) || this.isQuestTouchId(gp.id)) {
            const ox = other.axes[2] ?? other.axes[0] ?? 0;
            const oy = other.axes[3] ?? other.axes[1] ?? 0;
            if (Math.hypot(ox, oy) > Math.hypot(this.currentAxes[2] ?? 0, this.currentAxes[3] ?? 0)) {
              this.currentAxes[2] = ox;
              this.currentAxes[3] = oy;
            }
            for (let b = 0; b < other.buttons.length; b++) {
              const btn = other.buttons[b];
              const isDown = typeof btn === 'object' ? btn.pressed || btn.value > 0.25 : Boolean(btn);
              if (isDown) {
                this.currentButtons[b] = true;
                this.buttonValues[b] = Math.max(this.buttonValues[b] ?? 0, typeof btn === 'object' ? btn.value : 1);
              }
            }
          }
        }
      }
    }

    // Track active user input this frame
    const lx = this.currentAxes[XBOX_AXIS.LEFT_X] ?? 0;
    const ly = this.currentAxes[XBOX_AXIS.LEFT_Y] ?? 0;
    const rx = this.currentAxes[XBOX_AXIS.RIGHT_X] ?? 0;
    const ry = this.currentAxes[XBOX_AXIS.RIGHT_Y] ?? 0;
    const hasStickInput = Math.hypot(lx, ly) > 0.16 || Math.hypot(rx, ry) > 0.18;
    const hasButtonInput = this.currentButtons.some(Boolean);
    this.hasInputThisFrame = hasStickInput || hasButtonInput;

    // Gameplay triggers
    const abilityPressed = this.gamepadBindings.ability.some((b) => this.isButtonJustPressed(b));

    if (abilityPressed) {
      this.abilityRequested = true;
      this.onAbilityCallback?.();
    }

    // Pause is fixed to the Menu (three-line) button. The Guide / Xbox button never pauses.
    const pausePressed = this.isButtonJustPressed(this.menuIndex);

    if (pausePressed) {
      this.pauseRequested = true;
      this.onPauseCallback?.();
    }
  }

  /**
   * Reads Meta Quest Touch controllers directly from WebXR `session.inputSources`.
   * In the W3C `xr-standard` mapping:
   * - axes[2], axes[3] are the Thumbstick X/Y
   * - buttons[0] = Index Trigger, buttons[1] = Grip Squeeze, buttons[3] = Thumbstick Click,
   *   buttons[4] = A / X button, buttons[5] = B / Y button
   */
  private updateFromXrInputSources(sources: XRInputSourceArray): void {
    if (!this.isConnected) {
      this.isConnected = true;
      this.isXbox = true;
      this.gamepadName = 'META QUEST TOUCH (VR)';
      this.onConnectCallback?.({
        connected: true,
        id: 'xr-standard',
        isXbox: true,
        name: this.gamepadName
      });
    }

    this.lastButtons = [...this.currentButtons];
    this.currentButtons = new Array(17).fill(false);
    this.buttonValues = new Array(17).fill(0);
    this.currentAxes = [0, 0, 0, 0];

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const gp = src?.gamepad;
      if (!gp) continue;

      // xr-standard puts thumbstick on axes[2], axes[3] (fallback to 0, 1 if only 2 axes exist)
      const sx = gp.axes.length >= 4 ? (gp.axes[2] ?? 0) : (gp.axes[0] ?? 0);
      const sy = gp.axes.length >= 4 ? (gp.axes[3] ?? 0) : (gp.axes[1] ?? 0);

      if (src.handedness === 'left') {
        this.currentAxes[XBOX_AXIS.LEFT_X] = sx;
        this.currentAxes[XBOX_AXIS.LEFT_Y] = sy;
        // Left X button (buttons[4]) or Left Squeeze (buttons[1]) -> Ability
        if (gp.buttons[4]?.pressed || gp.buttons[1]?.pressed) {
          this.currentButtons[XBOX_BUTTON.X] = true;
          this.buttonValues[XBOX_BUTTON.X] = 1;
        }
        // Left Y button (buttons[5]) -> Menu/Pause
        if (gp.buttons[5]?.pressed) {
          this.currentButtons[XBOX_BUTTON.MENU] = true;
          this.buttonValues[XBOX_BUTTON.MENU] = 1;
        }
      } else if (src.handedness === 'right') {
        this.currentAxes[XBOX_AXIS.RIGHT_X] = sx;
        this.currentAxes[XBOX_AXIS.RIGHT_Y] = sy;
        // Right A button (buttons[4]) or Right Trigger (buttons[0]) -> Confirm / Ability
        if (gp.buttons[4]?.pressed || gp.buttons[0]?.pressed) {
          this.currentButtons[XBOX_BUTTON.A] = true;
          this.buttonValues[XBOX_BUTTON.A] = 1;
          this.currentButtons[XBOX_BUTTON.RB] = true;
          this.buttonValues[XBOX_BUTTON.RB] = 1;
        }
        // Right B button (buttons[5]) or Right Squeeze (buttons[1]) -> Cancel / Ability
        if (gp.buttons[5]?.pressed || gp.buttons[1]?.pressed) {
          this.currentButtons[XBOX_BUTTON.B] = true;
          this.buttonValues[XBOX_BUTTON.B] = 1;
          this.currentButtons[XBOX_BUTTON.Y] = true;
          this.buttonValues[XBOX_BUTTON.Y] = 1;
        }
      } else {
        // Unknown handedness: map to left stick if larger
        if (Math.hypot(sx, sy) > Math.hypot(this.currentAxes[0], this.currentAxes[1])) {
          this.currentAxes[0] = sx;
          this.currentAxes[1] = sy;
        }
      }
    }

    const lx = this.currentAxes[XBOX_AXIS.LEFT_X] ?? 0;
    const ly = this.currentAxes[XBOX_AXIS.LEFT_Y] ?? 0;
    const rx = this.currentAxes[XBOX_AXIS.RIGHT_X] ?? 0;
    const ry = this.currentAxes[XBOX_AXIS.RIGHT_Y] ?? 0;
    this.hasInputThisFrame =
      Math.hypot(lx, ly) > 0.14 || Math.hypot(rx, ry) > 0.14 || this.currentButtons.some(Boolean);

    if (
      this.isButtonJustPressed(XBOX_BUTTON.Y) ||
      this.isButtonJustPressed(XBOX_BUTTON.X) ||
      this.isButtonJustPressed(XBOX_BUTTON.RB)
    ) {
      this.abilityRequested = true;
      this.onAbilityCallback?.();
    }

    if (this.isButtonJustPressed(XBOX_BUTTON.MENU)) {
      this.pauseRequested = true;
      this.onPauseCallback?.();
    }
  }

  private hasInputThisFrame = false;

  public hasRecentInput(): boolean {
    return this.hasInputThisFrame;
  }

  public consumeAbility(): boolean {
    if (this.abilityRequested) {
      this.abilityRequested = false;
      return true;
    }
    return false;
  }

  public clearAbilityRequest(): void {
    this.abilityRequested = false;
  }

  public isButtonDown(buttonIndex: number): boolean {
    return Boolean(this.currentButtons[buttonIndex]);
  }

  public isButtonJustPressed(buttonIndex: number): boolean {
    return Boolean(this.currentButtons[buttonIndex] && !this.lastButtons[buttonIndex]);
  }

  public isButtonJustReleased(buttonIndex: number): boolean {
    return Boolean(!this.currentButtons[buttonIndex] && this.lastButtons[buttonIndex]);
  }

  public getButtonValue(buttonIndex: number): number {
    return this.buttonValues[buttonIndex] ?? 0;
  }

  private applyRadialDeadzone(x: number, y: number, deadzone: number): { x: number; y: number } {
    const mag = Math.hypot(x, y);
    if (mag < deadzone) return { x: 0, y: 0 };
    const scaled = Math.min(1.0, (mag - deadzone) / (1.0 - deadzone));
    return {
      x: (x / mag) * scaled,
      y: (y / mag) * scaled
    };
  }

  public getMovement(): { x: number; z: number } | null {
    if (!this.isConnected) return null;

    // Left analog stick (axes 0, 1)
    const stick = this.applyRadialDeadzone(
      this.currentAxes[XBOX_AXIS.LEFT_X] ?? 0,
      this.currentAxes[XBOX_AXIS.LEFT_Y] ?? 0,
      0.18
    );

    let x = stick.x;
    let z = stick.y;

    // Combine D-Pad (Up: -Z, Down: +Z, Left: -X, Right: +X)
    if (this.isButtonDown(XBOX_BUTTON.DPAD_UP)) z -= 1.0;
    if (this.isButtonDown(XBOX_BUTTON.DPAD_DOWN)) z += 1.0;
    if (this.isButtonDown(XBOX_BUTTON.DPAD_LEFT)) x -= 1.0;
    if (this.isButtonDown(XBOX_BUTTON.DPAD_RIGHT)) x += 1.0;

    const len = Math.hypot(x, z);
    if (len < 0.05) return null;

    if (len > 1.0) {
      x /= len;
      z /= len;
    }

    return { x, z };
  }

  public getAimVector(): { x: number; z: number } | null {
    if (!this.isConnected) return null;

    // Right analog stick (axes 2, 3)
    const stick = this.applyRadialDeadzone(
      this.currentAxes[XBOX_AXIS.RIGHT_X] ?? 0,
      this.currentAxes[XBOX_AXIS.RIGHT_Y] ?? 0,
      0.22
    );

    const mag = Math.hypot(stick.x, stick.y);
    if (mag < 0.08) return null;

    return { x: stick.x, z: stick.y };
  }

  public getAimAngle(): number | null {
    const vec = this.getAimVector();
    if (!vec) return null;
    return Math.atan2(vec.x, vec.z);
  }

  public consumePause(): boolean {
    const pause = this.pauseRequested;
    this.pauseRequested = false;
    return pause;
  }

  /**
   * Menu Navigation helper:
   * Returns discrete {-1, 0, 1} for X and Y navigation with repeat delay.
   */
  public getMenuNavigation(dt: number): { x: number; y: number } {
    let nx = 0;
    let ny = 0;

    // D-Pad input
    if (this.isButtonDown(XBOX_BUTTON.DPAD_UP)) ny -= 1;
    if (this.isButtonDown(XBOX_BUTTON.DPAD_DOWN)) ny += 1;
    if (this.isButtonDown(XBOX_BUTTON.DPAD_LEFT)) nx -= 1;
    if (this.isButtonDown(XBOX_BUTTON.DPAD_RIGHT)) nx += 1;

    // Left Stick fallback
    const lx = this.currentAxes[XBOX_AXIS.LEFT_X] ?? 0;
    const ly = this.currentAxes[XBOX_AXIS.LEFT_Y] ?? 0;
    if (ly < -0.45) ny -= 1;
    if (ly > 0.45) ny += 1;
    if (lx < -0.45) nx -= 1;
    if (lx > 0.45) nx += 1;

    // Clamp
    nx = Math.max(-1, Math.min(1, nx));
    ny = Math.max(-1, Math.min(1, ny));

    if (nx === 0 && ny === 0) {
      this.navRepeatTimer = 0;
      this.lastNavDirection = { x: 0, y: 0 };
      return { x: 0, y: 0 };
    }

    if (nx !== this.lastNavDirection.x || ny !== this.lastNavDirection.y) {
      this.lastNavDirection = { x: nx, y: ny };
      this.navRepeatTimer = GamepadManager.NAV_REPEAT_INITIAL_DELAY;
      return { x: nx, y: ny };
    }

    this.navRepeatTimer -= dt;
    if (this.navRepeatTimer <= 0) {
      this.navRepeatTimer = GamepadManager.NAV_REPEAT_RATE;
      return { x: nx, y: ny };
    }

    return { x: 0, y: 0 };
  }

  public isMenuConfirmPressed(): boolean {
    return (
      this.isButtonJustPressed(XBOX_BUTTON.A) ||
      this.isButtonJustPressed(XBOX_BUTTON.RT) ||
      this.isButtonJustPressed(this.menuIndex)
    );
  }

  public isMenuCancelPressed(): boolean {
    return this.isButtonJustPressed(XBOX_BUTTON.B) || this.isButtonJustPressed(this.viewIndex);
  }

  /**
   * Controller Haptics / Dual-Rumble Implementation
   * Directly drives Xbox / PlayStation / standard gamepad rumble motors via W3C vibrationActuator.
   */
  public playRumble(durationMs: number, strongMagnitude: number, weakMagnitude: number): void {
    const duration = Math.max(16, Math.min(2500, Math.round(durationMs)));
    const strong = Math.max(0, Math.min(1.0, strongMagnitude));
    const weak = Math.max(0, Math.min(1.0, weakMagnitude));

    // Support mock in tests
    if (this.mockGamepad) {
      const act = (this.mockGamepad as any).vibrationActuator;
      if (act && typeof act.playEffect === 'function') {
        act.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          strongMagnitude: strong,
          weakMagnitude: weak
        });
      }
      return;
    }

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;

    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp || !gp.connected) continue;

      // 1. Modern W3C Gamepad Haptics actuator (Xbox Dual-Rumble)
      const actuator = (gp as any).vibrationActuator;
      if (actuator && typeof actuator.playEffect === 'function') {
        try {
          const promise = actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration,
            strongMagnitude: strong,
            weakMagnitude: weak
          });
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch {
          // Suppress if actuator is in transition
        }
      } else if (Array.isArray((gp as any).hapticActuators)) {
        // 2. Legacy Firefox / WebKit hapticActuators pulse
        try {
          for (const h of (gp as any).hapticActuators) {
            if (h && typeof h.pulse === 'function') {
              h.pulse(Math.max(strong, weak), duration).catch(() => {});
            }
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Translates sound effect haptic patterns into rich Xbox dual-rumble parameters.
   */
  public triggerRumblePattern(pattern: number | number[]): void {
    if (typeof pattern === 'number') {
      if (pattern <= 10) {
        // Subtle micro-tick (XP pickup, laser, plasma)
        this.playRumble(30, 0.05, 0.22);
      } else if (pattern <= 16) {
        // Gunfire / bullet impact / blade slash
        this.playRumble(55, 0.2, 0.42);
      } else if (pattern <= 30) {
        // Shotgun / railgun burst
        this.playRumble(85, 0.45, 0.55);
      } else if (pattern <= 65) {
        // Solid hit
        this.playRumble(110, 0.55, 0.65);
      } else {
        // Heavy impact
        this.playRumble(pattern, 0.75, 0.7);
      }
      return;
    }

    if (Array.isArray(pattern) && pattern.length > 0) {
      const sum = pattern.reduce((acc, v) => acc + v, 0);
      if (pattern.length >= 4 && sum > 150) {
        // Boss arrival / ominous heavy rumble
        this.playRumble(340, 0.95, 0.85);
      } else if (sum > 120) {
        // Heavy blast / explosion
        this.playRumble(240, 0.88, 0.65);
      } else if (sum >= 70) {
        // Player damaged shudder
        this.playRumble(175, 0.9, 0.7);
      } else {
        // Medium pattern
        this.playRumble(95, 0.5, 0.6);
      }
    }
  }

  public getControllerStatus(): GamepadStatus {
    return {
      connected: this.isConnected,
      id: this.getActiveGamepad()?.id ?? '',
      isXbox: this.isXbox,
      name: this.gamepadName || (this.isXbox ? 'XBOX CONTROLLER' : 'CONTROLLER')
    };
  }

  public get hasActiveController(): boolean {
    return this.isConnected;
  }

  public get isXboxController(): boolean {
    return this.isXbox;
  }

  // Unit test mock helper
  public setMockGamepadForTest(gp: any): void {
    this.mockGamepad = gp;
    this.isConnected = Boolean(gp && gp.connected);
    if (gp) {
      this.isXbox = this.isXboxId(gp.id || '') || gp.mapping === 'standard';
      this.gamepadName = this.cleanGamepadName(gp.id || '');
    }
  }
}
