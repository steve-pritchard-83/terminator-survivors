import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bakeAutoRigged, bakeEndoModel, markEndoShared, type EndoModel } from './EndoModel';
import { autoRigHumanoid, type AutoRigged } from './AutoRig';
import { RENDER_BUDGET } from '../data/performance';

/** Phones load the light variants (name.m.glb: fewer triangles, 512 px textures). */
const variant = (url: string): string => url.replace(/\.glb$/, `${RENDER_BUDGET.modelSuffix}.glb`);

/**
 * Sculpted models (public/models, made by scripts/process-models.mjs). They load in the background
 * at startup; meshes show a placeholder shape until their model is ready (Deploy waits for them).
 * Every model is normalised to a fixed size, facing +z.
 */
export type ModelName =
  | 'hk_tank_hull'
  | 'hk_tank_turret'
  | 'hk_aerial'
  | 'burnt_car'
  | 't1_tracked'
  | 't1000'
  | 'skynet_core'
  | 'plasma_rifle'
  | 'infiltrator'
  | 'player'
  | 't600'
  | 'moto'
  | 'turret_base'
  | 'turret_gun'
  | 'k9'
  | 'seeker'
  | 'xp';

interface ModelSpec {
  url: string;
  /** Size along one axis in the mesh's local units (before the mesh group's own scale) */
  fit: { axis: 'x' | 'y' | 'z'; size: number };
  /** Turn the source to face +z before sizing */
  rotateY?: number;
  /** Rigged: instances get their own skeleton (animated by HumanoidAnimator) */
  skinned?: boolean;
  /** Make the materials dark reflective metal (the films' machines); omit to keep the source look */
  metal?: { metalness: number; roughness: number };
  /** Mute the model's own colours toward weathered grey (0 keeps them, 1 is fully grey) so it sits in the landscape */
  grey?: number;
  /** true: sits on y = 0; false: centred on y = 0 */
  grounded: boolean;
  /** Split into a hull and a turret above this fraction of the height */
  turretSplit?: { hull: ModelName; turret: ModelName; fraction: number };
}

const MACHINE_METAL = { metalness: 0.75, roughness: 0.42 };

const SPECS: Record<string, ModelSpec> = {
  hk_tank: {
    url: './models/hk_tank.glb',
    fit: { axis: 'z', size: 6.2 },
    grounded: true,
    metal: MACHINE_METAL,
    turretSplit: { hull: 'hk_tank_hull', turret: 'hk_tank_turret', fraction: 0.52 }
  },
  hk_aerial: { url: './models/hk_aerial.glb', fit: { axis: 'z', size: 6.7 }, grounded: false, metal: MACHINE_METAL },
  // The wreck keeps its own rust textures
  burnt_car: { url: './models/burnt_car.glb', fit: { axis: 'z', size: 4.4 }, grounded: true, grey: 0.78 },
  // Faces -x in the source
  t1_tracked: { url: './models/t1_tracked.glb', fit: { axis: 'z', size: 1.9 }, grounded: true, rotateY: Math.PI / 2 },
  t1000: { url: './models/t1000.glb', fit: { axis: 'y', size: 2.15 }, grounded: true },
  skynet_core: { url: './models/skynet_core.glb', fit: { axis: 'y', size: 6.6 }, grounded: true },
  // Barrel points +x in the source
  plasma_rifle: { url: './models/plasma_rifle.glb', fit: { axis: 'z', size: 1.0 }, grounded: false, rotateY: -Math.PI / 2 },
  infiltrator: { url: './models/infiltrator.glb', fit: { axis: 'y', size: 1.95 }, grounded: true, skinned: true },
  // Unrigged A-pose soldier: rigged at load time (AutoRig)
  player: { url: './models/player.glb', fit: { axis: 'y', size: 1.8 }, grounded: true },
  // Unrigged T-pose: rigged, posed and split for the instanced batch at load time
  t600: { url: './models/t600.glb', fit: { axis: 'y', size: 1.85 }, grounded: true, metal: { metalness: 0.7, roughness: 0.5 } },
  // Faces -x in the source
  moto: { url: './models/moto.glb', fit: { axis: 'z', size: 2.1 }, grounded: true, rotateY: Math.PI / 2 },
  // The gun turns on its tripod
  turret: {
    url: './models/turret.glb',
    fit: { axis: 'y', size: 1.4 },
    grounded: true,
    turretSplit: { hull: 'turret_base', turret: 'turret_gun', fraction: 0.4 }
  },
  // Faces +x in the source
  k9: { url: './models/k9.glb', fit: { axis: 'z', size: 1.2 }, grounded: true, rotateY: -Math.PI / 2 },
  seeker: { url: './models/seeker.glb', fit: { axis: 'x', size: 0.8 }, grounded: false },
  xp: { url: './models/xp.glb', fit: { axis: 'y', size: 0.5 }, grounded: false }
};
const skinnedNames = new Set(Object.entries(SPECS).filter(([, s]) => s.skinned).map(([n]) => n));

