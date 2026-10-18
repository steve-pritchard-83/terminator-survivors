import { globalEvents } from './EventBus';

export class GameLoop {
  public static readonly FIXED_DT = 1 / 60;
  private readonly maxFrameDelta = 0.1;

  private isRunning = false;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  public hitStopTimer = 0;

  // Performance telemetry
  public fps = 60;
  public frameTimeMs = 16.6;
  private frameCount = 0;
  private fpsTimer = 0;

  private readonly onUpdate: (dt: number) => void;
  private readonly onRender: (alpha: number, dt: number) => void;

  public hitStopEnabled = true;

  constructor(
    onUpdate: (dt: number) => void,
    onRender: (alpha: number, dt: number) => void
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;

    // Dynamically toggle hit-stop with reduced motion
    globalEvents.on('settings:updated', (s) => {
      this.hitStopEnabled = !s.reducedMotion;
    });
  }

  public hitStop(seconds: number): void {
    if (!this.hitStopEnabled) return;
    const clamped = Math.min(0.10, Math.max(0, seconds));
    this.hitStopTimer = Math.min(0.12, this.hitStopTimer + clamped);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public get running(): boolean {
    return this.isRunning;
  }

  public tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    let deltaSeconds = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (deltaSeconds > this.maxFrameDelta) {
      deltaSeconds = this.maxFrameDelta;
    }

    // Telemetry tracking
    this.frameCount++;
    this.fpsTimer += deltaSeconds;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameTimeMs = Number(((this.fpsTimer / this.frameCount) * 1000).toFixed(1));
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.accumulator += deltaSeconds;
    while (this.accumulator >= GameLoop.FIXED_DT) {
      if (this.hitStopTimer > 0) {
        this.hitStopTimer = Math.max(0, this.hitStopTimer - GameLoop.FIXED_DT);
        this.onUpdate(0);
      } else {
        this.onUpdate(GameLoop.FIXED_DT);
      }
      this.accumulator -= GameLoop.FIXED_DT;
    }

    const alpha = this.accumulator / GameLoop.FIXED_DT;
    this.onRender(alpha, deltaSeconds);

    this.animFrameId = requestAnimationFrame(this.tick);
  };
}
