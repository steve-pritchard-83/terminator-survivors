import type { SaveManager } from '../state/SaveManager';
import type { GamepadManager } from '../input/GamepadManager';

/** Ignore skip input for this long so button-mashing at the moment of victory doesn't skip it. */
const SKIP_LOCK_MS = 1200;
/** If playback has not started after this long (slow network, unsupported codec), go to the results. */
const START_TIMEOUT_MS = 6000;
/** Hard maximum playback time so a stalled stream never traps the player on the video overlay. */
const MAX_PLAY_MS = 16000;

export interface EndVideoOptions {
  /** Path of the movie under public/, e.g. './video/victory.mp4' */
  url: string;
  testId: string;
  label: string;
}

/**
 * Full-screen end-of-run movie (victory or defeat). Plays once, can be skipped after a short
 * lock (Enter / Space / Escape / tap / click / gamepad A, B or Menu), and always hands control
 * back to the caller, so a missing file, blocked autoplay or offline play never traps the player.
 */
export class EndVideo {
  private readonly container: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly skipHint: HTMLElement;
  private onFinished: ((played: boolean) => void) | null = null;
  private visible = false;
  private startedAt = 0;
  private playedAny = false;
  private startTimer: number | null = null;
  private maxPlayTimer: number | null = null;
  private hintTimer: number | null = null;
  private skipBtn: HTMLButtonElement;
  private prepared = false;

  constructor(
    root: HTMLElement,
    private readonly saveManager: SaveManager,
    private readonly options: EndVideoOptions
  ) {
    this.container = document.createElement('div');
    this.container.setAttribute('data-testid', options.testId);
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', options.label);
    this.container.style.cssText =
      'position:fixed; inset:0; z-index:400; display:none; background:#000; align-items:center; justify-content:center;';

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.preload = 'none';
    this.video.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000;';

    this.skipHint = document.createElement('div');
    this.skipHint.textContent = 'TAP / ENTER / SPACE TO SKIP';
    this.skipHint.style.cssText =
      'position:absolute; right:18px; bottom:14px; font-family:var(--font-mono, monospace); font-size:12px; letter-spacing:2px; color:rgba(242,233,228,0.65); opacity:0; transition:opacity 0.4s; pointer-events:none;';

    this.skipBtn = document.createElement('button');
    this.skipBtn.type = 'button';
    this.skipBtn.className = 'btn-secondary btn-sm';
    this.skipBtn.textContent = 'SKIP >>';
    this.skipBtn.style.cssText = 'position:absolute; right:18px; top:18px; z-index:410;';
    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish(true);
    });

    this.container.append(this.video, this.skipHint, this.skipBtn);
    root.appendChild(this.container);

    this.video.addEventListener('ended', () => this.finish(true));
    this.video.addEventListener('error', () => this.finish(this.playedAny));
    this.video.addEventListener('stalled', () => this.finish(this.playedAny));
    this.video.addEventListener('playing', () => {
      this.playedAny = true;
      if (this.startTimer !== null) {
        window.clearTimeout(this.startTimer);
        this.startTimer = null;
      }
    });

    this.container.addEventListener('pointerdown', () => this.trySkip());
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  /** Starts downloading the movie so it begins instantly when the run ends. */
  public prepare(): void {
    if (this.prepared) return;
    this.prepared = true;
    this.video.preload = 'auto';
    this.video.src = this.options.url;
    this.video.load();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * Shows the movie after an optional lead-in (so the moment of death or victory is seen first).
   * `onFinished(played)` fires exactly once when it ends, is skipped or fails.
   */
  public play(onFinished: (played: boolean) => void, leadInMs = 0): void {
    if (leadInMs > 0) {
      window.setTimeout(() => this.play(onFinished, 0), leadInMs);
      return;
    }
    this.onFinished = onFinished;
    this.visible = true;
    this.playedAny = false;
    this.startedAt = performance.now();
    this.container.style.display = 'flex';
    this.skipHint.style.opacity = '0';
    this.hintTimer = window.setTimeout(() => {
      this.skipHint.style.opacity = '1';
    }, SKIP_LOCK_MS);

    if (!this.prepared) this.prepare();
    this.video.currentTime = 0;
    const settings = this.saveManager.getData().settings;
    this.video.muted = false;
    this.video.volume = Math.max(0, Math.min(1, settings.masterVolume));

    this.startTimer = window.setTimeout(() => this.finish(this.playedAny), START_TIMEOUT_MS);
    this.maxPlayTimer = window.setTimeout(() => this.finish(this.playedAny), MAX_PLAY_MS);

    const attempt = this.video.play();
    if (attempt) {
      attempt.catch(() => {
        // Autoplay with sound was blocked: show it silently rather than not at all
        this.video.muted = true;
        this.video.play().catch(() => this.finish(false));
      });
    }
  }

  public handleGamepad(gp: GamepadManager): boolean {
    if (!this.visible) return false;
    if (gp.isMenuConfirmPressed() || gp.isMenuCancelPressed()) this.trySkip();
    return true;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.visible) return;
    // Swallow all keys while the movie is up so nothing underneath reacts
    e.stopPropagation();
    e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') this.trySkip();
  };

  private trySkip(): void {
    if (!this.visible || performance.now() - this.startedAt < SKIP_LOCK_MS) return;
    this.finish(true);
  }

  private finish(played: boolean): void {
    if (!this.visible) return;
    this.visible = false;
    if (this.startTimer !== null) window.clearTimeout(this.startTimer);
    if (this.maxPlayTimer !== null) window.clearTimeout(this.maxPlayTimer);
    if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
    this.startTimer = null;
    this.maxPlayTimer = null;
    this.hintTimer = null;
    this.video.pause();
    this.container.style.display = 'none';
    const cb = this.onFinished;
    this.onFinished = null;
    cb?.(played);
  }
}
