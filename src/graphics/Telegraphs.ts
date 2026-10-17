import * as THREE from 'three';
import { disposeObject3D } from './dispose';

export class CircleTelegraph {
  public readonly group = new THREE.Group();
  private readonly outerRing: THREE.Mesh;
  private readonly innerFill: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly fillMat: THREE.MeshBasicMaterial;
  private readonly baseRadius: number;

  constructor(radius = 4.0, color = 0xff1744) {
    this.baseRadius = radius;

    const ringGeo = new THREE.RingGeometry(radius * 0.94, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.outerRing = new THREE.Mesh(ringGeo, this.ringMat);
    this.outerRing.position.y = 0.05;

    const fillGeo = new THREE.CircleGeometry(radius * 0.94, 32);
    fillGeo.rotateX(-Math.PI / 2);
    this.fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.innerFill = new THREE.Mesh(fillGeo, this.fillMat);
    this.innerFill.position.y = 0.051;
    this.innerFill.scale.set(0.001, 1, 0.001);

    this.group.add(this.outerRing, this.innerFill);
    this.group.visible = false;
  }

  public update(x: number, z: number, progress: number, customRadius?: number): void {
    this.group.visible = true;
    this.group.position.set(x, 0, z);

    const rMult = customRadius ? customRadius / this.baseRadius : 1.0;
    this.outerRing.scale.set(rMult, 1, rMult);

    const clampedProgress = Math.max(0.001, Math.min(1.0, progress));
    const fillScale = clampedProgress * rMult;
    this.innerFill.scale.set(fillScale, 1, fillScale);

    this.ringMat.opacity = 0.4 + 0.5 * clampedProgress;
    this.fillMat.opacity = 0.15 + 0.55 * clampedProgress;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class LineTelegraph {
  public readonly group = new THREE.Group();
  private readonly beamMesh: THREE.Mesh;
  private readonly coreMesh: THREE.Mesh;
  private readonly beamMat: THREE.MeshBasicMaterial;
  private readonly coreMat: THREE.MeshBasicMaterial;

  constructor(baseWidth = 0.28, color = 0xff1744) {
    // Outer danger stripe: extends from Z=0 to Z=1
    const beamGeo = new THREE.PlaneGeometry(baseWidth, 1.0);
    beamGeo.translate(0, 0.5, 0);
    beamGeo.rotateX(-Math.PI / 2);

    this.beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
    this.beamMesh.position.y = 0.05;

    // Inner bright laser core: thinner line
    const coreGeo = new THREE.PlaneGeometry(baseWidth * 0.35, 1.0);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(-Math.PI / 2);

    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMat);
    this.coreMesh.position.y = 0.052;

    this.group.add(this.beamMesh, this.coreMesh);
    this.group.visible = false;
  }

  public update(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    progress: number,
    widthMult = 1.0
  ): void {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    this.group.position.set(fromX, 0, fromZ);
    this.group.rotation.y = Math.atan2(dx, dz);

    const clampedProgress = Math.max(0.001, Math.min(1.0, progress));
    // Pulsing danger beam width and opacity
    const width = widthMult * (0.6 + 0.4 * clampedProgress);
    this.group.scale.set(width, 1, dist);

    this.beamMat.opacity = 0.25 + 0.6 * clampedProgress;
    this.coreMat.opacity = 0.4 + 0.55 * clampedProgress;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}

export class ConeTelegraph {
  public readonly group = new THREE.Group();
  private readonly outerBorder: THREE.Mesh;
  private readonly innerFill: THREE.Mesh;
  private readonly borderMat: THREE.MeshBasicMaterial;
  private readonly fillMat: THREE.MeshBasicMaterial;

  constructor(radius = 8.0, angleSpan = Math.PI / 3, color = 0xff1744) {
    const borderGeo = new THREE.RingGeometry(radius * 0.94, radius, 24, 1, -angleSpan / 2, angleSpan);
    borderGeo.rotateX(-Math.PI / 2);
    this.borderMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.outerBorder = new THREE.Mesh(borderGeo, this.borderMat);
    this.outerBorder.position.y = 0.05;

    const fillGeo = new THREE.CircleGeometry(radius * 0.94, 24, -angleSpan / 2, angleSpan);
    fillGeo.rotateX(-Math.PI / 2);
    this.fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.innerFill = new THREE.Mesh(fillGeo, this.fillMat);
    this.innerFill.position.y = 0.051;
    this.innerFill.scale.set(0.001, 1, 0.001);

    this.group.add(this.outerBorder, this.innerFill);
    this.group.visible = false;
  }

  public update(x: number, z: number, facingAngle: number, progress: number): void {
    this.group.visible = true;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = facingAngle;

    const clampedProgress = Math.max(0.001, Math.min(1.0, progress));
    this.innerFill.scale.set(clampedProgress, 1, clampedProgress);

    this.borderMat.opacity = 0.35 + 0.55 * clampedProgress;
    this.fillMat.opacity = 0.15 + 0.55 * clampedProgress;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
