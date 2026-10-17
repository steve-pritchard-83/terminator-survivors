import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { globalEvents } from '../core/EventBus';

export const CameronGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uAberration: { value: 0.0012 },
    uDamageFlash: { value: 0.0 },
    uLowHpPulse: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uDamageFlash;
    uniform float uLowHpPulse;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      vec2 offset = dir * uAberration * (0.5 + dist);

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      // Guard against NaN / Inf values from mobile GPU half-float buffers
      if (!(col.r >= 0.0 && col.r <= 16.0)) col.r = 0.0;
      if (!(col.g >= 0.0 && col.g <= 16.0)) col.g = 0.0;
      if (!(col.b >= 0.0 && col.b <= 16.0)) col.b = 0.0;
      col = clamp(col, vec3(0.0), vec3(4.0));

      // Cold James Cameron 2029 Cobalt-Teal shadow lift & crisp silver highlight curve
      col = pow(max(col, vec3(0.0001)), vec3(0.92)) * 1.06;
      vec3 coldShadows = vec3(0.03, 0.08, 0.16);
      float luma = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
      col = mix(col + coldShadows * (1.0 - luma) * 0.35, col * vec3(0.96, 1.02, 1.10), smoothstep(0.08, 0.75, luma));

      // Subtle 35mm film grain & moonlit slate-blue fog haze at outer screen edges
      float grain = (rand(vUv + fract(uTime)) - 0.5) * 0.016;
      vec3 edgeFogColor = vec3(0.09, 0.16, 0.25);
      float edgeFogFactor = smoothstep(0.44, 0.90, dist) * 0.34;
      col = mix(col + grain, edgeFogColor, edgeFogFactor);
      float vignette = smoothstep(0.98, 0.42, dist);
      col *= mix(0.84, 1.0, vignette);

      // Crimson optical damage flash
      col = mix(col, vec3(0.95, 0.08, 0.08), clamp(uDamageFlash, 0.0, 0.65));

      // Crimson low-HP (<25%) pulsing vignette
      float lowHpVignette = smoothstep(0.28, 0.95, dist) * uLowHpPulse;
      col = mix(col, vec3(0.85, 0.02, 0.02), clamp(lowHpVignette, 0.0, 0.75));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

export function isSoftwareOrAutomatedRenderer(renderer: THREE.WebGLRenderer): boolean {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const rendererName = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(rendererName)) {
        return true;
      }
    }
  } catch {
    // Ignore extension query errors
  }
  return false;
}

export function isMobileGpuDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)) return true;
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches)
    return true;
  return false;
}

export class PostProcessingManager {
  public readonly composer: EffectComposer;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradingPass: ShaderPass;
  private readonly useFastPath: boolean;

  private aberrationTarget = 0.0008;
  private currentAberration = 0.0008;
  private damageFlash = 0.0;
  private lowHpIntensity = 0.0;
  private flashIntensityScale = 1.0;

  public setFlashIntensityScale(scale: number): void {
    this.flashIntensityScale = Math.max(0, Math.min(2.0, scale));
  }

  public getFlashIntensityScale(): number {
    return this.flashIntensityScale;
  }

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.useFastPath = isSoftwareOrAutomatedRenderer(renderer);

    globalEvents.on('settings:updated', (s) => {
      this.setFlashIntensityScale(s.reducedMotion ? 0.2 : s.flashIntensity / 100);
    });
    const isMobile = isMobileGpuDevice();

    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pixelRatio = renderer.getPixelRatio();

    // Use UnsignedByteType on mobile GPUs to prevent HalfFloatType NaN bloom blackouts when HK bosses spawn
    const renderTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.x * pixelRatio)),
      Math.max(1, Math.floor(size.y * pixelRatio)),
      this.useFastPath || isMobile
        ? { type: THREE.UnsignedByteType, samples: 0 }
        : { type: THREE.HalfFloatType, samples: 4 }
    );

    this.composer = new EffectComposer(renderer, renderTarget);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // High threshold (1.35) ensures ONLY high-emissive lasers, plasma bolts, and red optics bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)),
      0.42, // controlled strength (no nuclear blobs)
      0.28, // tight halo radius
      1.35 // strict HDR threshold so skulls/cars/ground never bloom
    );
    if (!this.useFastPath) {
      this.composer.addPass(this.bloomPass);
    }

    this.gradingPass = new ShaderPass(CameronGradingShader);
    this.composer.addPass(this.gradingPass);
  }

  public setPixelRatio(pixelRatio: number): void {
    if (this.useFastPath) return;
    this.composer.setPixelRatio(pixelRatio);
  }

  public setSize(width: number, height: number): void {
    if (this.useFastPath) return;
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public setBloomEnabled(enabled: boolean): void {
    if (this.bloomPass) {
      this.bloomPass.enabled = enabled;
    }
  }

  public isBloomEnabled(): boolean {
    return this.bloomPass ? this.bloomPass.enabled : false;
  }

  public triggerDamageFlash(): void {
    this.damageFlash = 0.65 * this.flashIntensityScale;
    this.currentAberration = 0.012 * this.flashIntensityScale; // Spike chromatic aberration on hit
  }

  public triggerEmpGlitch(): void {
    this.currentAberration = 0.018;
  }

  public setLowHpIntensity(intensity: number): void {
    this.lowHpIntensity = intensity;
  }

  public update(dt: number, timeSeconds: number): void {
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    }
    if (this.currentAberration > this.aberrationTarget) {
      this.currentAberration = Math.max(this.aberrationTarget, this.currentAberration - dt * 0.03);
    }

    this.gradingPass.uniforms.uTime.value = timeSeconds;
    this.gradingPass.uniforms.uDamageFlash.value = this.damageFlash;
    this.gradingPass.uniforms.uAberration.value = this.currentAberration;
    this.gradingPass.uniforms.uLowHpPulse.value = this.lowHpIntensity;
  }

  public render(): void {
    if (this.useFastPath) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render();
  }
}
