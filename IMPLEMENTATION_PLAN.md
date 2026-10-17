# Implementation Plan: TERMINATOR SURVIVORS — LOS ANGELES 2029 AD
**Target Execution Model:** Gemini Flash 3.8 (High Reasoning) in Antigravity
**Plan Readiness Score:** 99 / 100 (Turnkey Blueprint with Verbatim Contracts, Authentic Fonts/Music Integration, Shaders, Math & Test Harnesses)

> [!IMPORTANT]
> **Directives for Gemini Flash 3.8 (High Reasoning):**
> 1. **Zero Placeholders or `TODO`s**: Every file, mesh, shader, sound effect, weapon evolution, enemy wave, UI screen, PWA manifest, and test suite specified in this plan must be implemented completely.
> 2. **Single Source of Truth for Types**: Create `src/core/types.ts` **first** (Phase 2.1) using the exact verbatim contract below. Every module in `src/data/`, `src/systems/`, `src/graphics/`, and `src/ui/` must import from `src/core/types.ts` so `npm run typecheck` passes with 0 errors.
> 3. **Authentic Local Reference Assets (`docs/reference/`)**:
>    * **Typography**: Use the provided `docs/reference/terminator real nfi.ttf` and `docs/reference/terminator real nfi.otf` (copied to `public/fonts/terminator-real-nfi.ttf` and `.otf` by `scripts/generate-pwa-icons.mjs`) via `@font-face { font-family: 'Terminator Real NFI'; ... }` for all game titles, headers, Boss warnings, and T-800 HUD banners, paired with `@fontsource/rajdhani` and `@fontsource/share-tech-mono` for dense telemetry readouts.
>    * **Looping Soundtrack**: Use the provided `docs/reference/backgroundmusic.mp3` (~2.05 MB, copied to `public/audio/backgroundmusic.mp3`) for seamless gapless background music playback in `src/audio/AudioEngine.ts`, while synthesizing all 12 combat/HUD SFX via the Web Audio API.
>    * **100% Offline PWA Caching**: Ensure `vite.config.ts` includes `ttf,otf,mp3` in `workbox.globPatterns` and sets `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` so the 2.05 MB soundtrack and Terminator fonts are precached for offline play.
> 4. **Antigravity Tool Efficiency**: Create files in logical phase batches, run `npm run typecheck` after completing each phase, and never leave blocking dev servers (`npm run dev`) running—use `npm run test:unit`, `npm run build`, and `npm run test:e2e` for verification.

---

## 1. Visual, Font & Audio Reference Specification (T1 & T2 Future War)

All visuals, lighting, color grading, meshes, VFX, audio, and UI must strictly replicate James Cameron's **"Future War (Los Angeles, 2029 AD)"** aesthetic captured in `docs/reference/`:
* `ref_01_hk_tank_searchlights.jpg`: Deep cold cobalt-blue nocturnal sky, silhouetted HK-Tank with dual blinding cyan-white volumetric searchlight cones, industrial refinery ruins, rising black smoke plume.
* `ref_02_hk_aerial_laser.jpg`: Twisted black rebar silhouettes in foreground, burnt-out 1980s sedan chassis, shattered concrete pillars, hovering metallic HK-Aerial with crimson navigation beacons firing a razor-sharp violet-magenta phased plasma beam.
* `ref_03_future_war_battlefield.webp`: Overlapping magenta/crimson/violet plasma bolts, downward volumetric white spotlights from flying HKs, bright orange/white thermal detonations illuminating blue-lit rubble.
* `ref_04_t800_endoskeleton.jpg`: Cyberdyne Series 800 Endoskeleton — specular dark-chrome titanium alloy (`#9CA8B8`, `metalness: 0.92`, `roughness: 0.18`), recessed black orbital sockets with glowing crimson optical sensors (`#FF0000`, `emissiveIntensity: 4.5` for UnrealBloom), dual cheek hydraulic pistons, exposed teeth.
* `ref_05_skull_field_hk_tank.jpg`: Bleached bone-white human skull carpets (`#B8C2CC` under blue moonlight) crushed beneath tank treads, ruined freeway overpass, violet-pink plasma beam slicing across the horizon.
* `terminator real nfi.ttf` & `terminator real nfi.otf`: Official *Terminator Real NFI* display typeface for authentic movie title cards and HUD headers.
* `backgroundmusic.mp3`: Official looping Future War background music track.

### 1.1 Exact Color & Material Palette (`src/data/palette.ts`)
```ts
export const PALETTE = {
  skyZenith: 0x040b18,
  skyHorizon: 0x0f294a,
  fogColor: 0x081a33,
  fogDensity: 0.016,
  moonlightColor: 0x4a88d9,
  ambientColor: 0x162d4c,
  endoChrome: 0x9ca8b8,
  endoDarkIron: 0x4a4642,
  endoLiquidMercury: 0xdce8f8,
  endoEyeRed: 0xff1111,
  plasmaCore: 0xffffff,
  plasmaViolet: 0xd400ff,
  plasmaMagenta: 0xff1e8e,
  searchlightCyan: 0xd8f4ff,
  searchlightAlert: 0xff2222,
  fireCore: 0xfff5cc,
  fireOrange: 0xff6611,
  empCyan: 0x00e5ff,
  skullBone: 0xb8c2cc,
  ashGround: 0x101824,
  hudRedPrimary: '#e61919',
  hudRedGlow: '#ff3333',
  hudCyanTechCom: '#4dd2ff',
  hudAmberWarn: '#ff9900',
} as const;
```

