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
  isAdditive: boolean;
}

export class ParticleSystem {
  public readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly pool: Particle[] = [];

  private readonly sparkGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0.4)
  ]);
  private readonly sparkMat = new THREE.LineBasicMaterial({ color: 0xffaa00 });

  private readonly smokeMat: THREE.MeshBasicMaterial;
  private readonly fireMat: THREE.MeshBasicMaterial;
  private readonly plasmaMat: THREE.MeshBasicMaterial;

  constructor() {
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
    const geo = new THREE.PlaneGeometry(2.4 * scale, 2.4 * scale);
    geo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(geo, this.fireMat.clone());
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
        scaleStart: 0.5 * scale,
        scaleEnd: 2.2 * scale,
        isAdditive: true
      });
    }

    // Black smoke puffs rising
    const smokeGeo = new THREE.PlaneGeometry(2.8 * scale, 2.8 * scale);
    smokeGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const sMesh = new THREE.Mesh(smokeGeo, this.smokeMat.clone());
      sMesh.position.set(x, y + 0.2, z);
      this.group.add(sMesh);
      this.particles.push({
        mesh: sMesh,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 1.2 + Math.random() * 1.5,
        vz: (Math.random() - 0.5) * 0.8,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        scaleStart: 1.0 * scale,
        scaleEnd: 3.5 * scale,
        isAdditive: false
      });
    }
  }

  public spawnPlasmaImpact(x: number, y: number, z: number): void {
    const geo = new THREE.PlaneGeometry(1.2, 1.2);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.plasmaMat.clone());
    mesh.position.set(x, y + 0.15, z);
    this.group.add(mesh);
    this.particles.push({
      mesh,
      vx: 0,
      vy: 0.2,
      vz: 0,
      life: 0,
      maxLife: 0.22,
      scaleStart: 0.4,
      scaleEnd: 1.8,
      isAdditive: true
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
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
}
