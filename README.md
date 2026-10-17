# TERMINATOR SURVIVORS: 2029 A.D.
### A 3D WebGL / PWA Vampire Survivors Experience starring Kyle Reese

[![Live Production Demo](https://img.shields.io/badge/Live%20Demo-terminator--survivors.vercel.app-ff1e27.svg?style=flat-square&logo=vercel)](https://terminator-survivors.vercel.app)
[![CI/CD Deployment](https://github.com/steve-pritchard-83/terminator-survivors/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/steve-pritchard-83/terminator-survivors/actions)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25%20Offline-00e5ff.svg)](https://terminator-survivors.vercel.app)
[![Three.js](https://img.shields.io/badge/Graphics-Three.js%20PBR-e61919.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.7-3178c6.svg)](https://www.typescriptlang.org/)

> *"The machines rose from the ashes of the nuclear fire. Their war to exterminate mankind had raged for decades, but the final battle would not be fought in the future. It would be fought here, in our present. Tonight."*  
> — **Kyle Reese, Sergeant Tech-Com, DN38416**

🕹️ **Play Now in Browser / Mobile PWA**: [https://terminator-survivors.vercel.app](https://terminator-survivors.vercel.app)

---

## 💀 Overview

**Terminator Survivors: 2029 A.D.** is a high-octane 3D browser game inspired by *Vampire Survivors*, meticulously crafted to recreate the grim, cobalt-blue night battlefield of the Future War from James Cameron’s *The Terminator* (1984) and *Terminator 2: Judgment Day* (1991).

You play as **Kyle Reese** (Tech-Com Sergeant DN38416), fighting desperately across the ruined wasteland of Los Angeles in the year 2029. Survive swarms of chrome T-800 Endoskeletons, evading airborne Hunter-Killer searchlights and titan Hunter-Killer Tanks until John Connor’s final bunker breach.

Available anywhere on desktop and mobile, with full progressive web app (PWA) offline installation, full Xbox / Bluetooth controller support with dual-rumble haptics, and forced landscape mobile optimization.

---

## 🎮 Features

### 1. Authentic Cameron Future War Aesthetic
- **Procedural PBR 3D Graphics**: Built from the ground up in `Three.js` with custom metallic chrome shaders, volumetric searchlight cones with soft edge falloff, red scanning lasers, destroyed rebar highway pillars, crushed car chassis, procedural blast craters, cracked asphalt slabs, and miles of human skull fields.
- **Cinematic Post-Processing**: Unreal bloom, cobalt-blue color grading, film grain, and an authentic red CRT scanline overlay simulating Skynet terminal telemetries.
- **Faithful Typography & Audio**:
  - Incorporates the authentic `Terminator Real NFI` font alongside tactical Rajdhani and 6502 assembly telemetry fonts.
  - Features Brad Fiedel’s iconic looped future war score (`backgroundmusic.mp3`) with a seamless gapless Web Audio loop graph.
  - Hybrid Audio Engine combining 56 preloaded authentic `.wav` combat SFX (`S_PlasmaShot01.wav`, `S_Ithica01.wav`, `Shotgun_shot_spas.wav`, `S_LaserTank01.wav`, `plasma_explosion.wav`, `hk_heavy1a_m.wav`, and the iconic `terminated.wav` death sting) with procedural Web Audio API synthesis.

### 2. Deep Survivor Combat & Arsenal (8 Base Weapons, 8 Passives, 8 Evolutions)
- **8 Base Weapons**:
  - **Sawed-Off Ithaca 37**: 12-gauge close-quarters buckshot spread.
  - **Westinghouse M-25 Plasma Rifle**: Rapid purple phased plasma bolts in the 40-watt range.
  - **Tech-Com Pipe Bomb**: Improvised cylindrical charges with timed area detonation.
  - **Tactical EMP Emitter**: Periodic electromagnetic shockwave that slows and strips Skynet armor.
  - **Reprogrammed Seeker Drone**: Orbiting Tech-Com micro-drones slicing through nearby hostiles.
  - **M79 Thumper Grenade Launcher**: High-angle lobbed 40mm fragmentation shells.
  - **Scorched Earth Napalm Canister**: Incendiary canisters igniting lingering ground fire zones.
  - **Bunker Laser Designator**: Calls down pinpoint orbital plasma strikes from captured satellites.
- **8 Tactical Passives**:
  - Bandolier Harness (+Projectile Speed & Range)
  - Overcharged Plasma Cell (+Cooldown Reduction)
  - Blast Compound (+Area Radius)
  - Sarah’s Polaroid (+Max HP & Armor)
  - Gyro-Stabilizer (+Extra Projectiles)
  - Salvaged Endo-Servos (+Move Speed & Magnet Radius)
  - Skynet CPU Uplink (+Critical Chance & XP Gain)
  - Coltan Alloy Plating (+HP Regeneration & Might)
- **8 Synergy Superweapons**: Max out a Level 8 weapon with its paired passive and open a Boss Data Vault to unlock:
  - *DN38416 Trench Sweeper* (360-degree incendiary flechette nova)
  - *Westinghouse M-95A1 Heavy Pulse* (Continuous piercing magenta plasma stream)
  - *Coltan Thermite Core Buster* (Cluster pipe bombs with white-hot thermite shockwaves)
  - *Zero-Point EMP Supernova* (Massive EMP vortex that strips armor and leeches HP)
  - *Resistance Perimeter Defense Ring* (6 hyper-velocity plasma-tethered orbitals)
  - *MM-1 Multi-Grenade Barrage* (360-degree carpet bombardment)
  - *Judgment Day Firestorm Wall* (Expanding ring of 3000K plasma fire)
  - *Skynet Orbital Ion Cannon* (Triple cascading orbital ion beams)

### 3. Skynet Threat Matrix
- **T-800 Cyberdyne Systems Model 101 Endoskeletons**: Dual-layer InstancedMesh rendering capable of holding 650+ active chrome skeletons with glowing red optical sensors at 60 FPS.
- **Hunter-Killer Aerial**: Supersonic patrol units strafing the battlefield with crimson plasma beams.
- **Hunter-Killer Goliath Tank**: Multi-track behemoths equipped with dual swivel turrets and twin sweeping volumetric searchlights.
- **T-1000 Mimetic Polyalloy Prototype**: Advanced liquid metal boss capable of liquid puddle repositioning, blade flurries, and nanite regeneration.

### 4. Controller, Mobile Native & PWA First
- **Xbox & Universal Gamepad Support**:
  - Auto-detects standard USB and Bluetooth gamepads.
  - Left stick 360-degree movement, right stick dedicated twin-stick aiming.
  - Smooth stick-release handling preserving last facing angle without snapping to mouse.
  - `Button B` (Circle) for combat dive / tactical dash; `Button A` (Cross) for modal confirmations.
  - Dual-rumble actuator haptics for low-frequency explosions and high-frequency firing/XP ticks.
- **Mobile Landscape PWA**:
  - Dedicated landscape orientation lock and immersive fullscreen prompt.
  - Installable PWA with offline caching via Workbox service worker.
  - Dual touch controls: left-side floating virtual joystick and right-side tactical dash button.
  - Native mobile vibration haptics (`navigator.vibrate`) on XP pickups, level-ups, and combat dive.
  - Responsive touch scrolling in Requisition & Boss Vault modals.

---

## 🕹️ Controls

| Platform | Action | Control |
| :--- | :--- | :--- |
| **Desktop Keyboard / Mouse** | Movement | `W`, `A`, `S`, `D` or Arrow Keys |
| **Desktop Keyboard / Mouse** | Aiming | Mouse cursor position |
| **Desktop Keyboard / Mouse** | Tactical Dash | `Space` or `Left Shift` |
| **Desktop Keyboard / Mouse** | Pause / Menu | `Escape` or `P` |
| **Xbox / Standard Gamepad** | Movement | Left Thumbstick or D-Pad |
| **Xbox / Standard Gamepad** | 360° Aiming | Right Thumbstick (retains angle on release) |
| **Xbox / Standard Gamepad** | Tactical Dash | `Button B` (East / Circle) |
| **Xbox / Standard Gamepad** | Select / Upgrade | `Button A` (South / Cross) |
| **Xbox / Standard Gamepad** | Pause / Menu | `Start` / `Menu` button |
| **Mobile PWA** | Movement | Virtual Touch Joystick (drag left half of screen) |
| **Mobile PWA** | Tactical Dash | Dedicated `DASH` button (bottom right) |

---

## 🛠️ Tech Stack & Architecture

- **Rendering Engine**: Three.js (WebGL 2.0 / PBR shaders / InstancedMesh)
- **Audio System**: Web Audio API (procedural synthesis) + HTML5 Audio (gapless music streaming & 56 SFX)
- **Spatial Partitioning**: Custom 2D Spatial Hash Grid ($O(1)$ collision checks across hundreds of units)
- **State Management**: Reactive deterministic game loop with fixed-timestep physics (60Hz) and lerped rendering
- **Input System**: Multi-device manager supporting Keyboard, Mouse, Virtual Touchscreen Joystick, and Standard Gamepad API with Dual-Rumble Haptics
- **Build System**: Vite 6 + TypeScript 5.7
- **PWA Tooling**: Vite Plugin PWA + Workbox (precache limit configured for high-fidelity assets)
- **Testing**:
  - Unit Tests: Vitest (combat math, spatial hashing, weapon evolutions, save manager, wave director)
  - E2E Tests: Playwright (desktop gameplay, mobile touch joystick, offline PWA verification)
- **CI / CD**: GitHub Actions workflow (`ci-deploy.yml`) with automated typechecking, unit tests, and Playwright execution
- **Deployment**: Vercel Edge (`terminator-survivors.vercel.app`) + GitHub Pages backup

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.0 or higher
- npm 9.0 or higher

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

- Built with tribute to James Cameron, Gale Anne Hurd, Brad Fiedel, and the creators of *The Terminator* franchise.
- Created for non-commercial educational and entertainment purposes.

*"There is no fate but what we make for ourselves."*
