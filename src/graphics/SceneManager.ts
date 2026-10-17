import * as THREE from 'three';
import { PostProcessingManager } from './PostProcessing';
import { ProceduralTextures } from './ProceduralTextures';
import { DynamicLightingManager } from './DynamicLightingManager';
import { AtmosphereSystem } from './AtmosphereSystem';
import { globalEvents } from '../core/EventBus';
import type { QualityPreset } from '../core/types';
import { getQualityProfile, detectPresetFromFps } from './qualityPresets';

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly postProcessing: PostProcessingManager;
  public readonly dynamicLighting: DynamicLightingManager;
  public readonly atmosphere: AtmosphereSystem;

  private currentPreset: QualityPreset = 'high';
  private initialFpsSamples: number[] = [];
  private initialSampleTimer = 0;
  private hasAutoDetectedQuality = false;

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
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + trauma);
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

  constructor(container: HTMLElement) {
    const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver === true;

    globalEvents.on('settings:updated', (s) => {
      this.setScreenShakeScale(s.reducedMotion ? 0 : s.screenShake / 100);
      if (s.qualityPreset && s.qualityPreset !== this.currentPreset) {
        this.applyQualityPreset(s.qualityPreset);
      }
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x162840);
    // Camera is ~21.5m from player; starting fog at 23.5m keeps the play area crisp while misting the outer perimeter
    this.scene.fog = new THREE.Fog(0x162840, 23.5, 48.0);
    if (!isAutomated) {
      this.scene.environment = ProceduralTextures.getMetallicEnvMap();
      this.scene.environmentIntensity = 0.5;
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
    this.renderer.toneMappingExposure = 1.2;

    container.appendChild(this.renderer.domElement);

    // Balanced "in-between" nocturnal moonlight: clear battlefield visibility with diffused metallic sheen
    const hemiLight = new THREE.HemisphereLight(0x7aa8d8, 0x203044, 1.25);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0x345070, 1.05);
    this.scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x90bce8, 1.45);
    moonLight.position.set(-16, 30, -14);
    this.scene.add(moonLight);

    // Subtle counter-rim light for silhouettes emerging from the fog
    const rimLight = new THREE.DirectionalLight(0x5288c4, 0.85);
    rimLight.position.set(18, 14, 20);
    this.scene.add(rimLight);

    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);
    this.postProcessing.setSize(width, height);

    this.dynamicLighting = new DynamicLightingManager(this.scene);
    this.atmosphere = new AtmosphereSystem(this.scene);

    window.addEventListener('resize', this.onResize);
  }

  public onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.postProcessing.setSize(width, height);
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
    this.hasAutoDetectedQuality = true;
    this.currentPreset = preset;
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

  public adjustQuality(fps: number, dt = 1 / 60): void {
    // 1. Auto-detect default preset from first 5 s FPS
    if (!this.hasAutoDetectedQuality && fps > 0) {
      this.initialSampleTimer += dt;
      this.initialFpsSamples.push(fps);
      if (this.initialSampleTimer >= 5.0) {
        this.hasAutoDetectedQuality = true;
        const avgFps =
          this.initialFpsSamples.reduce((a, b) => a + b, 0) /
          this.initialFpsSamples.length;
        const deviceRatio =
          typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const detected = detectPresetFromFps(avgFps, deviceRatio);
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

    if (this.qualityCooldownTimer <= 0) {
      if (this.lowFpsDuration >= 3.0 && currentRatio > 1.0) {
        this.applyQualityChange(1.0);
      } else if (this.highFpsDuration >= 3.0) {
        const deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const targetRatio = Math.min(deviceRatio, 1.5);
        if (deviceRatio > 1 && currentRatio < targetRatio) {
          this.applyQualityChange(targetRatio);
        }
      }
    }
  }

  private applyQualityChange(ratio: number): void {
    this.hasAutoDetectedQuality = true;
    this.renderer.setPixelRatio(ratio);
    this.postProcessing.setPixelRatio(ratio);
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    this.postProcessing.setSize(width, height);
    this.dynamicLighting.setEnabled(ratio > 1.0);
    this.atmosphere.setEnabled(ratio > 1.0);
    this.qualityCooldownTimer = 5.0;
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.log(`[SceneManager] Quality adjusted: pixelRatio = ${ratio}`);
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
