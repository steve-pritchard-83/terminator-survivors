import * as THREE from 'three';
import { disposeObject3D } from '../dispose';
import { ModelLibrary } from '../ModelLibrary';

export class T1000Mesh {
  public readonly group = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly puddleMesh: THREE.Mesh;
  private readonly liquidMat: THREE.MeshStandardMaterial;

  constructor() {
    // Polished mirror chrome: it reflects the night sky and fires, so contrast does the work
    this.liquidMat = new THREE.MeshStandardMaterial({
      color: 0xf4f8fc,
      metalness: 1.0,
      roughness: 0.04,
      envMapIntensity: 2.4
    });

    // The sculpted figure in the same mirror chrome as its puddle (a chrome capsule until it has loaded)
    const model = ModelLibrary.get('t1000');
    if (model) {
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = this.liquidMat;
      });
      this.bodyGroup.add(model);
    } else {
      const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.3, 4, 10), this.liquidMat);
      capsule.position.y = 0.95;
      this.bodyGroup.add(capsule);
    }
    this.group.add(this.bodyGroup);

    // Mercury puddle (flattened disc for the puddle state)
    this.puddleMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.08, 24), this.liquidMat);
    this.puddleMesh.position.y = 0.04;
    this.puddleMesh.visible = false;
    this.group.add(this.puddleMesh);
  }

  public update(timeSeconds: number, isLiquid: boolean, isSlashing: boolean): void {
    if (isLiquid) {
      this.bodyGroup.visible = false;
      this.puddleMesh.visible = true;
      const pulse = 1.0 + Math.sin(timeSeconds * 12) * 0.1;
      this.puddleMesh.scale.set(pulse, 1.0, pulse);
      return;
    }

    this.bodyGroup.visible = true;
    this.puddleMesh.visible = false;

    // Subtle fluid ripple
    this.bodyGroup.position.y = Math.sin(timeSeconds * 6) * 0.04;

    // The blades are built into the figure, so a slash is a lunge forward and a twist
    this.bodyGroup.rotation.x = isSlashing ? 0.28 : 0;
    this.bodyGroup.rotation.y = isSlashing ? Math.sin(timeSeconds * 14) * 0.35 : 0;
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}
