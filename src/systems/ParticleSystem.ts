import * as THREE from 'three';
import { ProceduralTextures } from '../graphics/ProceduralTextures';

export interface Particle {
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

  private readonly unitPlaneGeo: THREE.PlaneGeometry;
  private readonly smokeMat: THREE.MeshBasicMaterial;
  private readonly fireMat: THREE.MeshBasicMaterial;
  private readonly plasmaMat: THREE.MeshBasicMaterial;

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
  }

  public spawnExplosion(x: number, y: number, z: number, scale = 1.0): void {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(this.unitPlaneGeo, this.fireMat.clone());
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.8 * scale,
        y + 0.1 + i * 0.05,
        z + (Math.random() - 0.5) * 0.8 * scale
      );
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.5 + Math.random() * 1.2,
        vz: (Math.random() - 0.5) * 1.5,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        scaleStart: 1.2 * scale,
        scaleEnd: 5.2 * scale
      });
    }

    // Black smoke puffs rising
    for (let i = 0; i < 4; i++) {
      const sMesh = new THREE.Mesh(this.unitPlaneGeo, this.smokeMat.clone());
      sMesh.position.set(x, y + 0.2, z);
      this.group.add(sMesh);
      this.particles.push({
        mesh: sMesh,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 1.2 + Math.random() * 1.5,
        vz: (Math.random() - 0.5) * 0.8,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        scaleStart: 2.8 * scale,
        scaleEnd: 9.8 * scale
      });
    }
  }

  public spawnPlasmaImpact(x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(this.unitPlaneGeo, this.plasmaMat.clone());
    mesh.position.set(x, y + 0.15, z);
    this.group.add(mesh);
    this.particles.push({
      mesh,
      vx: 0,
      vy: 0.2,
      vz: 0,
      life: 0,
      maxLife: 0.22,
      scaleStart: 0.48,
      scaleEnd: 2.16
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
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
      this.group.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
  }
}
