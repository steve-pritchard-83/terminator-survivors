import * as THREE from 'three';
import { ModelLibrary } from '../ModelLibrary';

export interface DogMeshGroup extends THREE.Group {
  userData: {
    legs: THREE.Mesh[];
    ears: THREE.Mesh[];
    tail: THREE.Mesh;
    trotTime: number;
  };
}

export function createDogMesh(isPack = false): DogMeshGroup {
  const group = new THREE.Group() as DogMeshGroup;

  // Sculpted German Shepherd: one piece, so it gallops by bobbing and pitching (see DogUnit)
  const model = ModelLibrary.get('k9');
  if (model) {
    model.name = 'body';
    group.add(model);
    group.userData = { legs: [], ears: [], tail: new THREE.Mesh(), trotTime: 0 };
    return group;
  }

  const furColor = isPack ? 0x2d3748 : 0x5c4033;
  const chestColor = isPack ? 0x1a202c : 0x8b6b4f;
  const collarColor = isPack ? 0xff0055 : 0x00e5ff;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: furColor,
    roughness: 0.85,
    metalness: 0.1
  });
  const chestMat = new THREE.MeshStandardMaterial({
    color: chestColor,
    roughness: 0.9,
    metalness: 0.05
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: collarColor,
    emissive: collarColor,
    emissiveIntensity: 2.0
  });

  // Body torso
  const bodyGeo = new THREE.BoxGeometry(0.36, 0.36, 0.72);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.42;
  group.add(body);

  // Chest / belly
  const chestGeo = new THREE.BoxGeometry(0.34, 0.3, 0.4);
  const chest = new THREE.Mesh(chestGeo, chestMat);
  chest.position.set(0, 0.4, 0.16);
  group.add(chest);

  // Head
  const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.28);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 0.62, 0.42);
  group.add(head);

  // Snout
  const snoutGeo = new THREE.BoxGeometry(0.14, 0.12, 0.2);
  const snout = new THREE.Mesh(snoutGeo, chestMat);
  snout.position.set(0, 0.58, 0.6);
  group.add(snout);

  // Nose tip
  const noseGeo = new THREE.BoxGeometry(0.06, 0.05, 0.05);
  const noseMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.62, 0.7);
  group.add(nose);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.06, 0.16, 4);
  earGeo.rotateX(-0.2);
  const earMat = new THREE.MeshStandardMaterial({ color: furColor });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.09, 0.8, 0.4);
  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.09, 0.8, 0.4);
  group.add(leftEar, rightEar);

  // Collar with glowing tag
  const collarGeo = new THREE.TorusGeometry(0.14, 0.03, 6, 12);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 0.54, 0.32);
  group.add(collar);

  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.32, 6);
  tailGeo.rotateX(-0.7);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, 0.52, -0.42);
  group.add(tail);

  // 4 Legs
  const legGeo = new THREE.BoxGeometry(0.1, 0.34, 0.1);
  const legFL = new THREE.Mesh(legGeo, chestMat);
  legFL.position.set(-0.13, 0.17, 0.22);
  const legFR = new THREE.Mesh(legGeo, chestMat);
  legFR.position.set(0.13, 0.17, 0.22);
  const legBL = new THREE.Mesh(legGeo, bodyMat);
  legBL.position.set(-0.13, 0.17, -0.22);
  const legBR = new THREE.Mesh(legGeo, bodyMat);
  legBR.position.set(0.13, 0.17, -0.22);

  group.add(legFL, legFR, legBL, legBR);

  group.userData = {
    legs: [legFL, legFR, legBL, legBR],
    ears: [leftEar, rightEar],
    tail,
    trotTime: 0
  };

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