### 1.2 `@font-face` & Typography Rules (`src/style.css`)
```css
@font-face {
  font-family: 'Terminator Real NFI';
  src: url('/fonts/terminator-real-nfi.otf') format('opentype'),
       url('/fonts/terminator-real-nfi.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

:root {
  --font-display: 'Terminator Real NFI', 'Orbitron', sans-serif;
  --font-tactical: 'Rajdhani', sans-serif;
  --font-telemetry: 'Share Tech Mono', monospace;
}
```
> [!NOTE]
> Also inject a `<style>` tag in `index.html` using relative `url('./fonts/terminator-real-nfi.ttf')` and `url('./fonts/terminator-real-nfi.otf')` so the font resolves identically whether served at root (`/`) or under a subpath (`/terminator-survivors/`).

---

## 2. Complete Repository File Tree

```text
TerminatorSurvivors/
├── .github/workflows/ci-deploy.yml
├── docs/reference/                       # 5 reference images + terminator real nfi.ttf/.otf + backgroundmusic.mp3
├── public/
│   ├── audio/backgroundmusic.mp3         # Staged from docs/reference/backgroundmusic.mp3
│   ├── fonts/terminator-real-nfi.ttf     # Staged from docs/reference/terminator real nfi.ttf
│   ├── fonts/terminator-real-nfi.otf     # Staged from docs/reference/terminator real nfi.otf
│   └── icons/                            # Generated by scripts/generate-pwa-icons.mjs
├── scripts/generate-pwa-icons.mjs        # Copies fonts/music to public/ & generates PNG/SVG icons
├── src/
│   ├── main.ts                           # Bootstrap, SW registration, window.__GAME_DEBUG__
│   ├── style.css                         # 'Terminator Real NFI', CSM-101 HUD, CRT scanlines, mobile layout
│   ├── vite-env.d.ts
│   ├── core/
│   │   ├── types.ts                      # CANONICAL TYPESCRIPT CONTRACTS (Create first!)
│   │   ├── Game.ts                       # Top-level coordinator owning Loop, Scene, Systems, UI
│   │   ├── GameLoop.ts                   # Fixed 60Hz accumulator + rolling FPS counter
│   │   ├── SpatialHashGrid.ts            # Fast 2D spatial index for 600+ entities
│   │   └── RNG.ts                        # Seedable Mulberry32 PRNG
│   ├── data/
│   │   ├── palette.ts                    # Color & material tokens
│   │   ├── weapons.ts                    # 8 weapons, 8 passives, 8 evolutions, Lv 1-8 builder
│   │   ├── enemies.ts                    # 10 enemy & boss archetypes
│   │   ├── waves.ts                      # 30-minute timeline (0..30) + scripted boss events
│   │   ├── upgrades.ts                   # 8 Tech-Com Bunker meta-upgrades & 4 loadouts
│   │   └── lore.ts                       # Quotes, 6502 hex strings, dossier text
│   ├── state/
│   │   ├── RunState.ts                   # Active run state, XP curve, stat computation
│   │   └── SaveManager.ts                # LocalStorage persistence + schema recovery
│   ├── input/
│   │   └── InputManager.ts               # Keyboard, Mouse, and Mobile Floating Touch Joystick
│   ├── audio/
│   │   └── AudioEngine.ts                # Loops ./audio/backgroundmusic.mp3 + 12 Web Audio API SFX
│   ├── graphics/
│   │   ├── SceneManager.ts               # WebGLRenderer, Camera, Lights, Adaptive Quality Governor
│   │   ├── PostProcessing.ts             # EffectComposer, UnrealBloomPass, CameronGradingShader
│   │   ├── ProceduralTextures.ts         # CanvasTexture brushed metal, ash/skulls, soft radial glow
│   │   ├── Environment2029.ts            # 3x3 infinite chunk terrain, instanced skulls, cars, skyline
│   │   ├── VolumetricSearchlight.ts      # Custom GLSL cone shader + ground spotlight ring
│   │   └── meshes/
│   │       ├── geometryUtils.ts          # Safe non-indexed mergeGeometries helper
│   │       ├── KyleReeseMesh.ts          # Articulated Kyle Reese + trenchcoat + muzzle flash
│   │       ├── EndoskeletonBatch.ts      # Dual-layer InstancedMesh (Chrome Chassis + Red Optics)
│   │       ├── HKAerialMesh.ts           # Flying Hunter-Killer gunship + dual searchlights
│   │       ├── HKTankMesh.ts             # Tracked Hunter-Killer Tank boss + twin plasma booms
│   │       ├── T1000Mesh.ts              # Liquid-metal chrome boss + blade morphs
│   │       └── PickupMeshes.ts           # Data cores, Supply crates, Boss Data Vaults
│   ├── systems/
│   │   ├── PlayerSystem.ts               # Movement, Combat Dive dash, armor, regen
│   │   ├── WeaponSystem.ts               # Firing logic for all 8 base + 8 evolved weapons
│   │   ├── EnemySystem.ts                # Steering, searchlight detection, boss AI, plasma fire
│   │   ├── WaveDirector.ts               # Perimeter spawning & 30:00 TDE Core finale
│   │   ├── PickupSystem.ts               # Magnet attraction, crates, Boss Vault evolution triggers
│   │   └── ParticleSystem.ts             # Pooled plasma bolts, explosions, smoke, floating damage
│   └── ui/
│       ├── UIManager.ts                  # Screen router & HUD bindings
│       ├── HUDView.ts                    # XP bar, weapon rack, clock, boss bar, mobile touch UI
│       ├── TitleScreen.ts                # 2029 prologue, loadout select, Bunker upgrade shop
│       ├── LevelUpModal.ts               # T-800 CSM-101 red vision modal + 6502 assembly ticker
│       ├── VaultJackpotModal.ts          # Skynet Data Vault decoder & Weapon Evolution showcase
│       └── EndRunModal.ts                # TERMINATED / 1984 TDE VICTORY screen
└── tests/
    ├── unit/                             # 6 Vitest suites
    └── e2e/                              # 3 Playwright suites (Desktop, Mobile, Offline PWA)
```

