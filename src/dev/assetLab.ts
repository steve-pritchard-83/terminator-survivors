// Dev-only Asset Lab: every model (with its in-game animation), effect, sound, music track and movie,
// with controls to drive them for review and fine tuning. Served by `vite` at /asset-lab.html and never
// part of the production build (index.html is the only build entry).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelLibrary, type ModelName } from '../graphics/ModelLibrary';
import { KyleReeseMesh } from '../graphics/meshes/KyleReeseMesh';
import { EndoskeletonBatch } from '../graphics/meshes/EndoskeletonBatch';
import { InfiltratorMesh } from '../graphics/meshes/InfiltratorMesh';
import { T1000Mesh } from '../graphics/meshes/T1000Mesh';
import { HKAerialMesh } from '../graphics/meshes/HKAerialMesh';
import { HKTankMesh } from '../graphics/meshes/HKTankMesh';
import { SkynetCoreMesh } from '../graphics/meshes/SkynetCoreMesh';
import { T1MinigunMesh, MotoTerminatorMesh, PlasmaTurretMesh } from '../graphics/meshes/NewEnemyMeshes';
import { createDogMesh, createReprogrammedT800Mesh } from '../graphics/meshes/AllyMeshes';
import { Environment2029 } from '../graphics/Environment2029';
import { ParticleSystem } from '../systems/ParticleSystem';
import { CircleTelegraph, ConeTelegraph, LineTelegraph } from '../graphics/Telegraphs';
import { VolumetricSearchlight } from '../graphics/VolumetricSearchlight';
import { buildBoltGeometry, createBoltMaterial } from '../graphics/PlasmaBolts';
import { ProceduralTextures } from '../graphics/ProceduralTextures';
import { AudioEngine, SFX_WAV_MANIFEST } from '../audio/AudioEngine';
import { ENEMY_CONFIGS, ELITE_AFFIXES } from '../data/enemies';
import { ENEMY_SHADOW, LIGHTING, PALETTE } from '../data/artDirection';
import { DEATH_ANIMATION_SECONDS } from '../data/balance';
import type { ActiveEnemy, EnemyArchetypeId } from '../core/types';

// ---------- Types ----------
type Params = Record<string, number | boolean>;

interface Control {
  kind: 'slider' | 'toggle' | 'button';
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number | boolean;
  onClick?: () => void;
}

interface Subject {
  object: THREE.Object3D;
  /** Where the camera looks, and how far away it starts */
  target?: THREE.Vector3;
  distance?: number;
  update?(dt: number, t: number, p: Params): void;
  controls?: Control[];
  info?: () => string;
  dispose?(): void;
}

interface Entry {
  id: string;
  label: string;
  group: string;
  note?: string;
  make(): Subject;
}

// ---------- Renderer, scene, camera ----------
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.environment = ProceduralTextures.getMetallicEnvMap();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
camera.position.set(3, 2.2, 4);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;

// Same lighting rig as SceneManager; "studio" brightens it to inspect detail
const hemi = new THREE.HemisphereLight(LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity);
const ambient = new THREE.AmbientLight(LIGHTING.ambient, LIGHTING.ambientIntensity);
const moon = new THREE.DirectionalLight(PALETTE.moon, LIGHTING.moonIntensity);
moon.position.set(...LIGHTING.moonPosition);
const fireFill = new THREE.DirectionalLight(LIGHTING.fireFill, LIGHTING.fireFillIntensity);
fireFill.position.set(...LIGHTING.fireFillPosition);
scene.add(hemi, ambient, moon, fireFill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x1c232c, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
const grid = new THREE.GridHelper(40, 40, 0x3a4652, 0x222a33);
grid.position.y = 0.002;
scene.add(ground, grid);

// The in-game contact shadow, sized like EnemySystem does it
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1, ENEMY_SHADOW.segments).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    map: ProceduralTextures.getSoftGlowSprite(),
    transparent: true,
    opacity: ENEMY_SHADOW.opacity,
    depthWrite: false
  })
);
shadow.position.y = 0.01;
shadow.visible = false;
scene.add(shadow);

const particles = new ParticleSystem();
scene.add(particles.group);

const audio = new AudioEngine();
const stage = new THREE.Group();
scene.add(stage);

const global: Params = {
  playing: true,
  timeScale: 1,
  autoRotate: false,
  studio: false,
  wireframe: false,
  grid: true,
  shadow: false,
  shadowRadius: 0.7
};

function applyLighting(): void {
  const studio = Boolean(global.studio);
  hemi.intensity = studio ? 1.6 : LIGHTING.hemiIntensity;
  ambient.intensity = studio ? 0.9 : LIGHTING.ambientIntensity;
  renderer.toneMappingExposure = studio ? 1.4 : LIGHTING.exposure * 1.25;
  scene.background = new THREE.Color(studio ? 0x2a3138 : PALETTE.sky);
  scene.fog = studio ? null : new THREE.Fog(PALETTE.fog, LIGHTING.fogNear * 2, LIGHTING.fogFar * 2.5);
  scene.environmentIntensity = studio ? 1.2 : LIGHTING.envIntensity;
}
applyLighting();

// ---------- Helpers ----------
const fakeEnemy = (archetype: EnemyArchetypeId): ActiveEnemy => {
  const cfg = ENEMY_CONFIGS[archetype];
  return {
    id: 7, type: 'enemy', archetype, x: 0, z: 0, radius: cfg.radius, hp: cfg.maxHp, maxHp: cfg.maxHp, speed: cfg.speed,
    damage: cfg.damage, mass: cfg.mass, vx: 0, vz: 0, isBoss: cfg.isBoss, isFlying: cfg.isFlying, xpValue: cfg.xpValue,
    hitFlashTimer: 0, slowTimer: 0, armorStripMultiplier: 1, attackCooldown: 0, chargeTimer: 0, searchlightAngle: 0,
    searchlightAlertTimer: 0, phaseState: 0, state: {}
  } as ActiveEnemy;
};

