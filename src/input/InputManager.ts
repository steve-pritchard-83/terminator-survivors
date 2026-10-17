export class InputManager {
  private keys = new Set<string>();
  private touchVec = { x: 0, z: 0 };
  private targetAimAngle: number | null = null;
  private mouseScreenPos: { x: number; y: number } | null = null;
  private leftMouseDown = false;
  private dashRequested = false;
  public onDashCallback: (() => void) | null = null;

  private activePointerId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };
  private readonly maxRadius = 56;

  private joystickBaseEl: HTMLElement | null = null;
  private joystickKnobEl: HTMLElement | null = null;

  constructor() {
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
      this.mouseScreenPos = { x: e.clientX, y: e.clientY };
    }
  };

  private onWindowPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && window.innerWidth > 900) {
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
    dashBtnEl: HTMLElement
  ): void {
    this.joystickBaseEl = baseEl;
    this.joystickKnobEl = knobEl;

    touchZoneEl.addEventListener('pointerdown', (e: PointerEvent) => {
      // On desktop viewports (> 900px), ignore mouse clicks so virtual joystick doesn't pop up
      if (e.pointerType === 'mouse' && window.innerWidth > 900) return;
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
      this.dashRequested = true;
      this.onDashCallback?.();
    };
    dashBtnEl.addEventListener('pointerdown', onDash);
    dashBtnEl.addEventListener('touchstart', onDash);
    dashBtnEl.addEventListener('click', onDash);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.dashRequested = true;
      this.onDashCallback?.();
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

  public getMovement(): { x: number; z: number } {
    let kx = 0;
    let kz = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    // Combine keyboard and touch joystick
    let finalX = kx !== 0 ? kx : this.touchVec.x;
    let finalZ = kz !== 0 ? kz : this.touchVec.z;

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

  public setAimAngle(angle: number | null): void {
    this.targetAimAngle = angle;
  }

  public getAimAngle(): number | null {
    return this.targetAimAngle;
  }

  public consumeDash(): boolean {
    const dash = this.dashRequested;
    this.dashRequested = false;
    return dash;
  }

  // Playwright & Unit test helpers
  public setJoystickVectorForTest(x: number, z: number): void {
    this.touchVec = { x, z };
  }

  public triggerDashForTest(): void {
    this.dashRequested = true;
  }
}
