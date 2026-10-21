// Dev-only mesh preview used for screenshot review. Served by `vite` at /mesh-preview.html and
// never part of the production build (index.html is the only build entry).
//
//   ?m=kyle | env | <enemy archetype id>   what to render
//   &az=35 &el=18 &dist=4                  camera azimuth / elevation (degrees) and distance
//   &game=1                                use the in-game camera angle instead of a close-up
//   ?m=glb&src=models/x.glb               any glTF file under public/ (fit to view)
//   &speed=5.5 &time=0.4 &move=90         kyle only: run at this speed for this many seconds, moving
//                                          at this angle (degrees) relative to the aim
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { Environment2029 } from '../graphics/Environment2029';
import { createEnemyPreviewObject } from '../graphics/meshes/EnemyTurntablePreview';
import { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { ProceduralTextures } from '../graphics/ProceduralTextures';
import type { ActiveEnemy, EnemyArchetypeId, LoadoutId } from '../core/types';
import { LIGHTING, PALETTE } from '../data/artDirection';
import { ModelLibrary } from '../graphics/ModelLibrary';

await ModelLibrary.preload();

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
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, LIGHTING.fogNear, LIGHTING.fogFar);
// The game uses this reflection map on real GPUs (it is skipped only under automation)
scene.environment = ProceduralTextures.getMetallicEnvMap();
scene.environmentIntensity = LIGHTING.envIntensity;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LIGHTING.exposure * 1.2;
document.getElementById('app')!.appendChild(renderer.domElement);

// Same lighting rig as SceneManager
scene.add(new THREE.HemisphereLight(LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity));
scene.add(new THREE.AmbientLight(LIGHTING.ambient, LIGHTING.ambientIntensity));
const moon = new THREE.DirectionalLight(PALETTE.moon, LIGHTING.moonIntensity);
moon.position.set(...LIGHTING.moonPosition);
scene.add(moon);
const fireFill = new THREE.DirectionalLight(LIGHTING.fireFill, LIGHTING.fireFillIntensity);
fireFill.position.set(...LIGHTING.fireFillPosition);
scene.add(fireFill);

const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 250);

let target = new THREE.Vector3(0, 0.9, 0);

if (which === 'glb') {
  const gltf = await new GLTFLoader().loadAsync(params.get('src') ?? '');
  const obj = gltf.scene;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const fit = 2 / Math.max(size.x, size.y, size.z);
  obj.scale.setScalar(fit);
  const centred = new THREE.Box3().setFromObject(obj);
  obj.position.sub(centred.getCenter(new THREE.Vector3()));
  scene.add(obj);
  target = new THREE.Vector3(0, 0, 0);
} else if (which === 'env') {
  const env = new Environment2029();
  scene.add(env.group);
  env.update(0, 0);
} else if (which === 'kyle') {
  const kyle = new KyleReeseMesh();
  kyle.applyLoadout((params.get('loadout') ?? 'reese_1984') as LoadoutId);
  const rifle = ModelLibrary.getMeshData('plasma_rifle');
  if (rifle) kyle.applyRifleModel(rifle);
  const player = ModelLibrary.getPlayer();
  if (player && rifle) kyle.applyPlayerModel(player, rifle);
  scene.add(kyle.group);
  const speed = Number(params.get('speed') ?? 0);
  const runFor = Number(params.get('time') ?? 0.5);
  const move = THREE.MathUtils.degToRad(Number(params.get('move') ?? 0));
  for (let t = 0; t < runFor; t += 1 / 60) kyle.updateAnimation(1 / 60, speed, 0, move);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
} else if (BATCH_ARCHETYPES.includes(which)) {
  // Same instanced renderer the game uses for these enemies
  const batch = new EndoskeletonBatch(4);
  const endo = ModelLibrary.getEndo();
  if (endo) batch.applySculptedModel(endo, ModelLibrary.getMeshData('plasma_rifle'));
  const crab = ModelLibrary.getMeshData('crab_drone');
  if (crab) batch.applyCrabModel(crab);
  const t600 = ModelLibrary.getT600();
  if (t600) batch.applyT600Model(t600, ModelLibrary.getMeshData('plasma_rifle'));
  scene.add(batch.group);
  const fake = {
    id: 1, type: 'enemy', archetype: which, x: 0, z: 0, radius: 0.5, hp: 10, maxHp: 10, speed: 1, damage: 1,
    mass: 1, vx: 0, vz: 0, isBoss: false, isFlying: false, xpValue: 1, hitFlashTimer: 0, slowTimer: 0,
    armorStripMultiplier: 1, attackCooldown: 0, chargeTimer: 0, searchlightAngle: 0, searchlightAlertTimer: 0,
    phaseState: 0, state: {}
  } as unknown as ActiveEnemy;
  // ?walk=<seconds> walks it forward (+z) at 1.6 m/s first, to see the stride; it ends back at the origin
  const walkFor = Number(params.get('walk') ?? 0);
  for (let t = 0; t <= walkFor; t += 1 / 60) {
    fake.z = (t - walkFor) * 1.6;
    batch.updateBatch([fake], 0.4 + t, 0, fake.z + 6);
  }
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
