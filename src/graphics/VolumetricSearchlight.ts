import * as THREE from 'three';

export class VolumetricSearchlight {
  public readonly group = new THREE.Group();
  private readonly coneMat: THREE.MeshBasicMaterial;
  private readonly groundDiscMat: THREE.MeshBasicMaterial;
  private readonly normalColor = new THREE.Color(0x9cd8ff);
  private readonly alertColor = new THREE.Color(0xff2222);

  constructor(length = 10, radius = 2.6) {
    // Use CylinderGeometry with non-zero top radius (0.18) instead of ConeGeometry(0)
    // to prevent degenerate zero-length apex normals that produce NaN in mobile GPU shaders
    const coneGeo = new THREE.CylinderGeometry(0.18, radius, length, 20, 1, true);
    coneGeo.translate(0, -length / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Points along +Z in local space

    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0x9cd8ff,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false
    });

    const coneMesh = new THREE.Mesh(coneGeo, this.coneMat);
    coneMesh.frustumCulled = false;
    this.group.add(coneMesh);

    const discGeo = new THREE.RingGeometry(0.2, radius * 0.9, 24);
    discGeo.rotateX(-Math.PI / 2);
    this.groundDiscMat = new THREE.MeshBasicMaterial({
      color: 0x9cd8ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const discMesh = new THREE.Mesh(discGeo, this.groundDiscMat);
    discMesh.name = 'groundDisc';
    discMesh.frustumCulled = false;
    this.group.add(discMesh);
  }

  public update(timeSeconds: number, alertLevel: number, groundYOffset: number): void {
    const clampedAlert = Math.max(0, Math.min(1, Number.isFinite(alertLevel) ? alertLevel : 0));
    const pulse = 0.92 + 0.08 * Math.sin(timeSeconds * 4.0);

    this.coneMat.color.lerpColors(this.normalColor, this.alertColor, clampedAlert);
    this.coneMat.opacity = (0.09 + 0.08 * clampedAlert) * pulse;

    this.groundDiscMat.color.lerpColors(this.normalColor, this.alertColor, clampedAlert);
    this.groundDiscMat.opacity = (0.14 + 0.12 * clampedAlert) * pulse;

    const disc = this.group.getObjectByName('groundDisc');
    if (disc) {
      disc.position.set(0, groundYOffset, 6.5);
    }
  }
}