const configInfo = (archetype: EnemyArchetypeId) => () => {
  const c = ENEMY_CONFIGS[archetype];
  return `<b>${c.name}</b> (${archetype})<br>hp ${c.maxHp} · speed ${c.speed} · damage ${c.damage} · radius ${c.radius} · xp ${c.xpValue}${c.isBoss ? ' · BOSS' : ''}${c.isFlying ? ' · flying' : ''}<br>src/data/enemies.ts`;
};

const staticModel = (name: ModelName, distance = 3): Subject => {
  const obj = ModelLibrary.get(name) ?? new THREE.Group();
  return { object: obj, distance };
};

function sizeAndTris(obj: THREE.Object3D): string {
  let tris = 0;
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = mesh.geometry;
    const count = g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0);
    const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? Math.max(1, (mesh as THREE.InstancedMesh).count) : 1;
    tris += (count / 3) * instances;
  });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return `${Math.round(tris).toLocaleString()} triangles · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`;
}

// ---------- Walkers drawn by the instanced batch (same gait code as the game) ----------
function walkerSubject(archetype: EnemyArchetypeId): Subject {
  const batch = new EndoskeletonBatch(4);
  const rifle = ModelLibrary.getMeshData('plasma_rifle');
  const endo = ModelLibrary.getEndo();
  if (endo) batch.applySculptedModel(endo, rifle);
  const crab = ModelLibrary.getMeshData('crab_drone');
  if (crab) batch.applyCrabModel(crab);
  const t600 = ModelLibrary.getT600();
  if (t600) batch.applyT600Model(t600, rifle);
  const root = new THREE.Group();
  root.add(batch.group);
  const enemy = fakeEnemy(archetype);
  let z = 0;
  let deadFor = 0;
  return {
    object: root,
    distance: archetype === 'skynet_crab_drone' ? 2.6 : 4.2,
    target: new THREE.Vector3(0, archetype === 'skynet_crab_drone' ? 0.3 : 1.0, 0),
    controls: [
      { kind: 'slider', key: 'speed', label: 'Walk speed', min: 0, max: 8, step: 0.1, value: ENEMY_CONFIGS[archetype].speed },
      { kind: 'toggle', key: 'elite', label: 'Elite (scaled, tinted)', value: false },
      { kind: 'button', key: 'hit', label: 'Hit', onClick: () => (enemy.hitFlashTimer = 0.15) },
      {
        kind: 'button',
        key: 'kill',
        label: 'Kill (death animation)',
        onClick: () => {
          if (deadFor > 0) return;
          batch.addCorpse(enemy, 0, enemy.z + 6);
          deadFor = DEATH_ANIMATION_SECONDS + 0.6;
          audio.playEnemyDeath(archetype === 'skynet_crab_drone' ? 'small' : 'humanoid');
        }
      }
    ],
    update(dt, t, p) {
      enemy.isElite = Boolean(p.elite);
      enemy.scale = p.elite ? 1.4 : undefined;
      enemy.affix = p.elite ? 'Armored' : undefined;
      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      if (deadFor > 0) {
        deadFor -= dt;
        batch.updateBatch([], t, 0, enemy.z + 6);
        return;
      }
      // Walks forward for real (so the stride matches the ground), with the stage sliding back to keep it centred
      z += Number(p.speed) * dt;
      enemy.z = z;
      root.position.z = -z;
      batch.updateBatch([enemy], t, 0, z + 6);
    },
    info: () => `${configInfo(archetype)()}<br>Elite affixes: ${Object.keys(ELITE_AFFIXES).join(', ')}`
  };
}

