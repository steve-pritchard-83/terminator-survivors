# TERMINATOR SURVIVORS: 2029 A.D.
### A 3D WebGL / PWA Vampire Survivors Experience starring Kyle Reese

[![CI/CD Deployment](https://github.com/steve-pritchard-83/terminator-survivors/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/steve-pritchard-83/terminator-survivors/actions)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25%20Offline-00e5ff.svg)](https://github.com/steve-pritchard-83/terminator-survivors)
[![Three.js](https://img.shields.io/badge/Graphics-Three.js%20PBR-e61919.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.7-3178c6.svg)](https://www.typescriptlang.org/)

> *"The machines rose from the ashes of the nuclear fire. Their war to exterminate mankind had raged for decades, but the final battle would not be fought in the future. It would be fought here, in our present. Tonight."*  
> — **Kyle Reese, Sergeant Tech-Com, DN38416**

---

## 💀 Overview

**Terminator Survivors: 2029 A.D.** is a high-octane 3D browser game inspired by *Vampire Survivors*, meticulously crafted to recreate the grim, cobalt-blue night battlefield of the Future War from James Cameron’s *The Terminator* (1984) and *Terminator 2: Judgment Day* (1991).

You play as **Kyle Reese** (Tech-Com Sergeant DN38416), fighting desperately across the ruined wasteland of Los Angeles in the year 2029. Survive swarms of chrome T-800 Endoskeletons, evading airborne Hunter-Killer searchlights and titan Hunter-Killer Tanks until John Connor’s final bunker breach.

Available anywhere on desktop and mobile, with full progressive web app (PWA) offline capability.

---

## 🎮 Features

### 1. Authentic Cameron Future War Aesthetic
- **Procedural PBR 3D Graphics**: Built from the ground up in `Three.js` with custom metallic chrome shaders, volumetric searchlight cones with soft edge falloff, red scanning lasers, destroyed rebar highway pillars, crushed car chassis, and miles of human skull fields.
- **Cinematic Post-Processing**: Unreal bloom, cobalt-blue color grading, film grain, and an authentic red CRT scanline overlay simulating Skynet terminal telemetries.
- **Faithful Typography & Audio**:
  - Incorporates the authentic `Terminator Real NFI` font alongside tactical Rajdhani and 6502 assembly telemetry fonts.
  - Features Brad Fiedel’s iconic looped future war score (`backgroundmusic.mp3`) with seamless looping audio graph.
  - Procedural Web Audio API sound synthesizer producing metallic anvil clanks, phased plasma bolts, HK jet turbine whooshes, optical servo whines, and EMP blasts with zero external audio assets.

### 2. Deep Survivor Combat & Arsenal
- **6 Base Weapons**:
  - **Ithaca 37 Shotgun**: 12-gauge close-quarters buckshot.
  - **M-25 Phased Plasma Rifle**: Rapid purple plasma bolts in the 40-watt range.
  - **Improvised Pipe Bomb**: High-explosive cylindrical charges thrown at clusters.
  - **Thermite Charge**: Incendiary canister igniting persistent ground infernos.
  - **General Dynamics RBS-80**: Heavy tripod-mounted phased plasma cannon.
  - **Tech-Com Microgun**: Multi-barrel ballistic lead storm.
- **6 Tactical Passives**:
  - Trench Coat Pockets (Speed & Dash Cooldown)
  - Military Webbing (Projectile Amount)
  - John Connor’s Polaroids (Damage Multiplier)
  - Titanium Rebar Armor (Flat Damage Reduction)
  - Tech-Com Scanner (Magnet Radius)
  - Laser Aiming Module (Critical Strike Chance)
- **6 Synergy Superweapons**: Max out a Level 8 weapon with its paired passive to unlock devastating military overhauls:
  - *Trench Sweeper* (Dual combat dragonsbreath)
  - *M95A1 Phased Pulse System* (Piercing hyper-plasma)
  - *Seismic Breaching Charge* (Screen-shattering shockwave)
  - *Thermite Buster* (White-hot apocalyptic inferno)
  - *RBS-80 Dual Pulse Battery* (Alternating twin heavy beams)
  - *Phased Microgun Vulkan* (High-cyclic plasma minigun)

### 3. Skynet Threat Matrix
- **T-800 Cyberdyne Systems Model 101 Endoskeletons**: Dual-layer InstancedMesh rendering capable of holding 650+ active chrome skeletons with glowing red optical sensors at 60 FPS.
- **Hunter-Killer Aerial**: Supersonic patrol units strafing the battlefield with crimson plasma beams.
- **Hunter-Killer Goliath Tank**: Multi-track behemoths equipped with dual swivel turrets and twin sweeping volumetric searchlights.
- **T-1000 Mimetic Polyalloy Prototype**: Advanced liquid metal boss capable of liquid puddle repositioning, blade flurries, and nanite regeneration.

### 4. PWA & Mobile Native First
- **Offline First**: Precaches all assets, fonts, and audio via Workbox service worker. Play completely disconnected from the internet.
- **Touch Virtual Joystick**: Fluid thumb-drag navigation on mobile viewports with dedicated **Tactical Dash** button.
- **Keyboard / Gamepad**: Smooth desktop WASD / Arrow movement and Spacebar combat dive.
- **T-800 CSM-101 Optical HUD**: Red tactical readouts, 6502 assembly ticker logs, boss health meters, and CRT scanlines.

---

## 🕹️ Controls

| Platform | Action | Control |
| :--- | :--- | :--- |
| **Desktop** | Movement | `W`, `A`, `S`, `D` or Arrow Keys |
| **Desktop** | Tactical Dash | `Space` or `Left Shift` |
| **Mobile** | Movement | Virtual Touch Joystick (drag left half of screen) |
| **Mobile** | Tactical Dash | Dedicated `DASH` button (bottom right) |

---

## 🛠️ Tech Stack & Architecture

- **Rendering Engine**: Three.js (WebGL 2.0 / PBR shaders / InstancedMesh)
- **Audio System**: Web Audio API (procedural synthesis) + HTML5 Audio (gapless music streaming)
- **Spatial Partitioning**: Custom 2D Spatial Hash Grid ($O(1)$ collision checks across hundreds of units)
- **State Management**: Reactive deterministic game loop with fixed-timestep physics (60Hz) and lerped rendering
- **Build System**: Vite 6 + TypeScript 5.7
- **PWA Tooling**: Vite Plugin PWA + Workbox (precache limit configured for high-fidelity assets)
- **Testing**:
  - Unit Tests: Vitest (combat math, spatial hashing, weapon evolutions, save manager, wave director)
  - E2E Tests: Playwright (desktop gameplay, mobile touch joystick, offline PWA verification)
- **CI / CD**: GitHub Actions workflow (`ci-deploy.yml`) with automated typechecking, unit tests, and Playwright execution

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
Stage fonts and music, compile TypeScript, and bundle production assets:
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
