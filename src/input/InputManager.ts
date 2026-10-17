import { GamepadManager } from './GamepadManager';

export class InputManager {
  public readonly gamepadManager: GamepadManager;
  public lastActiveDevice: 'gamepad' | 'mouse_keyboard' | 'touch' = 'mouse_keyboard';
  private keys = new Set<string>();
  private touchVec = { x: 0, z: 0 };
  private targetAimAngle: number | null = null;
  private mouseScreenPos: { x: number; y: number } | null = null;
  private leftMouseDown = false;
  private dashRequested = false;
  private abilityRequested = false;
  public onDashCallback: (() => void) | null = null;
  public onAbilityCallback: (() => void) | null = null;
  public onPauseCallback: (() => void) | null = null;

  private activePointerId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };
  private readonly maxRadius = 56;

  private joystickBaseEl: HTMLElement | null = null;
  private joystickKnobEl: HTMLElement | null = null;

  constructor() {
    this.gamepadManager = new GamepadManager();
    this.gamepadManager.onDashCallback = () => {
      this.dashRequested = true;
      this.onDashCallback?.();
    };
    this.gamepadManager.onAbilityCallback = () => {
      this.abilityRequested = true;
      this.onAbilityCallback?.();
    };
    this.gamepadManager.onPauseCallback = () => {
      this.onPauseCallback?.();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('pointermove', this.onWindowPointerMove);
      window.addEventListener('pointerdown', this.onWindowPointerDown);
      window.addEventListener('pointerup', this.onWindowPointerUp);
      window.addEventListener('blur', this.onWindowBlur);
      window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }
  }

  private isInteractiveUiTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest('button, .upgrade-card, .btn-primary, .btn-secondary, .btn-mobile-dash, input')
    );
  }

  private onWindowPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && window.innerWidth > 900) {
      if (Math.abs(e.movementX) > 1 || Math.abs(e.movementY) > 1) {
        this.lastActiveDevice = 'mouse_keyboard';
        this.mouseScreenPos = { x: e.clientX, y: e.clientY };
      }
    }
  };

  private onWindowPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && window.innerWidth > 900) {
      this.lastActiveDevice = 'mouse_keyboard';
      this.mouseScreenPos = { x: e.clientX, y: e.clientY };
      if (e.button === 2) {
        // Right-click triggers Combat Dive / Dash
        this.dashRequested = true;
        this.onDashCallback?.();
      } else if (e.button === 0 && !this.isInteractiveUiTarget(e.target)) {
        this.leftMouseDown = true;
      }
    }
  };

  private onWindowPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button === 0) {
      this.leftMouseDown = false;
    }
  };

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.leftMouseDown = false;
  };

  public setupTouchControls(
    touchZoneEl: HTMLElement,
    baseEl: HTMLElement,
    knobEl: HTMLElement,
    dashBtnEl: HTMLElement,
    abilityBtnEl?: HTMLElement
  ): void {
    this.joystickBaseEl = baseEl;
    this.joystickKnobEl = knobEl;

    touchZoneEl.addEventListener('pointerdown', (e: PointerEvent) => {
      // On desktop viewports (> 900px), ignore mouse clicks so virtual joystick doesn't pop up
      if (e.pointerType === 'mouse' && window.innerWidth > 900) return;
      this.lastActiveDevice = 'touch';
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.joystickOrigin = { x: e.clientX, y: e.clientY };

      baseEl.style.display = 'block';
      baseEl.style.left = `${e.clientX}px`;
      baseEl.style.top = `${e.clientY}px`;
      knobEl.style.transform = 'translate(-50%, -50%)';
    });

    touchZoneEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      const dx = e.clientX - this.joystickOrigin.x;
      const dy = e.clientY - this.joystickOrigin.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, this.maxRadius);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      knobEl.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

      this.touchVec.x = knobX / this.maxRadius;
      this.touchVec.z = knobY / this.maxRadius;
    });

    const resetTouch = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.touchVec = { x: 0, z: 0 };
      baseEl.style.display = 'none';
      knobEl.style.transform = 'translate(-50%, -50%)';
    };

    touchZoneEl.addEventListener('pointerup', resetTouch);
    touchZoneEl.addEventListener('pointercancel', resetTouch);

    // Mobile Dash Touch Button
    const onDash = (e: Event) => {
      e.preventDefault();
      this.lastActiveDevice = 'touch';
      this.dashRequested = true;
      this.onDashCallback?.();
    };
    dashBtnEl.addEventListener('pointerdown', onDash);
    dashBtnEl.addEventListener('touchstart', onDash);
    dashBtnEl.addEventListener('click', onDash);

    // Mobile Ability Touch Button
    if (abilityBtnEl) {
      const onAbility = (e: Event) => {
        e.preventDefault();
        this.lastActiveDevice = 'touch';
        this.abilityRequested = true;
        this.onAbilityCallback?.();
      };
      abilityBtnEl.addEventListener('pointerdown', onAbility);
      abilityBtnEl.addEventListener('touchstart', onAbility);
      abilityBtnEl.addEventListener('click', onAbility);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.lastActiveDevice = 'mouse_keyboard';
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.dashRequested = true;
      this.onDashCallback?.();
    } else if (e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'KeyF') {
      this.abilityRequested = true;
      this.onAbilityCallback?.();
    } else if (e.code === 'Escape') {
      this.onPauseCallback?.();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  public hasKeyboardMovement(): boolean {
    return (
      this.keys.has('KeyW') ||
      this.keys.has('ArrowUp') ||
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown') ||
      this.keys.has('KeyA') ||
      this.keys.has('ArrowLeft') ||
      this.keys.has('KeyD') ||
      this.keys.has('ArrowRight')
    );
  }

  public update(dt: number): void {
    this.gamepadManager.update(dt);
    if (this.gamepadManager.hasRecentInput()) {
      this.lastActiveDevice = 'gamepad';
    }
  }

  public getMovement(): { x: number; z: number } {
    let kx = 0;
    let kz = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    // Combine keyboard, touch joystick, and Xbox / Gamepad controller
    const gpMove = this.gamepadManager.getMovement();
    let finalX = kx !== 0 ? kx : gpMove ? gpMove.x : this.touchVec.x;
    let finalZ = kz !== 0 ? kz : gpMove ? gpMove.z : this.touchVec.z;

    const len = Math.hypot(finalX, finalZ);
    if (len > 1.0) {
      finalX /= len;
      finalZ /= len;
    }

    return { x: finalX, z: finalZ };
  }

  public getMouseScreenPos(): { x: number; y: number } | null {
    return this.mouseScreenPos;
  }

  public isMouseMoveActive(): boolean {
    return this.leftMouseDown;
  }

  public isMouseAimActive(): boolean {
    return this.lastActiveDevice === 'mouse_keyboard';
  }

  public setAimAngle(angle: number | null): void {
    this.targetAimAngle = angle;
  }

  public getAimAngle(): number | null {
    if (this.lastActiveDevice === 'gamepad') {
      // Twin-stick right stick aiming returns angle ONLY when actively pushed;
      // when sticks are released/neutral, returns null so character never snaps to idle mouse!
      return this.gamepadManager.getAimAngle();
    }
    if (this.lastActiveDevice === 'mouse_keyboard') {
      return this.targetAimAngle;
    }
    return null;
  }

  public consumeDash(): boolean {
    const dash = this.dashRequested || this.gamepadManager.consumeDash();
    this.dashRequested = false;
    return dash;
  }

  public clearDashRequest(): void {
    this.dashRequested = false;
    this.gamepadManager.clearDashRequest();
  }

  public consumeAbility(): boolean {
    const ability = this.abilityRequested || this.gamepadManager.consumeAbility();
    this.abilityRequested = false;
    return ability;
  }

  public clearAbilityRequest(): void {
    this.abilityRequested = false;
    this.gamepadManager.clearAbilityRequest();
  }

  // Playwright & Unit test helpers
  public setJoystickVectorForTest(x: number, z: number): void {
    this.touchVec = { x, z };
  }

  public triggerDashForTest(): void {
    this.dashRequested = true;
  }

  public triggerAbilityForTest(): void {
    this.abilityRequested = true;
  }
}