// ---------- Model entries ----------
const entries: Entry[] = [
  // Player
  {
    id: 'kyle',
    label: 'Kyle Reese (player)',
    group: 'Player',
    make() {
      const kyle = new KyleReeseMesh();
      const rifle = ModelLibrary.getMeshData('plasma_rifle');
      if (rifle) kyle.applyRifleModel(rifle);
      const player = ModelLibrary.getPlayer();
      if (player && rifle) kyle.applyPlayerModel(player, rifle);
      let fireTimer = 0;
      const fire = () => {
        kyle.pulseMuzzleFlash(PALETTE.plasmaResistance, 1);
        audio.playPlasmaShot();
      };
      return {
        object: kyle.group,
        distance: 3.6,
        target: new THREE.Vector3(0, 1, 0),
        controls: [
          { kind: 'slider', key: 'speed', label: 'Run speed', min: 0, max: 7, step: 0.1, value: 0 },
          { kind: 'slider', key: 'move', label: 'Move vs aim (°)', min: -180, max: 180, step: 5, value: 0 },
          { kind: 'toggle', key: 'sweep', label: 'Sweep aim around', value: false },
          { kind: 'toggle', key: 'autofire', label: 'Auto-fire', value: false },
          { kind: 'button', key: 'fire', label: 'Fire', onClick: fire }
        ],
        update(dt, t, p) {
          const aim = p.sweep ? t * 0.6 : 0;
          kyle.updateAnimation(dt, Number(p.speed), aim, aim + THREE.MathUtils.degToRad(Number(p.move)));
          if (p.autofire) {
            fireTimer -= dt;
            if (fireTimer <= 0) {
              fireTimer = 0.32;
              fire();
            }
          }
        },
        info: () => 'Sculpted Kyle with the auto-rig animator, belt lamp and muzzle flash<br>src/graphics/meshes/KyleReeseMesh.ts'
      };
    }
  },
  // Walkers
  { id: 't800', label: 'T-800 Endoskeleton', group: 'Enemies', make: () => walkerSubject('t800_endoskeleton') },
  { id: 't600', label: 'T-600 Heavy Walker', group: 'Enemies', make: () => walkerSubject('t600_rusted') },
  { id: 'crab', label: 'Crab drone', group: 'Enemies', make: () => walkerSubject('skynet_crab_drone') },
  {
    id: 't1',
    label: 'T-1 Tracked Chassis',
    group: 'Enemies',
    make: () => ({ object: new T1MinigunMesh().group, distance: 4, info: configInfo('t1_minigun_tracked') })
  },
  {
    id: 'moto',
    label: 'Moto-Terminator',
    group: 'Enemies',
    make: () => ({ object: new MotoTerminatorMesh().group, distance: 3.5, info: configInfo('moto_terminator') })
  },
  {
    id: 'turret',
    label: 'Plasma Turret',
    group: 'Enemies',
    make() {
      const turret = new PlasmaTurretMesh();
      return {
        object: turret.group,
        distance: 4,
        controls: [{ kind: 'slider', key: 'track', label: 'Tracking speed', min: 0, max: 3, step: 0.1, value: 0.8 }],
        update: (_dt, t, p) => {
          turret.barrelGroup.rotation.y = Math.sin(t * Number(p.track)) * 1.2;
        },
        info: configInfo('plasma_turret')
      };
    }
  },
  {
    id: 'hk_patrol',
    label: 'HK Aerial (patrol)',
    group: 'Enemies',
    make: () => hkAerialSubject(false)
  },
  // Bosses
  {
    id: 'infiltrator',
    label: 'Infiltrator CSM-101',
    group: 'Bosses',
    make() {
      const inf = new InfiltratorMesh();
      return {
        object: inf.group,
        distance: 4.2,
        target: new THREE.Vector3(0, 1.1, 0),
        controls: [
          { kind: 'slider', key: 'speed', label: 'Walk speed', min: 0, max: 6, step: 0.1, value: ENEMY_CONFIGS.infiltrator_csm101.speed },
          { kind: 'toggle', key: 'firing', label: 'Firing (rifle raised)', value: false },
          { kind: 'button', key: 'chrome', label: 'Phase 3 chrome', onClick: () => inf.setPhase3Endoskeleton() }
        ],
        update: (dt, _t, p) => inf.updateAnimation(dt, Number(p.speed), 0, Boolean(p.firing)),
        info: configInfo('infiltrator_csm101')
      };
    }
  },
  {
    id: 'hk_tank',
    label: 'HK Tank Goliath',
    group: 'Bosses',
    make() {
      const tank = new HKTankMesh();
      return {
        object: tank.group,
        distance: 26,
        target: new THREE.Vector3(0, 4, 0),
        controls: [
          { kind: 'slider', key: 'alert', label: 'Searchlight alert', min: 0, max: 1, step: 0.05, value: 0 },
          { kind: 'slider', key: 'charge', label: 'Cannon charge', min: 0, max: 1, step: 0.05, value: 0 },
          { kind: 'toggle', key: 'track', label: 'Turret tracks around', value: true },
          {
            kind: 'button',
            key: 'mortar',
            label: 'Mortar warning sound',
            onClick: () => audio.playTelegraph('mortar', 1.5)
          }
        ],
        update: (_dt, t, p) => tank.update(t, Number(p.alert), Number(p.charge), p.track ? t * 0.5 : 0),
        info: configInfo('hk_tank_goliath')
      };
    }
  },
  { id: 'hk_leader', label: 'HK Aerial Command Gunship', group: 'Bosses', make: () => hkAerialSubject(true) },
  {
    id: 't1000',
    label: 'T-1000',
    group: 'Bosses',
    make() {
      const t1000 = new T1000Mesh();
      return {
        object: t1000.group,
        distance: 4,
        target: new THREE.Vector3(0, 1.1, 0),
        controls: [
          { kind: 'toggle', key: 'liquid', label: 'Liquid puddle', value: false },
          { kind: 'toggle', key: 'slash', label: 'Slashing', value: false }
        ],
        update: (_dt, t, p) => t1000.update(t, Boolean(p.liquid), Boolean(p.slash)),
        info: configInfo('t1000_prototype')
      };
    }
  },
  {
    id: 'core',
    label: 'Skynet Time Displacement Core',
    group: 'Bosses',
    make() {
      const core = new SkynetCoreMesh();
      return {
        object: core.group,
        distance: 16,
        target: new THREE.Vector3(0, 3, 0),
        controls: [
          { kind: 'toggle', key: 'enraged', label: 'Enraged (phase 2+)', value: false },
          { kind: 'button', key: 'charge', label: 'Charge warning sound', onClick: () => audio.playTelegraph('charge', 1) }
        ],
        update: (dt, t, p) => core.updateAnimation(dt, t, Boolean(p.enraged)),
        info: configInfo('skynet_tde_core')
      };
    }
  },
  // Allies
  {
    id: 'k9',
    label: 'K-9 (dog ally)',
    group: 'Allies',
    make() {
      const dog = createDogMesh();
      let phase = 0;
      return {
        object: dog,
        distance: 2.4,
        target: new THREE.Vector3(0, 0.4, 0),
        controls: [{ kind: 'slider', key: 'gallop', label: 'Gallop rate', min: 0, max: 30, step: 0.5, value: 14 }],
        update(dt, _t, p) {
          // Same bound-and-pitch gallop as DogUnit
          phase += dt * Number(p.gallop);
          const body = dog.getObjectByName('body');
          if (body) {
            body.position.y = Math.abs(Math.sin(phase)) * 0.09;
            body.rotation.x = Math.sin(phase) * 0.1;
          }
        }
      };
    }
  },
  {
    id: 't800_ally',
    label: 'Reprogrammed T-800 (ally)',
    group: 'Allies',
    make: () => ({ object: createReprogrammedT800Mesh(false), distance: 3.6, target: new THREE.Vector3(0, 1, 0) })
  },
  {
    id: 't800_guardian',
    label: 'Guardian Protocol T-800 (evolved ally)',
    group: 'Allies',
    make: () => ({ object: createReprogrammedT800Mesh(true), distance: 3.6, target: new THREE.Vector3(0, 1, 0) })
  },
  {
    id: 'seeker',
    label: 'Seeker drones (orbiting)',
    group: 'Allies',
    make() {
      const root = new THREE.Group();
      const drones = [0, 1, 2].map(() => {
        const d = ModelLibrary.get('seeker') ?? new THREE.Group();
        root.add(d);
        return d;
      });
      return {
        object: root,
        distance: 4,
        target: new THREE.Vector3(0, 0.75, 0),
        controls: [
          { kind: 'slider', key: 'radius', label: 'Orbit radius', min: 0.5, max: 4, step: 0.1, value: 1.6 },
          { kind: 'slider', key: 'rate', label: 'Orbit speed', min: 0, max: 6, step: 0.1, value: 2.4 }
        ],
        update(_dt, t, p) {
          drones.forEach((d, i) => {
            const a = t * Number(p.rate) + (i / drones.length) * Math.PI * 2;
            d.position.set(Math.cos(a) * Number(p.radius), 0.75 + Math.sin(t * 3 + i) * 0.06, Math.sin(a) * Number(p.radius));
            d.rotation.y = -a;
          });
        }
      };
    }
  },
  // Props and pickups
  { id: 'rifle', label: 'Plasma rifle', group: 'Props & pickups', make: () => staticModel('plasma_rifle', 1.6) },
  {
    id: 'xp',
    label: 'XP power cell',
    group: 'Props & pickups',
    make() {
      const cell = ModelLibrary.get('xp') ?? new THREE.Group();
      cell.position.y = 0.4;
      return { object: cell, distance: 1.6, target: new THREE.Vector3(0, 0.4, 0), update: (_dt, t) => (cell.rotation.y = t * 1.5) };
    }
  },
  { id: 'car', label: 'Burnt car wreck', group: 'Props & pickups', make: () => staticModel('burnt_car', 6) },
  {
    id: 'env',
    label: 'Wasteland chunk (environment)',
    group: 'Props & pickups',
    make() {
      const env = new Environment2029();
      env.update(0, 0);
      return { object: env.group, distance: 40, target: new THREE.Vector3(0, 0, 0) };
    }
  }
];