---

## 3. Phase-by-Phase Turnkey Specifications

### Phase 1: Project Scaffolding, Asset Staging Script & PWA Config

#### 1.1 `package.json`
```json
{
  "name": "terminator-survivors",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare-assets": "node scripts/generate-pwa-icons.mjs",
    "dev": "node scripts/generate-pwa-icons.mjs && vite",
    "build": "node scripts/generate-pwa-icons.mjs && tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --host",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test": "npm run typecheck && npm run test:unit && npm run test:e2e"
  },
  "dependencies": {
    "@fontsource/orbitron": "^5.1.0",
    "@fontsource/rajdhani": "^5.1.0",
    "@fontsource/share-tech-mono": "^5.1.0",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.2",
    "@types/three": "^0.170.0",
    "@vitest/coverage-v8": "^2.1.5",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.5"
  }
}
```

#### 1.2 Verbatim `scripts/generate-pwa-icons.mjs` (Stages Fonts/Music & Generates PWA Icons)
```js
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const iconDir = path.resolve('public/icons');
const fontDir = path.resolve('public/fonts');
const audioDir = path.resolve('public/audio');
fs.mkdirSync(iconDir, { recursive: true });
fs.mkdirSync(fontDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

// Stage authentic reference font files & looping background music into public/
const refDir = path.resolve('docs/reference');
if (fs.existsSync(path.join(refDir, 'terminator real nfi.ttf'))) {
  fs.copyFileSync(path.join(refDir, 'terminator real nfi.ttf'), path.join(fontDir, 'terminator-real-nfi.ttf'));
}
if (fs.existsSync(path.join(refDir, 'terminator real nfi.otf'))) {
  fs.copyFileSync(path.join(refDir, 'terminator real nfi.otf'), path.join(fontDir, 'terminator-real-nfi.otf'));
}
if (fs.existsSync(path.join(refDir, 'backgroundmusic.mp3'))) {
  fs.copyFileSync(path.join(refDir, 'backgroundmusic.mp3'), path.join(audioDir, 'backgroundmusic.mp3'));
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function createIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const eyeY = cy - size * 0.04, eyeDx = size * 0.13, eyeR = size * 0.065;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      let R = 5, G = 13, B = 26;
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < r && (dy < size * 0.12 || Math.abs(dx) < size * 0.18)) {
        R = 140; G = 156; B = 176;
      }
      const dLeft = Math.hypot(x - (cx - eyeDx), y - eyeY);
      const dRight = Math.hypot(x - (cx + eyeDx), y - eyeY);
      if (dLeft < eyeR || dRight < eyeR) {
        R = 255; G = 18; B = 18;
      } else if (dLeft < eyeR * 1.8 || dRight < eyeR * 1.8) {
        R = Math.min(255, R + 90); G = Math.max(0, G - 40); B = Math.max(0, B - 40);
      }
      raw[idx] = R; raw[idx + 1] = G; raw[idx + 2] = B; raw[idx + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync(path.join(iconDir, 'icon-192.png'), createIconPng(192));
fs.writeFileSync(path.join(iconDir, 'icon-512.png'), createIconPng(512));
fs.writeFileSync(path.join(iconDir, 'icon-maskable-512.png'), createIconPng(512));
fs.writeFileSync(
  path.join(iconDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="20" fill="#050d1a"/><path d="M32 40 L96 40 L88 84 L74 104 L54 104 L40 84 Z" fill="#9ca8b8" stroke="#4dd2ff" stroke-width="3"/><circle cx="48" cy="60" r="10" fill="#ff1111"/><circle cx="80" cy="60" r="10" fill="#ff1111"/></svg>`
);
console.log('Staged fonts, backgroundmusic.mp3, and generated PWA icons in public/');
```

#### 1.3 Verbatim `vite.config.ts` (Caches `ttf,otf,mp3` up to 5MB for Offline PWA)
```ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'fonts/terminator-real-nfi.ttf',
        'fonts/terminator-real-nfi.otf',
        'audio/backgroundmusic.mp3'
      ],
      manifest: {
        name: 'Terminator Survivors: Los Angeles 2029 AD',
        short_name: 'T-Survivors',
        description: 'Survive the 2029 AD Future War as Kyle Reese against Skynet Hunter-Killers and T-800 Endoskeletons.',
        theme_color: '#050d1a',
        background_color: '#050d1a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,otf,mp3}']
      }
    })
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200
  }
});
```

---

### Phase 2: Canonical TypeScript Contract (`src/core/types.ts`) & Deterministic Math

#### 2.1 Verbatim `src/core/types.ts` (Create First!)
```ts
export type BaseWeaponId =
  | 'ithaca_37'
  | 'pipe_bomb'
  | 'm25_plasma'
  | 'seeker_drone'
  | 'emp_emitter'
  | 'm79_thumper'
  | 'napalm_canister'
  | 'laser_designator';