/** Phones: a faint cool glow through the material's own texture so dark metal reads against the ground. */
function liftMachine(mat: THREE.MeshStandardMaterial): void {
  if (!RENDER_BUDGET.machineLift) return;
  mat.emissive.setRGB(0.8, 0.88, 1).multiplyScalar(RENDER_BUDGET.machineLift);
  mat.emissiveMap = mat.map;
}

/**
 * The T-800 texture has a rust-copper cast; the films' endoskeleton is polished silver chrome.
 * Keep the texture's detail but drain most of its colour, tint it cool silver and make it fully metallic.
 */
function chromeEndoMaterial(mat: THREE.MeshStandardMaterial): void {
  mat.color.setHex(0xd2dbe4);
  mat.metalness = RENDER_BUDGET.metalScale;
  liftMachine(mat);
  mat.roughness = 0.75; // multiplies the texture's own roughness
  mat.envMapIntensity = 1.5;
  mat.side = THREE.FrontSide;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\ndiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.15);'
    );
  };
  mat.customProgramCacheKey = () => 'endo-chrome';
}

const cache = new Map<ModelName, THREE.Object3D>();
const meshData = new Map<ModelName, { geometry: THREE.BufferGeometry; material: THREE.Material }>();
let endoModel: EndoModel | null = null;
let t600Model: EndoModel | null = null;
let loading: Promise<void> | null = null;

/**
 * Pulls a model's own textures toward cool concrete grey, keeping their detail: saturation drops by `amount`
 * and the result is slightly darkened, so rust and paint stop shouting against the ground.
 */