// Every processed model file, raw (normalised as the game loads it)
const RAW_MODELS: ModelName[] = [
  'player', 'infiltrator', 't1000', 't600', 'crab_drone', 't1_tracked', 'moto', 'turret_base', 'turret_gun', 'hk_aerial',
  'hk_tank_hull', 'hk_tank_turret', 'skynet_core', 'k9', 'seeker', 'plasma_rifle', 'xp', 'burnt_car'
];
for (const name of RAW_MODELS) {
  entries.push({ id: `raw_${name}`, label: name, group: 'Raw model files', make: () => staticModel(name, 4) });
}

function hkAerialSubject(leader: boolean): Subject {
  const hk = new HKAerialMesh(leader);
  hk.group.position.y = 3;
  const root = new THREE.Group();
  root.add(hk.group);
  return {
    object: root,
    distance: leader ? 15 : 12,
    target: new THREE.Vector3(0, 2.5, 0),
    controls: [
      { kind: 'slider', key: 'alert', label: 'Searchlight alert', min: 0, max: 1, step: 0.05, value: 0 },
      { kind: 'slider', key: 'flight', label: 'Forward flight', min: -8, max: 8, step: 0.5, value: 0 },
      { kind: 'slider', key: 'strafe', label: 'Strafe (bank)', min: -8, max: 8, step: 0.5, value: 0 },
      { kind: 'button', key: 'alarm', label: 'Lock-on alarm', onClick: () => audio.playSearchlightAlert() }
    ],
    update: (dt, t, p) => hk.update(t, Number(p.alert), 0, Number(p.strafe), Number(p.flight), dt),
    info: configInfo(leader ? 'hk_aerial_squadron_leader' : 'hk_aerial_patrol')
  };
}