export type EvolvedWeaponId =
  | 'trench_sweeper'
  | 'thermite_buster'
  | 'm95a1_plasma'
  | 'perimeter_ring'
  | 'emp_supernova'
  | 'mm1_barrage'
  | 'firestorm_wall'
  | 'orbital_ion';

export type WeaponId = BaseWeaponId | EvolvedWeaponId;

export type PassiveId =
  | 'might_shells'
  | 'blast_radius'
  | 'phase_inductor'
  | 'telemetry_cpu'
  | 'flux_coil'
  | 'bandolier'
  | 'fuel_tank'
  | 'comms_uplink';

export type EnemyArchetypeId =
  | 'skynet_crab_drone'
  | 't600_rusted'
  | 't700_scout'
  | 't800_endoskeleton'
  | 'hk_aerial_patrol'
  | 'infiltrator_csm101'
  | 'hk_tank_goliath'
  | 'hk_aerial_squadron_leader'
  | 't1000_prototype'
  | 'skynet_tde_core';

export type LoadoutId = 'reese_2029' | 'reese_1984' | 'techcom_sapper' | 'john_connor';

export type MetaUpgradeId =
  | 'armor_vest'
  | 'combat_stims'
  | 'plasma_overclock'
  | 'servo_greaves'
  | 'salvage_magnet'
  | 'phase_capacitor'
  | 'scavenger_protocol'
  | 'defibrillator';

export type GameMode = 'title' | 'playing' | 'levelup' | 'vault' | 'paused' | 'gameover' | 'victory';

export interface WeaponLevelStats {
  level: number;
  damage: number;
  cooldown: number;
  area: number;
  speed: number;
  amount: number;
  duration: number;
  pierce: number;
  description: string;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  codeName: string;
  isEvolved: boolean;
  pairedPassive?: PassiveId;
  evolvesInto?: EvolvedWeaponId;
  evolvesFrom?: BaseWeaponId;
  iconColor: string;
  levels: WeaponLevelStats[];
}

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  codeName: string;
  maxLevel: number;
  evolvesWeapon: BaseWeaponId;
  iconColor: string;
  descriptionPerLevel: string;
  statPerLevel: Partial<PlayerComputedStats>;
}

export interface PlayerComputedStats {
  maxHp: number;
  regenPerSec: number;
  moveSpeed: number;
  armor: number;
  mightMultiplier: number;
  areaMultiplier: number;
  cooldownMultiplier: number;
  speedMultiplier: number;
  durationMultiplier: number;
  bonusAmount: number;
  magnetRadius: number;
  critChance: number;
  luckMultiplier: number;
  xpGainMultiplier: number;
  revivals: number;
}

export interface SpatialEntity {
  id: number;
  x: number;
  z: number;
  radius: number;
  type: 'enemy' | 'pickup' | 'crate';
}

export interface ActiveEnemy extends SpatialEntity {
  type: 'enemy';
  archetype: EnemyArchetypeId;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  isBoss: boolean;
  isFlying: boolean;
  xpValue: number;
  hitFlashTimer: number;
  slowTimer: number;
  armorStripMultiplier: number;
  attackCooldown: number;
  searchlightAngle: number;
  searchlightAlertTimer: number;
  phaseState: number;
}

export interface ActiveWeaponSlot {
  id: WeaponId;
  level: number;
  evolved: boolean;
  cooldownTimer: number;
}

export interface UpgradeChoice {
  kind: 'weapon' | 'passive' | 'heal' | 'scrap';
  id: WeaponId | PassiveId | 'medkit' | 'scrap_cache';
  title: string;
  subtitle: string;
  currentLevel: number;
  nextLevel: number;
  description: string;
  synergyHint?: string;
  accentColor: string;
}

export interface MetaSaveData {
  version: 1;
  alloyScrap: number;
  totalKills: number;
  bestTimeSeconds: number;
  victories: number;
  unlockedLoadouts: LoadoutId[];
  selectedLoadout: LoadoutId;
  upgrades: Record<MetaUpgradeId, number>;
  settings: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    crtScanlines: boolean;
    autoAim: boolean;
  };
}

export interface GameDebugAPI {
  getState: () => {
    mode: GameMode;
    fps: number;
    timeSeconds: number;
    level: number;
    xp: number;
    xpToNext: number;
    hp: number;
    maxHp: number;
    kills: number;
    alloyScrap: number;
    activeEnemies: number;
    playerPos: { x: number; z: number };
    isDashing: boolean;
    weapons: Array<{ id: WeaponId; level: number; evolved: boolean }>;
    passives: Array<{ id: PassiveId; level: number }>;
  };
  grantXp: (amount: number) => void;
  spawnBoss: (archetype: EnemyArchetypeId) => void;
  triggerVault: () => void;
  fastForward: (seconds: number) => void;
  setGodMode: (enabled: boolean) => void;
}

declare global {
  interface Window {
    __GAME_DEBUG__?: GameDebugAPI;
  }
}
```

#### 2.2 Deterministic Combat & Leveling Math (`src/state/RunState.ts` & `src/data/weapons.ts`)
```ts
export function getXpForNextLevel(level: number): number {
  return Math.floor(10 + 8 * level + 2.5 * Math.pow(level, 1.65));
}

export function computeMitigatedDamage(rawDamage: number, armor: number): number {
  const safeArmor = Math.max(0, armor);
  return Math.max(1, Math.round(rawDamage * (100 / (100 + safeArmor * 8))));
}

