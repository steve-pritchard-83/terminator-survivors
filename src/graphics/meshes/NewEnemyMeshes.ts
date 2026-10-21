import * as THREE from 'three';
import { createPlaceholder } from './geometryUtils';
import { disposeObject3D } from '../dispose';
import { ModelLibrary } from '../ModelLibrary';

export class T1MinigunMesh {
  public readonly group = new THREE.Group();

  constructor() {
    this.group.add(ModelLibrary.get('t1_tracked') ?? createPlaceholder(1.4, 0.9, 1.4));
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}

export class MotoTerminatorMesh {
  public readonly group = new THREE.Group();

  constructor() {
    this.group.add(ModelLibrary.get('moto') ?? createPlaceholder(0.4, 0.8, 1.6));
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}

export class PlasmaTurretMesh {
  public readonly group = new THREE.Group();
  public readonly barrelGroup = new THREE.Group();

  constructor() {
    // Sculpted sentry: the tripod stays put, the gun turns to track
    this.group.add(ModelLibrary.get('turret_base') ?? createPlaceholder(1.4, 0.7, 1.4), this.barrelGroup);
    this.barrelGroup.add(ModelLibrary.get('turret_gun') ?? createPlaceholder(0.5, 0.4, 1.2, 0.95));
  }

  public dispose(): void {
    this.group.removeFromParent();
    disposeObject3D(this.group);
  }
}