// ---------- Effect entries ----------
const effectEntries: Entry[] = [
  {
    id: 'fx_explosions',
    label: 'Explosions & particles',
    group: 'Effects',
    make() {
      let auto = 0;
      const withSound = () => Boolean(currentParams.sound);
      const boom = (scale: number) => {
        particles.spawnExplosion(0, 0.5, 0, scale);
        if (withSound()) audio.playExplosion(scale);
      };
      return {
        object: new THREE.Group(),
        distance: 9,
        target: new THREE.Vector3(0, 1, 0),
        controls: [
          { kind: 'toggle', key: 'sound', label: 'With sound', value: true },
          { kind: 'slider', key: 'scale', label: 'Explosion scale', min: 0.3, max: 3, step: 0.1, value: 1 },
          { kind: 'toggle', key: 'auto', label: 'Repeat every 1.5 s', value: false },
          { kind: 'button', key: 'boom', label: 'Explosion', onClick: () => boom(Number(currentParams.scale)) },
          { kind: 'button', key: 'burst', label: 'Death burst', onClick: () => particles.spawnDeathBurst(0, 0.4, 0, 1.2) },
          {
            kind: 'button',
            key: 'impact',
            label: 'Plasma impact',
            onClick: () => {
              particles.spawnPlasmaImpact(0, 1, 0);
              if (withSound()) audio.playEndoHit();
            }
          },
          { kind: 'button', key: 'debris', label: 'Enemy debris', onClick: () => particles.spawnEnemyDebris(0, 0.5, 0, 10) },
          { kind: 'button', key: 'dash', label: 'Afterimage', onClick: () => particles.spawnDashAfterimage(0, 0.5, 0) }
        ],
        update(dt, _t, p) {
          if (!p.auto) return;
          auto -= dt;
          if (auto <= 0) {
            auto = 1.5;
            boom(Number(p.scale));
          }
        },
        info: () => 'ParticleSystem: explosions, smoke, sparks, debris<br>src/systems/ParticleSystem.ts'
      };
    }
  },
  {
    id: 'fx_bolts',
    label: 'Plasma bolts & pellets',
    group: 'Effects',
    make() {
      const root = new THREE.Group();
      const kinds = [
        { label: 'M-25 bolt', geo: buildBoltGeometry(1.7, 0.035, 0.11, PALETTE.plasmaResistanceCore, PALETTE.plasmaResistance) },
        { label: 'Heavy bolt', geo: buildBoltGeometry(2.4, 0.07, 0.22, PALETTE.plasmaResistanceCore, PALETTE.plasmaResistance) },
        { label: 'Shotgun pellet', geo: buildBoltGeometry(0.55, 0.025, 0.06, 0xfff2d0, PALETTE.fire) },
        { label: 'Skynet bolt', geo: buildBoltGeometry(1.5, 0.04, 0.12, PALETTE.plasmaSkynetCore, PALETTE.plasmaSkynet) }
      ];
      const mat = createBoltMaterial(2.6);
      const bolts = kinds.map((k, i) => {
        const m = new THREE.Mesh(k.geo, mat);
        m.position.set(0, 1, (i - 1.5) * 1.2);
        m.rotation.y = Math.PI / 2;
        root.add(m);
        return m;
      });
      return {
        object: root,
        distance: 9,
        target: new THREE.Vector3(0, 1, 0),
        controls: [
          { kind: 'slider', key: 'speed', label: 'Bolt speed', min: 0, max: 40, step: 1, value: 14 },
          { kind: 'slider', key: 'bright', label: 'Brightness', min: 0.5, max: 6, step: 0.1, value: 2.6 }
        ],
        update(_dt, t, p) {
          mat.color.setScalar(Number(p.bright));
          bolts.forEach((b, i) => (b.position.x = (((t * Number(p.speed) + i * 3) % 24) + 24) % 24 - 12));
        },
        info: () => `Top to bottom: ${kinds.map((k) => k.label).join(', ')}<br>src/graphics/PlasmaBolts.ts`
      };
    }
  },
  {
    id: 'fx_telegraphs',
    label: 'Attack telegraphs',
    group: 'Effects',
    make() {
      const root = new THREE.Group();
      const circle = new CircleTelegraph(4.5, 0xff1111);
      const line = new LineTelegraph(0.35, 0xff2288);
      const cone = new ConeTelegraph(7, Math.PI / 3, 0xff1744);
      root.add(circle.group, line.group, cone.group);
      return {
        object: root,
        distance: 18,
        target: new THREE.Vector3(0, 0, 0),
        controls: [{ kind: 'slider', key: 'duration', label: 'Warning length (s)', min: 0.3, max: 3, step: 0.1, value: 1.5 }],
        update(_dt, t, p) {
          const progress = (t % Number(p.duration)) / Number(p.duration);
          circle.update(-6, 0, progress, 4.5);
          line.update(0, -6, 0, 6, progress);
          cone.update(6, -3, 0, progress);
        },
        info: () => 'Left: mortar circle · middle: line (spokes, laser sights) · right: cone (T-1 minigun)<br>src/graphics/Telegraphs.ts'
      };
    }
  },
  {
    id: 'fx_searchlight',
    label: 'Volumetric searchlight',
    group: 'Effects',
    make() {
      const light = new VolumetricSearchlight(9.5, 2.2);
      light.group.position.y = 4;
      light.group.rotation.x = -0.35;
      return {
        object: light.group,
        distance: 12,
        target: new THREE.Vector3(0, 1.5, 3),
        controls: [
          { kind: 'slider', key: 'alert', label: 'Alert level', min: 0, max: 1, step: 0.05, value: 0 },
          { kind: 'slider', key: 'sweep', label: 'Sweep', min: 0, max: 1, step: 0.05, value: 0.2 }
        ],
        update(_dt, t, p) {
          light.group.rotation.y = Math.sin(t * 1.8) * Number(p.sweep);
          light.update(t, Number(p.alert), -4);
        },
        info: () => 'src/graphics/VolumetricSearchlight.ts'
      };
    }
  },
  {
    id: 'fx_shadow',
    label: 'Contact shadow',
    group: 'Effects',
    make() {
      const root = new THREE.Group();
      const crab = ModelLibrary.get('crab_drone');
      if (crab) root.add(crab);
      return {
        object: root,
        distance: 3,
        target: new THREE.Vector3(0, 0.3, 0),
        controls: [
          { kind: 'slider', key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.05, value: ENEMY_SHADOW.opacity },
          { kind: 'slider', key: 'scale', label: 'Radius × collision', min: 0.5, max: 3, step: 0.05, value: ENEMY_SHADOW.radiusScale }
        ],
        update(_dt, _t, p) {
          shadow.visible = true;
          (shadow.material as THREE.MeshBasicMaterial).opacity = Number(p.opacity);
          // Crab collision radius is 0.5
          const r = Math.max(ENEMY_SHADOW.minRadius, 0.5 * Number(p.scale));
          shadow.scale.set(r, 1, r);
        },
        info: () =>
          `In game: ENEMY_SHADOW in src/data/artDirection.ts (opacity ${ENEMY_SHADOW.opacity}, radiusScale ${ENEMY_SHADOW.radiusScale}). Shown under a crab (collision radius 0.5).`
      };
    }
  }
];

// ---------- UI ----------
const listEl = document.getElementById('list')!;
const controlsEl = document.getElementById('controls')!;
const infoEl = document.getElementById('info')!;
const mediaEl = document.getElementById('media')!;

let current: Subject | null = null;
let currentEntry: Entry | null = null;
let currentParams: Params = {};
let subjectTime = 0;
const wireframed = new Set<THREE.Material>();

function setWireframe(on: boolean): void {
  for (const m of wireframed) (m as THREE.MeshStandardMaterial).wireframe = false;
  wireframed.clear();
  if (!on || !current) return;
  current.object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if ('wireframe' in m) {
        (m as THREE.MeshStandardMaterial).wireframe = true;
        wireframed.add(m);
      }
    }
  });
}