export function buildWeaponLevels(
  base: Omit<WeaponLevelStats, 'level' | 'description'>,
  descs: string[]
): WeaponLevelStats[] {
  return Array.from({ length: 8 }, (_, idx) => {
    const lv = idx + 1;
    const mult = 1 + idx * 0.22;
    return {
      level: lv,
      damage: Math.round(base.damage * mult),
      cooldown: Number((base.cooldown * Math.pow(0.94, idx)).toFixed(2)),
      area: Number((base.area * (1 + idx * 0.08)).toFixed(2)),
      speed: Number((base.speed * (1 + idx * 0.06)).toFixed(2)),
      amount: base.amount + (lv >= 3 ? 1 : 0) + (lv >= 6 ? 1 : 0) + (lv === 8 ? 1 : 0),
      duration: Number((base.duration * (1 + idx * 0.08)).toFixed(2)),
      pierce: base.pierce + Math.floor(idx / 2),
      description: descs[idx] ?? `Level ${lv} Tech-Com modification.`
    };
  });
}
```

---

### Phase 3: Procedural PBR Meshes, Safe Geometry Merging & Custom GLSL Shaders

#### 3.1 Safe Geometry Merging (`src/graphics/meshes/geometryUtils.ts`)
```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function bakePart(
  geom: THREE.BufferGeometry,
  tx = 0, ty = 0, tz = 0,
  rx = 0, ry = 0, rz = 0
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
  return nonIndexed;
}

export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}
```

#### 3.2 Exact T-800 Endoskeleton Blueprint (`src/graphics/meshes/EndoskeletonBatch.ts`)
Construct two synchronized `THREE.InstancedMesh` objects (`maxCount = 650`):
1. **`chassisInstancedMesh`** (`MeshStandardMaterial({ color: 0x9ca8b8, metalness: 0.92, roughness: 0.18 })`) merged from these 15 anatomical parts using `bakePart`:
   * **Cranium Dome**: `SphereGeometry(0.19, 10, 8)` at `(0, 1.72, 0)`
   * **Supraorbital Brow Bar**: `BoxGeometry(0.30, 0.07, 0.22)` at `(0, 1.73, 0.07)`
   * **Maxilla & Jaw Teeth Block**: `BoxGeometry(0.22, 0.16, 0.20)` at `(0, 1.56, 0.05)`
   * **Cheek Hydraulic Pistons (L/R)**: `CylinderGeometry(0.025, 0.025, 0.18, 6)` at `(±0.13, 1.60, 0.04)`, `rz = ∓0.2`
   * **Cervical Spine & Pistons**: `CylinderGeometry(0.07, 0.08, 0.18, 8)` at `(0, 1.44, -0.02)`
   * **Clavicle Yoke**: `BoxGeometry(0.62, 0.09, 0.20)` at `(0, 1.34, 0)`
   * **Thoracic Ribcage Core**: `CylinderGeometry(0.18, 0.14, 0.42, 8)` at `(0, 1.12, 0)`
   * **Spinal Column Rod**: `CylinderGeometry(0.055, 0.055, 0.65, 6)` at `(0, 0.95, -0.06)`
   * **Pelvic H-Chassis**: `BoxGeometry(0.42, 0.16, 0.22)` at `(0, 0.72, 0)`
   * **Thigh Twin Struts (L/R)**: `CylinderGeometry(0.065, 0.055, 0.38, 6)` at `(±0.14, 0.48, 0)`
   * **Shin Pistons (L/R)**: `CylinderGeometry(0.05, 0.04, 0.36, 6)` at `(±0.14, 0.18, 0)`
   * **Upper Arms (L/R)**: `CylinderGeometry(0.05, 0.045, 0.34, 6)` at `(±0.34, 1.15, 0.05)`, `rx = 0.35`
   * **Forearm & M-25 Plasma Rifle Barrel**: `BoxGeometry(0.08, 0.09, 0.58)` at `(0.26, 1.02, 0.32)`
2. **`opticsInstancedMesh`** (`MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 4.5 })`) merged from:
   * **Left & Right Crimson Optical Sensors**: `SphereGeometry(0.038, 8, 8)` at `(-0.075, 1.68, 0.17)` and `(0.075, 1.68, 0.17)`
   * **Thoracic Power Cell Glow**: `BoxGeometry(0.10, 0.08, 0.22)` at `(0, 1.16, 0.04)`
3. **Menacing Animatronic Walk-Cycle Transform**:
   * In `updateBatch(enemies, timeSeconds)`, set each instance matrix with position `(enemy.x, bobY, enemy.z)` where `bobY = Math.abs(Math.sin(timeSeconds * 8 + enemy.id)) * 0.08` and roll oscillation `rz = Math.sin(timeSeconds * 8 + enemy.id) * 0.07`.

#### 3.3 Verbatim Volumetric Searchlight Shader (`src/graphics/VolumetricSearchlight.ts`)
```ts
import * as THREE from 'three';

export class VolumetricSearchlight {
  public readonly group = new THREE.Group();
  private readonly coneMat: THREE.ShaderMaterial;
  private readonly groundDiscMat: THREE.MeshBasicMaterial;

