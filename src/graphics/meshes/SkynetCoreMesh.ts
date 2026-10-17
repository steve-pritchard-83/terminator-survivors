import * as THREE from 'three';
import { disposeObject3D } from '../dispose';

export class SkynetCoreMesh {
  public readonly group = new THREE.Group();
  private readonly singularity: THREE.Mesh;
  private readonly wireframeShield: THREE.Mesh;
  private readonly ringOuter: THREE.Group;
  private readonly ringMid: THREE.Group;
  private readonly ringInner: THREE.Group;
  private readonly energyBeam: THREE.Mesh;
  private readonly coreLight: THREE.PointLight;
  private readonly coreMat: THREE.MeshStandardMaterial;
  private readonly shieldMat: THREE.MeshStandardMaterial;
  private readonly ringMat: THREE.MeshStandardMaterial;

  constructor() {
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00c8ff,
      emissiveIntensity: 3.2,
      roughness: 0.1,
      metalness: 0.8
    });

    this.shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00a2ff,
      emissiveIntensity: 1.8,
      wireframe: true
    });

    this.ringMat = new THREE.MeshStandardMaterial({
      color: 0x68788c,
      metalness: 0.92,
      roughness: 0.25
    });

    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff
    });

    // 1. Singularity Core (floating central sphere)
    this.singularity = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 20), this.coreMat);
    this.singularity.position.y = 3.6;

    this.wireframeShield = new THREE.Mesh(new THREE.SphereGeometry(1.85, 18, 14), this.shieldMat);
    this.wireframeShield.position.y = 3.6;

    this.coreLight = new THREE.PointLight(0x00e5ff, 3.5, 18);
    this.coreLight.position.y = 3.6;

    this.group.add(this.singularity, this.wireframeShield, this.coreLight);

    // 2. Central Vertical Axis Energy Column
    const beamGeo = new THREE.CylinderGeometry(0.18, 0.18, 9.0, 12);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x88eeff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.energyBeam = new THREE.Mesh(beamGeo, beamMat);
    this.energyBeam.position.y = 4.5;
    this.group.add(this.energyBeam);

    // 3. Gyroscopic Magnetic Rings
    // Outer Ring (radius 3.4)
    this.ringOuter = new THREE.Group();
    this.ringOuter.position.y = 3.6;
    const outerTorus = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 12, 40), this.ringMat);
    this.ringOuter.add(outerTorus);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), nodeMat);
      node.position.set(Math.cos(angle) * 3.4, Math.sin(angle) * 3.4, 0);
      this.ringOuter.add(node);
    }

    // Mid Ring (radius 2.5)
    this.ringMid = new THREE.Group();
    this.ringMid.position.y = 3.6;
    const midTorus = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.11, 10, 36), this.ringMat);
    this.ringMid.add(midTorus);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), nodeMat);
      node.position.set(Math.cos(angle) * 2.5, 0, Math.sin(angle) * 2.5);
      this.ringMid.add(node);
    }

    // Inner Ring (radius 1.9)
    this.ringInner = new THREE.Group();
    this.ringInner.position.y = 3.6;
    const innerTorus = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 10, 32), this.ringMat);
    this.ringInner.add(innerTorus);

    this.group.add(this.ringOuter, this.ringMid, this.ringInner);

    // 4. Ground Conduit Pylons (4 surrounding pylons channeling power up to core)
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x3a424e,
      metalness: 0.85,
      roughness: 0.35
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const px = Math.cos(angle) * 4.2;
      const pz = Math.sin(angle) * 4.2;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), pylonMat);
      pylon.position.set(px, 1.1, pz);
      // Incline slightly towards center
      pylon.rotation.y = -angle;
      pylon.rotation.z = Math.cos(angle) * 0.15;
      pylon.rotation.x = Math.sin(angle) * 0.15;
      this.group.add(pylon);
    }
  }

  public updateAnimation(dt: number, timeSeconds: number, isEnraged: boolean): void {
    const speedMult = isEnraged ? 2.8 : 1.0;

    // Counter-rotating gyroscopes
    this.ringOuter.rotation.x += dt * 0.9 * speedMult;
    this.ringOuter.rotation.y += dt * 0.6 * speedMult;

    this.ringMid.rotation.y -= dt * 1.4 * speedMult;
    this.ringMid.rotation.z += dt * 1.1 * speedMult;

    this.ringInner.rotation.z += dt * 2.1 * speedMult;
    this.ringInner.rotation.x -= dt * 1.3 * speedMult;

    this.wireframeShield.rotation.y += dt * 0.4;
    this.wireframeShield.rotation.x += dt * 0.3;

    // Singularity breathing / temporal distortion pulse
    const pulseFreq = isEnraged ? 10.0 : 4.0;
    const pulse = 1.0 + Math.sin(timeSeconds * pulseFreq) * (isEnraged ? 0.22 : 0.08);
    this.singularity.scale.set(pulse, pulse, pulse);
    this.wireframeShield.scale.set(pulse, pulse, pulse);

    // Enraged Phase 2 crimson shift
    if (isEnraged) {
      this.coreMat.color.setHex(0xff1133);
      this.coreMat.emissive.setHex(0xff0022);
      this.shieldMat.color.setHex(0xff3355);
      this.shieldMat.emissive.setHex(0xff0033);
      this.coreLight.color.setHex(0xff1133);
      this.coreLight.intensity = 4.5 + Math.sin(timeSeconds * 12) * 1.5;
    } else {
      this.coreMat.color.setHex(0x00e5ff);
      this.coreMat.emissive.setHex(0x00c8ff);
      this.shieldMat.color.setHex(0x00d4ff);
      this.shieldMat.emissive.setHex(0x00a2ff);
      this.coreLight.color.setHex(0x00e5ff);
      this.coreLight.intensity = 3.5 + Math.sin(timeSeconds * 4) * 0.8;
    }
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
