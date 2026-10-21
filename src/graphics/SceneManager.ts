import * as THREE from 'three';
import { COMPACT_VIEW_MAX_WIDTH, SHAKE_EVENT_CAP, SHAKE_TRAUMA_CAP, VIEW_PROFILES } from '../data/balance';
import { PostProcessingManager, isMobileGpuDevice } from './PostProcessing';
import { ProceduralTextures } from './ProceduralTextures';
import { DynamicLightingManager } from './DynamicLightingManager';
import { AtmosphereSystem } from './AtmosphereSystem';
import { globalEvents } from '../core/EventBus';
import type { QualityPreset } from '../core/types';
import { getQualityProfile, detectPresetFromFps } from './qualityPresets';
import { LIGHTING, PALETTE } from '../data/artDirection';
import { RENDER_BUDGET } from '../data/performance';

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

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 250);
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

    this.camera.position.set(
      this.currentCameraTarget.x + this.cameraOffset.x + shakeX,
      this.currentCameraTarget.y + this.cameraOffset.y,
      this.currentCameraTarget.z + this.cameraOffset.z + shakeZ
    );
    this.camera.lookAt(this.currentCameraTarget);
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