  constructor(length = 12, radius = 3.6) {
    const coneGeo = new THREE.ConeGeometry(radius, length, 28, 1, true);
    coneGeo.translate(0, -length / 2, 0);
    coneGeo.rotateX(-Math.PI / 2);

    this.coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xd8f4ff) },
        uAlertColor: { value: new THREE.Color(0xff2222) },
        uAlertLevel: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying float vAxial;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vAxial = clamp(1.0 - (position.z / ${length.toFixed(1)}), 0.0, 1.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uAlertColor;
        uniform float uAlertLevel;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying float vAxial;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(abs(dot(normalize(vNormal), viewDir)), 1.4);
          float axialFade = pow(vAxial, 1.35) * smoothstep(0.0, 0.12, vAxial);
          float dust = 0.88 + 0.12 * sin(vAxial * 18.0 - uTime * 4.0);
          vec3 col = mix(uColor, uAlertColor, clamp(uAlertLevel, 0.0, 1.0));
          float alpha = fresnel * axialFade * dust * (0.34 + 0.25 * uAlertLevel);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    const coneMesh = new THREE.Mesh(coneGeo, this.coneMat);
    this.group.add(coneMesh);

    const discGeo = new THREE.RingGeometry(0.2, radius * 0.95, 32);
    discGeo.rotateX(-Math.PI / 2);
    this.groundDiscMat = new THREE.MeshBasicMaterial({
      color: 0xd8f4ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const discMesh = new THREE.Mesh(discGeo, this.groundDiscMat);
    discMesh.name = 'groundDisc';
    this.group.add(discMesh);
  }

  public update(timeSeconds: number, alertLevel: number, groundYOffset: number): void {
    this.coneMat.uniforms.uTime.value = timeSeconds;
    this.coneMat.uniforms.uAlertLevel.value = alertLevel;
    this.groundDiscMat.color.lerpColors(
      new THREE.Color(0xd8f4ff),
      new THREE.Color(0xff2222),
      Math.min(1, alertLevel)
    );
    const disc = this.group.getObjectByName('groundDisc');
    if (disc) {
      disc.position.set(0, groundYOffset, 8.5);
    }
  }
}
```

#### 3.4 Verbatim Cameron Future War Post-Processing Shader (`src/graphics/PostProcessing.ts`)
```ts
export const CameronGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uAberration: { value: 0.0012 },
    uDamageFlash: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uDamageFlash;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      vec2 offset = dir * uAberration * (0.5 + dist);

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      vec3 coldShadows = vec3(0.03, 0.09, 0.19);
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col + coldShadows * (1.0 - luma) * 0.45, col * vec3(0.95, 1.02, 1.12), smoothstep(0.1, 0.8, luma));

      float grain = (rand(vUv + fract(uTime)) - 0.5) * 0.035;
      float vignette = smoothstep(0.88, 0.32, dist);
      col = (col + grain) * mix(0.42, 1.0, vignette);

      col = mix(col, vec3(0.95, 0.08, 0.08), clamp(uDamageFlash, 0.0, 0.65));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};