function greyMaterials(root: THREE.Object3D, amount: number): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial) continue;
      mat.color.multiply(new THREE.Color(0xc4cad0));
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float greyLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(greyLuma) * vec3(0.92, 0.95, 1.0), ${amount.toFixed(2)});`
        );
      };
      mat.customProgramCacheKey = () => `grey-${amount}`;
      mat.needsUpdate = true;
    }
  });
}

function markShared(root: THREE.Object3D, metal?: ModelSpec['metal']): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      m.userData.shared = true;
      const std = m as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial && metal) {
        std.metalness = metal.metalness * RENDER_BUDGET.metalScale;
        liftMachine(std);
        std.roughness = metal.roughness;
        std.envMapIntensity = 1.2;
      }
    }
  });
}

/** Turns the model to face +z, scales it to the spec's size, centres it on x/z and seats it on (or centres it at) y = 0. */
function normalise(scene: THREE.Object3D, spec: ModelSpec): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  if (spec.rotateY) scene.rotation.y += spec.rotateY;
  scene.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  scene.scale.multiplyScalar(spec.fit.size / size[spec.fit.axis]);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const centre = box.getCenter(new THREE.Vector3());
  scene.position.x -= centre.x;
  scene.position.z -= centre.z;
  scene.position.y -= spec.grounded ? box.min.y : centre.y;
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

/**
 * Cuts every mesh into two by triangle centroid height (in the wrapper's space), so a tank's turret
 * can turn on its hull. Each half gets its own copy of the geometry with the transform baked in.
 */
function splitByHeight(wrapper: THREE.Group, fraction: number): { hull: THREE.Group; turret: THREE.Group } {
  const hull = new THREE.Group();
  const turret = new THREE.Group();
  const cut = new THREE.Box3().setFromObject(wrapper).max.y * fraction;
  const v = new THREE.Vector3();
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const index = geo.getIndex();
    const triCount = index ? index.count / 3 : pos.count / 3;
    const lower: number[] = [];
    const upper: number[] = [];
    for (let t = 0; t < triCount; t++) {
      let y = 0;
      const ids = [0, 1, 2].map((k) => (index ? index.getX(t * 3 + k) : t * 3 + k));
      for (const id of ids) y += v.fromBufferAttribute(pos, id).applyMatrix4(mesh.matrixWorld).y;
      (y / 3 > cut ? upper : lower).push(...ids);
    }
    for (const [indices, target] of [
      [lower, hull],
      [upper, turret]
    ] as const) {
      if (indices.length === 0) continue;
      const part = geo.clone();
      part.setIndex(indices);
      part.applyMatrix4(mesh.matrixWorld);
      target.add(new THREE.Mesh(part, mesh.material));
    }
  });
  return { hull, turret };
}

export const ModelLibrary = {
  /** Starts loading every model once; safe to call repeatedly. */
  preload(): Promise<void> {
    if (loading) return loading;
    const loader = new GLTFLoader();
    const endo = loader
      .loadAsync(variant('./models/t800.glb'))
      .then((gltf) => {
        endoModel = bakeEndoModel(gltf.scene);
        if (endoModel) {
          markEndoShared(endoModel);
          chromeEndoMaterial(endoModel.material as THREE.MeshStandardMaterial);
        }
      })
      .catch(() => {
        // The T-800 stays a placeholder (Deploy then stays disabled)
      });
    loading = Promise.all([
      endo,
      ...Object.entries(SPECS).map(async ([name, spec]) => {
        try {
          const gltf = await loader.loadAsync(variant(spec.url));
          const model = normalise(gltf.scene, spec);
          if (spec.turretSplit) {
            const { hull, turret } = splitByHeight(model, spec.turretSplit.fraction);
            markShared(hull, spec.metal);
            markShared(turret, spec.metal);
            cache.set(spec.turretSplit.hull, hull);
            cache.set(spec.turretSplit.turret, turret);
          } else {
            markShared(model, spec.metal);
            if (spec.grey) greyMaterials(model, spec.grey);
            cache.set(name as ModelName, model);
          }
        } catch {
          // Missing or unloadable model (tests, offline first run): the procedural mesh stays
        }
      })
    ]).then(() => {
      // The T-600 arrives unrigged: rig it, pose the rifle carry and split it like the T-800
      const t600 = cache.get('t600');
      const rigged = t600 ? autoRigHumanoid(t600) : null;
      t600Model = rigged ? bakeAutoRigged(rigged) : null;
      if (t600Model) markEndoShared(t600Model);
    });
    return loading;
  },

  /** The baked T-600 pieces (same layout as the T-800's), or null if not loaded (yet). */
  getT600(): EndoModel | null {
    return t600Model;
  },

  /** The baked T-800 pieces for the instanced endoskeleton batch, or null if not loaded (yet). */
  getEndo(): EndoModel | null {
    return endoModel;
  },

  /**
   * The model as one geometry (transforms baked in) and one material, for instanced drawing.
   * Pieces with other materials are dropped. Shared: never dispose them.
   */
  getMeshData(name: ModelName): { geometry: THREE.BufferGeometry; material: THREE.Material } | null {
    const cached = meshData.get(name);
    if (cached) return cached;
    const model = cache.get(name);
    if (!model) return null;
    model.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    let material: THREE.Material | null = null;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      material ??= mat;
      if (mat !== material) return;
      parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    });
    if (!material || parts.length === 0) return null;
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!geometry) return null;
    geometry.userData.shared = true;
    const data = { geometry, material };
    meshData.set(name, data);
    return data;
  },

  /**
   * Where a hand holds a gun model (facing +z): just above the bottom of the pistol grip, found as
   * the lowest point 18-40% of the way forward from the butt (behind that is the shoulder stock).
   */
  gripPoint(geometry: THREE.BufferGeometry): THREE.Vector3 {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const length = box.max.z - box.min.z;
    const from = box.min.z + length * 0.18;
    const to = box.min.z + length * 0.4;
    const pos = geometry.getAttribute('position');
    const grip = new THREE.Vector3(0, Infinity, 0);
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (z >= from && z <= to && y < grip.y) grip.set(pos.getX(i), y, z);
    }
    grip.y += 0.07;
    return grip;
  },

  /** A freshly rigged player figure (Kyle 2029), or null if the model has not loaded (yet). */
  getPlayer(): AutoRigged | null {
    const model = cache.get('player');
    return model ? autoRigHumanoid(model) : null;
  },

  /** A fresh instance sharing the cached geometry and materials, or null if not loaded (yet). */
  get(name: ModelName): THREE.Object3D | null {
    const model = cache.get(name);
    if (!model) return null;
    if (!skinnedNames.has(name)) return model.clone(true);
    const copy = cloneSkinned(model);
    // Posed limbs move outside the bind-pose bounds, so never cull them
    copy.traverse((o) => {
      o.frustumCulled = false;
    });
    return copy;
  }
};
