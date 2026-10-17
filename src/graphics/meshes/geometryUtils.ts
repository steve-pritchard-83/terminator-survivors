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
  colorHex = 0xffffff
): THREE.BufferGeometry {
  const nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();
  nonIndexed.deleteAttribute('uv');
  if (!nonIndexed.getAttribute('normal')) {
    nonIndexed.computeVertexNormals();
  }
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  mat.compose(new THREE.Vector3(tx, ty, tz), q, new THREE.Vector3(1, 1, 1));
  nonIndexed.applyMatrix4(mat);
  nonIndexed.computeVertexNormals();

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
  merged.computeVertexNormals();
  return merged;
}
