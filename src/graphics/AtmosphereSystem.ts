import * as THREE from 'three';
import { globalEvents } from '../core/EventBus';
import { vfxRNG } from '../core/RNG';

interface ScorchSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
}

export class AtmosphereSystem {
  public static readonly MAX_DECALS = 64;
  public static readonly DECAL_LIFETIME = 20.0;
  public static readonly ASH_PARTICLE_COUNT = 240;

  private readonly group = new THREE.Group();
  private readonly unbinds: (() => void)[] = [];

  // 1. Falling Ash Particles
  private ashPoints: THREE.Points | null = null;
  private ashGeo: THREE.BufferGeometry | null = null;
  private ashMat: THREE.PointsMaterial | null = null;
  private ashPositions: Float32Array;
  private ashVelocities: Float32Array;
  private ashPhases: Float32Array;
  private ashTime = 0;

  // 2. Distant Lightning Skyline Flashes
  private flashIntensity = 0;
  private nextFlashTimer = 5.0;
  private isDoubleStrike = false;
  private secondStrikeDelay = 0;
  private readonly baseFogColor = new THREE.Color(0x162840);
  private readonly flashFogColor = new THREE.Color(0x84b2e8);
  private readonly currentFogColor = new THREE.Color(0x162840);

  // 3. Ground Scorch Decals
  private readonly scorchSlots: ScorchSlot[] = [];
  private nextScorchIdx = 0;
  private readonly sharedDecalGeo: THREE.PlaneGeometry;

  private enabled = true;

  constructor(private readonly scene: THREE.Scene) {
    this.scene.add(this.group);

    // 1. Setup Falling Ash Particles
    this.ashPositions = new Float32Array(AtmosphereSystem.ASH_PARTICLE_COUNT * 3);
    this.ashVelocities = new Float32Array(AtmosphereSystem.ASH_PARTICLE_COUNT);
    this.ashPhases = new Float32Array(AtmosphereSystem.ASH_PARTICLE_COUNT);

    for (let i = 0; i < AtmosphereSystem.ASH_PARTICLE_COUNT; i++) {
      this.ashPositions[i * 3 + 0] = (vfxRNG.next() - 0.5) * 44;
      this.ashPositions[i * 3 + 1] = vfxRNG.next() * 14 + 0.2;
      this.ashPositions[i * 3 + 2] = (vfxRNG.next() - 0.5) * 44;
      this.ashVelocities[i] = 0.8 + vfxRNG.next() * 0.9;
      this.ashPhases[i] = vfxRNG.next() * Math.PI * 2;
    }

    this.ashGeo = new THREE.BufferGeometry();
    this.ashGeo.setAttribute('position', new THREE.BufferAttribute(this.ashPositions, 3));

    this.ashMat = new THREE.PointsMaterial({
      color: 0xc8d2de,
      size: 0.24,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });

    this.ashPoints = new THREE.Points(this.ashGeo, this.ashMat);
    this.group.add(this.ashPoints);

    // 2. Setup Scorch Decal Ring Buffer Pool (64 decals max)
    this.sharedDecalGeo = new THREE.PlaneGeometry(1, 1);
    this.sharedDecalGeo.rotateX(-Math.PI / 2);

    const scorchTexture = this.createScorchCanvasTexture();

    for (let i = 0; i < AtmosphereSystem.MAX_DECALS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x0c0e12,
        map: scorchTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -1.0
      });
      const mesh = new THREE.Mesh(this.sharedDecalGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.scorchSlots.push({
        mesh,
        material: mat,
        active: false,
        life: 0
      });
    }