function select(entry: Entry): void {
  if (current) {
    setWireframe(false);
    stage.remove(current.object);
    current.dispose?.();
  }
  shadow.visible = Boolean(global.shadow);
  particles.clear();
  currentEntry = entry;
  current = entry.make();
  stage.add(current.object);
  subjectTime = 0;
  currentParams = {};
  for (const c of current.controls ?? []) if (c.kind !== 'button') currentParams[c.key] = c.value ?? 0;
  const target = current.target ?? new THREE.Vector3(0, 0.8, 0);
  const d = current.distance ?? 4;
  orbit.target.copy(target);
  camera.position.set(target.x + d * 0.7, target.y + d * 0.35, target.z + d * 0.75);
  setWireframe(Boolean(global.wireframe));
  document.querySelectorAll('.item').forEach((el) => el.classList.toggle('active', (el as HTMLElement).dataset.id === entry.id));
  renderControls();
  window.setTimeout(renderInfo, 50);
}

function controlRow(c: Control, params: Params, onChange: () => void): HTMLElement {
  if (c.kind === 'button') {
    const b = document.createElement('button');
    b.className = 'act primary';
    b.textContent = c.label;
    b.onclick = () => c.onClick?.();
    return b;
  }
  const row = document.createElement('div');
  if (c.kind === 'toggle') {
    row.className = 'ctl toggle';
    row.innerHTML = `<label>${c.label}</label><input type="checkbox" ${params[c.key] ? 'checked' : ''}>`;
    const input = row.querySelector('input')!;
    input.onchange = () => {
      params[c.key] = input.checked;
      onChange();
    };
    return row;
  }
  row.className = 'ctl';
  row.innerHTML = `<label>${c.label}</label><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${params[c.key]}"><output>${params[c.key]}</output>`;
  const input = row.querySelector('input')!;
  const out = row.querySelector('output')!;
  input.oninput = () => {
    params[c.key] = Number(input.value);
    out.textContent = input.value;
    onChange();
  };
  return row;
}

const GLOBAL_CONTROLS: Control[] = [
  { kind: 'toggle', key: 'playing', label: 'Animate' },
  { kind: 'slider', key: 'timeScale', label: 'Time scale', min: 0.05, max: 2, step: 0.05 },
  { kind: 'toggle', key: 'autoRotate', label: 'Turntable' },
  { kind: 'toggle', key: 'studio', label: 'Studio lighting (else in-game night)' },
  { kind: 'toggle', key: 'wireframe', label: 'Wireframe' },
  { kind: 'toggle', key: 'grid', label: 'Grid' },
  { kind: 'toggle', key: 'shadow', label: 'Contact shadow' },
  { kind: 'slider', key: 'shadowRadius', label: 'Shadow radius', min: 0.2, max: 4, step: 0.05 }
];

function renderControls(): void {
  controlsEl.innerHTML = '';
  if (current?.controls?.length) {
    controlsEl.insertAdjacentHTML('beforeend', `<h3>${currentEntry?.label ?? ''}</h3>`);
    const btns = document.createElement('div');
    btns.className = 'btns';
    for (const c of current.controls) {
      const el = controlRow(c, currentParams, () => {});
      if (c.kind === 'button') btns.appendChild(el);
      else controlsEl.appendChild(el);
    }
    if (btns.children.length) controlsEl.appendChild(btns);
  }
  controlsEl.insertAdjacentHTML('beforeend', '<h3>View</h3>');
  for (const c of GLOBAL_CONTROLS) {
    controlsEl.appendChild(
      controlRow(c, global, () => {
        orbit.autoRotate = Boolean(global.autoRotate);
        grid.visible = Boolean(global.grid);
        shadow.visible = Boolean(global.shadow) || currentEntry?.id === 'fx_shadow';
        applyLighting();
        setWireframe(Boolean(global.wireframe));
      })
    );
  }
  const reset = document.createElement('div');
  reset.className = 'btns';
  reset.innerHTML = '<button class="act">Reset subject</button><button class="act">Reset camera</button>';
  const [resetSubject, resetCam] = reset.querySelectorAll('button');
  resetSubject.onclick = () => currentEntry && select(currentEntry);
  resetCam.onclick = () => {
    const target = current?.target ?? new THREE.Vector3(0, 0.8, 0);
    const d = current?.distance ?? 4;
    orbit.target.copy(target);
    camera.position.set(target.x + d * 0.7, target.y + d * 0.35, target.z + d * 0.75);
  };
  controlsEl.appendChild(reset);
}

function renderInfo(): void {
  if (!current) return;
  const extra = current.info ? current.info() : '';
  infoEl.innerHTML = `${extra ? `${extra}<br>` : ''}${sizeAndTris(current.object)}`;
}

function renderList(tab: string): void {
  listEl.innerHTML = '';
  const showViewer = tab === 'models' || tab === 'effects';
  canvas.style.display = showViewer ? '' : 'none';
  controlsEl.style.display = showViewer ? '' : 'none';
  infoEl.style.display = showViewer ? '' : 'none';
  mediaEl.style.display = tab === 'media' || tab === 'sounds' ? 'block' : 'none';

  if (tab === 'models' || tab === 'effects') {
    const source = tab === 'models' ? entries : effectEntries;
    let group = '';
    for (const e of source) {
      if (e.group !== group) {
        group = e.group;
        listEl.insertAdjacentHTML('beforeend', `<div class="group-title">${group}</div>`);
      }
      const b = document.createElement('button');
      b.className = 'item';
      b.dataset.id = e.id;
      b.innerHTML = `<span>${e.label}</span>${e.note ? `<small>${e.note}</small>` : ''}`;
      b.onclick = () => select(e);
      listEl.appendChild(b);
    }
    const first = source.find((e) => e.id === currentEntry?.id) ?? source[0];
    select(first);
  } else if (tab === 'sounds') {
    renderSounds();
  } else {
    renderMedia();
  }
}

