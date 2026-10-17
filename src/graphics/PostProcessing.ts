import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const CameronGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uAberration: { value: 0.0012 },
    uDamageFlash: { value: 0.0 }
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

      // Cold James Cameron 2029 Cobalt-Teal shadow lift & bright silver highlight curve
      col = pow(max(col, vec3(0.0)), vec3(0.84)) * 1.18;
      vec3 coldShadows = vec3(0.05, 0.13, 0.26);
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col + coldShadows * (1.0 - luma) * 0.55, col * vec3(0.96, 1.04, 1.15), smoothstep(0.08, 0.75, luma));

      // Subtle 35mm film grain & gentle vignette
      float grain = (rand(vUv + fract(uTime)) - 0.5) * 0.024;
      float vignette = smoothstep(0.95, 0.35, dist);
      col = (col + grain) * mix(0.76, 1.0, vignette);

      // Crimson optical damage flash
      col = mix(col, vec3(0.95, 0.08, 0.08), clamp(uDamageFlash, 0.0, 0.65));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

export class PostProcessingManager {
  public readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradingPass: ShaderPass;

  private aberrationTarget = 0.0012;
  private currentAberration = 0.0012;
  private damageFlash = 0.0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    const size = new THREE.Vector2();
    renderer.getSize(size);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x * 0.5, size.y * 0.5),
      1.15, // strength
      0.45, // radius
      0.72  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.gradingPass = new ShaderPass(CameronGradingShader);
    this.composer.addPass(this.gradingPass);
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width * 0.5, height * 0.5);
  }

  public triggerDamageFlash(): void {
    this.damageFlash = 0.65;
    this.currentAberration = 0.012; // Spike chromatic aberration on hit
  }

  public triggerEmpGlitch(): void {
    this.currentAberration = 0.018;
  }

  public update(dt: number, timeSeconds: number): void {
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    }
    if (this.currentAberration > this.aberrationTarget) {
      this.currentAberration = Math.max(
        this.aberrationTarget,
        this.currentAberration - dt * 0.03
      );
    }

    this.gradingPass.uniforms.uTime.value = timeSeconds;
    this.gradingPass.uniforms.uDamageFlash.value = this.damageFlash;
    this.gradingPass.uniforms.uAberration.value = this.currentAberration;
  }

  public render(): void {
    this.composer.render();
  }
}