    // Event hook: explosions leave persistent ground scorch decals
    this.unbinds.push(
      globalEvents.on('vfx:explosion', (data) => {
        const radius = Math.min(4.8, 2.0 * Math.sqrt(data.scale ?? 1.0));
        this.spawnScorchDecal(data.x, data.z, radius);
      })
    );
  }

  private createScorchCanvasTexture(): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;
    try {
      const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
      if (isJsdom) return null;

      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(12, 14, 18, 0.95)');
      grad.addColorStop(0.35, 'rgba(16, 18, 22, 0.85)');
      grad.addColorStop(0.7, 'rgba(20, 24, 28, 0.45)');
      grad.addColorStop(1, 'rgba(20, 24, 28, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getActiveDecalCount(): number {
    let count = 0;
    for (let i = 0; i < this.scorchSlots.length; i++) {
      if (this.scorchSlots[i].active) count++;
    }
    return count;
  }

  public spawnScorchDecal(x: number, z: number, radius = 2.2): void {
    if (!this.enabled) return;

    const slot = this.scorchSlots[this.nextScorchIdx];
    this.nextScorchIdx = (this.nextScorchIdx + 1) % AtmosphereSystem.MAX_DECALS;

    slot.active = true;
    slot.life = 0;
    slot.mesh.position.set(x, 0.015, z);
    slot.mesh.scale.set(radius * 2, 1, radius * 2);
    slot.mesh.rotation.y = vfxRNG.next() * Math.PI * 2;
    slot.material.opacity = 0.85;
    slot.mesh.visible = true;
  }

  public triggerLightningFlash(intensity = 1.0): void {
    this.flashIntensity = Math.min(1.0, this.flashIntensity + intensity);
  }

  public update(dt: number, playerX = 0, playerZ = 0): void {
    if (!this.enabled) return;

    this.ashTime += dt;

    // 1. Update Falling Ash Particles
    if (this.ashPositions && this.ashGeo) {
      for (let i = 0; i < AtmosphereSystem.ASH_PARTICLE_COUNT; i++) {
        const idx = i * 3;
        // Gravity descent
        this.ashPositions[idx + 1] -= this.ashVelocities[i] * dt;
        // Lateral wind drift
        this.ashPositions[idx + 0] += Math.sin(this.ashTime * 1.5 + this.ashPhases[i]) * 0.35 * dt;

        // Wrap around player's active 44m x 44m volume
        const dx = this.ashPositions[idx + 0] - playerX;
        const dz = this.ashPositions[idx + 2] - playerZ;

        if (this.ashPositions[idx + 1] < 0.1 || Math.abs(dx) > 23 || Math.abs(dz) > 23) {
          this.ashPositions[idx + 0] = playerX + (vfxRNG.next() - 0.5) * 44;
          this.ashPositions[idx + 1] = 13.0 + vfxRNG.next() * 3.0;
          this.ashPositions[idx + 2] = playerZ + (vfxRNG.next() - 0.5) * 44;
        }
      }
      const posAttr = this.ashGeo.getAttribute('position') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    }

    // 2. Update Distant Lightning Skyline Flashes
    this.nextFlashTimer -= dt;
    if (this.nextFlashTimer <= 0) {
      this.triggerLightningFlash(0.95);
      this.isDoubleStrike = vfxRNG.next() > 0.45;
      if (this.isDoubleStrike) {
        this.secondStrikeDelay = 0.14;
      }
      this.nextFlashTimer = 5.0 + vfxRNG.next() * 4.5;
    }

    if (this.secondStrikeDelay > 0) {
      this.secondStrikeDelay -= dt;
      if (this.secondStrikeDelay <= 0) {
        this.triggerLightningFlash(0.75);
      }
    }

    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 6.5);
      if (this.scene.fog) {
        this.currentFogColor.lerpColors(this.baseFogColor, this.flashFogColor, this.flashIntensity * 0.7);
        this.scene.fog.color.copy(this.currentFogColor);
      }
    }

    // 3. Update Scorch Decals (20 second lifetime with last 4s fadeout)
    for (let i = 0; i < AtmosphereSystem.MAX_DECALS; i++) {
      const slot = this.scorchSlots[i];
      if (!slot.active) continue;

      slot.life += dt;
      if (slot.life >= AtmosphereSystem.DECAL_LIFETIME) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.material.opacity = 0;
      } else if (slot.life >= 16.0) {
        const fade = 1.0 - (slot.life - 16.0) / 4.0;
        slot.material.opacity = 0.85 * Math.max(0, fade);
      }
    }
  }

  public dispose(): void {
    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;

    this.scene.remove(this.group);

    if (this.ashGeo) this.ashGeo.dispose();
    if (this.ashMat) this.ashMat.dispose();

    this.sharedDecalGeo.dispose();
    for (let i = 0; i < this.scorchSlots.length; i++) {
      this.scorchSlots[i].material.dispose();
    }
    this.scorchSlots.length = 0;
  }
}
