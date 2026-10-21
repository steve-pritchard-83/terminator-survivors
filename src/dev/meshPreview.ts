// Dev-only mesh preview used for screenshot review. Served by `vite` at /mesh-preview.html and
// never part of the production build (index.html is the only build entry).
//
//   ?m=kyle | env | <enemy archetype id>   what to render
//   &az=35 &el=18 &dist=4                  camera azimuth / elevation (degrees) and distance
//   &game=1                                use the in-game camera angle instead of a close-up
import * as THREE from 'three';
import { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { Environment2029 } from '../graphics/Environment2029';
import { createEnemyPreviewObject } from '../graphics/meshes/EnemyTurntablePreview';
import { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { ProceduralTextures } from '../graphics/ProceduralTextures';
import type { ActiveEnemy, EnemyArchetypeId, LoadoutId } from '../core/types';

const BATCH_ARCHETYPES = ['t800_endoskeleton', 't600_rusted', 't700_scout', 'skynet_crab_drone'];

const params = new URLSearchParams(location.search);
const which = params.get('m') ?? 'kyle';
const az = THREE.MathUtils.degToRad(Number(params.get('az') ?? 35));
const el = THREE.MathUtils.degToRad(Number(params.get('el') ?? 18));
const dist = Number(params.get('dist') ?? 4);
const gameView = params.get('game') === '1';

const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x162840);
scene.fog = new THREE.Fog(0x162840, 23.5, 48.0);
// The game uses this reflection map on real GPUs (it is skipped only under automation)
scene.environment = ProceduralTextures.getMetallicEnvMap();
scene.environmentIntensity = 0.5;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('app')!.appendChild(renderer.domElement);

// Same lighting rig as SceneManager
scene.add(new THREE.HemisphereLight(0x7aa8d8, 0x203044, 1.25));
scene.add(new THREE.AmbientLight(0x345070, 1.05));
const moon = new THREE.DirectionalLight(0x90bce8, 1.45);
moon.position.set(-16, 30, -14);
scene.add(moon);
const rim = new THREE.DirectionalLight(0x5288c4, 0.85);
rim.position.set(18, 14, 20);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 250);

let target = new THREE.Vector3(0, 0.9, 0);

if (which === 'env') {
  const env = new Environment2029();
  scene.add(env.group);
  env.update(0, 0);
} else if (which === 'kyle') {
  const kyle = new KyleReeseMesh();
  kyle.applyLoadout((params.get('loadout') ?? 'reese_1984') as LoadoutId);
  scene.add(kyle.group);
  kyle.updateAnimation(0.016, 0, 0);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
} else if (BATCH_ARCHETYPES.includes(which)) {
  // Same instanced renderer the game uses for these enemies
  const batch = new EndoskeletonBatch(4);
  scene.add(batch.group);
  const fake = {
    id: 1, type: 'enemy', archetype: which, x: 0, z: 0, radius: 0.5, hp: 10, maxHp: 10, speed: 1, damage: 1,
    mass: 1, vx: 0, vz: 0, isBoss: false, isFlying: false, xpValue: 1, hitFlashTimer: 0, slowTimer: 0,
    armorStripMultiplier: 1, attackCooldown: 0, chargeTimer: 0, searchlightAngle: 0, searchlightAlertTimer: 0,
    phaseState: 0, state: {}
  } as unknown as ActiveEnemy;
  batch.updateBatch([fake], 0.4, 0, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
} else {
  const obj = createEnemyPreviewObject(which as EnemyArchetypeId);
  scene.add(obj);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.9;
  scene.add(ground);
  target = new THREE.Vector3(0, 0, 0);
}

if (gameView) {
  // In-game camera: high, slightly behind, looking down at the player (see SceneManager.cameraOffset)
  camera.position.set(0, 17, 13);
  camera.lookAt(0, 0, 0);
} else {
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * dist,
    target.y + Math.sin(el) * dist,
    target.z + Math.cos(az) * Math.cos(el) * dist
  );
  camera.lookAt(target);
}

renderer.render(scene, camera);
(window as unknown as { __PREVIEW_READY__: boolean }).__PREVIEW_READY__ = true;