```

---

### Phase 4: Looping `backgroundmusic.mp3` & 12 Web Audio API SFX (`src/audio/AudioEngine.ts`)

1. **Gapless Looping `backgroundmusic.mp3` + Fallback**:
   * Load `./audio/backgroundmusic.mp3` via `fetch('./audio/backgroundmusic.mp3')` and decode it via `audioCtx.decodeAudioData(arrayBuffer)` into a cached `AudioBuffer`.
   * Start an `AudioBufferSourceNode` with `source.buffer = decodedBuffer`, `source.loop = true`, connected to `musicGain -> masterGain` for sample-accurate gapless looping!
   * Also keep an `HTMLAudioElement('./audio/backgroundmusic.mp3')` (`audioEl.loop = true`) fallback if `decodeAudioData` is unavailable, and gracefully no-op in headless Vitest unit tests when `fetch` or `AudioContext` is mocked.
2. **12 Required Procedural Web Audio SFX Methods**:
   * `playPlasmaShot(isHeavy = false)`: High-voltage FM laser snap (`1800Hz -> 240Hz` sawtooth + bandpass noise burst + `90Hz` punch).
   * `playShotgunBlast()`: White/pink noise burst through resonant lowpass (`900Hz -> 120Hz`) + delayed mechanical pump-action click (`0.18s` later).
   * `playExplosion(scale = 1.0)`: Deep sub-bass drop (`80Hz -> 22Hz`) + filtered rumble noise (`0.9s` decay).
   * `playEmpBlast()`: Rising electric hum + descending phase-swept chord (`600Hz -> 45Hz`).
   * `playEndoHit()`: Metallic ricochet (`triangle` + ring-modulated `1420Hz`/`2180Hz` ping).
   * `playEndoDestroy()`: Hydraulic pressure hiss + low metallic crunch.
   * `playSearchlightAlert()`: Skynet target-lock klaxon (`880Hz` / `1320Hz` square wave pulse).
   * `playPickupGem(combo = 0)`: Crystalline microchip chirp rising in pitch by semitones (`440 * Math.pow(1.05946, combo % 16)`).
   * `playLevelUp()`: Authentic 1984 T-800 HUD 6502 microcomputer diagnostic sequence + synth brass swell.
   * `playVaultJackpot()`: Rapid telemetry cycling ticks culminating in a synth fanfare.
   * `playCombatDive()`: Bandpass whoosh sweep.
   * `playPlayerHit()`: Heavy impact thud + brief static burst.
   * **Memory Safety**: Every transient `OscillatorNode` and `AudioBufferSourceNode` must disconnect its output nodes inside `onended`.

---

### Phase 5: Gameplay Content Matrix (Weapons, Passives, Evolutions & 30-Min Waves)

#### 5.1 Complete 8 Base Weapons + 8 Passives + 8 Evolutions (`src/data/weapons.ts`)
| Base Weapon ID | Base Stats (Lv1) | Paired Passive ID | Evolved Weapon ID | Evolved Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `ithaca_37` | `dmg: 24, cd: 1.15, area: 1.0, spd: 22, amt: 5, dur: 0.45, prc: 2` | `might_shells` (`+12% Might/lv`) | `trench_sweeper` | Fires 12 incendiary tungsten flechettes in a wide twin-cone every `0.55s` (`dmg: 58, prc: 6`). |
| `pipe_bomb` | `dmg: 45, cd: 2.40, area: 1.35, spd: 12, amt: 1, dur: 1.2, prc: 99` | `blast_radius` (`+12% Area/lv`) | `thermite_buster` | Throws 3 cluster thermite bombs that detonate and leave molten slag zones (`dmg: 110, area: 2.4`). |
| `m25_plasma` | `dmg: 30, cd: 0.75, area: 1.0, spd: 28, amt: 1, dur: 1.2, prc: 1` | `phase_inductor` (`-8% Cooldown/lv`) | `m95a1_plasma` | Westinghouse M95A1 rapid violet plasma beams (`cd: 0.22s, dmg: 65, amt: 2, prc: 8`) with splash sparks. |
| `seeker_drone` | `dmg: 18, cd: 3.20, area: 1.1, spd: 4.2, amt: 2, dur: 2.6, prc: 99` | `telemetry_cpu` (`+15% Duration/lv`) | `perimeter_ring` | 6 permanent high-speed orbiting razor drones + outward laser arcs (`dmg: 48, dur: 999`). |
| `emp_emitter` | `dmg: 14, cd: 1.45, area: 1.25, spd: 1, amt: 1, dur: 0.35, prc: 99` | `flux_coil` (`+25% Magnet & +10% HP/lv`) | `emp_supernova` | Huge `6.5m` electromagnetic shockwave every `0.95s` that stuns machines, strips 30% armor, and heals `1 HP`. |
| `m79_thumper` | `dmg: 52, cd: 2.10, area: 1.2, spd: 16, amt: 1, dur: 0.8, prc: 99` | `bandolier` (`+1 Amount/lv`, max Lv2) | `mm1_barrage` | Launches a 6-round rolling 40mm artillery carpet barrage at high-HP targets (`dmg: 95, cd: 1.35s`). |
| `napalm_canister` | `dmg: 16, cd: 2.60, area: 1.3, spd: 10, amt: 1, dur: 3.0, prc: 99` | `fuel_tank` (`+12% Speed & Move/lv`) | `firestorm_wall` | Spawns 4 roaring blue-orange chemical flame pools around Kyle (`dmg: 42/tick, dur: 4.5s`). |
| `laser_designator` | `dmg: 60, cd: 2.80, area: 1.1, spd: 40, amt: 1, dur: 0.5, prc: 99` | `comms_uplink` (`+8% Crit & Luck/lv`) | `orbital_ion` | Calls down massive cyan-magenta orbital ion beams that vaporize target clusters (`dmg: 165, amt: 3`). |

#### 5.2 Complete 30-Minute Wave & Boss Timeline (`src/data/waves.ts`)
* Export `WAVE_TIMELINE: WaveMinuteEntry[]` covering Minutes `0` through `30` (`31` entries):
  * `minute`: `0..30`
  * `spawnInterval`: `Math.max(0.12, Number((1.15 * Math.pow(0.925, minute)).toFixed(3)))`
  * `minEnemies`: `Math.min(480, Math.floor(18 + minute * 14))`
  * `hpMultiplier`: `Number((1 + minute * 0.28 + Math.pow(minute, 1.45) * 0.06).toFixed(2))`
  * `damageMultiplier`: `Number((1 + minute * 0.12).toFixed(2))`
  * **Boss Triggers**:
    * Minute `5`: `infiltrator_csm101` (*"INFILTRATOR UNIT CSM-101 DETECTED"*)
    * Minute `10`: `hk_tank_goliath` (*"HUNTER-KILLER TANK GOLIATH APPROACHING"*)
    * Minute `15`: `infiltrator_csm101` (*"TWIN CSM-101 INFILTRATOR AMBUSH"*)
    * Minute `20`: `hk_aerial_squadron_leader` (*"HK-AERIAL COMMAND SQUADRON INBOUND"*)
    * Minute `25`: `hk_tank_goliath` (*"HEAVY ARMORED HK-TANK DIVISION"*)
    * Minute `28`: `t1000_prototype` (*"LIQUID METAL PROTOTYPE T-1000 RELEASED"*)
    * Minute `30`: `skynet_tde_core` (*"SKYNET TIME DISPLACEMENT CORE BREACHED — DESTROY CORE TO ENTER 1984"*)

---

### Phase 6: Desktop + Mobile Touch Controls & Authentic T-800 CSM-101 HUD

1. **`src/input/InputManager.ts`**:
   * Track keyboard state (`KeyW`/`ArrowUp`, `KeyS`/`ArrowDown`, `KeyA`/`ArrowLeft`, `KeyD`/`ArrowRight`, `Space`/`ShiftLeft` for Dash).
   * Track Mobile Touch Virtual Joystick on `#touch-zone-left`:
     * On `pointerdown`: record `originX, originY` and `activePointerId`, position `#joystick-base` and `#joystick-knob` at `(originX, originY)` and make visible.
     * On `pointermove` (matching `activePointerId`): clamp delta `(dx, dy)` to `maxRadius = 56px`, update `#joystick-knob` transform, set `touchVec = { x: dx / maxRadius, z: dy / maxRadius }`.
     * On `pointerup` / `pointercancel`: reset `touchVec = { x: 0, z: 0 }`.
   * Expose `setJoystickVectorForTest(x: number, z: number)` and `triggerDashForTest()` on `InputManager` as well as full pointer event support so both real touch devices and Playwright mobile tests work seamlessly.
