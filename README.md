# TERMINATOR SURVIVORS: 2029 A.D.

### A 3D WebGL / PWA Vampire Survivors Experience starring Kyle Reese

[![Live Production Demo](https://img.shields.io/badge/Live%20Demo-terminator--survivors.vercel.app-ff1e27.svg?style=flat-square&logo=vercel)](https://terminator-survivors.vercel.app)
[![CI/CD Deployment](https://github.com/steve-pritchard-83/terminator-survivors/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/steve-pritchard-83/terminator-survivors/actions)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25%20Offline-00e5ff.svg)](https://terminator-survivors.vercel.app)
[![Three.js](https://img.shields.io/badge/Graphics-Three.js%20PBR-e61919.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.7-3178c6.svg)](https://www.typescriptlang.org/)

> _"The machines rose from the ashes of the nuclear fire. Their war to exterminate mankind had raged for decades, but the final battle would not be fought in the future. It would be fought here, in our present. Tonight."_  
> — **Kyle Reese, Sergeant Tech-Com, DN38416**

🕹️ **Play Now in Browser / Mobile PWA**: [https://terminator-survivors.vercel.app](https://terminator-survivors.vercel.app)

---

## 💀 Overview

**Terminator Survivors: 2029 A.D.** is a high-octane 3D browser game inspired by _Vampire Survivors_, meticulously crafted to recreate the grim, cobalt-blue night battlefield of the Future War from James Cameron’s _The Terminator_ (1984) and _Terminator 2: Judgment Day_ (1991).

You play as **Kyle Reese** (Tech-Com Sergeant DN38416), fighting desperately across the ruined wasteland of Los Angeles in the year 2029. Survive swarms of chrome T-800 Endoskeletons, evading airborne Hunter-Killer searchlights and titan Hunter-Killer Tanks until John Connor’s final bunker breach.

Available anywhere on desktop and mobile, with full progressive web app (PWA) offline installation, full Xbox / Bluetooth controller support with dual-rumble haptics, and forced landscape mobile optimization.

---

## 🎮 Features

### 1. Authentic Cameron Future War Aesthetic

- **Sculpted 3D Models**: Built in `Three.js` from supplied models (T-800, T-600, HK Aerial and Tank, T-1000, Infiltrator, Skynet core, K-9, turret and more) with metal materials, instanced crowds with jointed walk cycles, volumetric searchlight cones, procedural blast craters, ruins and miles of human skull fields.
- **Cinematic Post-Processing**: Unreal bloom, cobalt-blue colour grading, film grain (desktop), and a faint steel CRT scanline overlay. The interface is neutral steel; red is kept for health, bosses and damage.
- **Faithful Typography & Audio**:
  - Incorporates the authentic `Terminator Real NFI` font alongside Share Tech Mono for the interface.
  - Looped background music (`backgroundmusic.mp3`) played through a gapless Web Audio loop graph, crossfading to a boss track (`boss.mp3`) during boss fights.
  - Audio engine playing about 170 trimmed WAV effects (listed in `SFX_WAV_MANIFEST`) with spatial panning and voice limits, plus synthesised warning cues before boss attacks.

### 2. Survivor Combat & Arsenal (11 Weapons, 10 Passives, 11 Evolutions)

- **Weapons** (each evolves into a superweapon once it reaches level 7 alongside its paired passive and a data vault is opened):
  - **Westinghouse M-25 Plasma Rifle** (starting weapon) → M95A1 Heavy
  - **Ithaca 37 Shotgun** → Trench Sweeper Auto-12
  - **Thermite Pipe Bomb** → Thermite Bunker Buster
  - **RPG-7 Heavy Launcher** → Tandem Warhead RPG
  - **Incendiary Molotov** → Firestorm Incendiary Lane
  - **Captured Seeker Drone** → Perimeter Defense Ring
  - **EMP Pulse Emitter** → Tech-Com EMP Supernova
  - **Bunker Laser Targeter** → Captured HK-Orbital Ion
  - **Resistance K-9 Scout** → K-9 Wolfpack
  - **Reprogrammed T-800 Ally** → Guardian Protocol T-800
  - **Coltan Combat Knife** → Hyperalloy Combat Blade
- Five weapons are unlocked by achievements: destroying the HK-Aerial, HK-Tank, T-1000 and Skynet Core bosses, and reaching level 20.
- **Requisition**: ten permanent upgrades bought with Alloy Scrap between runs.
- **Ability** (`E`): Kyle throws four heavy pipe bombs outward in a cross.

### 3. Skynet Threat Matrix

- **Fodder**: Series 600 walkers (from the start, in growing packs) and T-800 endoskeletons (from minute 1), drawn as instanced crowds with jointed walk cycles and contact shadows.
- **Specialists**: Moto-Terminator flankers and T-1 tracked chassis (from minute 3), plasma turrets, and Hunter-Killer Aerial gunships with searchlights.
- **Elites**: any fodder can spawn as an Armored, Overclocked or Self-Destruct elite.
- **Bosses**: Infiltrator CSM-101 (2:00), Hunter-Killer Tank Goliath (4:00), HK-Aerial Command (6:00), T-1000 (8:00) and the Skynet Time Displacement Core (10:00). Each has a minimum fight length so its phases always play out.
- **Threat levels**: winning unlocks the next of five harder levels (tougher machines, more scrap, and one extra rule each: elites from the start, faster machines, bigger packs, no medkits, tougher bosses).
- **Supply drops**: at 3:20, 5:20 and 7:20 a guarded data vault lands nearby; arrows at the screen edge point to vaults and off-screen bosses.
- **Daily operation**: the same waves for everyone each day, with the day's best result kept.

### 4. Controller, Mobile Native & PWA First

- **Xbox & Universal Gamepad Support**:
  - Auto-detects standard USB and Bluetooth gamepads.
  - Left stick 360-degree movement, right stick dedicated twin-stick aiming.
  - Smooth stick-release handling preserving last facing angle without snapping to mouse.
  - `Start` / `Menu` pauses; `Button A` (Cross) confirms in menus.
  - Dual-rumble actuator haptics for low-frequency explosions and high-frequency firing/XP ticks.
- **Mobile Landscape PWA**:
  - Dedicated landscape orientation lock and immersive fullscreen prompt.
  - Installable PWA with offline caching via Workbox service worker.
  - Touch controls: left-side floating virtual joystick and a tappable ability chip.
  - Native mobile vibration haptics (`navigator.vibrate`) on XP pickups and level-ups.
  - Responsive touch scrolling in Requisition & Boss Vault modals.

---

## 🕹️ Controls

| Platform                     | Action           | Control                                           |
| :--------------------------- | :--------------- | :------------------------------------------------ |
| **Desktop Keyboard / Mouse** | Movement         | `W`, `A`, `S`, `D` or Arrow Keys                  |
| **Desktop Keyboard / Mouse** | Aiming           | Mouse cursor position                             |
| **Desktop Keyboard / Mouse** | Ability          | `E`                                               |
| **Desktop Keyboard / Mouse** | Pause / Menu     | `Escape`                                          |
| **Xbox / Standard Gamepad**  | Movement         | Left Thumbstick or D-Pad                          |
| **Xbox / Standard Gamepad**  | 360° Aiming      | Right Thumbstick (retains angle on release)       |
| **Xbox / Standard Gamepad**  | Ability          | `Button Y` / `Button X` / `RB`                    |
| **Xbox / Standard Gamepad**  | Select / Upgrade | `Button A` (South / Cross)                        |
| **Xbox / Standard Gamepad**  | Pause / Menu     | `Start` / `Menu` button                           |
| **Mobile PWA**               | Movement         | Virtual Touch Joystick (drag left half of screen) |
| **Mobile PWA**               | Ability          | Tap the ability chip above the health bar         |

---

## 🛠️ Tech Stack & Architecture

- **Rendering Engine**: Three.js (WebGL 2.0 / PBR shaders / InstancedMesh)
- **Audio System**: Web Audio API (procedural synthesis) + HTML5 Audio (gapless music streaming and the sound effects)
- **Spatial Partitioning**: Custom 2D Spatial Hash Grid ($O(1)$ collision checks across hundreds of units)
- **State Management**: Reactive deterministic game loop with fixed-timestep physics (60Hz) with interpolated player and camera rendering
- **Input System**: Multi-device manager supporting Keyboard, Mouse, Virtual Touchscreen Joystick, and Standard Gamepad API with Dual-Rumble Haptics
- **Build System**: Vite 6 + TypeScript 5.7
- **PWA Tooling**: Vite Plugin PWA + Workbox (precache limit configured for high-fidelity assets)
- **Testing**:
  - Unit Tests: Vitest (combat math, spatial hashing, weapon evolutions, save manager, wave director)
  - E2E Test: one Playwright smoke test (title, bunker shop, deploy, level-up)
- **CI / CD**: GitHub Actions workflow (`ci-deploy.yml`) with automated typechecking, unit tests and production build
- **Deployment**: Vercel (`terminator-survivors.vercel.app`), deployed with `vercel --prod`

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22 (what CI uses) or newer
- npm 10 or newer

### Installation

```bash
git clone https://github.com/steve-pritchard-83/terminator-survivors.git
cd terminator-survivors
npm install
```

### Development

Launch local development server:

```bash
npm run dev
```

### Build & PWA Generation

Verify public assets, compile TypeScript, and bundle production assets:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

## 🧪 Testing

Run all test suites (typecheck, unit, and end-to-end):

```bash
npm test
```

### Unit Tests

```bash
npm run test:unit
```

### End-to-End Tests (Playwright)

```bash
npm run test:e2e
```

---

## 📜 Credits & Disclaimers

- Built with tribute to James Cameron, Gale Anne Hurd, Brad Fiedel, and the creators of _The Terminator_ franchise.
- Created strictly as a non-commercial educational and entertainment fan project. Not endorsed by or affiliated with Orion Pictures, StudioCanal, or rights holders of _The Terminator_.
- Complete asset provenance and licensing registers are tracked in [`ASSETS.md`](ASSETS.md). UI icons are from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors (CC BY 3.0).

_"There is no fate but what we make for ourselves."_
