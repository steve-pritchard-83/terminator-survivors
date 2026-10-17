import * as THREE from 'three';
import { PALETTE } from '../data/palette';
import { PostProcessingManager } from './PostProcessing';

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly postProcessing: PostProcessingManager;

  private readonly cameraOffset = new THREE.Vector3(0, 18, 13);
  private currentCameraTarget = new THREE.Vector3(0, 0, 0);

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyZenith);
    this.scene.fog = new THREE.FogExp2(PALETTE.fogColor, PALETTE.fogDensity);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 250);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.appendChild(this.renderer.domElement);

    // Setup Lighting (Cameron Cobalt Moonlight & Ambient Glow)
    const ambientLight = new THREE.AmbientLight(PALETTE.ambientColor, 0.95);
    this.scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(PALETTE.moonlightColor, 1.8);
    moonLight.position.set(-15, 30, -20);
    this.scene.add(moonLight);

    // Subtle counter-rim light
    const rimLight = new THREE.DirectionalLight(0x0e2038, 0.8);
    rimLight.position.set(20, 10, 25);
    this.scene.add(rimLight);

    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);
    this.postProcessing.setSize(width, height);

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
    const target = new THREE.Vector3(targetX, 0, targetZ);
    this.currentCameraTarget.lerp(target, Math.min(1, dt * 10));

    this.camera.position.set(
      this.currentCameraTarget.x + this.cameraOffset.x,
      this.currentCameraTarget.y + this.cameraOffset.y,
      this.currentCameraTarget.z + this.cameraOffset.z
    );
    this.camera.lookAt(this.currentCameraTarget);
  }

  public adjustQuality(fps: number): void {
    if (fps < 42 && this.renderer.getPixelRatio() > 1.0) {
      this.renderer.setPixelRatio(1.0);
    } else if (fps >= 58 && this.renderer.getPixelRatio() < 1.5 && window.devicePixelRatio > 1) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
  }

  public render(dt: number, timeSeconds: number): void {
    this.postProcessing.update(dt, timeSeconds);
    this.postProcessing.render();
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
