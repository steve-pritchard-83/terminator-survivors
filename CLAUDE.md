# Terminator Survivors — Developer & Agent Guide

## 1. Quick Commands

- `npm run dev`: Launch local Vite development server
- `npm run build`: Compile TypeScript and bundle production PWA
- `npm run typecheck`: Run TypeScript compiler (`tsc --noEmit`) — the default check
- `npm run test:unit`: Run Vitest unit tests (pure logic only)
- `npm run test:e2e`: Run the single Playwright smoke test (rarely needed)
- `npm run lint` / `npm run format`: available, not required

## 2. Codebase Architecture (`src/`)

- `src/audio`: Web Audio API synthesis, SFX trigger library, and gapless background music streamer
- `src/core`: Game orchestrator, fixed 60Hz GameLoop, EventBus, and `window.__GAME_DEBUG__` interface
- `src/data`: Game balance data (weapons, passives, evolutions, meta-upgrades, wave schedule) — **all balance numbers live here**
- `src/graphics`: Three.js scene manager, camera, post-processing, procedural textures, and custom meshes
- `src/input`: Keyboard, mouse, virtual touch joystick, and standard Gamepad API with dual-rumble haptics
- `src/state`: RunState (in-run player stats & leveling math) and SaveManager (LocalStorage persistence)
- `src/systems`: Core gameplay systems: EnemySystem, PlayerSystem, WeaponSystem, PickupSystem, ParticleSystem
- `src/ui`: minimal HUD (health, XP, timer, boss bar/alert), icons (`src/ui/icons`: edit `iconMap.ts`, then `npm run build:icons`), Tactical CSM-101 HUD, TitleScreen, BunkerRequisition, LevelUpModal, VaultJackpotModal, PauseModal

## 3. Debug API (`window.__GAME_DEBUG__`)

Exposed during gameplay on `window.__GAME_DEBUG__` for testing and Playwright specs:

- `getState()`: Returns live run state (`mode`, `hp`, `xp`, `weapons`, `passives`, `playerPos`, `activeEnemies`, `revivalsLeft`, `invulnerabilityTimer`, etc.)
- `grantXp(amount)`: Adds XP directly to test level-up triggers
- `spawnBoss(archetype)`: Spawns specific boss archetype (`hk_aerial_squadron_leader`, `hk_tank_goliath`, `t1000_prototype`, etc.)
- `spawnSwarm(archetype, count)`: Spawns swarm of enemies around player
- `getPerf()`: Returns performance telemetry (FPS, frame time, draw calls, geometries, textures, heap)
- `triggerVault()`: Spawns a Boss Data Vault directly at player position
- `fastForward(seconds)`: Fast-forwards run clock
- `setGodMode(enabled)`: Toggles player invulnerability
- `togglePause()`, `pauseGame()`, `resumeGame()`: Pause flow controls
- `getSceneCensus()`: Returns scene counts: `{ enemyGroupChildren, weaponGroupChildren, pickupGroupChildren, fuelDrums, cars, obstacleColliders, visibleLights }`
- `getRuntimeSettings()`: Returns live runtime settings: `{ shakeScale, flashScale, hitStopEnabled, damageNumbersMode, qualityPreset, pixelRatio, lightsEnabled, keyBindings, bodyClasses }`
- `getSave()`: Returns deep clone of `SaveManager.getData()`
- `damageEnemy(target, amount, crit)`: Deals damage to enemy/boss/drum through `WeaponSystem.applyDamageToTarget`
- `killAllEnemies()`: Eliminates all active enemies via `damageEnemy`
- `setPlayerHp(hp)`: Sets player current HP
- `startRunWith(config)`: Launches run with custom `RunConfig` (`loadoutId`, `seed`)

## 4. Working Rules (keep it cheap)

Read only the files the task touches. Do not explore the repo or run the full test suite to "be safe".

1. **Verify with `npm run typecheck`.** Run `npm run test:unit` only when you changed code covered by a test in `tests/unit/` (state, save, RNG, spatial hash, wave director, combat math). Do not run `test:e2e` or `build` unless asked.
2. **Tests:** add a unit test only for pure logic (math, state, save migration, determinism). Do not write tests for rendering, UI, audio or Three.js wiring.
3. **Commits:** commit when something works, with a plain message. No task-ID format, no CHANGELOG or README edits unless a user-visible claim became false.
4. **Style:** 2-space indent, single quotes, semicolons, `import type`. No new runtime dependencies.
5. **Never remove or break `window.__GAME_DEBUG__`.** Keep `playwright` smoke test working.
6. **Data over code:** balance numbers belong in `src/data/*.ts`.
7. **Three.js:** dispose per-entity geometries/materials on removal, or use shared ones.
8. **Randomness:** `globalRNG` for gameplay, `vfxRNG` for cosmetics; no `Math.random()` in `src/systems` or `src/state`.
