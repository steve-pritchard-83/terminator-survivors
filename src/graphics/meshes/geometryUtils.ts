import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function bakePart(
  geom: THREE.BufferGeometry,
  tx = 0,
  ty = 0,
  tz = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  colorHex = 0xffffff,
  sx = 1,
  sy = 1,
  sz = 1
): THREE.BufferGeometry {
  const nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();
  nonIndexed.deleteAttribute('uv');
  // Keep the primitive's own normals so spheres and cylinders stay smooth (boxes keep hard edges).
  if (!nonIndexed.getAttribute('normal')) {
    nonIndexed.computeVertexNormals();
  }
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  mat.compose(new THREE.Vector3(tx, ty, tz), q, new THREE.Vector3(sx, sy, sz));
  nonIndexed.applyMatrix4(mat);

  const posAttr = nonIndexed.getAttribute('position');
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(colorHex);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return nonIndexed;
}

export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) {
    throw new Error('mergeGeometries failed to produce geometry');
  }
  return merged;
}

export type Vec3 = [number, number, number];

/** Cylinder from point a to point b. r1 is the radius at a, r2 at b. */
export function limbBetween(
  a: Vec3,
  b: Vec3,
  r1: number,
  r2: number,
  color: number,
  segments = 8
): THREE.BufferGeometry {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return bakePart(
    new THREE.CylinderGeometry(r2, r1, length, segments),
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
    e.x,
    e.y,
    e.z,
    color
  );
}

export function ballPart(x: number, y: number, z: number, r: number, color: number, sx = 1, sy = 1, sz = 1) {
  return bakePart(new THREE.SphereGeometry(r, 8, 6), x, y, z, 0, 0, 0, color, sx, sy, sz);
}

export function boxPart(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
  rx = 0,
  ry = 0,
  rz = 0
) {
  return bakePart(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz, color);
}

/** Cylinder whose axis is along x (a wheel seen from the side) at the given position. */
export function wheelPart(x: number, y: number, z: number, radius: number, width: number, color: number, segments = 14) {
  return bakePart(new THREE.CylinderGeometry(radius, radius, width, segments), x, y, z, 0, 0, Math.PI / 2, color);
}

/** Cylinder whose axis is along z (a barrel pointing forward). */
export function barrelPart(x: number, y: number, z: number, radius: number, length: number, color: number, segments = 10) {
  return bakePart(new THREE.CylinderGeometry(radius, radius, length, segments), x, y, z, Math.PI / 2, 0, 0, color);
}

const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.5, roughness: 0.6 });
placeholderMat.userData.shared = true;

/**
 * Stand-in drawn only until an entity's sculpted model has loaded (the title screen holds Deploy until
 * then, so players don't normally see it): a dim box of the entity's rough size, seated on y = 0.
 */
export function createPlaceholder(width: number, height: number, depth: number, y = height / 2): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), placeholderMat);
  mesh.position.y = y;
  return mesh;
}