// ---------- Sounds ----------
const soundOpts = { volume: 0.8, rate: 1, loop: false };
let playing: HTMLAudioElement | null = null;

function playFile(url: string): HTMLAudioElement {
  playing?.pause();
  const a = new Audio(url);
  a.volume = soundOpts.volume;
  a.playbackRate = soundOpts.rate;
  a.loop = soundOpts.loop;
  void a.play();
  playing = a;
  return a;
}

/** Game sound events through the real engine (its gains, variation and voice limits). */
const ENGINE_EVENTS: Array<[string, () => void]> = [
  ['Plasma shot', () => audio.playPlasmaShot()],
  ['Heavy plasma shot', () => audio.playPlasmaShot(true)],
  ['Railgun (M95A1)', () => audio.playGunShot('railgun')],
  ['Shotgun + pump', () => audio.playShotgunBlast(false)],
  ['Auto shotgun', () => audio.playShotgunBlast(true)],
  ['Strike (laser)', () => audio.playStrike()],
  ['Drone zap', () => audio.playDroneZap()],
  ['EMP', () => audio.playEmpBlast()],
  ['Throw', () => audio.playLaunch('throw')],
  ['Grenade launch', () => audio.playLaunch('grenade')],
  ['Rocket launch', () => audio.playLaunch('rocket')],
  ['Fire deploy', () => audio.playFireDeploy()],
  ['Glass break', () => audio.playGlassBreak()],
  ['Swing', () => audio.playSwing()],
  ['Enemy plasma', () => audio.playEnemyShot('light')],
  ['Enemy heavy', () => audio.playEnemyShot('heavy')],
  ['Minigun', () => audio.playEnemyShot('minigun')],
  ['Metal hit', () => audio.playEndoHit()],
  ['Liquid hit (T-1000)', () => audio.playEndoHit(undefined, undefined, undefined, undefined, true)],
  ['Crit crunch', () => audio.playCritCrunch()],
  ['Death: humanoid', () => audio.playEnemyDeath('humanoid')],
  ['Death: small', () => audio.playEnemyDeath('small')],
  ['Death: machine', () => audio.playEnemyDeath('machine')],
  ['Death: boss', () => audio.playEnemyDeath('boss')],
  ['Explosion small', () => audio.playExplosion(0.5)],
  ['Explosion medium', () => audio.playExplosion(1)],
  ['Explosion large', () => audio.playExplosion(2)],
  ['Fuel drum', () => audio.playDrumExplosion()],
  ['Mortar warning', () => audio.playTelegraph('mortar', 1.5)],
  ['Core charge warning', () => audio.playTelegraph('charge', 1)],
  ['Searchlight alarm', () => audio.playSearchlightAlert()],
  ['Salvo warning', () => audio.playSalvoWarning()],
  ['Bomb beep', () => audio.playBombBeep()],
  ['Boss stinger (tank)', () => audio.playBossStinger('hk_tank_goliath')],
  ['Boss stinger (aerial)', () => audio.playBossStinger('hk_aerial_squadron_leader')],
  ['Boss stinger (core)', () => audio.playBossStinger('skynet_tde_core')],
  ['Footstep', () => audio.playFootstep()],
  ['Endo step', () => audio.playEndoStep(2, 2, 0, 0)],
  ['Servo', () => audio.playServo()],
  ['Player hit', () => audio.playPlayerHit()],
  ['Heartbeat', () => audio.playHeartbeat()],
  ['Revive', () => audio.playRevive()],
  ['XP pickup', () => audio.playPickupGem()],
  ['Loot: heal', () => audio.playLoot('heal')],
  ['Loot: scrap', () => audio.playLoot('scrap')],
  ['Crate break', () => audio.playCrateBreak()],
  ['Level up', () => audio.playLevelUp()],
  ['Evolution', () => audio.playEvolution()],
  ['Vault jackpot', () => audio.playVaultJackpot()],
  ['Achievement', () => audio.playAchievement()],
  ['Flare launch', () => audio.playFlareLaunch()],
  ['UI click', () => audio.playUiClick()],
  ['UI beep', () => audio.playUiBeep()],
  ['UI buy', () => audio.playUiBuy()],
  ['UI error', () => audio.playUiError()],
  ['Upgrade applied', () => audio.playUpgradeApplied()],
  ['Panel open', () => audio.playHudScanOpen()],
  ['Panel close', () => audio.playHudScanClose()],
  ['Run start', () => audio.playRunStart()],
  ['Run end: victory', () => audio.playRunEnd(true)],
  ['Run end: defeat', () => audio.playRunEnd(false)],
  ['Terminated', () => audio.playPlayerTerminated()]
];

