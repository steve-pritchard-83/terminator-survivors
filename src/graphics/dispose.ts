import * as THREE from 'three';

/**
 * Traverses an Object3D hierarchy and disposes all attached geometries and materials
 * UNLESS explicitly flagged with `userData.shared = true`.
 */
export function disposeObject3D(obj: THREE.Object3D | null | undefined): void {
  if (!obj) return;

  obj.traverse((child) => {
    const renderable = child as THREE.Mesh;

    // Dispose geometry if not marked shared
    if (renderable.geometry && !renderable.geometry.userData?.shared && typeof renderable.geometry.dispose === 'function') {
      renderable.geometry.dispose();
    }

    // Dispose material(s) if not marked shared
    if (renderable.material) {
      if (Array.isArray(renderable.material)) {
        for (const mat of renderable.material) {
          if (mat && !mat.userData?.shared && typeof mat.dispose === 'function') {
            mat.dispose();
          }
        }
      } else if (!renderable.material.userData?.shared && typeof renderable.material.dispose === 'function') {
        renderable.material.dispose();
      }
    }
  });
}
