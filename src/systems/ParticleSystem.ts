import * as THREE from 'three';
import { ProceduralTextures } from '../graphics/ProceduralTextures';
import { vfxRNG } from '../core/RNG';
import { bakePart, mergeParts } from '../graphics/meshes/geometryUtils';
import { globalEvents } from '../core/EventBus';
import { getQualityProfile } from '../graphics/qualityPresets';

export type ParticleType = 'fire' | 'smoke' | 'plasma' | 'dash';

export interface Particle {
  type: ParticleType;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scaleStart: number;
  scaleEnd: number;
}

export type DebrisType = 'skull' | 'ribs' | 'limb' | 'plate';

export interface DebrisChunk {
  type: DebrisType;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  eyeMesh?: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  eyeMat?: THREE.MeshBasicMaterial;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  life: number;
  maxLife: number;
  hasRedEye: boolean;
  active: boolean;
}

export class ParticleSystem {
  public readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly unbinds: (() => void)[] = [];
  private particleCap = 100;
  private debrisCap = 48;

  public setCaps(particleCap: number, debrisCap: number): void {
    this.particleCap = Math.max(15, particleCap);
    this.debrisCap = Math.max(8, debrisCap);
  }

  public getCaps(): { particleCap: number; debrisCap: number } {
    return { particleCap: this.particleCap, debrisCap: this.debrisCap };
  }

  private readonly freePool: Record<ParticleType, Particle[]> = {
    fire: [],
    smoke: [],
    plasma: [],
    dash: []
  };

  private readonly unitPlaneGeo: THREE.PlaneGeometry;
  private readonly smokeMat: THREE.MeshBasicMaterial;
  private readonly fireMat: THREE.MeshBasicMaterial;
  private readonly plasmaMat: THREE.MeshBasicMaterial;
  private readonly dashMat: THREE.MeshBasicMaterial;

  // Debris system
  private readonly debris: DebrisChunk[] = [];
  private readonly freeDebrisPool: Record<DebrisType, DebrisChunk[]> = {
    skull: [],
    ribs: [],
    limb: [],
    plate: []
  };

  private readonly skullGeo: THREE.BufferGeometry;
  private readonly eyeGeo: THREE.BufferGeometry;
  private readonly ribsGeo: THREE.BufferGeometry;
  private readonly limbGeo: THREE.BufferGeometry;
  private readonly plateGeo: THREE.BufferGeometry;

  private readonly chromeMatTemplate: THREE.MeshStandardMaterial;
  private readonly eyeMatTemplate: THREE.MeshBasicMaterial;

