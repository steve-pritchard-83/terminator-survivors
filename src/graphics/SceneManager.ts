import * as THREE from 'three';
import { COMPACT_VIEW_MAX_WIDTH, SHAKE_EVENT_CAP, SHAKE_TRAUMA_CAP, VIEW_PROFILES } from '../data/balance';
import { PostProcessingManager, isMobileGpuDevice } from './PostProcessing';
import { ProceduralTextures } from './ProceduralTextures';
import { DynamicLightingManager } from './DynamicLightingManager';
import { AtmosphereSystem } from './AtmosphereSystem';
import { globalEvents } from '../core/EventBus';
import type { QualityPreset } from '../core/types';
import { getQualityProfile, detectPresetFromFps } from './qualityPresets';
import { LIGHTING, PALETTE, XR_VIEW } from '../data/artDirection';
import { RENDER_BUDGET } from '../data/performance';

/** What the VR centre panel shows */
export interface XrPanel {
  title: string;
  cards?: Array<{ title: string; sub: string; line: string; hint?: string }>;
  selected?: number;
  footer?: string;
}

/** Centred, word-wrapped text, at most `maxLines` lines (the last one trimmed with an ellipsis). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly postProcessing: PostProcessingManager;
  public readonly dynamicLighting: DynamicLightingManager;
  public readonly atmosphere: AtmosphereSystem;

  private currentPreset: QualityPreset = 'auto';
  private initialFpsSamples: number[] = [];
  private initialSampleTimer = 0;
  private hasAutoDetectedQuality = false;

  private readonly baseCameraOffset = new THREE.Vector3(0, 17.5, 12.5);
  private readonly cameraOffset = new THREE.Vector3(0, 17.5, 12.5);
  private currentCameraTarget = new THREE.Vector3(0, 0, 0);
  private readonly tempTarget = new THREE.Vector3();
  private readonly screenScratch = new THREE.Vector3();
  private shakeTrauma = 0;
  private screenShakeScale = 1.0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
  private readonly intersectPt = new THREE.Vector3();
  private readonly ndcMouse = new THREE.Vector2();

  private lowFpsDuration = 0;
  private highFpsDuration = 0;
  private qualityCooldownTimer = 0;

  // Stereoscopic 3D Side-by-Side (SBS) & WebXR VR Diorama support (Meta Quest 2)
  public stereo3DEnabled = false;
  private readonly stereoCamera = new THREE.StereoCamera();
  public readonly xrRig = new THREE.Group();
  private xrHudSprite: THREE.Sprite | null = null;
  private xrHudCanvas: HTMLCanvasElement | null = null;
  private xrHudTex: THREE.CanvasTexture | null = null;
  private lastXrHudText = '';
  private xrBannerText = '';
  private xrBannerUntil = 0;

  private xrPanel: THREE.Sprite | null = null;
  private xrPanelCanvas: HTMLCanvasElement | null = null;
  private xrPanelTex: THREE.CanvasTexture | null = null;

  /**
   * The large panel in front of the viewer in VR (pause, level-up choices, run result); null hides it.
   * Cards are drawn side by side and the selected one is outlined.
   */
  public setXrPanel(panel: XrPanel | null): void {
    if (!panel) {
      if (this.xrPanel) this.xrPanel.visible = false;
      return;
    }
    if (typeof document === 'undefined') return;
    if (!this.xrPanel || !this.xrPanelCanvas || !this.xrPanelTex) {
      this.xrPanelCanvas = document.createElement('canvas');
      this.xrPanelCanvas.width = 1024;
      this.xrPanelCanvas.height = 512;
      this.xrPanelTex = new THREE.CanvasTexture(this.xrPanelCanvas);
      this.xrPanelTex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: this.xrPanelTex, transparent: true, depthTest: false, depthWrite: false });
      this.xrPanel = new THREE.Sprite(mat);
      this.xrPanel.scale.set(XR_VIEW.panelWidth, XR_VIEW.panelWidth / 2, 1);
      this.xrPanel.renderOrder = 1000;
      this.scene.add(this.xrPanel);
    }
    const ctx = this.xrPanelCanvas.getContext('2d');
    if (!ctx) return;
    const W = 1024;
    const H = 512;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(7, 9, 11, 0.86)';
    ctx.fillRect(6, 6, W - 12, H - 12);
    ctx.strokeStyle = '#cdd7de';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2e9e4';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(panel.title, W / 2, 84);
    const cards = panel.cards ?? [];
    if (cards.length > 0) {
      const gap = 18;
      const cw = (W - 60 - gap * (cards.length - 1)) / cards.length;
      cards.forEach((c, i) => {
        const x = 30 + i * (cw + gap);
        const y = 120;
        const h = 300;
        const sel = i === panel.selected;
        ctx.fillStyle = sel ? 'rgba(95, 200, 238, 0.18)' : 'rgba(42, 49, 55, 0.6)';
        ctx.fillRect(x, y, cw, h);
        ctx.strokeStyle = sel ? '#5fc8ee' : '#56616b';
        ctx.lineWidth = sel ? 6 : 2;
        ctx.strokeRect(x, y, cw, h);
        ctx.fillStyle = sel ? '#ffffff' : '#cdd7de';
        ctx.font = 'bold 30px monospace';
        wrapText(ctx, c.title.toUpperCase(), x + cw / 2, y + 52, cw - 24, 34, 2);
        ctx.fillStyle = '#5fc8ee';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(c.sub, x + cw / 2, y + 140);
        ctx.fillStyle = '#cdd7de';
        ctx.font = '22px monospace';
        wrapText(ctx, c.line, x + cw / 2, y + 188, cw - 24, 26, 3);
        if (c.hint) {
          ctx.fillStyle = '#ffb000';
          ctx.font = 'bold 18px monospace';
          wrapText(ctx, c.hint, x + cw / 2, y + 276, cw - 20, 20, 1);
        }
      });
    }
    if (panel.footer) {
      ctx.fillStyle = '#56c8ee';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(panel.footer, W / 2, cards.length > 0 ? 470 : 300);
    }
    this.xrPanelTex.needsUpdate = true;
    this.xrPanel.visible = true;
    this.placeXrPanel();
  }

  private placeXrPanel(): void {
    if (!this.xrPanel?.visible) return;
    this.xrPanel.position.set(
      this.currentCameraTarget.x,
      XR_VIEW.panelHeight,
      this.currentCameraTarget.z + XR_VIEW.panelForward
    );
  }

  public setXrBanner(text: string, durationSec = 3.5): void {
    this.xrBannerText = text;
    this.xrBannerUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + durationSec * 1000;
    this.lastXrHudText = '';
  }

  public getQualityGovernorState(): {
    pixelRatio: number;
    lowFpsDuration: number;
    highFpsDuration: number;
    cooldownTimer: number;
  } {
    return {
      pixelRatio: this.renderer.getPixelRatio(),
      lowFpsDuration: this.lowFpsDuration,
      highFpsDuration: this.highFpsDuration,
      cooldownTimer: this.qualityCooldownTimer
    };
  }

  public getCameraTarget(out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.currentCameraTarget);
  }

  public addScreenShake(trauma: number): void {
    // Per-event and total caps keep stacked boss effects from throwing the camera around.
    this.shakeTrauma = Math.min(SHAKE_TRAUMA_CAP, this.shakeTrauma + Math.min(trauma, SHAKE_EVENT_CAP));
  }

  public setScreenShakeScale(scale: number): void {
    this.screenShakeScale = Math.max(0, Math.min(2.0, scale));
  }

  public get shakeScale(): number {
    return this.screenShakeScale;
  }

  public get qualityPreset(): QualityPreset {
    return this.currentPreset;
  }

  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private moonLight: THREE.DirectionalLight;
  private fireFill: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver === true;

    globalEvents.on('settings:updated', (s) => {
      this.setScreenShakeScale(s.reducedMotion ? 0 : s.screenShake / 100);
      if (s.qualityPreset) {
        this.applyQualityPreset(s.qualityPreset);
      }
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    // Camera is ~21.5m from the player: the play area stays crisp, the perimeter fades into blue-grey smoke
    this.scene.fog = new THREE.Fog(PALETTE.fog, LIGHTING.fogNear, LIGHTING.fogFar);
    if (!isAutomated) {
      this.scene.environment = ProceduralTextures.getMetallicEnvMap();
      this.scene.environmentIntensity = LIGHTING.envIntensity;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(48, width / height, 1.0, 250);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !isAutomated,
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isAutomated ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LIGHTING.exposure;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local');
    // Stereo at native headset resolution overloads a Quest 2's GPU: a little below native, with the
    // edges of each eye drawn at lower detail, and a steady 72 Hz instead of chasing 90
    this.renderer.xr.setFramebufferScaleFactor(XR_VIEW.resolutionScale);
    this.renderer.xr.setFoveation(XR_VIEW.foveation);
    this.stereoCamera.eyeSep = 0.65; // Exaggerated tactical diorama depth for Quest 2 3D mode

    this.xrRig.position.copy(this.cameraOffset);
    this.xrRig.rotation.set(-0.55, 0, 0);
    this.scene.add(this.xrRig);

    this.renderer.xr.addEventListener('sessionstart', () => {
      const session = this.renderer.xr.getSession() as (XRSession & { updateTargetFrameRate?: (r: number) => Promise<void> }) | null;
      void session?.updateTargetFrameRate?.(XR_VIEW.frameRate).catch(() => {});
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.xrRig.add(this.camera);
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this.xrRig.remove(this.camera);
      this.camera.position.copy(this.cameraOffset);
      this.camera.lookAt(this.currentCameraTarget);
    });

    container.appendChild(this.renderer.domElement);

    // Cold sky from above, fire bounce from below: tops read blue, undersides warm
    this.hemiLight = new THREE.HemisphereLight(LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(LIGHTING.ambient, LIGHTING.ambientIntensity);
    this.scene.add(this.ambientLight);

    // Moon key from behind the action, so chrome and silhouettes get bright rims towards the camera
    this.moonLight = new THREE.DirectionalLight(PALETTE.moon, LIGHTING.moonIntensity);
    this.moonLight.position.set(...LIGHTING.moonPosition);
    this.scene.add(this.moonLight);

    // Low warm fill from the burning horizon
    this.fireFill = new THREE.DirectionalLight(LIGHTING.fireFill, LIGHTING.fireFillIntensity);
    this.fireFill.position.set(...LIGHTING.fireFillPosition);
    this.scene.add(this.fireFill);

    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);
    this.postProcessing.setSize(width, height);

    this.dynamicLighting = new DynamicLightingManager(this.scene);
    this.atmosphere = new AtmosphereSystem(this.scene);

    window.addEventListener('resize', this.onResize);
    this.applyViewProfile();
  }

  /** Phones and small screens get a closer camera and a brighter scene. */
  private applyViewProfile(): void {
    const compact = isMobileGpuDevice() || window.innerWidth <= COMPACT_VIEW_MAX_WIDTH;
    const p = compact ? VIEW_PROFILES.compact : VIEW_PROFILES.desktop;
    this.cameraOffset.copy(this.baseCameraOffset).multiplyScalar(p.cameraZoom);
    this.renderer.toneMappingExposure = p.exposure;
    this.hemiLight.intensity = p.hemiIntensity;
    this.ambientLight.intensity = p.ambientIntensity;
    // The machines are mostly metal, which shows reflections rather than the ambient fill
    if (this.scene.environment) this.scene.environmentIntensity = p.envIntensity;
  }

  public onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.postProcessing.setSize(width, height);
    this.applyViewProfile();
  };

  public updateCamera(targetX: number, targetZ: number, dt: number): void {
    this.tempTarget.set(targetX, 0, targetZ);
    // Tight, responsive camera tracking
    this.currentCameraTarget.lerp(this.tempTarget, Math.min(1, dt * 28));
    this.dynamicLighting.setPlayerPos(this.currentCameraTarget.x, this.currentCameraTarget.z);

    // Trauma-based Camera Shake
    let shakeX = 0;
    let shakeZ = 0;
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.4);
      const shake = this.shakeTrauma * this.shakeTrauma * 0.7 * this.screenShakeScale;
      const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
      shakeX = Math.sin(t * 0.045) * shake;
      shakeZ = Math.cos(t * 0.055) * shake;
    }

    if (this.renderer.xr.isPresenting) {
      this.xrRig.position.set(
        this.currentCameraTarget.x + shakeX,
        this.currentCameraTarget.y + XR_VIEW.height,
        this.currentCameraTarget.z + XR_VIEW.back + shakeZ
      );
      this.xrRig.rotation.set(XR_VIEW.pitch, 0, 0);
      this.xrRig.scale.setScalar(XR_VIEW.viewerScale);
      this.placeXrPanel();
      return;
    }

    this.camera.position.set(
      this.currentCameraTarget.x + this.cameraOffset.x + shakeX,
      this.currentCameraTarget.y + this.cameraOffset.y,
      this.currentCameraTarget.z + this.cameraOffset.z + shakeZ
    );
    this.camera.lookAt(this.currentCameraTarget);
  }

  public toggleStereo3D(): boolean {
    this.stereo3DEnabled = !this.stereo3DEnabled;
    document.body.classList.toggle('stereo-sbs-active', this.stereo3DEnabled);
    this.onResize();
    return this.stereo3DEnabled;
  }

  /** Updates the floating 3D holographic status bar above Kyle when in WebXR or 3D mode. */
  public updateXrHoloHud(hp: number, maxHp: number, level: number, timeSec: number, bossName?: string, bossPct?: number): void {
    if (!this.renderer.xr.isPresenting && !this.stereo3DEnabled) {
      if (this.xrHudSprite) this.xrHudSprite.visible = false;
      return;
    }
    if (!this.xrHudCanvas || !this.xrHudSprite || !this.xrHudTex) {
      this.xrHudCanvas = document.createElement('canvas');
      this.xrHudCanvas.width = 512;
      this.xrHudCanvas.height = 96;
      this.xrHudTex = new THREE.CanvasTexture(this.xrHudCanvas);
      const mat = new THREE.SpriteMaterial({ map: this.xrHudTex, transparent: true, depthTest: false, depthWrite: false });
      this.xrHudSprite = new THREE.Sprite(mat);
      this.xrHudSprite.scale.set(XR_VIEW.hudWidth, XR_VIEW.hudWidth * (96 / 512), 1);
      this.xrHudSprite.renderOrder = 999;
      this.scene.add(this.xrHudSprite);
    }
    this.xrHudSprite.visible = true;
    // Low and between the viewer and Kyle, at the bottom of the view rather than over the fight
    this.xrHudSprite.position.set(this.currentCameraTarget.x, XR_VIEW.hudHeight, this.currentCameraTarget.z + XR_VIEW.hudForward);

    const sec = Math.floor(timeSec);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const banner = now < this.xrBannerUntil ? this.xrBannerText : '';
    const key = `${Math.round(hp)}/${maxHp}|${level}|${sec}|${bossName ?? ''}|${Math.round((bossPct ?? 0) * 100)}|${banner}`;
    if (key === this.lastXrHudText) return;
    this.lastXrHudText = key;

    const ctx = this.xrHudCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = 'rgba(7, 9, 11, 0.55)';
    ctx.fillRect(8, 8, 496, 80);
    ctx.strokeStyle = '#cdd7de';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 496, 80);

    // HP Bar
    const hpRatio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    ctx.fillStyle = '#2a3137';
    ctx.fillRect(22, 22, 240, 18);
    ctx.fillStyle = hpRatio < 0.25 ? '#ffb000' : '#ff2a1a';
    ctx.fillRect(22, 22, Math.round(240 * hpRatio), 18);

    // Level & Clock
    const mm = Math.floor(sec / 60).toString().padStart(2, '0');
    const ss = (sec % 60).toString().padStart(2, '0');
    ctx.fillStyle = '#f2e9e4';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`LV ${level}   ${mm}:${ss}`, 280, 38);

    if (banner) {
      ctx.fillStyle = '#ffb000';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(banner.slice(0, 42), 22, 70);
    } else if (bossName && bossPct !== undefined) {
      ctx.fillStyle = '#ff2a1a';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${bossName.slice(0, 22)} (${Math.round(bossPct * 100)}%)`, 22, 70);
    } else {
      ctx.fillStyle = '#5fc8ee';
      ctx.font = '15px monospace';
      ctx.fillText(`HP ${Math.round(hp)}/${maxHp} · 3D VR DIORAMA`, 22, 70);
    }
    this.xrHudTex.needsUpdate = true;
  }

  public screenToWorldGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    this.ndcMouse.x = (clientX / width) * 2 - 1;
    this.ndcMouse.y = -(clientY / height) * 2 + 1;

    this.raycaster.setFromCamera(this.ndcMouse, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.aimPlane, this.intersectPt);
    if (!hit) return null;
    return { x: this.intersectPt.x, z: this.intersectPt.z };
  }

  /**
   * True when a point on the battlefield (at enemy height) is inside the visible screen. A margin above 1
   * widens the test past the edges (1.1 = ten percent beyond).
   */
  public isOnScreen(x: number, z: number, margin = 1): boolean {
    this.screenScratch.set(x, 0.9, z).project(this.camera);
    return this.screenScratch.z < 1 && Math.abs(this.screenScratch.x) <= margin && Math.abs(this.screenScratch.y) <= margin;
  }

  /**
   * How far the screen reaches over the ground from the player in the given direction (radians, 0 = +z),
   * in metres. The camera sits behind the player, so the bottom of the screen is much closer than the top.
   */
  public getReachAlong(angle: number): number {
    const target = this.currentCameraTarget;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    let reach = 0;
    for (let m = 0.5; m <= 40; m += 0.5) {
      if (!this.isOnScreen(target.x + dx * m, target.z + dz * m)) break;
      reach = m;
    }
    return reach;
  }

  /** The average distance from the player to the four screen edges over the ground, in metres. */
  public getReachRadius(): number {
    const cam = this.camera.position;
    const target = this.currentCameraTarget;
    let sum = 0;
    let count = 0;
    for (const [nx, ny] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      this.screenScratch.set(nx, ny, 0.5).unproject(this.camera);
      const dy = this.screenScratch.y - cam.y;
      if (dy >= -1e-4) continue;
      const t = -cam.y / dy;
      const gx = cam.x + (this.screenScratch.x - cam.x) * t;
      const gz = cam.z + (this.screenScratch.z - cam.z) * t;
      sum += Math.hypot(gx - target.x, gz - target.z);
      count++;
    }
    return count > 0 ? sum / count : 14;
  }

  /**
   * Where to draw an arrow for an off-screen point (at enemy height): a spot `inset` pixels inside the
   * screen edge in the point's direction, and the arrow's angle (radians, screen space). Null when on screen.
   */
  public getEdgePointer(x: number, z: number, inset: number): { x: number; y: number; angle: number } | null {
    if (typeof window === 'undefined') return null;
    this.screenScratch.set(x, 0.9, z).project(this.camera);
    let nx = this.screenScratch.x;
    let ny = this.screenScratch.y;
    const behind = this.screenScratch.z > 1;
    if (!behind && Math.abs(nx) <= 1 && Math.abs(ny) <= 1) return null;
    if (behind) {
      nx = -nx;
      ny = -ny;
    }
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const dx = (nx * w) / 2;
    const dy = (-ny * h) / 2;
    const s = Math.min((w / 2 - inset) / Math.max(1e-6, Math.abs(dx)), (h / 2 - inset) / Math.max(1e-6, Math.abs(dy)));
    return { x: w / 2 + dx * s, y: h / 2 + dy * s, angle: Math.atan2(dy, dx) };
  }

  public worldToScreen(
    worldX: number,
    worldY: number,
    worldZ: number
  ): { x: number; y: number } | null {
    if (typeof window === 'undefined') return null;
    this.screenScratch.set(worldX, worldY, worldZ);
    this.screenScratch.project(this.camera);

    if (this.screenScratch.z > 1) return null;

    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const x = (this.screenScratch.x * 0.5 + 0.5) * width;
    const y = (-this.screenScratch.y * 0.5 + 0.5) * height;
    return { x, y };
  }

  public getQualityPreset(): QualityPreset {
    return this.currentPreset;
  }

  public getAutoDetectionStatus(): { detected: boolean; preset: QualityPreset; timer: number } {
    return {
      detected: this.hasAutoDetectedQuality,
      preset: this.currentPreset,
      timer: this.initialSampleTimer
    };
  }

  public applyQualityPreset(preset: QualityPreset): void {
    this.currentPreset = preset;
    this.hasAutoDetectedQuality = preset !== 'auto';
    const profile = getQualityProfile(preset);

    this.renderer.setPixelRatio(profile.pixelRatio);
    this.postProcessing.setPixelRatio(profile.pixelRatio);
    this.postProcessing.setBloomEnabled?.(profile.bloom);
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = profile.shadows;
    }
    this.dynamicLighting.setEnabled(profile.dynamicLights);
    this.atmosphere.setEnabled(profile.atmosphere);

    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    this.postProcessing.setSize(width, height);
    globalEvents.emit('quality:preset_changed', { preset });
  }

  public applyStage(stage: {
    fogColor: number;
    fogDensity: number;
    skyZenith: number;
    skyHorizon: number;
    ambientLightColor: number;
    directionalLightColor: number;
  }): void {
    const bgColor = new THREE.Color(stage.skyZenith);
    this.scene.background = bgColor;
    const fogColor = new THREE.Color(stage.fogColor);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color = fogColor;
      // Convert density (e.g. 0.015 - 0.02) to distance ranges
      const far = Math.max(35, 1.0 / (stage.fogDensity || 0.016));
      this.scene.fog.near = far * 0.45;
      this.scene.fog.far = far;
    }
    this.ambientLight.color.setHex(stage.ambientLightColor);
    this.moonLight.color.setHex(stage.directionalLightColor);
  }

  public adjustQuality(fps: number, dt = 1 / 60): void {
    // 1. Auto-detect default preset from first 5 s FPS (only if preset is 'auto')
    if (this.currentPreset === 'auto' && !this.hasAutoDetectedQuality && fps > 0) {
      this.initialSampleTimer += dt;
      this.initialFpsSamples.push(fps);
      if (this.initialSampleTimer >= 5.0) {
        this.hasAutoDetectedQuality = true;
        const avgFps =
          this.initialFpsSamples.reduce((a, b) => a + b, 0) /
          this.initialFpsSamples.length;
        const deviceRatio =
          typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const detected = detectPresetFromFps(avgFps, deviceRatio, RENDER_BUDGET.maxAutoPreset);
        this.applyQualityPreset(detected);
        globalEvents.emit('quality:autodetected', { preset: detected, avgFps });
      }
    }

    if (this.qualityCooldownTimer > 0) {
      this.qualityCooldownTimer = Math.max(0, this.qualityCooldownTimer - dt);
    }

    if (fps < 42) {
      this.lowFpsDuration += dt;
      this.highFpsDuration = 0;
    } else if (fps >= 58) {
      this.highFpsDuration += dt;
      this.lowFpsDuration = 0;
    } else {
      this.lowFpsDuration = 0;
      this.highFpsDuration = 0;
    }

    const currentRatio = this.renderer.getPixelRatio();
    const profile = getQualityProfile(this.currentPreset);

    if (this.qualityCooldownTimer <= 0) {
      if (this.lowFpsDuration >= RENDER_BUDGET.lowFpsSeconds && currentRatio > profile.minPixelRatio) {
        this.applyQualityChange(profile.minPixelRatio);
      } else if (this.highFpsDuration >= 3.0 && currentRatio < profile.maxPixelRatio) {
        this.applyQualityChange(profile.maxPixelRatio);
      }
    }
  }

  private applyQualityChange(ratio: number): void {
    this.hasAutoDetectedQuality = true;
    const profile = getQualityProfile(this.currentPreset);
    const clampedRatio = Math.max(profile.minPixelRatio, Math.min(profile.maxPixelRatio, ratio));
    this.renderer.setPixelRatio(clampedRatio);
    this.postProcessing.setPixelRatio(clampedRatio);
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    this.postProcessing.setSize(width, height);
    this.qualityCooldownTimer = 5.0;
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.log(`[SceneManager] Quality adjusted: pixelRatio = ${clampedRatio}`);
    }
  }

  public render(dt: number, timeSeconds: number): void {
    this.dynamicLighting.update(dt);
    this.atmosphere.update(dt, this.currentCameraTarget.x, this.currentCameraTarget.z);
    if (this.renderer.xr.isPresenting) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.stereo3DEnabled) {
      this.scene.updateMatrixWorld();
      if (this.camera.parent === null) this.camera.updateMatrixWorld();
      this.stereoCamera.update(this.camera);
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      const halfW = size.width / 2;
      const h = size.height;
      const prevAutoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.setScissorTest(true);
      this.renderer.clear();

      this.renderer.setScissor(0, 0, halfW, h);
      this.renderer.setViewport(0, 0, halfW, h);
      this.renderer.render(this.scene, this.stereoCamera.cameraL);

      this.renderer.setScissor(halfW, 0, halfW, h);
      this.renderer.setViewport(halfW, 0, halfW, h);
      this.renderer.render(this.scene, this.stereoCamera.cameraR);

      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, size.width, h);
      this.renderer.autoClear = prevAutoClear;
      return;
    }
    this.postProcessing.update(dt, timeSeconds);
    this.postProcessing.render();
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.dynamicLighting.dispose();
    this.atmosphere.dispose();
    this.renderer.dispose();
  }
}
