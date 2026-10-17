# Terminator Survivors — Developer & Agent Guide

## 1. Quick Commands
- `npm run dev`: Launch local Vite development server
- `npm run build`: Compile TypeScript and bundle production PWA
- `npm run typecheck`: Run TypeScript compiler (`tsc --noEmit`)
- `npm run test:unit`: Run Vitest unit tests
- `npm run test:e2e`: Run Playwright end-to-end tests

## 2. Codebase Architecture (`src/`)
- `src/audio`: Web Audio API synthesis, SFX trigger library, and gapless background music streamer
- `src/core`: Game orchestrator, fixed 60Hz GameLoop, EventBus, and `window.__GAME_DEBUG__` interface
- `src/data`: Game balance data (weapons, passives, evolutions, meta-upgrades, wave schedule) — **all balance numbers live here**
- `src/graphics`: Three.js scene manager, camera, post-processing, procedural textures, and custom meshes
- `src/input`: Keyboard, mouse, virtual touch joystick, and standard Gamepad API with dual-rumble haptics
- `src/state`: RunState (in-run player stats & leveling math) and SaveManager (LocalStorage persistence)
- `src/systems`: Core gameplay systems: EnemySystem, PlayerSystem, WeaponSystem, PickupSystem, ParticleSystem
- `src/ui`: Tactical CSM-101 HUD, TitleScreen, BunkerRequisition, LevelUpModal, VaultJackpotModal, PauseModal

## 3. Debug API (`window.__GAME_DEBUG__`)
Exposed during gameplay on `window.__GAME_DEBUG__` for testing and Playwright specs:
- `getState()`: Returns live run state (`mode`, `hp`, `xp`, `weapons`, `passives`, `playerPos`, `activeEnemies`, etc.)
- `grantXp(amount)`: Adds XP directly to test level-up triggers
- `spawnBoss(archetype)`: Spawns specific boss archetype (`hk_aerial_squadron_leader`, `hk_tank_goliath`, `t1000_prototype`, etc.)
- `triggerVault()`: Spawns a Boss Data Vault directly at player position
- `fastForward(seconds)`: Fast-forwards run clock
- `killAllEnemies()`: Clears active enemies
- `setGodMode(enabled)`: Toggles player invulnerability

## 4. Working Rules for Agents (from `roadmap.md`)
1. **One task = one commit.** Format: `<type>(<area>): <task-id> <short summary>` (e.g. `fix(run): P1-02 stop revivals refilling on passive pick`).
2. **Before starting a task**, read every file listed under *Files*. Do not edit unlisted files without justification.
3. **Verification loop after every task:**
   - `npm run typecheck`
   - `npm run test:unit`
   - Run `npm run build` and `npm run test:e2e` at the end of each phase.
4. **Unit test required for every bug fix:** Add a test in `tests/unit/` named after the task ID in the `describe` (e.g. `describe('P1-02 revivals', ...)`).
5. **Coding style:** 2-space indent, single quotes, semicolons, explicit `public`/`private`/`readonly`, typed imports (`import type`). No new runtime dependencies unless specified.
6. **Never remove or break `window.__GAME_DEBUG__`** — Playwright tests rely on it.
7. **Data over code:** Balance numbers belong in `src/data/*.ts`, never hardcoded in systems.
8. **Three.js hygiene:** Per-entity geometries/materials must be disposed on removal or use shared/pooled instances.
9. **Randomness:** Use `globalRNG` for gameplay and `vfxRNG` for cosmetics. Avoid `Math.random()` in `src/systems` or `src/state`.
10. **Definition of Done:** Acceptance criteria met, tests pass, zero regressions, no undisposed GPU resources, documentation updated.
