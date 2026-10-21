import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { globalEvents } from '../core/EventBus';
import { GRADE } from '../data/artDirection';
import { IS_MOBILE, RENDER_BUDGET } from '../data/performance';

/**
 * Final pass. Rendering into the composer's target skips three's tone mapping and sRGB output,
 * so this pass applies exposure, ACES and the sRGB curve itself, then grades the image like the
 * films' night battles: steel-blue shadows, warm highlights, slightly desaturated, film grain,
 * and vignette.
 */
export const CameronGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uExposure: { value: 1.0 },
    uAberration: { value: 0.0012 },
    uDamageFlash: { value: 0.0 },
    uLowHpPulse: { value: 0.0 },
    uGrain: { value: GRADE.grain },
    uVignette: { value: GRADE.vignette },
    uSaturation: { value: GRADE.saturation },
    uShadowTint: { value: new THREE.Vector3(...GRADE.shadowTint) },
    uHighlightTint: { value: new THREE.Vector3(...GRADE.highlightTint) }
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
    uniform float uExposure;
    uniform float uAberration;
    uniform float uDamageFlash;
    uniform float uLowHpPulse;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 safe(vec3 c) {
      // Guard against NaN / Inf from mobile half-float buffers
      if (!(c.r >= 0.0 && c.r <= 64.0)) c.r = 0.0;
      if (!(c.g >= 0.0 && c.g <= 64.0)) c.g = 0.0;
      if (!(c.b >= 0.0 && c.b <= 64.0)) c.b = 0.0;
      return c;
    }

    // ACES fitted (Stephen Hill), as used by three's ACESFilmicToneMapping
    vec3 aces(vec3 color) {
      const mat3 inputM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 outputM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      color = inputM * color;
      vec3 a = color * (color + 0.0245786) - 0.000090537;
      vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
      return clamp(outputM * (a / b), 0.0, 1.0);
    }

    vec3 toSrgb(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      vec2 offset = dir * uAberration * (0.5 + dist);

      vec3 col = safe(vec3(
        texture2D(tDiffuse, vUv + offset).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - offset).b
      ));

      col = toSrgb(aces(col * uExposure));

      // Grade in display space
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, uSaturation);
      col += uShadowTint * (1.0 - smoothstep(0.0, 0.45, luma));
      col *= mix(vec3(1.0), uHighlightTint, smoothstep(0.4, 0.95, luma));
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.25);

      // Film grain, strongest in the mid-tones
      float grain = (rand(vUv * 1.37 + fract(uTime * 0.71)) - 0.5) * uGrain;
      col += grain * (1.0 - abs(luma - 0.4) * 1.4);

      float vignette = smoothstep(0.95, 0.35, dist);
      col *= mix(1.0 - uVignette, 1.0, vignette);

      // Crimson optical damage flash
      col = mix(col, vec3(0.95, 0.08, 0.08), clamp(uDamageFlash, 0.0, 0.65));

      // Crimson low-HP (<25%) pulsing vignette
      float lowHpVignette = smoothstep(0.28, 0.95, dist) * uLowHpPulse;
      col = mix(col, vec3(0.85, 0.02, 0.02), clamp(lowHpVignette, 0.0, 0.75));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

/**
 * Runs before bloom. A single NaN or Inf pixel (e.g. an overflowing specular highlight in a
 * half-float buffer) would otherwise be smeared by the bloom blur into a huge black block.
 */
export const SanitizeHdrShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // NaN fails every comparison, so it becomes 0; +Inf passes and is clamped to bright
      if (!(c.r >= 0.0)) c.r = 0.0;
      if (!(c.g >= 0.0)) c.g = 0.0;
      if (!(c.b >= 0.0)) c.b = 0.0;
      gl_FragColor = vec4(min(c, vec3(32.0)), 1.0);
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
  return IS_MOBILE;
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
    // 8 bits of linear light crush a night scene into its bottom few levels; stored sRGB-encoded
    // (and decoded on read) the dark tones keep their detail
    if (this.useFastPath || isMobile) renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    this.composer = new EffectComposer(renderer, renderTarget);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);
    // Only half-float buffers can hold NaN/Inf; the 8-bit buffers used on phones cannot
    if (!(this.useFastPath || isMobile)) this.composer.addPass(new ShaderPass(SanitizeHdrShader));

    // Threshold is in linear HDR: only plasma, fire, optics and searchlights bloom, never the ground
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)),
      GRADE.bloomStrength,
      GRADE.bloomRadius,
      GRADE.bloomThreshold
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
    this.bloomPass.resolution.set(width * RENDER_BUDGET.bloomScale, height * RENDER_BUDGET.bloomScale);
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
    this.gradingPass.uniforms.uExposure.value = this.renderer.toneMappingExposure;
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