function renderSounds(): void {
  listEl.innerHTML = `
    <h3>Playback</h3>
    <div class="ctl"><label>Volume</label><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${soundOpts.volume}"><output>${soundOpts.volume}</output></div>
    <div class="ctl"><label>Pitch / rate</label><input id="s-rate" type="range" min="0.5" max="2" step="0.05" value="${soundOpts.rate}"><output>${soundOpts.rate}</output></div>
    <div class="ctl toggle"><label>Loop</label><input id="s-loop" type="checkbox" ${soundOpts.loop ? 'checked' : ''}></div>
    <div class="btns"><button class="act" id="s-stop">Stop</button></div>
    <p class="hint">Files play raw (as stored). "Game events" below go through the engine with its in-game gains, random variants and voice limits.</p>
    <h3>Game events (engine)</h3>
    <div class="btns" id="s-events"></div>`;
  // The file list is long, so it gets the main area as a grid of categories
  mediaEl.innerHTML =
    '<h3>Sound files by category (SFX_WAV_MANIFEST in src/audio/AudioEngine.ts)</h3><div id="s-files" class="sound-grid"></div>';
  const vol = listEl.querySelector('#s-vol') as HTMLInputElement;
  const rate = listEl.querySelector('#s-rate') as HTMLInputElement;
  vol.oninput = () => {
    soundOpts.volume = Number(vol.value);
    (vol.nextElementSibling as HTMLElement).textContent = vol.value;
    if (playing) playing.volume = soundOpts.volume;
  };
  rate.oninput = () => {
    soundOpts.rate = Number(rate.value);
    (rate.nextElementSibling as HTMLElement).textContent = rate.value;
    if (playing) playing.playbackRate = soundOpts.rate;
  };
  (listEl.querySelector('#s-loop') as HTMLInputElement).onchange = (e) => (soundOpts.loop = (e.target as HTMLInputElement).checked);
  (listEl.querySelector('#s-stop') as HTMLElement).onclick = () => playing?.pause();

  const events = listEl.querySelector('#s-events')!;
  for (const [label, fn] of ENGINE_EVENTS) {
    const b = document.createElement('button');
    b.className = 'act';
    b.textContent = label;
    b.onclick = () => {
      audio.init();
      fn();
    };
    events.appendChild(b);
  }

  const files = mediaEl.querySelector('#s-files')!;
  for (const [category, urls] of Object.entries(SFX_WAV_MANIFEST)) {
    const box = document.createElement('div');
    box.innerHTML = `<div class="group-title">${category} · ${urls.length}</div>`;
    files.appendChild(box);
    for (const url of urls) {
      const row = document.createElement('div');
      row.className = 'sound-row';
      const name = url.split('/').pop() ?? url;
      row.innerHTML = `<button class="act">▶</button><span title="${url}">${name}</span><small></small>`;
      const dur = row.querySelector('small')!;
      row.querySelector('button')!.onclick = () => {
        const a = playFile(url);
        a.onloadedmetadata = () => (dur.textContent = `${a.duration.toFixed(2)} s`);
      };
      box.appendChild(row);
    }
  }
}

// ---------- Music & movies ----------
const musicState = { enemies: 30, boss: false, on: false };

function renderMedia(): void {
  listEl.innerHTML = `
    <h3>Adaptive music (engine)</h3>
    <p class="hint">The game plays one track through calm, combat and boss filter layers, driven by enemy count and bosses.</p>
    <div class="btns"><button class="act primary" id="m-start">Start music</button><button class="act" id="m-stop">Stop</button></div>
    <div class="ctl"><label>Enemies on screen</label><input id="m-enemies" type="range" min="0" max="300" step="5" value="${musicState.enemies}"><output>${musicState.enemies}</output></div>
    <div class="ctl toggle"><label>Boss alive</label><input id="m-boss" type="checkbox" ${musicState.boss ? 'checked' : ''}></div>
    <div class="ctl"><label>Music volume</label><input id="m-vol" type="range" min="0" max="1" step="0.05" value="0.7"><output>0.7</output></div>
    <h3>Ambience (engine)</h3>
    <div class="btns"><button class="act primary" id="a-start">Start ambience</button><button class="act" id="a-stop">Stop</button></div>
    <p class="hint">A battle bed loop plus distant explosions at random intervals (AMBIENCE in src/data/balance.ts).</p>`;
  const q = (id: string) => listEl.querySelector(id) as HTMLInputElement;
  q('#m-start').onclick = () => {
    audio.init();
    audio.startMusic();
    musicState.on = true;
  };
  q('#m-stop').onclick = () => {
    audio.stopMusic();
    musicState.on = false;
  };
  q('#m-enemies').oninput = () => {
    musicState.enemies = Number(q('#m-enemies').value);
    (q('#m-enemies').nextElementSibling as HTMLElement).textContent = q('#m-enemies').value;
  };
  q('#m-boss').onchange = () => (musicState.boss = q('#m-boss').checked);
  q('#m-vol').oninput = () => {
    audio.setMusicVolume(Number(q('#m-vol').value));
    (q('#m-vol').nextElementSibling as HTMLElement).textContent = q('#m-vol').value;
  };
  q('#a-start').onclick = () => {
    audio.init();
    audio.startAmbience();
  };
  q('#a-stop').onclick = () => audio.stopAmbience();

  mediaEl.innerHTML = `
    <h3>Background music (raw file)</h3>
    <audio controls preload="metadata" src="./audio/backgroundmusic.mp3"></audio>
    <h3>Battle ambience loop (raw file)</h3>
    <audio controls preload="metadata" src="./audio/effects/amb_battle_loop.mp3"></audio>
    <h3>Victory movie</h3>
    <video controls preload="metadata" src="./video/victory.mp4"></video>
    <h3>Defeat movie</h3>
    <video controls preload="metadata" src="./video/defeat.mp4"></video>`;
}

// ---------- Tabs, sound unlock, loop ----------
document.querySelectorAll('nav button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
    if ((b as HTMLElement).dataset.tab !== 'models' && (b as HTMLElement).dataset.tab !== 'effects') currentEntry = null;
    renderList((b as HTMLElement).dataset.tab!);
  });
});

const unlock = document.getElementById('unlock')!;
await ModelLibrary.preload();
unlock.querySelector('div')!.textContent = 'Click anywhere to start (enables sound)';
unlock.addEventListener('click', () => {
  audio.init();
  unlock.remove();
});
renderList('models');

function resize(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let infoTimer = 0;
renderer.setAnimationLoop(() => {
  const raw = Math.min(0.05, clock.getDelta());
  const dt = global.playing ? raw * Number(global.timeScale) : 0;
  subjectTime += dt;
  if (current?.update) current.update(dt, subjectTime, currentParams);
  particles.update(dt);
  if (global.shadow && currentEntry?.id !== 'fx_shadow') {
    const r = Number(global.shadowRadius);
    shadow.scale.set(r, 1, r);
  }
  if (musicState.on) audio.updateMusicIntensity(musicState.enemies, musicState.boss, raw);
  infoTimer -= raw;
  if (infoTimer <= 0 && current) {
    infoTimer = 1;
    renderInfo();
  }
  orbit.update();
  if (canvas.style.display !== 'none') renderer.render(scene, camera);
});
