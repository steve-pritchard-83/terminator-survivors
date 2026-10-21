import * as THREE from 'three';
import { ModelLibrary } from '../ModelLibrary';
import { createPlaceholder } from './geometryUtils';

/** The K-9: the sculpted German Shepherd as one piece named 'body' (DogUnit bounds and pitches it to gallop). */
export function createDogMesh(): THREE.Group {
  const group = new THREE.Group();
  const body = ModelLibrary.get('k9') ?? createPlaceholder(0.3, 0.45, 0.9);
  body.name = 'body';
  group.add(body);
  return group;
}

export function createReprogrammedT800Mesh(isGuardian = false): THREE.Group {
  const group = new THREE.Group();

  const chassisColor = isGuardian ? 0x222a36 : 0x5a6578;
  const opticsColor = 0x00e5ff; // Cyan reprogrammed eyes!

  const chassisMat = new THREE.MeshStandardMaterial({
    color: chassisColor,
    metalness: 0.85,
    roughness: 0.35
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x9ca8b8,
    metalness: 0.95,
    roughness: 0.2
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: opticsColor });

  // Torso / ribcage
  const torsoGeo = new THREE.BoxGeometry(0.65, 0.8, 0.4);
  const torso = new THREE.Mesh(torsoGeo, chassisMat);
  torso.position.y = 1.1;
  group.add(torso);

  // Skull
  const skullGeo = new THREE.BoxGeometry(0.32, 0.34, 0.32);
  const skull = new THREE.Mesh(skullGeo, chromeMat);
  skull.position.set(0, 1.7, 0);
  group.add(skull);

  // Glowing cyan optic sensors
  const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 1.72, 0.17);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.08, 1.72, 0.17);
  group.add(eyeL, eyeR);

  // Arms and Westinghouse rifle
  const armGeo = new THREE.BoxGeometry(0.16, 0.65, 0.16);
  const armL = new THREE.Mesh(armGeo, chassisMat);
  armL.position.set(-0.42, 1.1, 0.1);
  const armR = new THREE.Mesh(armGeo, chassisMat);
  armR.position.set(0.42, 1.1, 0.1);
  group.add(armL, armR);

  // Rifle
  const rifleGeo = new THREE.BoxGeometry(0.12, 0.16, 0.9);
  const rifleMat = new THREE.MeshStandardMaterial({
    color: 0x1a222e,
    metalness: 0.8,
    roughness: 0.4
  });
  const rifle = new THREE.Mesh(rifleGeo, rifleMat);
  rifle.position.set(0.25, 1.05, 0.4);
  group.add(rifle);

  // Glowing barrel vent
  const ventGeo = new THREE.BoxGeometry(0.06, 0.06, 0.3);
  const vent = new THREE.Mesh(ventGeo, eyeMat);
  vent.position.set(0.25, 1.1, 0.6);
  group.add(vent);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
  const legL = new THREE.Mesh(legGeo, chassisMat);
  legL.position.set(-0.18, 0.38, 0);
  const legR = new THREE.Mesh(legGeo, chassisMat);
  legR.position.set(0.18, 0.38, 0);
  group.add(legL, legR);

  // Heavy armor plates for Guardian
  if (isGuardian) {
    const shoulderGeo = new THREE.BoxGeometry(0.3, 0.25, 0.4);
    const shL = new THREE.Mesh(shoulderGeo, chromeMat);
    shL.position.set(-0.48, 1.45, 0);
    const shR = new THREE.Mesh(shoulderGeo, chromeMat);
    shR.position.set(0.48, 1.45, 0);
    group.add(shL, shR);

    // Second minigun on left arm
    const leftGun = new THREE.Mesh(rifleGeo, rifleMat);
    leftGun.position.set(-0.25, 1.05, 0.4);
    group.add(leftGun);
    group.scale.set(1.25, 1.25, 1.25);
  }

  return group;
}

export function createSlashArcMesh(
  radius: number,
  arcAngle: number,
  color = 0x44ddff
): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.55, radius, 32, 1, -arcAngle / 2, arcAngle);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Mesh(geo, mat);
}
