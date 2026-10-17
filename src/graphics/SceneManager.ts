import * as THREE from 'three';
import { PALETTE } from '../data/palette';
import { PostProcessingManager } from './PostProcessing';
import { ProceduralTextures } from './ProceduralTextures';

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly postProcessing: PostProcessingManager;

  private readonly cameraOffset = new THREE.Vector3(0, 17.5, 12.5);
  private currentCameraTarget = new THREE.Vector3(0, 0, 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
  private readonly intersectPt = new THREE.Vector3();
  private readonly ndcMouse = new THREE.Vector2();

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b192e);
    this.scene.fog = new THREE.FogExp2(0x102544, 0.011);
    this.scene.environment = ProceduralTextures.getMetallicEnvMap();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 250);
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
    this.renderer.toneMappingExposure = 1.48;

    container.appendChild(this.renderer.domElement);

    // High-contrast James Cameron Cobalt Moonlight & Battlefield Illumination
    const hemiLight = new THREE.HemisphereLight(0x8cc8ff, 0x2c4260, 2.8);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0x3b628f, 2.1);
    this.scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x98ccff, 4.2);
    moonLight.position.set(-15, 32, -18);
    this.scene.add(moonLight);

    // Strong silver-blue counter-rim light for Endoskeleton silhouettes
    const rimLight = new THREE.DirectionalLight(0x66aaff, 2.5);
    rimLight.position.set(18, 16, 24);
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
    // Tight, responsive camera tracking
    this.currentCameraTarget.lerp(target, Math.min(1, dt * 28));

    this.camera.position.set(
      this.currentCameraTarget.x + this.cameraOffset.x,
      this.currentCameraTarget.y + this.cameraOffset.y,
      this.currentCameraTarget.z + this.cameraOffset.z
    );
    this.camera.lookAt(this.currentCameraTarget);
  }

  public screenToWorldGround(
    clientX: number,
    clientY: number
  ): { x: number; z: number } | null {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    this.ndcMouse.x = (clientX / width) * 2 - 1;
    this.ndcMouse.y = -(clientY / height) * 2 + 1;

    this.raycaster.setFromCamera(this.ndcMouse, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.aimPlane, this.intersectPt);
    if (!hit) return null;
    return { x: this.intersectPt.x, z: this.intersectPt.z };
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
