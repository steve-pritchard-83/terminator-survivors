import * as THREE from 'three';
import { ProceduralTextures } from '../graphics/ProceduralTextures';

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

export class ParticleSystem {
  public readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
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
        x + (Math.random() - 0.5) * 0.8 * scale,
        y + 0.1 + i * 0.05,
        z + (Math.random() - 0.5) * 0.8 * scale
      );
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = 0.5 + Math.random() * 1.2;
      p.vz = (Math.random() - 0.5) * 1.5;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.25;
      p.scaleStart = 1.2 * scale;
      p.scaleEnd = 5.2 * scale;
      this.particles.push(p);
    }

    // Black smoke puffs rising
    for (let i = 0; i < 4; i++) {
      const p = this.acquireParticle('smoke');
      p.mesh.position.set(x, y + 0.2, z);
      p.vx = (Math.random() - 0.5) * 0.8;
      p.vy = 1.2 + Math.random() * 1.5;
      p.vz = (Math.random() - 0.5) * 0.8;
      p.life = 0;
      p.maxLife = 0.8 + Math.random() * 0.4;
      p.scaleStart = 2.8 * scale;
      p.scaleEnd = 9.8 * scale;
      this.particles.push(p);
    }
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

  public update(dt: number): void {
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
  }

  public clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.mesh.visible = false;
      this.freePool[p.type].push(p);
    }
    this.particles.length = 0;
  }
}
