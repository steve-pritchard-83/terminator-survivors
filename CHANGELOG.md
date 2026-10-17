# Changelog

All notable changes to the "Terminator Survivors: Los Angeles 2029 AD" project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.0] - 2026-10-18

### Added
- **Phase 10 Release Engineering**:
  - Global `ErrorReporter` and accessible `SYSTEM FAULT` crash overlay modal (`#system-fault-overlay`) with diagnostic clipboard export and local telemetry.
  - Automated bundle size checker (`scripts/check-bundle-size.mjs`) guarding production bundle budgets (< 450 KB initial JS).
  - Production code splitting and dynamic chunking via Rollup `manualChunks` (`three-vendor`, `stage-environments`, `codex`, `settings`).
  - Strict CI test coverage thresholds in Vitest v8 across `src/state` (80%), `src/systems` (60%), and `src/core` (70%).
  - Version watermark and build hash display (`v1.10.0`) on the Title Screen.
  - Comprehensive `CHANGELOG.md` detailing all roadmap phases.

## [1.9.0] - 2026-10-18

### Added
- **Phase 9 Audio & Visual Polish**:
  - Adaptive multi-track music system with dynamically crossfaded calm, combat, and boss layers.
  - WebAudio 3D spatial audio panning via `StereoPannerNode` and distance attenuation.
  - Dynamic `PointLight` budget pool (8 lights) with priority allocation for muzzle flashes, explosions, and plasma arcs.
  - Atmospheric particle effects including falling ash, volumetric sky lightning flashes, and pooled ground scorch decals (up to 64).
  - Multi-tier quality presets (Low, Medium, High, Ultra) with automatic hardware benchmark detection.
  - Procedural character and enemy animations: Kyle recoil and dash rolls, Endoskeleton hit stagger and knockback, HK Aerial bank tilt and thruster gimbaling.

## [1.8.0] - 2026-10-18

### Added
- **Phase 8 UX & Accessibility**:
  - Comprehensive Calibration & Settings Panel supporting volume sliders, screen shake, CRT scanlines, flash intensity, damage numbers, and UI scaling.
  - Rebindable input mapping for both keyboard and gamepad controllers with conflict detection and defaults reset.
  - WCAG AAA menu accessibility: full ARIA dialog roles, focus trapping, keyboard navigation, and `prefers-reduced-motion` compliance.
  - Interactive 60-second Tech-Com Boot Camp tutorial guiding new recruits through combat mechanics.
  - Quality of life features: auto-pause on window blur/controller disconnect, and Level-Up modal re-roll, scrap skip, and upgrade banish.
  - Modular internationalization scaffold (`src/i18n/en.ts`) with type-safe `t(key)` lookup.

## [1.7.0] - 2026-10-17

### Added
- **Phase 7 Meta-Progression & Archives**:
  - Tech-Com Bunker Requisition system with permanent alloy scrap upgrades and refund capability.
  - Operative loadout select (Kyle Reese, Resistance Scavenger, Tech-Com Veteran) with unique passive attributes and starting armaments.
  - Weapon evolutions (Plasma Minigun, Thermite Cluster, Neutron Disruptor) combining max-tier weapons and passive modules.
  - LocalStorage-backed Run History Archives recording mission outcomes, telemetry, loadouts, and kill statistics.
  - Tech-Com Intel Achievements system tracking 20 progressive milestones.

## [1.6.0] - 2026-10-17

### Added
- **Phase 6 Lore & Narrative**:
  - Tech-Com Codex bestiary documenting Skynet units, weapons, resistance lore, and intercepted machine transmissions.
  - Atmospheric 2029 A.D. Future War prologue narrative.

## [1.5.0] - 2026-10-17

### Added
- **Phase 5 Boss Encounters & Stages**:
  - Multi-phase boss encounters: Hunter-Killer Goliath with plasma sweeps and missile salvos, and the cybernetic T-800 Infiltrator.
  - Multi-stage environment progression across Sector 44, Downtown Los Angeles Ruins, and the Skynet Infiltration Core.
  - Stage transition logic with cinematic boss health bars and danger banners.

## [1.4.0] - 2026-10-17

### Added
- **Phase 4 Enemy Variety & Swarm AI**:
  - Expanded Skynet roster: T-800 Endoskeletons, HK Aerial drones, HK Ground Tanks, and crawling damaged units.
  - Swarm collision avoidance, flocking vectors, pathfinding, hit-flash shaders, and modular death debris pooling.

## [1.3.0] - 2026-10-17

### Added
- **Phase 3 Weapons & Arsenal**:
  - Phased Plasma Rifle (40W range), Pipe Bomb Clusters, Grenade Launcher, and Micro-Gun auto-fire weapons.
  - Passive modules: Titanium Plating, Micro-Fusion Battery, Radar Uplink, and Nanite Repair Kits.
  - Nearest-enemy auto-aim targeting system and dynamic bullet trajectory physics.

## [1.2.0] - 2026-10-17

### Added
- **Phase 2 Performance & Engine Architecture**:
  - Spatial hash grid partitioning for O(N) enemy and projectile collision queries.
  - Strict zero-allocation object pools for projectiles, particles, floating damage numbers, and enemies.
  - Stable 60 FPS performance optimizations targeting mobile WebGL runtimes.

## [1.1.0] - 2026-10-17

### Added
- **Phase 1 Core Combat & Survivors Loop**:
  - Top-down twin-stick / WASD character movement for Kyle Reese with combat dash roll.
  - Scrap collection, XP progression, level-up upgrade selections, and floating damage numbers.
  - Camera shake and combat impact feedback.

## [1.0.0] - 2026-10-16

### Added
- **Phase 0 Architecture & Prototype**:
  - Three.js WebGL rendering pipeline, basic terrain grid, and camera controls.
  - Vite build setup with PWA offline service worker and initial asset pipeline.