  constructor() {
    this.unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
    this.unitPlaneGeo.rotateX(-Math.PI / 2);

    const spriteTex = ProceduralTextures.getSoftGlowSprite();

    this.smokeMat = new THREE.MeshBasicMaterial({
      map: spriteTex,
      color: 0x1a212b,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });

    this.fireMat = new THREE.MeshBasicMaterial({
      map: spriteTex,
      color: 0xff6600,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.plasmaMat = new THREE.MeshBasicMaterial({
      map: spriteTex,
      color: 0xd400ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.dashMat = new THREE.MeshBasicMaterial({
      map: spriteTex,
      color: 0x00e5ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Zero-allocation pre-warming: pre-fill pools with reusable meshes
    this.prefillPool('fire', 48, this.fireMat);
    this.prefillPool('smoke', 36, this.smokeMat);
    this.prefillPool('plasma', 24, this.plasmaMat);
    this.prefillPool('dash', 20, this.dashMat);

    // Chrome Debris Geometries & Materials
    const chromeBright = 0xb8c6d4;
    const chromeMid = 0x8e9eae;
    const darkSocket = 0x10161e;
    const teethIvory = 0xbec8d2;
    const pistonSteel = 0x5c6c7c;

    // 1. Skull
    const skullParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.SphereGeometry(0.11, 8, 8), 0, 0.05, -0.01, 0, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.18, 0.04, 0.1), 0, 0.05, 0.06, 0.08, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.16, 0.045, 0.08), 0, 0.01, 0.065, 0, 0, 0, darkSocket),
      bakePart(new THREE.BoxGeometry(0.11, 0.035, 0.09), 0, -0.045, 0.065, 0, 0, 0, teethIvory),
      bakePart(new THREE.BoxGeometry(0.12, 0.04, 0.11), 0, -0.09, 0.05, 0.08, 0, 0, chromeMid),
      bakePart(new THREE.CylinderGeometry(0.015, 0.015, 0.11, 6), -0.08, -0.03, 0.02, 0.15, 0, 0.18, pistonSteel),
      bakePart(new THREE.CylinderGeometry(0.015, 0.015, 0.11, 6), 0.08, -0.03, 0.02, 0.15, 0, -0.18, pistonSteel)
    ];
    this.skullGeo = mergeParts(skullParts);

    // Pinpoint red eye optics
    const eyeParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.SphereGeometry(0.018, 6, 6), -0.042, 0.012, 0.105, 0, 0, 0, 0xff2222),
      bakePart(new THREE.SphereGeometry(0.018, 6, 6), 0.042, 0.012, 0.105, 0, 0, 0, 0xff2222)
    ];
    this.eyeGeo = mergeParts(eyeParts);

    // 2. Ribs
    const ribsParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.CylinderGeometry(0.03, 0.035, 0.28, 6), 0, 0, -0.02, 0, 0, 0, chromeMid),
      bakePart(new THREE.BoxGeometry(0.08, 0.04, 0.08), 0, 0.05, -0.02, 0, 0, 0, pistonSteel),
      bakePart(new THREE.BoxGeometry(0.08, 0.04, 0.08), 0, -0.05, -0.02, 0, 0, 0, pistonSteel),
      bakePart(new THREE.BoxGeometry(0.24, 0.025, 0.09), 0, 0.08, 0.03, 0, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.22, 0.025, 0.08), 0, 0.0, 0.03, 0, 0, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.18, 0.025, 0.07), 0, -0.08, 0.02, 0, 0, 0, chromeMid)
    ];
    this.ribsGeo = mergeParts(ribsParts);

    // 3. Limb
    const limbParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 6), 0, 0.08, 0, 0, 0, 0, chromeBright),
      bakePart(new THREE.SphereGeometry(0.045, 8, 8), 0, -0.03, 0, 0, 0, 0, pistonSteel),
      bakePart(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 8), 0, -0.03, 0, 0, 0, 0, darkSocket),
      bakePart(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), 0, -0.14, 0, 0, 0, 0, chromeMid)
    ];
    this.limbGeo = mergeParts(limbParts);

    // 4. Plate
    const plateParts: THREE.BufferGeometry[] = [
      bakePart(new THREE.BoxGeometry(0.22, 0.16, 0.04), 0, 0, 0, 0.1, 0.15, 0, chromeBright),
      bakePart(new THREE.BoxGeometry(0.05, 0.18, 0.06), 0, 0, 0.01, 0.1, 0.15, 0, pistonSteel),
      bakePart(new THREE.BoxGeometry(0.14, 0.04, 0.05), -0.02, -0.04, -0.01, 0.1, 0.15, 0, darkSocket)
    ];
    this.plateGeo = mergeParts(plateParts);

    this.chromeMatTemplate = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.85,
      transparent: true,
      opacity: 1.0,
      normalMap: ProceduralTextures.getBrushedMetalNormal(),
      roughnessMap: ProceduralTextures.getBrushedMetalRoughness()
    });

    this.eyeMatTemplate = new THREE.MeshBasicMaterial({
      color: 0xff1111,
      transparent: true,
      opacity: 1.0
    });

    // Zero-allocation pre-warming for debris chunks
    const types: DebrisType[] = ['skull', 'ribs', 'limb', 'plate'];
    for (const t of types) {
      for (let i = 0; i < 10; i++) {
        this.freeDebrisPool[t].push(this.createDebrisChunk(t));
      }
    }

    this.unbinds.push(
      globalEvents.on('quality:preset_changed', ({ preset }) => {
        const profile = getQualityProfile(preset);
        this.setCaps(profile.particleCap, profile.debrisCap);
      })
    );
  }

  private prefillPool(
    type: ParticleType,
    count: number,
    templateMat: THREE.MeshBasicMaterial
  ): void {
    for (let i = 0; i < count; i++) {
      const mat = templateMat.clone();
      const mesh = new THREE.Mesh(this.unitPlaneGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.freePool[type].push({
        type,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scaleStart: 1,
        scaleEnd: 1
      });
    }
  }

  private acquireParticle(type: ParticleType): Particle {
    const pool = this.freePool[type];
    if (pool.length > 0) {
      const p = pool.pop()!;
      p.mesh.visible = true;
      return p;
    }

    let mat: THREE.MeshBasicMaterial;
    switch (type) {
      case 'fire':
        mat = this.fireMat.clone();
        break;
      case 'smoke':
        mat = this.smokeMat.clone();
        break;
      case 'plasma':
        mat = this.plasmaMat.clone();
        break;
      case 'dash':
        mat = this.dashMat.clone();
        break;
    }
    const mesh = new THREE.Mesh(this.unitPlaneGeo, mat);
    this.group.add(mesh);
    return {
      type,
      mesh,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      scaleStart: 1,
      scaleEnd: 1
    };
  }

  public spawnExplosion(x: number, y: number, z: number, scale = 1.0): void {
    for (let i = 0; i < 6; i++) {
      const p = this.acquireParticle('fire');
      p.mesh.position.set(
        x + (vfxRNG.next() - 0.5) * 0.8 * scale,
        y + 0.1 + i * 0.05,
        z + (vfxRNG.next() - 0.5) * 0.8 * scale
      );
      p.vx = (vfxRNG.next() - 0.5) * 1.5;
      p.vy = 0.5 + vfxRNG.next() * 1.2;
      p.vz = (vfxRNG.next() - 0.5) * 1.5;
      p.life = 0;
      p.maxLife = 0.45 + vfxRNG.next() * 0.25;
      p.scaleStart = 1.2 * scale;
      p.scaleEnd = 5.2 * scale;
      this.particles.push(p);
    }

    // Black smoke puffs rising
    for (let i = 0; i < 4; i++) {
      const p = this.acquireParticle('smoke');
      p.mesh.position.set(x, y + 0.2, z);
      p.vx = (vfxRNG.next() - 0.5) * 0.8;
      p.vy = 1.2 + vfxRNG.next() * 1.5;
      p.vz = (vfxRNG.next() - 0.5) * 0.8;
      p.life = 0;
      p.maxLife = 0.8 + vfxRNG.next() * 0.4;
      p.scaleStart = 2.8 * scale;
      p.scaleEnd = 9.8 * scale;
      this.particles.push(p);
    }

    globalEvents.emit('vfx:explosion', { x, y, z, scale });
  }

  public spawnPlasmaImpact(x: number, y: number, z: number): void {
    const p = this.acquireParticle('plasma');
    p.mesh.position.set(x, y + 0.15, z);
    p.vx = 0;
    p.vy = 0.2;
    p.vz = 0;
    p.life = 0;
    p.maxLife = 0.22;
    p.scaleStart = 0.48;
    p.scaleEnd = 2.16;
    this.particles.push(p);

    globalEvents.emit('vfx:plasma', { x, y, z });
  }

  public spawnDashAfterimage(x: number, y: number, z: number): void {
    const p = this.acquireParticle('dash');
    p.mesh.position.set(x, y, z);
    p.vx = 0;
    p.vy = 0.1;
    p.vz = 0;
    p.life = 0;
    p.maxLife = 0.22;
    p.scaleStart = 1.1;
    p.scaleEnd = 0.4;
    this.particles.push(p);
  }

  private createDebrisChunk(type: DebrisType): DebrisChunk {
    const group = new THREE.Group();
    let geo: THREE.BufferGeometry;
    let hasRedEye = false;
    switch (type) {
      case 'skull':
        geo = this.skullGeo;
        hasRedEye = true;
        break;
      case 'ribs':
        geo = this.ribsGeo;
        break;
      case 'limb':
        geo = this.limbGeo;
        break;
      case 'plate':
        geo = this.plateGeo;
        break;
    }

    const coreMat = this.chromeMatTemplate.clone();
    const coreMesh = new THREE.Mesh(geo, coreMat);
    group.add(coreMesh);

    let eyeMesh: THREE.Mesh | undefined;
    let eyeMat: THREE.MeshBasicMaterial | undefined;
    if (hasRedEye) {
      eyeMat = this.eyeMatTemplate.clone();
      eyeMesh = new THREE.Mesh(this.eyeGeo, eyeMat);
      group.add(eyeMesh);
    }

    group.visible = false;
    this.group.add(group);

    return {
      type,
      group,
      coreMesh,
      eyeMesh,
      coreMat,
      eyeMat,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      vRotX: 0,
      vRotY: 0,
      vRotZ: 0,
      life: 0,
      maxLife: 4.0,
      hasRedEye,
      active: false
    };
  }

  private acquireDebrisChunk(type: DebrisType): DebrisChunk {
    const pool = this.freeDebrisPool[type];
    if (pool.length > 0) {
      return pool.pop()!;
    }
    return this.createDebrisChunk(type);
  }

  private recycleChunk(chunk: DebrisChunk): void {
    chunk.active = false;
    chunk.group.visible = false;
    if (chunk.eyeMesh) chunk.eyeMesh.visible = false;
    this.freeDebrisPool[chunk.type].push(chunk);
  }

  public get activeDebris(): readonly DebrisChunk[] {
    return this.debris;
  }

  public getDebrisCount(): number {
    return this.debris.length;
  }

  public spawnEnemyDebris(x: number, y: number, z: number, count?: number): void {
    const numChunks = Math.min(this.debrisCap, count ?? (3 + Math.floor(vfxRNG.next() * 4)));

    // Cap total debris at debrisCap by recycling oldest chunks
    while (this.debris.length + numChunks > this.debrisCap && this.debris.length > 0) {
      const oldest = this.debris.shift()!;
      this.recycleChunk(oldest);
    }

    const poolTypes: DebrisType[] = ['skull', 'ribs', 'limb', 'plate'];
    for (let i = 0; i < numChunks; i++) {
      // First chunk is guaranteed to be a skull, remaining are random
      const type = i === 0 ? 'skull' : poolTypes[Math.floor(vfxRNG.next() * poolTypes.length)];
      const chunk = this.acquireDebrisChunk(type);

      chunk.active = true;
      chunk.life = 0;
      chunk.maxLife = 4.0;
      chunk.x = x + (vfxRNG.next() - 0.5) * 0.3;
      chunk.y = y + (vfxRNG.next() - 0.5) * 0.2;
      chunk.z = z + (vfxRNG.next() - 0.5) * 0.3;
      chunk.vx = (vfxRNG.next() - 0.5) * 4.0;
      chunk.vy = 2.5 + vfxRNG.next() * 3.5;
      chunk.vz = (vfxRNG.next() - 0.5) * 4.0;
      chunk.rotX = vfxRNG.next() * Math.PI * 2;
      chunk.rotY = vfxRNG.next() * Math.PI * 2;
      chunk.rotZ = vfxRNG.next() * Math.PI * 2;
      chunk.vRotX = (vfxRNG.next() - 0.5) * 12.0;
      chunk.vRotY = (vfxRNG.next() - 0.5) * 12.0;
      chunk.vRotZ = (vfxRNG.next() - 0.5) * 12.0;

      chunk.coreMat.opacity = 1.0;
      if (chunk.eyeMat && chunk.eyeMesh) {
        chunk.eyeMat.opacity = 1.0;
        chunk.eyeMesh.visible = true;
      }

      chunk.group.position.set(chunk.x, chunk.y, chunk.z);
      chunk.group.rotation.set(chunk.rotX, chunk.rotY, chunk.rotZ);
      chunk.group.visible = true;

      this.debris.push(chunk);
    }
  }

  public update(dt: number): void {
    // 1. Update sprite particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        this.freePool[p.type].push(p);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      const progress = p.life / p.maxLife;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      const sc = THREE.MathUtils.lerp(p.scaleStart, p.scaleEnd, progress);
      p.mesh.scale.set(sc, sc, sc);

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.85;
    }

    // 2. Update debris chunks
    const groundY = 0.08;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life += dt;

      if (d.life >= d.maxLife) {
        this.recycleChunk(d);
        this.debris.splice(i, 1);
        continue;
      }

      // Red eye power-down flicker over first 0.7s
      if (d.hasRedEye && d.eyeMat && d.eyeMesh) {
        if (d.life < 0.7) {
          const flicker = Math.sin(d.life * 35) > 0 ? (1 - d.life / 0.7) : 0;
          d.eyeMat.opacity = Math.max(0, Math.min(1, flicker));
          d.eyeMesh.visible = d.eyeMat.opacity > 0.05;
        } else {
          d.eyeMat.opacity = 0;
          d.eyeMesh.visible = false;
        }
      }

      // Physics integration: gravity & ground collision
      d.vy -= 16.0 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      d.rotX += d.vRotX * dt;
      d.rotY += d.vRotY * dt;
      d.rotZ += d.vRotZ * dt;

      if (d.y <= groundY) {
        d.y = groundY;
        const rebound = -d.vy * 0.42;
        if (rebound >= 0.4) {
          d.vy = rebound;
          d.vx *= 0.65;
          d.vz *= 0.65;
          d.vRotX *= 0.65;
          d.vRotY *= 0.65;
          d.vRotZ *= 0.65;
        } else {
          d.vy = 0;
          d.vx = 0;
          d.vz = 0;
          d.vRotX = 0;
          d.vRotY = 0;
          d.vRotZ = 0;
        }
      }

      // Fade out after 3.0s (up to maxLife 4.0s)
      if (d.life > 3.0) {
        const fade = Math.max(0, 1 - (d.life - 3.0) / 1.0);
        d.coreMat.opacity = fade;
      }

      d.group.position.set(d.x, d.y, d.z);
      d.group.rotation.set(d.rotX, d.rotY, d.rotZ);
    }
  }

  public clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.mesh.visible = false;
      this.freePool[p.type].push(p);
    }
    this.particles.length = 0;

    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      d.active = false;
      d.group.visible = false;
      if (d.eyeMesh) d.eyeMesh.visible = false;
      this.freeDebrisPool[d.type].push(d);
    }
    this.debris.length = 0;
  }

  public dispose(): void {
    this.clear();
    this.unitPlaneGeo.dispose();
    this.smokeMat.dispose();
    this.fireMat.dispose();
    this.plasmaMat.dispose();
    this.dashMat.dispose();
    this.skullGeo.dispose();
    this.eyeGeo.dispose();
    this.ribsGeo.dispose();
    this.limbGeo.dispose();
    this.plateGeo.dispose();
    this.chromeMatTemplate.dispose();
    this.eyeMatTemplate.dispose();
    const debrisTypes: DebrisType[] = ['skull', 'ribs', 'limb', 'plate'];
    for (const t of debrisTypes) {
      for (const d of this.freeDebrisPool[t]) {
        d.coreMat.dispose();
        d.eyeMat?.dispose();
      }
    }

    for (const unbind of this.unbinds) {
      unbind();
    }
    this.unbinds.length = 0;
  }
}