2. **Semantic `data-testid` Contract Across All UI Screens (`src/ui/`)**:
   * `data-testid="btn-start-run"` (Deploy button on Title Screen)
   * `data-testid="btn-bunker-shop"` (Tech-Com Bunker Requisition button)
   * `data-testid="hud-container"` (In-game HUD root)
   * `data-testid="hud-level"` (Level readout)
   * `data-testid="hud-timer"` (30:00 clock readout)
   * `data-testid="levelup-modal"` (T-800 Red Vision Level-Up overlay)
   * `data-testid="upgrade-card-0"`, `"upgrade-card-1"`, `"upgrade-card-2"` (Upgrade choice cards)
   * `data-testid="vault-modal"` and `data-testid="btn-claim-vault"` (Boss Vault Jackpot modal)
   * `data-testid="btn-mobile-dash"` (Mobile Combat Dive button)
   * `data-testid="touch-joystick-zone"` (Left-screen touch joystick zone)

---

### Phase 7: Complete Testing Harness (Vitest Unit Tests + Playwright E2E / Offline PWA)

#### 7.1 Unit Test Suites (`tests/unit/*.test.ts`)
Implement all 6 unit test files and verify with `npm run test:unit`:
1. `tests/unit/spatialHash.test.ts` — Inserts 600 entities, tests `queryRadius`, `findNearest` with filters, negative coordinates, and `clear()`.
2. `tests/unit/weaponEvolution.test.ts` — Verifies all 8 base weapons have 8 levels, pairs each with its passive, and tests evolving all 8 into their Superweapons when a Boss Vault is opened at weapon Lv 8 + passive Lv $\ge 1$.
3. `tests/unit/waveDirector.test.ts` — Verifies `WAVE_TIMELINE` has 31 entries (0..30), checks boss spawns at minutes `5, 10, 15, 20, 25, 28, 30`, and verifies scaling curves.
4. `tests/unit/saveManager.test.ts` — Verifies `SaveManager` loads default state, purchases `MetaUpgradeId` upgrades, deducts `alloyScrap`, persists to `localStorage`, and recovers from invalid JSON.
5. `tests/unit/combatMath.test.ts` — Verifies `getXpForNextLevel`, `computeMitigatedDamage`, critical hit multipliers, and Combat Dive invulnerability frames.
6. `tests/unit/audioEngine.test.ts` — Verifies `AudioEngine` instantiates cleanly with a mocked `AudioContext`, toggles mute/volume, and invokes all 12 SFX methods without throwing.

#### 7.2 Verbatim Playwright Configuration (`playwright.config.ts`)
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    headless: true,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
});
```

#### 7.3 Verbatim Non-Flaky Offline PWA Test (`tests/e2e/pwa-offline.spec.ts`)
```ts
import { test, expect } from '@playwright/test';

test('PWA registers Service Worker, caches Terminator font & music, and runs completely offline', async ({ page, context }) => {
  const failedRequests: string[] = [];
  page.on('requestfailed', (req) => failedRequests.push(req.url()));

  await page.goto('/');
  await expect(page.getByTestId('btn-start-run')).toBeVisible();

  // Wait for Workbox Service Worker to activate and claim the client
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
          setTimeout(resolve, 1500);
        });
      }
    }
  });

  // Switch browser context to strict Offline Mode and reload
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Verify game boots and plays offline with zero failed requests
  await expect(page.getByTestId('btn-start-run')).toBeVisible();
  await page.getByTestId('btn-start-run').click();
  await expect(page.getByTestId('hud-container')).toBeVisible();

  const state = await page.evaluate(() => window.__GAME_DEBUG__?.getState());
  expect(state?.mode).toBe('playing');
  expect(failedRequests).toEqual([]);

  await context.setOffline(false);
});
```

---

### Phase 8: GitHub Repository Creation & CI/CD Deployment

1. **Create `.github/workflows/ci-deploy.yml`**:
   * Runs `npm ci`, `npm run typecheck`, `npm run test:unit`, `npx playwright install --with-deps chromium`, `npm run build`, `npm run test:e2e`, and deploys `./dist` to GitHub Pages.
2. **Push to User's GitHub Account (`steve-pritchard-83/terminator-survivors`)**:
   ```powershell
   git init
   git branch -M main
   git add .
   git commit -m "feat: production release of Terminator Survivors: 2029 AD"
   gh repo create steve-pritchard-83/terminator-survivors --public --source=. --remote=origin --description "Terminator Survivors: 2029 AD - 3D Vampire Survivors clone set in the T1/T2 Future War starring Kyle Reese (Three.js + Web Audio + Offline PWA)" --push
   ```

---

## 4. Final Verification Checklist
- [ ] `npm run typecheck` passes with 0 errors (`strict: true`).
- [ ] `npm run test:unit` passes all 6 unit test suites.
- [ ] `npm run build && npm run test:e2e` passes Desktop gameplay, Mobile Touch Joystick, and Offline PWA tests (including offline caching of `terminator-real-nfi.ttf/.otf` and `backgroundmusic.mp3`).
- [ ] Repository `https://github.com/steve-pritchard-83/terminator-survivors` is live with all source code, reference assets, tests, and CI/CD workflow pushed to `main`.
