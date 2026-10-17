# Terminator Survivors — Audit & Roadmap

> **Audience:** this file is written to be handed to an implementation agent (including a smaller LLM) one phase at a time. Every task names the files to touch, the exact change, and how to prove it is done. Read **Section 3 (Working Rules)** before starting any task.

Audit date: 2026-10-17 · Commit audited: `421acc4` · Size: ~10.4k lines TypeScript (`src/`), 8 unit test files (40 tests, all passing), 3 Playwright specs.

---

## 1. Audit Scorecard

| #   | Category                         |    Score     | Summary                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------- | :----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Architecture & code organisation | **6.5 / 10** | Clean folder split (core / systems / graphics / ui / data), typed event bus, data-driven weapons/enemies/waves. But `EnemySystem` and `WeaponSystem` are big `if/switch` ladders keyed on string IDs, `Game.ts` is a god object, and pause state is tracked twice (`isPaused` + `runState.mode`).                                             |
| 2   | Correctness                      |  **5 / 10**  | Several real gameplay bugs (Section 2.1): death can fire `endRun` multiple times in one frame, revivals refill on every passive pick, multi-level XP is dropped, level-up can re-trigger while the modal is open, drone damage ignores Might and weapon stats.                                                                                |
| 3   | Performance & memory             | **5.5 / 10** | Good: instanced endoskeletons, spatial hash, particle pool. Bad: a new `THREE.Mesh` per bullet/pellet/XP gem, per-boss meshes never `dispose()`d (GPU leak across runs), one DOM node + `setTimeout` per damage number, pixel-ratio governor does not resize the post-processing composer.                                                    |
| 4   | Gameplay depth & content         |  **5 / 10**  | 8 weapons / 8 passives / 8 evolutions / 10 enemy types / 1 map / 10-minute run. Boss "abilities" in the README (T-1000 puddle teleport, blade flurries, regen) are visual-only — not implemented. Weapon level descriptions do not match the generic stat formula. Only one stage.                                                            |
| 5   | Game feel ("juice")              |  **6 / 10**  | Screen shake, hit flash, bloom, damage flash, dash afterimage, combo pitch on pickups are present. Missing: knockback (promised in text), hit-stop, enemy death debris, low-HP feedback, readable telegraphs for most attacks.                                                                                                                |
| 6   | Presentation (art & audio)       |  **7 / 10**  | Strong procedural Three.js look, chunked endless environment, volumetric searchlights, real SFX library, gapless music. No music intensity layering, no voice limiting, all SFX at same spatial position.                                                                                                                                     |
| 7   | UX & accessibility               | **3.5 / 10** | Zero ARIA roles/labels, no reduced-motion / screen-shake / flash toggles, no key remapping, no colour-blind support, no first-run tutorial, no pause-on-blur. Gamepad and touch support are good.                                                                                                                                             |
| 8   | Testing & CI                     |  **6 / 10**  | Typecheck + Vitest + Playwright (desktop, mobile, offline) in CI. No lint, no coverage gate, no tests for the bugs above, no performance budget test.                                                                                                                                                                                         |
| 9   | Documentation accuracy           |  **5 / 10**  | README is polished but over-claims (fixed-timestep "lerped rendering" — `alpha` is ignored; T-1000 abilities; "heavy knockback"). No CLAUDE.md / contributor guide.                                                                                                                                                                           |
| 10  | Asset & IP hygiene               |  **2 / 10**  | Music described as Brad Fiedel's score, a third-party "Terminator" font, and SFX files whose names suggest they were extracted from other commercial games (`Frogger_Error.wav`, `S_DetectiveMode*.wav`, `S_HUD_Infiltrator_*.wav`). No provenance or licence record exists. This is the single biggest risk to publishing the game publicly. |

### Overall: **52 / 100**

A solid, playable vertical slice with good technical bones. To be "the best Terminator game available" it needs: (1) bugs and leaks fixed, (2) a scalable architecture for enemies/weapons, (3) 3–5× more content with real boss mechanics, (4) proper game feel, accessibility and meta-progression, and (5) a clean asset-provenance story.

---

## 2. Detailed Findings (referenced by task IDs later)

### 2.1 Correctness bugs

| ID  | File:line                                                         | Bug                                                                                                                                                                                                                 | Impact                                                                                                        |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| B1  | `src/core/Game.ts:167-181`, `src/systems/EnemySystem.ts:304-314`  | `player:damaged` is emitted for every hit. Once `hp` hits 0, `takeDamage` still returns ≥1 (mitigation floors at 1), so every further hit in the same frame calls `endRun(false)` again.                            | Duplicate `addRunResults` → scrap/kills counted multiple times; end modal re-shown.                           |
| B2  | `src/state/RunState.ts:152`                                       | `revivalsLeft = Math.max(revivalsLeft, base.revivals)` runs on every `recalculateStats()` (i.e. every passive pick).                                                                                                | Used revivals are silently refilled. Also `initRun` never resets `revivalsLeft`, so state leaks between runs. |
| B3  | `src/state/RunState.ts:161-171`                                   | `addXp` levels up at most once per call even if XP exceeds several thresholds.                                                                                                                                      | Big XP drops (bosses give 180–1500 XP) waste levels or cause a chain of single level-ups on later pickups.    |
| B4  | `src/systems/PickupSystem.ts:121-160`, `src/core/Game.ts:200-211` | Pickup loop keeps collecting after a level-up in the same frame; a second `levelup:triggered` replaces the open modal's callback.                                                                                   | Lost upgrade choices; modal state confusion.                                                                  |
| B5  | `src/systems/WeaponSystem.ts:575`                                 | Seeker drone / Perimeter Ring damage is hard-coded (`18 + level*4`, `48`), ignores `mightMultiplier`, weapon level table and crit design; applied every fixed tick (60×/s) producing 60 damage numbers/s per enemy. | Balance broken; floating-text spam.                                                                           |
| B6  | `src/systems/WeaponSystem.ts:363`                                 | Orbital Ion fires a hard-coded 3 strikes, ignoring `amount` and `bonusAmount`. Laser Designator targets the same `nearest` enemy for every strike.                                                                  | Passives that add projectiles do nothing; strikes stack on one target.                                        |
| B7  | `src/systems/PickupSystem.ts:179-191`                             | Boss vault without an evolution applies `choices[0]` of a random shuffle 3× — includes medkit/scrap filler and never shows the player what they got.                                                                | Feels random/unrewarding.                                                                                     |
| B8  | `src/graphics/SceneManager.ts:136-142`                            | `adjustQuality` calls `renderer.setPixelRatio` but never resizes the `EffectComposer`/bloom targets; can also oscillate between 1.0 and 1.5 every 0.5 s.                                                            | Blurry/mismatched post-processing, frame hitches.                                                             |
| B9  | `src/core/Game.ts:420-422`, `src/core/GameLoop.ts`                | `render(alpha)` ignores `alpha`; camera is moved in `fixedUpdate`.                                                                                                                                                  | Judder on 120/144 Hz displays; README claim is false.                                                         |
| B10 | `src/core/RNG.ts`, multiple files                                 | `globalRNG` is never reseeded per run, and 50 call-sites use `Math.random()` anyway.                                                                                                                                | No reproducible runs; blocks daily-seed mode and deterministic tests.                                         |
| B11 | `src/systems/EnemySystem.ts:483-527`                              | Boss/HK/T-1000/Infiltrator/Core meshes and cloned reticle materials are removed but never `dispose()`d. Same for pickup meshes, enemy bolts and transient VFX (`WeaponSystem.ts:133-136`).                          | GPU memory grows every run.                                                                                   |
| B12 | `src/core/Game.ts:258-286`                                        | `endRun` can be called while a level-up/vault modal is open (e.g. napalm kills the Core).                                                                                                                           | Overlapping modals.                                                                                           |
| B13 | `src/systems/EnemySystem.ts:265-271`                              | Contact damage cooldown only decrements while in contact; an enemy that touches, leaves, and returns hits instantly. Minor.                                                                                         | Spiky damage.                                                                                                 |
| B14 | `src/graphics/SceneManager.ts:116-128`                            | `worldToScreen` reuses `tempTarget`, the vector also used by `updateCamera`. Works by accident today.                                                                                                               | Fragile; will break if call order changes.                                                                    |

### 2.2 Performance hot spots

- P1: `new THREE.Mesh(...)` per pellet/bolt/bomb (`WeaponSystem.ts:175,200,222,248,276,326`) and per enemy bolt (`EnemySystem.ts:163`). Needs pooling or `InstancedMesh`.
- P2: One `Object3D` per XP gem (`PickupSystem.ts:57-73`), no merging; late-game produces hundreds of gems.
- P3: One DOM element + `setTimeout` per damage number (`HUDView.ts:239-250`), fired on every hit.
- P4: `grid.queryRadius` (`SpatialHashGrid.ts:43`) accepts an optional out-array but no caller passes one, and it allocates a new `Set` for de-duplication on every call — hundreds of times per tick.
- P5: No audio voice cap — 300 simultaneous `playEndoHit()` calls are possible in one frame.
- P6: Enemies never despawn/relocate when far behind the player; `minEnemies` cap is reached by stragglers.

### 2.3 Content and design gaps

- Only one stage, one 10-minute run, no endless mode.
- Bosses have one attack each (or none — T-1000 only changes visuals).
- No elite/affix enemies, no enemy formations, no environmental hazards.
- Loadouts differ only by starting weapon + small stat bonus.
- No achievements, codex/bestiary, run history, difficulty tiers, or daily challenge.

---

## 3. Working Rules for the Implementing Agent

Follow these on **every** task. They exist so a smaller model can work safely.

1. **One task = one commit.** Commit message format: `<type>(<area>): <task-id> <short summary>` e.g. `fix(run): P1-02 stop revivals refilling on passive pick`. Types: `fix`, `feat`, `perf`, `refactor`, `test`, `docs`, `chore`.
2. **Before starting a task**, read every file listed under _Files_. Do not edit files not listed unless the task says "and any callers"; if you must, explain why in the commit body.
3. **After every task run, in order:**
   ```bash
   npm run typecheck
   ```
   ```bash
   npm run test:unit
   ```
   Run `npm run build` and `npm run test:e2e` at the end of each phase (they are slower).
   All must pass. If an existing test breaks because behaviour intentionally changed, update the test and say so in the commit body.
4. **Every bug fix needs a unit test** in `tests/unit/` that fails before the fix and passes after. Name it after the task ID in the `describe` (e.g. `describe('P1-02 revivals', ...)`).
5. **Match the existing style:** 2-space indent, single quotes, semicolons, `public`/`private` modifiers on class members, `readonly` where possible, typed imports with `import type`. No new runtime dependencies without the task saying so.
6. **Never** remove the `window.__GAME_DEBUG__` API (Playwright depends on it) — only extend it.
7. **Data over code:** balance numbers belong in `src/data/*.ts`, not inline in systems.
8. **Three.js hygiene:** any `Geometry`, `Material` or `Texture` created per-entity must be disposed when the entity is removed, or must come from a shared/pooled instance.
9. **Randomness:** after Phase 1, use `globalRNG` (gameplay) or a separate `vfxRNG` (cosmetic). Do not add new `Math.random()` calls in `src/systems` or `src/state`.
10. If a task is ambiguous, implement the smallest version that satisfies the _Acceptance criteria_ and leave a `// TODO(roadmap <task-id>):` comment describing what was skipped.
11. **Wiring over existence (added after the Phase 0–10 audit).** A feature is only done when a player can reach it and it changes the running game. A test that emits a domain event by hand (`globalEvents.emit('boss:defeated', …)`), greps a source/config file, asserts a line count, or mocks the system under test does **not** prove a feature. See Phase 11 "Wiring test" definition.
12. **Never claim more than you shipped.** Commit messages, `CHANGELOG.md` and `README.md` must describe what the code does today. If you implemented a smaller version, say so and leave the `TODO(roadmap …)` comment.

### Definition of Done (every task)

- [ ] Acceptance criteria met.
- [ ] Typecheck and unit tests pass.
- [ ] New/changed behaviour covered by a test (or the task states why not, e.g. purely visual).
- [ ] No new `Math.random()` in gameplay code, no undisposed per-entity GPU resources.
- [ ] README updated if a user-visible feature or control changed.

---

## 4. Phase Overview

| Phase | Theme                          | Goal                                                                              | Est. size |
| ----: | ------------------------------ | --------------------------------------------------------------------------------- | --------- |
|     0 | Foundations & asset provenance | Make the project safe to publish and easy for agents to work in                   | S         |
|     1 | Correctness                    | Fix every bug in 2.1 with regression tests                                        | M         |
|     2 | Performance                    | Hold 60 FPS with 600 enemies on a mid-range laptop; no memory growth across runs  | M         |
|     3 | Architecture                   | Registries for enemies/weapons, state machine, split `Game.ts`                    | L         |
|     4 | Game feel                      | Knockback, hit-stop, telegraphs, death debris, low-HP feedback                    | M         |
|     5 | Combat content                 | Real boss fights, elites, new enemies and weapons                                 | L         |
|     6 | Stages & modes                 | 3 new stages, endless mode, daily seeded run, threat levels                       | L         |
|     7 | Meta-progression               | Achievements, codex, run history, deeper loadouts                                 | M         |
|     8 | UX & accessibility             | Menus, settings, remapping, tutorial, a11y                                        | M         |
|     9 | Audio & visual polish          | Adaptive music, voice limiting, lighting, weather                                 | M         |
|    10 | Release engineering            | Lint, coverage, perf budget, telemetry, versioning                                | S         |
|    11 | Integration & honesty pass     | Fix regressions from Phases 1–10, wire unreachable features, replace hollow tests | L         |

Phases 0–3 must be done in order. Phases 4–9 may be done in any order after Phase 3. Phase 10 tasks can be pulled forward at any time. **Phase 11 must be completed before any new feature work**; within it, follow the group order given in the phase.

---

## Phase 0 — Foundations & Asset Provenance

### P0-01 Add `CLAUDE.md` agent guide

- **Files:** new `CLAUDE.md`.
- **Steps:** Document: commands (`dev`, `build`, `typecheck`, `test:unit`, `test:e2e`); folder map (one line per folder in `src/`); the Working Rules from Section 3 (copy them); the debug API (`window.__GAME_DEBUG__`) and what it is for; "balance lives in `src/data`".
- **Acceptance:** File exists, < 150 lines, every command listed actually runs.

### P0-02 Asset provenance register

- **Files:** new `ASSETS.md`.
- **Steps:**
  1. Create a table with one row per file in `public/audio`, `public/fonts`, `public/icons`: `path | source | author | licence | proof link | status`.
  2. Fill `status` as `OK` (original or licence confirmed), `UNKNOWN`, or `REPLACE`.
  3. Mark as `REPLACE` anything whose name or description indicates it came from a commercial game or film (e.g. `Frogger_Error.wav`, `S_DetectiveMode*.wav`, `S_HUD_Infiltrator_*.wav`, the film score in `backgroundmusic.mp3`) unless the project owner provides a licence.
- **Acceptance:** Every file in `public/` (except `robots.txt`) has a row. **A human must review this file** — the agent must not guess licences; use `UNKNOWN` when unsure.

### P0-03 Replace non-cleared assets

- **Depends on:** P0-02 reviewed by a human.
- **Files:** `public/audio/**`, `public/fonts/**`, `src/audio/AudioEngine.ts` (sample map), `src/style.css` (font-face), `README.md`.
- **Steps:** For each `REPLACE` row, substitute a CC0/CC-BY asset (e.g. from freesound.org, opengameart.org, kenney.nl) **chosen by the human owner** or a procedurally synthesised Web Audio version (the engine already synthesises several sounds — reuse that pattern). Keep the sample key names in `AudioEngine.ts` unchanged so call-sites do not change. Update `ASSETS.md`.
- **Acceptance:** No `REPLACE` rows remain; game still plays every sound; README no longer claims the film score is included.
- **Note for owner:** the game uses the _Terminator_ name and characters. That is fine for a free, non-commercial fan project, but it cannot be sold or monetised without a licence from the rights holder. Add a short fan-project disclaimer to the title screen footer and README.

### P0-04 Correct the README

- **Files:** `README.md`.
- **Steps:** Remove or mark "planned" for: lerped rendering, T-1000 puddle/blade/regen abilities, "heavy knockback", "650+ at 60 FPS" (until Phase 2 proves it). Add a "Roadmap" link to this file.
- **Acceptance:** Every feature claim in the README can be pointed to in code.

### P0-05 Lint & format baseline

- **Files:** `package.json`, new `eslint.config.js`, new `.prettierrc`.
- **Steps:** Add dev deps `eslint`, `typescript-eslint`, `prettier`, `eslint-config-prettier`. Rules: `no-restricted-syntax` banning `Math.random` in `src/systems/**` and `src/state/**` (warn for now, error after P1-08). Add scripts `lint` and `format`. Run `format` once and commit separately as `chore: P0-05 apply prettier`.
- **Acceptance:** `npm run lint` exits 0 (warnings allowed). CI runs lint (edit `.github/workflows/ci-deploy.yml`, add step after typecheck).

---

## Phase 1 — Correctness

All tasks need a regression unit test. Use the existing `tests/unit/*.test.ts` patterns (Vitest + jsdom).

### P1-01 Single, guarded player death (fixes B1, B12)

- **Files:** `src/state/RunState.ts`, `src/core/Game.ts`, `src/systems/EnemySystem.ts`, `src/core/EventBus.ts`.
- **Steps:**
  1. In `RunState.takeDamage`, return `0` immediately if `this.hp <= 0` or `this.mode !== 'playing'`.
  2. Move the death/revive decision out of the `player:damaged` listener into a new `RunState.resolveLethalDamage(): 'revived' | 'dead' | 'alive'`, called from `Game.fixedUpdate` **once per tick** after systems update.
  3. Emit the (already declared) `player:revived` / `player:died` events from `Game`.
  4. In `endRun`, early-return if `mode` is already `'gameover'` or `'victory'`; close any open level-up/vault modal first (add `hide()` calls).
- **Test:** Simulate 5 hits of 999 damage in one tick → `addRunResults` called exactly once (spy on `SaveManager`).
- **Acceptance:** Dying under a swarm records one result; Core kill while a modal is open shows only the victory modal.

### P1-02 Revivals do not refill (fixes B2)

- **Files:** `src/state/RunState.ts`.
- **Steps:** In `initRun`, set `revivalsLeft = 0` before `recalculateStats()`, then after it set `revivalsLeft = computedStats.revivals`. Remove the `Math.max` line from `recalculateStats`; instead, if a passive increases `computedStats.revivals`, add only the _delta_ to `revivalsLeft`.
- **Test:** Init with 1 revival → consume it → apply a passive → `revivalsLeft === 0`.

### P1-03 Multi-level XP (fixes B3)

- **Files:** `src/state/RunState.ts`, `src/systems/PickupSystem.ts`, `src/core/Game.ts`, `src/core/types.ts`.
- **Steps:**
  1. Change `addXp` to return the number of levels gained (`number`), looping while `xp >= xpToNext`.
  2. Add `pendingLevelUps: number` to `RunState` (reset in `initRun`).
  3. In `Game`, when a level-up modal closes and `pendingLevelUps > 0`, decrement and open the next modal immediately.
  4. Update the debug API `grantXp` accordingly.
- **Test:** `addXp(10_000)` at level 1 returns > 5 and leaves `xp < xpToNext`.

### P1-04 Freeze pickups while a modal is open (fixes B4)

- **Files:** `src/systems/PickupSystem.ts`.
- **Steps:** In `update`, `break` the loop as soon as `runState.mode !== 'playing'`. In `collectPickup` for cores, increment `runState.pendingLevelUps` instead of emitting directly; `Game` owns emitting `levelup:triggered` (one at a time).
- **Test:** Two cores worth a level each collected in one tick → one modal open, `pendingLevelUps === 1`.

### P1-05 Drone & orbital damage use weapon data (fixes B5, B6)

- **Files:** `src/data/weapons.ts`, `src/systems/WeaponSystem.ts`.
- **Steps:**
  1. Drones: read `damage`, `amount`, `area`, `speed` from the slot's level stats; apply `mightMultiplier`; count = `stats.amount + bonusAmount` (cap 8).
  2. Replace per-tick damage with a per-enemy hit cooldown (`Map<enemyId, number>`, 0.35 s) so each drone hit deals full `damage` once per cooldown.
  3. Orbital Ion / Laser Designator: `count = stats.amount + bonusAmount`; pick distinct targets (nearest N via a new `grid.findNearestN`), fall back to random positions.
- **Test:** With `mightMultiplier = 2`, a drone hit deals 2× level damage; orbital strike count increases with `bonusAmount`.

### P1-06 Weapon level text matches stats

- **Files:** `src/data/weapons.ts`, `src/ui/LevelUpModal.ts`.
- **Steps:** Replace the hand-written per-level strings with an auto-generated diff line (e.g. `"+22% DMG · +1 PELLET · -6% CD"`) computed from `levels[n]` vs `levels[n-1]`. Keep the level-1 flavour description.
- **Test:** For every base weapon, every level-up description mentions each stat that changed.

### P1-07 Boss vault shows a real choice (fixes B7)

- **Files:** `src/systems/PickupSystem.ts`, `src/ui/VaultJackpotModal.ts`, `src/core/Game.ts`.
- **Steps:** If no evolution is available, emit a level-up flow with 3 picks in a row (reuse `pendingLevelUps += 3`) after the vault modal closes, instead of auto-applying `choices[0]`. Vault modal text says "3 REQUISITIONS AUTHORISED".
- **Acceptance:** Player chooses all vault rewards; no medkit/scrap unless the pool is empty.

### P1-08 Seeded RNG everywhere (fixes B10)

- **Files:** `src/core/RNG.ts`, `src/core/Game.ts`, all files listed by `grep -rn "Math.random" src/systems src/state`.
- **Steps:**
  1. Export `vfxRNG = new RNG(…)` for cosmetic randomness.
  2. In `startRun`, `globalRNG.setSeed(seed)` where `seed` is `Date.now() >>> 0` unless a seed is passed (Phase 6 daily run).
  3. Replace `Math.random()` in `src/systems/*` and `src/state/*` with `globalRNG` (gameplay: crits, drops, spread) or `vfxRNG` (particles).
  4. Store `seed` on `RunState` and show it on the end-run modal.
  5. Change the ESLint rule from P0-05 to `error`.
- **Test:** Two runs with the same seed and same simulated inputs for 600 ticks produce identical `kills`, `hp`, enemy positions.

### P1-09 Render interpolation & camera on render (fixes B9, B14)

- **Files:** `src/core/Game.ts`, `src/graphics/SceneManager.ts`, `src/systems/PlayerSystem.ts`.
- **Steps:** Store `prevPlayerPos` each fixed tick; in `render(alpha)` set the player mesh and camera target to `lerp(prev, current, alpha)`. Move `updateCamera` into `render` using real frame `dt`. Give `worldToScreen` its own scratch vector.
- **Acceptance:** On a 144 Hz monitor the player and camera move smoothly (manual check); unit test asserts `worldToScreen` does not mutate the camera target.

### P1-10 Quality governor fix (fixes B8)

- **Files:** `src/graphics/SceneManager.ts`, `src/graphics/PostProcessing.ts`.
- **Steps:** After `setPixelRatio`, call `postProcessing.setSize(w, h)` and `composer.setPixelRatio`. Add hysteresis: only change after 3 consecutive seconds below/above threshold; at most one change per 5 s.
- **Acceptance:** No oscillation in a 2-minute run (log changes to console in dev).

### P1-11 Contact damage cooldown (fixes B13)

- **Files:** `src/systems/EnemySystem.ts`.
- **Steps:** Decrement `attackCooldown` every tick (clamped at 0) regardless of contact; only HK tank uses it as a charge timer — give the tank a separate `chargeTimer` field in `ActiveEnemy` (or a per-archetype state, see Phase 3).
- **Test:** Enemy touches, leaves for 0.1 s, touches again → second hit waits for the remaining cooldown.

---

## Phase 2 — Performance & Memory

Target hardware: integrated-GPU laptop (Intel Iris Xe) and a 2021 mid-range Android phone. Targets: 60 FPS desktop / 45 FPS mobile at 400 enemies; JS heap and `renderer.info.memory` flat across 5 consecutive runs.

### P2-01 Performance harness

- **Files:** `src/core/types.ts`, `src/core/Game.ts`, new `tests/e2e/perf.spec.ts`.
- **Steps:** Extend debug API with `spawnSwarm(archetype, count)`, `getPerf()` returning `{ fps, frameTimeMs, drawCalls: renderer.info.render.calls, geometries, textures, heapMB? }`. Perf spec: start run, god mode, spawn 400 crab drones + 100 T-800s, wait 10 s, assert `geometries` did not grow > 5% between second 5 and second 10. Mark FPS assertions as `test.skip` in CI (headless GPU is unreliable) but log them.
- **Acceptance:** `npx playwright test perf` prints a perf table.

### P2-02 Dispose everything (fixes B11)

- **Files:** `src/systems/EnemySystem.ts`, `src/systems/WeaponSystem.ts`, `src/systems/PickupSystem.ts`, `src/graphics/meshes/*.ts`, new `src/graphics/dispose.ts`.
- **Steps:** Add `disposeObject3D(obj)` helper that traverses and disposes geometries/materials **unless** flagged `userData.shared = true`. Mark shared geometries/materials in mesh factories with that flag. Call it wherever a per-entity object is removed. Each special mesh class gets a `dispose()` method.
- **Test:** Unit test creating and removing 50 HK meshes leaves no undisposed geometries (spy on `BufferGeometry.prototype.dispose`). Perf spec from P2-01: geometry count flat across 3 runs.

### P2-03 Projectile pooling via InstancedMesh

- **Files:** new `src/graphics/InstancedPool.ts`, `src/systems/WeaponSystem.ts`, `src/systems/EnemySystem.ts`.
- **Steps:** Create `InstancedPool` (wraps one `InstancedMesh`, capacity N, `acquire(): index`, `release(index)`, `setTransform(index, x, y, z, rotY)`, swap-remove + `count` update). One pool per projectile look (pellet, plasma bolt, heavy bolt, bomb, enemy bolt). `Projectile.mesh` becomes `poolIndex` + `pool` reference.
- **Acceptance:** Draw calls for projectiles = number of projectile types, not number of projectiles (check `renderer.info.render.calls` via harness).

### P2-04 XP gem instancing + merging

- **Files:** `src/systems/PickupSystem.ts`, `src/graphics/meshes/PickupMeshes.ts`.
- **Steps:** Render data cores with an `InstancedPool` per tier. When more than 250 cores exist, merge the oldest core into the nearest core within 3 m (sum XP, upgrade tier visual). Crates and vaults stay as individual meshes.
- **Acceptance:** 1000 gems on screen ≤ 6 draw calls for gems.

### P2-05 Damage numbers on canvas/instanced sprites

- **Files:** `src/ui/HUDView.ts`, `src/core/Game.ts`, new `src/ui/DamageNumbers.ts`.
- **Steps:** Replace DOM nodes with a pooled set (max 64) of `<div>`s reused via transform, **or** a single 2D canvas overlay redrawn per frame. Aggregate hits on the same enemy within 0.15 s into one number. Add setting `damageNumbers: 'all' | 'crits' | 'off'` (wire in Phase 8 settings UI; default `all`).
- **Acceptance:** No `setTimeout` per hit; at 500 hits/s the DOM node count under `#floating-text-layer` stays ≤ 64.

### P2-06 Allocation-free spatial queries

- **Files:** `src/core/SpatialHashGrid.ts`, all callers.
- **Steps:** Replace the per-call `new Set<number>()` with a reusable stamp scheme (`queryStamp` counter incremented per query; store `lastQueryStamp` per entity id in a `Map` or on the entity). Give every hot caller (enemy separation, projectile hits, drones, ground zones, `findNearest`) its own scratch array passed as `outResults`. Keep the method signature unchanged.
- **Test:** Existing `spatialHash.test.ts` plus a test for `queryRadiusInto`.

### P2-07 Audio voice limiter

- **Files:** `src/audio/AudioEngine.ts`.
- **Steps:** Per sample key: max concurrent voices (default 4, hits 6, explosions 3) and min retrigger interval (30 ms). Drop requests beyond the cap. Add a master `DynamicsCompressorNode` before destination.
- **Test:** Calling `playEndoHit()` 100× in one tick starts ≤ 6 sources (mock `AudioContext`, pattern from `audioEngine.test.ts`).

### P2-08 Enemy leash / relocation

- **Files:** `src/systems/EnemySystem.ts`, `src/data/waves.ts`.
- **Steps:** Non-boss enemies farther than 40 m from the player are teleported to a random spawn point on the 22–28 m ring ahead of the player's movement direction (Vampire-Survivors style). Bosses never relocate.
- **Acceptance:** Running in a straight line for 60 s keeps enemy pressure constant (enemies within 30 m ≥ 70% of total).

---

## Phase 3 — Architecture

Goal: adding an enemy, weapon, boss or stage should mean adding **one data entry + one behaviour file**, without editing big switch statements.

### P3-01 Game state machine

- **Files:** new `src/core/StateMachine.ts`, `src/core/Game.ts`, `src/core/types.ts`, `src/state/RunState.ts`.
- **Steps:** Remove `Game.isPaused`. `GameMode` becomes the single source of truth with explicit transitions table: `title→playing`, `playing↔paused`, `playing→levelup→playing`, `playing→vault→playing`, `playing→gameover|victory→title`. Illegal transitions throw in dev and are ignored in prod. `fixedUpdate` runs simulation only when mode is `playing`.
- **Test:** Table-driven test of every legal/illegal transition.

### P3-02 Enemy behaviour registry

- **Files:** new `src/systems/enemies/` folder with `EnemyBehaviour.ts` (interface), one file per special archetype (`T800Behaviour.ts`, `HKAerialBehaviour.ts`, `HKTankBehaviour.ts`, `T1000Behaviour.ts`, `InfiltratorBehaviour.ts`, `SkynetCoreBehaviour.ts`), `index.ts` registry; `src/systems/EnemySystem.ts`; `src/data/enemies.ts`.
- **Interface:**
  ```ts
  export interface EnemyBehaviour {
    createVisual?(enemy: ActiveEnemy, ctx: EnemyContext): THREE.Object3D | null; // null = instanced batch
    update(enemy: ActiveEnemy, dt: number, ctx: EnemyContext): void;
    onDeath?(enemy: ActiveEnemy, ctx: EnemyContext): void;
    dispose?(enemy: ActiveEnemy, ctx: EnemyContext): void;
  }
  ```
  `EnemyContext` exposes: `runState`, `audio`, `particles`, `spawnEnemyProjectile`, `applyPlayerDamage`, `emit`, `rng`, `group`.
- **Steps:** Move each `else if (enemy.archetype === …)` block into its behaviour. Per-enemy extra state goes in `enemy.state: Record<string, number>` (replace `phaseState`, `searchlight*`, the burst/nova/tank `Map`s). `EnemySystem.update` only does movement, separation, contact damage, then `registry[enemy.archetype]?.update(...)`.
- **Acceptance:** `EnemySystem.ts` < 250 lines; no `archetype ===` comparisons remain in it; all tests pass; behaviour unchanged in a manual run.

### P3-03 Weapon behaviour registry

- **Files:** new `src/systems/weapons/` (one file per firing pattern: `SpreadShot.ts`, `StraightShot.ts`, `Lobbed.ts`, `Nova.ts`, `Orbiters.ts`, `GroundZone.ts`, `Strike.ts`), `src/systems/WeaponSystem.ts`, `src/data/weapons.ts`, `src/core/types.ts`.
- **Steps:** Add `pattern: WeaponPatternId` and pattern-specific params (`spreadAngle`, `ringFull`, `projectileVisual`, `areaRadius`, etc.) to `WeaponDefinition`. Base and evolved weapons share a pattern with different params (e.g. Ithaca = `SpreadShot{spread:0.42}`, Trench Sweeper = `SpreadShot{spread:2π}`). Move the `switch` into pattern files.
- **Acceptance:** `fireWeapon` has no `switch`; adding a weapon needs only a data entry if an existing pattern fits.

### P3-04 Split `Game.ts`

- **Files:** `src/core/Game.ts`, new `src/core/RunController.ts` (start/end/abort, level-up queue, vault flow), `src/core/DebugAPI.ts`, `src/core/InputRouter.ts` (mouse aim/move translation now in `fixedUpdate`).
- **Acceptance:** `Game.ts` < 200 lines; constructor wires objects only.

### P3-05 Event subscription hygiene

- **Files:** `src/systems/PickupSystem.ts`, `src/core/Game.ts`, any `globalEvents.on` caller.
- **Steps:** Store the unsubscribe functions returned by `on()`; add `dispose()` to systems that subscribe. Add `EventBus.listenerCount(event)` for tests.
- **Test:** Constructing and disposing `PickupSystem` twice leaves `listenerCount('enemy:killed') === 0`.

### P3-06 Strip debug API from production

- **Files:** `src/core/DebugAPI.ts`, `vite.config.ts`, `playwright.config.ts`.
- **Steps:** Install the debug API only when `import.meta.env.DEV || import.meta.env.VITE_E2E === '1'`. Build for e2e with `VITE_E2E=1`. Production build must not expose `__GAME_DEBUG__`.
- **Acceptance:** `npm run build` output does not contain the string `__GAME_DEBUG__` unless `VITE_E2E=1`; e2e still passes.

### P3-07 Save schema versioning

- **Files:** `src/state/SaveManager.ts`, `src/core/types.ts`, `tests/unit/saveManager.test.ts`.
- **Steps:** `version` becomes a number; add `migrations: Record<number, (old) => new>`; validate `selectedLoadout` is unlocked and `upgrades` values are clamped to `maxLevel`. Add `exportSave(): string` (base64 JSON) and `importSave(str): boolean`.
- **Test:** v1 save migrates to v2; corrupted values are clamped; export→import round-trips.

---

## Phase 4 — Game Feel

### P4-01 Knockback & mass

- **Files:** `src/data/enemies.ts` (add `mass`), `src/data/weapons.ts` (add `knockback` per weapon), `src/core/types.ts` (`vx`, `vz` impulse on `ActiveEnemy`), `src/systems/EnemySystem.ts`, `src/systems/weapons/*`.
- **Steps:** On hit, add impulse `knockback / mass` along hit direction; decay impulse with `exp(-8 dt)`. Bosses have mass ≥ 20 (barely move).
- **Acceptance:** Ithaca visibly pushes crab drones back; T-800s barely; bosses not at all.

### P4-02 Hit-stop & crit punch

- **Files:** `src/core/GameLoop.ts`, `src/core/RunController.ts`.
- **Steps:** `GameLoop.hitStop(seconds)` scales sim dt to 0 for the duration (max 0.08 s, not stacking beyond 0.12 s). Trigger 0.04 s on boss hit by crit, 0.06 s on elite death, 0.1 s on boss death. Setting toggle in Phase 8.

### P4-03 Attack telegraphs

- **Files:** enemy behaviours from P3-02, new `src/graphics/Telegraphs.ts`.
- **Steps:** Reusable ground decals: circle (charging fill), cone, line. Every enemy attack that deals ≥ 15 damage must show a telegraph ≥ 0.4 s before impact (T-800 shot: red laser sight line 0.5 s; Infiltrator burst: muzzle glow; HK aerial: searchlight already, add fill ring).
- **Acceptance:** Checklist in the PR of every ranged attack + its telegraph.

### P4-04 Enemy death debris

- **Files:** `src/systems/ParticleSystem.ts`, `src/graphics/meshes/EndoskeletonBatch.ts`.
- **Steps:** On death, spawn 3–6 pooled chrome debris chunks (skull, ribs, limb boxes) with physics bounce, fading after 4 s; red eye "power-down" flicker. Cap total debris at 300 (oldest recycled).

### P4-05 Player feedback

- **Files:** `src/systems/PlayerSystem.ts`, `src/graphics/PostProcessing.ts`, `src/audio/AudioEngine.ts`, `src/ui/HUDView.ts`.
- **Steps:** i-frame flicker after damage (0.5 s invulnerability, configurable in data); low-HP (< 25%) red vignette pulse + heartbeat; dash cooldown ring under the player; aim reticle on ground when using mouse/right stick.

### P4-06 Pickup magnet feel

- **Files:** `src/systems/PickupSystem.ts`.
- **Steps:** Gems first pop outward 0.15 s, then accelerate toward player (`speed = 6 + 30 * t`), with a short trail. Combo counter shown on HUD (`x12 DATA LINK`).

---

## Phase 5 — Combat Content

### P5-01 Real boss fights (multi-phase)

Each boss: ≥ 2 phases, ≥ 3 distinct attacks, every attack telegraphed (P4-03), a unique HP-bar name, and a death sequence (slow-mo 0.5 s + big explosion). Implement in the boss's behaviour file.

| Boss                | Phase 1                              | Phase 2 (< 50% HP)                                                 | Phase 3 (< 20% HP)                                                          |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Infiltrator CSM-101 | 3-round plasma burst; walk-and-shoot | Charges in a straight line (cone telegraph), smashes cars          | Skin burns away → endoskeleton visual, faster, calls 6 crab drones          |
| HK Tank Goliath     | Artillery reticle (existing)         | Twin searchlight sweep — standing in light = 3 s lock then barrage | Crushes obstacles in path; spawns T-600s from rear hatch                    |
| HK Aerial Command   | Strafing run line telegraph          | Calls 2 HK patrol escorts; missile salvo (6 circles)               | Dives for kamikaze impact (large circle)                                    |
| T-1000              | Blade lunge (line) + slash combo     | Liquid puddle: becomes untargetable 1.5 s, reappears behind player | Regenerates 2%/s unless hit by EMP or napalm (freeze/melt counterplay)      |
| Skynet TDE Core     | Rotating plasma spokes               | Temporal nova (existing) + spawns T-800 waves                      | Time-displacement pulses that pull player toward core; final 30 s countdown |

- **Acceptance per boss:** Unit test that phase transitions fire at the right HP; manual playtest note in commit body.

### P5-02 Elite affixes

- **Files:** `src/data/enemies.ts` (new `ELITE_AFFIXES`), `src/data/waves.ts` (`eliteChance` per minute), `src/systems/EnemySystem.ts`.
- **Affixes:** `Armored` (−50% damage taken until armour stripped by EMP), `Overclocked` (+60% speed), `Shielded` (bubble absorbs first 30% HP), `Self-Destruct` (explodes on death, telegraphed), `Regenerating`. Elites are 1.4× scale, tinted, drop a guaranteed crate.

### P5-03 New enemy types

Add one at a time, each with data entry, behaviour, visual (reuse `geometryUtils` merge pattern), wave-pool placement and codex text.

1. **T-1 Minigun Tracked** (T3) — slow, sweeping bullet cone, minute 3+.
2. **Moto-Terminator** — fast flanker, dashes in lines, minute 4+.
3. **Hydrobot swarm** — tiny, fast, low HP, arrive in groups of 12 from one direction (formation spawn).
4. **Aerostat** — small flying scout; marks player → nearby enemies +20% speed for 4 s.
5. **Skynet Plasma Turret** — stationary emplacement spawned in the world; must be destroyed or avoided.
6. **T-600 Minigunner** — variant of T-600 with suppressive fire.

### P5-04 New weapons & passives (bring totals to 14 / 12 / 14)

Each weapon: data entry, pattern (reuse P3-03 patterns where possible), evolution, paired passive.

- **M-16 Plasma Carbine** (Straight burst) → _Phased Plasma Assault_.
- **RPG Launcher** (Lobbed, single large) → _Tandem Warhead_.
- **Molotov / Incendiary** (GroundZone line) → _Firestorm Lane_.
- **Dog Unit (Resistance K-9)** (new pattern: autonomous ally that bites infiltrators, reveals T-1000) → _K-9 Pack_.
- **Reprogrammed T-800 Ally** (new pattern: summon with HP, taunts) → _Guardian Protocol_ (very rare, late unlock).
- **Coltan Knife / Melee Sweep** (new pattern: arc) → _Hyperalloy Blade_.
- New passives: `Ammo Belt` (+duration), `Infrared Goggles` (+crit damage), `Lucky Rabbit's Foot`/`Polaroid` style luck, `Dog Tags` (+revival chance %).

### P5-05 Environmental interactables

- Explosive fuel drums (chain reactions), destructible car wrecks (cover that blocks enemy bolts until destroyed), Tech-Com supply drop (timed flare event every 3 min: reach it within 20 s for a chest).

---

## Phase 6 — Stages & Modes

### P6-01 Stage abstraction

- **Files:** new `src/data/stages.ts`, `src/graphics/Environment2029.ts` → `src/graphics/environments/` (one class per stage implementing `IEnvironment { group; obstacleColliders; update(px,pz); dispose() }`), `src/systems/WaveDirector.ts` reads `stage.waveTimeline`.
- **Acceptance:** Current map becomes stage `la_2029_wasteland` with no behaviour change.

### P6-02 New stages (one task each)

1. **Cyberdyne Factory (T2)** — indoor grid, conveyor belts that move entities, molten steel pits (hazard), T-1000 earlier.
2. **Tech Noir, LA 1984** — night streets, neon, police cars, Infiltrator as recurring stalker that cannot be killed until minute 8.
3. **Skynet Central / Time Displacement Facility** — final stage; laser grid hazards, unlocked by beating the other three.
4. **Century City Bunker** — defence stage: protect a stationary bunker door (objective HP) for 10 minutes.

Each stage: unique palette/fog, 3+ unique props, its own wave timeline and boss order, unlock condition, best-time record.

### P6-03 Endless mode

- After the final boss, offer "CONTINUE THE WAR" → endless with hp/damage scaling `×1.15` per extra minute and a boss every 3 min from a rotating pool. Separate leaderboard (local) for endless time.

### P6-04 Daily Seeded Operation

- Seed = `YYYYMMDD` hash; fixed stage + loadout + one modifier; one recorded attempt per day (practice runs allowed but not recorded). Depends on P1-08.

### P6-05 Threat Levels (difficulty)

- 10 stackable modifiers unlocked after first victory (e.g. _Enemy +25% HP_, _Pickups expire_, _No revives_, _Bosses enraged_, _Night vision only_). Each adds +X% scrap. Shown on run summary.

---

## Phase 7 — Meta-Progression

### P7-01 Achievements

- **Files:** new `src/data/achievements.ts`, `src/state/AchievementTracker.ts`, UI panel on title screen.
- 40 achievements (kills, survive times, evolutions, boss no-hit, stage clears, threat levels). Achievements unlock loadouts, weapons and cosmetics so new players see a curated starting pool (Vampire-Survivors style).

### P7-02 Codex / Bestiary / Armory

- Entries for every enemy (kills count, lore text, 3D turntable using existing meshes), weapon (stats table, evolution recipe once discovered), and stage. Lore text lives in `src/data/lore.ts`.

### P7-03 Run summary & history

- End-run modal: damage per weapon (track in `WeaponSystem`), DPS chart, kills by type, time-line of level-ups, seed. Keep last 20 runs in save.

### P7-04 Deeper loadouts

- Each loadout gets a unique active ability on a cooldown (bound to a new "Ability" input): Reese 2029 = _Pipe-bomb Barrage_, Reese 1984 = _Sawed-off Dual Wield_ (10 s), Sapper = _Overcharge_ (no cooldowns 4 s), John Connor = _Rally_ (temporary ally squad). Add 2 new loadouts: **Sarah Connor** (T2 era, minigun-style passive) and **Reprogrammed T-800** (high HP, no dash, slow regen).

### P7-05 Bunker upgrades rework

- Expand meta tree to 16 upgrades with a refund-all button; costs rebalanced from a spreadsheet in `src/data/upgrades.ts`.

---

## Phase 8 — UX & Accessibility

### P8-01 Settings screen

- **Files:** `src/ui/PauseModal.ts`, new `src/ui/SettingsPanel.ts`, `src/core/types.ts` (settings schema), `src/state/SaveManager.ts`.
- Options: master/music/SFX volume, screen shake (0–100%), flash intensity (0–100%), reduced motion (disables shake, CRT, hit-stop), damage numbers (all/crits/off), CRT scanlines, auto-aim, show FPS, colour-blind palette (deuteranopia/protanopia/tritanopia for XP tiers, telegraphs, HUD), UI scale (80–150%). Respect `prefers-reduced-motion` as the default.

### P8-02 Input remapping

- Keyboard and gamepad rebinding UI; stored in save; conflict detection; "reset to default".

### P8-03 Menu accessibility

- **Files:** all `src/ui/*.ts`.
- Every interactive element is a real `<button>` with `aria-label`; modals use `role="dialog"`, `aria-modal`, focus trap, and return focus on close; full keyboard navigation (arrows/Tab/Enter/Esc) mirrors gamepad navigation. Test with Playwright `page.keyboard` only (no mouse) in a new e2e spec.

### P8-04 First-run tutorial

- 60-second guided "Boot Camp" on first launch: move, aim, dash, collect, level-up, evolution explanation. Skippable; re-playable from title.

### P8-05 Quality of life

- Pause on window blur / tab hidden / controller disconnect. Show upgrade pool and evolution recipes in the pause screen. Level-up modal: reroll (limited), skip (+scrap), banish (remove from pool) — counts unlocked via meta upgrades.

### P8-06 Localisation scaffold

- Move all user-facing strings into `src/i18n/en.ts` with a `t(key)` helper. No other languages required yet.

---

## Phase 9 — Audio & Visual Polish

### P9-01 Adaptive music

- Split music into intensity layers (calm / combat / boss) using crossfaded `GainNode`s driven by enemy count and boss presence. Boss stinger on spawn. **Use only cleared assets (P0-03).**

### P9-02 Spatial audio

- `StereoPannerNode` per SFX based on screen-space x of the source; distance attenuation for off-screen explosions.

### P9-03 Dynamic lighting budget

- Pool of 8 `PointLight`s reused for muzzle flashes, explosions, plasma bolts (largest/closest wins). Disabled on low quality.

### P9-04 Atmosphere

- Falling ash particles, distant lightning flashes lighting the skyline, ground decals (scorch marks persisting 20 s, pooled, max 64).

### P9-05 Quality presets

- Low / Medium / High / Ultra in settings controlling pixel ratio, bloom, shadows, particle caps, debris caps, lights. Auto-detect default from first 5 s FPS.

### P9-06 Character & enemy animation pass

- Procedural walk-cycle improvements for Kyle (recoil per weapon, dash roll), endoskeleton stagger on hit, HK rotor/thruster tilt with movement.

---

## Phase 10 — Release Engineering

### P10-01 CI hardening

- Add `lint` step; Vitest coverage with thresholds (`src/state` 80%, `src/systems` 60%, `src/core` 70%); bundle size check (fail if main JS > 800 KB gz-less, currently ~672 KB); upload Playwright report as artifact on failure.

### P10-02 Code splitting

- Lazy-load codex, settings and stage environments with dynamic `import()`. Target initial JS < 450 KB.

### P10-03 Error reporting (opt-in)

- Global `error`/`unhandledrejection` handler that shows a friendly "SYSTEM FAULT" overlay with a copyable report (version, seed, stack). No network calls unless a future, user-approved endpoint is configured.

### P10-04 Versioning & changelog

- `CHANGELOG.md` (Keep a Changelog format); show version + build hash on title screen; bump `package.json` version per phase (`1.1.0` after Phase 1, etc.).

### P10-05 Lighthouse / PWA audit

- Lighthouse CI on the preview build: PWA, performance ≥ 80 (mobile), accessibility ≥ 90 after Phase 8.

---

## Phase 11 — Integration & Honesty Pass

**Why this phase exists.** An audit of Phases 0–10 (commit `18851fb`, 2026-10-18) found that 34 of 69 tasks were fully done, 26 partial, 7 hollow, 1 regressed and 1 skipped. Typecheck, lint, 457 unit tests and the build all passed, yet several features cannot be reached by a player, and some changes broke the game. Most of it slipped through because tests emitted events by hand or grepped files. Overall score: **62 / 100**.

### Wiring test (definition used by every task below)

A **wiring test** is one of:

1. **E2E wiring test:** a Playwright spec in `tests/e2e/integration/` that drives the game through real UI clicks/keys or through `window.__GAME_DEBUG__` actions which call the _same code path gameplay uses_ (P11-00 adds those actions). It asserts on `getState()`, `getSceneCensus()`, `getRuntimeSettings()`, `getSave()` or visible DOM.
2. **Real-system unit test:** a Vitest test in `tests/unit/` that constructs the real classes involved (e.g. `RunState` + `EnemySystem` + `PickupSystem` + `SpatialHashGrid`), advances them with `update(dt)`, and asserts outcomes. Only browser APIs (WebGL, AudioContext, localStorage) may be mocked.

A wiring test must **not**: call `globalEvents.emit(...)` for domain events, read source files with `readFileSync`, assert on line counts, or re-implement the formula under test. Every task's test must fail on commit `18851fb` and pass after the fix. State this in the commit body ("verified failing on 18851fb").

Name files `tests/unit/p11_XX_<slug>.test.ts` or `tests/e2e/integration/p11_XX_<slug>.spec.ts`; `describe('P11-XX …')`.

### Order

Do **P11-00** first, then the groups in order: **A** (blockers) → **B** (settings & save) → **C** (unreachable features) → **D** (hollow content) → **E** (hygiene, tests, docs). Run `npm run build` and `npm run test:e2e` at the end of each group, not only at the end of the phase.

---

### P11-00 Integration harness (prerequisite)

- **Files:** `src/core/DebugAPI.ts`, `src/core/types.ts` (`GameDebugAPI`), `eslint.config.js`, `playwright.config.ts`, new folder `tests/e2e/integration/`, `CLAUDE.md`.
- **Steps:**
  1. Extend `getState()` with `stageId`, `threats`, `isDaily`, `isEndless`, `revivalsLeft`, `invulnerabilityTimer`.
  2. Add these debug actions. Each must route through existing gameplay code, never set fields directly unless stated:
     - `getSceneCensus()` → `{ enemyGroupChildren, weaponGroupChildren, pickupGroupChildren, fuelDrums, cars, obstacleColliders, visibleLights }`.
     - `getRuntimeSettings()` → `{ shakeScale, flashScale, hitStopEnabled, damageNumbersMode, qualityPreset, pixelRatio, lightsEnabled, keyBindings, bodyClasses: string[] }`, read from the live objects (`SceneManager`, `GameLoop`, `HUDView`, `InputManager`, `document.body`), **not** from the save.
     - `getSave()` → deep clone of `SaveManager.getData()`.
     - `damageEnemy(target: number | 'boss', amount: number, crit?: boolean)` → calls the same function weapons use (`WeaponSystem.applyDamageToTarget`).
     - `killAllEnemies()` → `damageEnemy` on every enemy. (CLAUDE.md already documents this action but it does not exist.)
     - `setPlayerHp(hp: number)` (direct set is fine; it is test setup).
     - `startRunWith(config: RunConfig)` → calls the same function the UI calls (see P11-08).
  3. ESLint: add an override for `tests/**/p11_*` that errors on `CallExpression[callee.object.name='globalEvents'][callee.property.name='emit']` and on `readFileSync`.
  4. Add a Playwright project `integration` pointing at `tests/e2e/integration`.
  5. Update CLAUDE.md's debug API list to match reality, and add `lint` and `format` to its command list.
- **Acceptance:** One smoke spec `p11_00_harness.spec.ts` starts a run, calls each new action once and asserts sensible return shapes.

---

### Group A — Blockers (broken runs, soft-locks, unintended immortality)

#### P11-01 Endless "Continue" soft-lock and double-banked results

- **Bug:** after victory, Continue sets `mode = 'playing'`, but `StateMachine.ts` only allows `victory → title`. In production the transition is silently ignored, so the HUD and music start but the simulation never runs. If the transition did succeed, a later death would call `addRunResults` a second time with the full run totals and record a second history entry as a defeat.
- **Files:** `src/core/StateMachine.ts`, `src/core/RunController.ts`, `src/state/SaveManager.ts`, `src/state/RunState.ts`.
- **Fix:**
  1. Allow `victory → playing` only when `runState.isEndless` is being set (add a guard callback to the transition table, or a dedicated `continueEndless()` transition).
  2. Add `RunState.bankedKills` and `bankedScrap`, set when the victory is banked.
  3. On endless death, bank only the difference since the victory. Write one history entry of type `'endless'` that _replaces_ the victory entry instead of adding a defeat.
- **Wiring test (e2e):** start a run, then `startRunWith({ stageId: 'la_2029_wasteland' })`, `fastForward` to minute 10, `damageEnemy('boss', 1e9)` on the Core, click Continue. Assert `mode === 'playing'` and that `timeSeconds` increases over 1 s. Then `setPlayerHp(0)` and let it resolve. Assert `getSave().totalKills` grew by exactly the run's kills and the history gained exactly one entry.

#### P11-02 Boss and special-enemy meshes stay in the scene across runs

- **Bug:** every behaviour's `clear()` (`src/systems/enemies/*.ts`) disposes its meshes but does not remove them from `EnemySystem.group`. Dying with a boss alive leaves a frozen boss rendering in the next run.
- **Files:** `src/systems/enemies/*.ts`, `src/systems/EnemySystem.ts`.
- **Fix:** in each behaviour's `clear()`, call `ctx.group.remove(obj)` before disposing. As a backstop, `EnemySystem.clear()` removes every child of `group` that is not a shared pool mesh (`userData.shared !== true`).
- **Wiring tests:**
  - Unit: real `EnemySystem`; spawn one of every archetype; `clear()`; assert `group.children` contains only pool meshes.
  - E2E: `spawnBoss('hk_tank_goliath')` and `spawnBoss('skynet_tde_core')`, abort to title, start a new run, and assert `getSceneCensus().enemyGroupChildren` equals the value from a fresh run.

#### P11-03 Dead player revived at 1 HP through the vault

- **Bug:** `RunController.update` returns early when mode is not `'playing'`, so death resolution is skipped. If a lethal hit and a vault pickup happen in the same tick, the vault opens with `hp === 0`, and `recalculateStats` then forces `hp = Math.max(1, …)`.
- **Files:** `src/core/Game.ts`, `src/core/RunController.ts`, `src/systems/PickupSystem.ts`, `src/state/RunState.ts`.
- **Fix:**
  1. Resolve lethal damage immediately after `enemySystem.update` and before `pickupSystem.update`.
  2. `PickupSystem.update` returns early when `hp <= 0`.
  3. `recalculateStats` keeps `hp` at 0 when it was 0.
- **Wiring test (unit, real systems):** place a vault on the player and a lethal enemy in contact, advance one tick. Assert the result is death (`mode === 'gameover'`), no vault modal flow, and `revivalsLeft` unchanged.

#### P11-04 Revival chance can exceed 100%, and revives give no invulnerability

- **Bug:** Dog Tags (up to 0.75) plus Veteran Resilience (up to 0.45) are summed with no cap, so every lethal hit revives the player. A revive also sets `invulnerabilityTimer = 0`.
- **Files:** `src/state/RunState.ts`, `src/data/weapons.ts` (passives), `src/data/upgrades.ts` (meta upgrades), new file `src/data/balance.ts`.
- **Fix:** add `MAX_REVIVAL_CHANCE = 0.5` and `REVIVE_INVULNERABILITY_SECONDS = 2.0` in `src/data/balance.ts`. Clamp the summed chance. Set i-frames on every revive.
- **Wiring test (unit):** max both passives, then apply 100 lethal hits spaced past the i-frames. Assert the player dies at some point (seeded RNG) and that every revive sets `invulnerabilityTimer >= 2`.

#### P11-05 Crit hit-stop stutter and dead elite hit-stop

- **Bug:** `RunController` adds 0.02 s of hit-stop on **every** non-boss crit, so high crit rates stall the simulation repeatedly. The spec only asked for boss crits. The elite-death hit-stop checks `enemy.state?.isElite`, but the flag is `enemy.isElite`.
- **Files:** `src/core/RunController.ts`, `src/core/GameLoop.ts`, `src/data/balance.ts`.
- **Fix:** hit-stop only on boss crits, elite deaths and boss deaths, with a global cooldown of at least 0.25 s between hit-stops. Values go in `src/data/balance.ts`. Fix the elite flag check.
- **Wiring test (e2e or real-system unit):** with crit chance forced to 1 and 200 enemies inside napalm, run 5 s of wall time. Assert simulated `timeSeconds` advanced by at least 4.5 s. Kill an elite with `damageEnemy` and assert `gameLoop.hitStopTimer > 0` on the next tick.

---

### Group B — Settings and save persistence

#### P11-06 Apply saved settings at boot

- **Bug:** shake, flash, hit-stop, damage numbers, FPS display, colour-blind mode, UI scale and CRT only take effect after the user opens Settings and saves. After the P10-02 code split, `SettingsPanel` (which applied them) is lazy-loaded. The CRT overlay also ignores `reducedMotion`.
- **Files:** new `src/ui/SettingsApplier.ts` (not lazy), `src/ui/SettingsPanel.ts`, `src/core/Game.ts`.
- **Fix:** move `applyCurrentSettingsToDom` into `SettingsApplier.apply(settings)`. In the `Game` constructor, once every subscriber exists, call it and emit `settings:updated` once with the saved settings. `SettingsPanel` calls the same applier.
- **Wiring test (e2e):** seed `localStorage` with a save that has `reducedMotion: true`, `colorBlindMode: 'deuteranopia'`, `uiScale: 1.3`, then reload. Assert from `getRuntimeSettings()` that `hitStopEnabled === false`, `shakeScale === 0`, `bodyClasses` contains the colour-blind class, and the CRT overlay is hidden, all without opening Settings.

#### P11-07 Key remaps, quality preset and governor respected at boot

- **Bugs:**
  - `InputManager` starts from `DEFAULT_KEY_BINDINGS` and only updates on `input:rebound`, so remaps are lost on reload. `ShiftRight` is hard-coded as dash.
  - The saved quality preset is ignored at startup, and the 5 s auto-detect overwrites it.
  - The FPS governor turns lights and atmosphere on or off and raises the pixel ratio beyond the chosen preset.
  - `particleCap` is never enforced.
  - The light pool toggles `light.visible`, which forces shader recompiles.
- **Files:** `src/input/InputManager.ts`, `src/graphics/SceneManager.ts`, `src/graphics/qualityPresets.ts`, `src/systems/ParticleSystem.ts`, `src/graphics/DynamicLightingManager.ts`.
- **Fix:**
  1. Load the saved bindings in the `InputManager` constructor, and move `ShiftRight` into the defaults table.
  2. Apply the saved preset at boot. Auto-detect runs only when the preset is `'auto'`.
  3. The governor may only adjust pixel ratio within the preset's `[minPixelRatio, maxPixelRatio]` and never changes lights or atmosphere.
  4. Enforce `particleCap` in `acquireParticle`.
  5. Keep pooled lights visible and use `intensity = 0` when idle.
- **Wiring test (e2e):** save a binding of dash = `KeyQ` and preset = `low`, reload. Press `KeyQ` and assert `isDashing`. Assert `getRuntimeSettings().qualityPreset === 'low'` after 6 s and `pixelRatio <= 1`.

#### P11-08 Save migration to v3, and throttled writes

- **Bugs:**
  - `CURRENT_VERSION` is still 2 even though many fields were added. Existing players lose weapons that are now locked behind achievements, and veterans are forced into the tutorial.
  - `recordEnemyKill` calls `save()` on every kill, which means hundreds of synchronous `JSON.stringify` + `localStorage` writes per minute.
- **Files:** `src/state/SaveManager.ts`, `src/state/AchievementTracker.ts`, `src/core/RunController.ts`.
- **Fix:**
  1. Bump to v3 with a migration that fills new fields with defaults. Mark the tutorial as seen if `totalKills > 0`. Grandfather unlocks: a player with `victories > 0` gets every weapon whose unlock is achievement-gated.
  2. Add `markDirty()` and `flush()`. Flush on run end, pause, `visibilitychange`, and every 10 s.
- **Wiring tests (unit):** fixture JSON files for a v1 and a v2 save in `tests/fixtures/`; assert both migrate to v3 with the expected unlocks. With a real `SaveManager` and a spied `localStorage.setItem`, record 500 kills and assert at most 1 write before `flush()`.

---

### Group C — Wire unreachable features

#### P11-09 Run configuration and deploy flow (stage select)

- **Bug:** the only UI path into a run is `startRun(loadoutId)` (`Game.ts`), which always starts `la_2029_wasteland` with no threats and no daily flag.
- **Files:** `src/core/types.ts` (new `RunConfig { loadoutId; stageId; threats: ThreatId[]; seed?: number; daily?: { dateKey: string } }`), `src/core/Game.ts`, `src/core/RunController.ts`, `src/ui/TitleScreen.ts`, new `src/ui/DeployModal.ts`, `src/data/stages.ts`.
- **Fix:**
  1. `Game.startRun(config: RunConfig)` replaces the positional parameters.
  2. "Deploy" opens `DeployModal`, a 3-step flow: **stage**, then **loadout** (move the existing loadout picker in here if it lives elsewhere), then **threat levels** (shown only once a victory exists).
  3. Replace `unlockCondition` strings in `stages.ts` with structured data, e.g. `{ type: 'victory', stageId }` or `{ type: 'none' }`, evaluated against the save. Locked stages show the requirement.
  4. Show each stage's best time; record it per stage in the save.
  5. The modal must use the existing `A11yHelper` dialog pattern.
- **Wiring test (e2e):** click Deploy → pick a stage → confirm. Assert `getState().stageId`. Assert a locked stage cannot be started.

#### P11-10 Stages are actually different

- **Bug:** all five stages share `WAVE_TIMELINE`. Fog and palette fields are never read (`SceneManager` hard-codes fog). There is no Tech Noir stalker, and conveyors only move the player.
- **Files:** `src/data/waves.ts` (`buildWaveTimeline(params)`), `src/data/stages.ts`, `src/graphics/SceneManager.ts`, `src/systems/WaveDirector.ts`, `src/systems/InteractiveEnvironmentSystem.ts`, `src/graphics/environments/*.ts`.
- **Fix:**
  1. Each stage defines its own pool weights and boss order (as specified in P6-02) through `buildWaveTimeline`.
  2. `SceneManager.applyStage(stage)` sets background colour and fog colour and distance.
  3. Tech Noir: an Infiltrator spawns at 0:30, takes 0 damage until minute 8, and then becomes killable.
  4. Conveyors move enemies and pickups too, not just the player.
- **Wiring tests:**
  - Unit: any two stages produce different boss orders.
  - E2E: start `tech_noir_1984`, assert an infiltrator exists at 0:31 and `damageEnemy` deals 0 damage to it before minute 8.

#### P11-11 Bunker defence objective

- **Bug:** `damageBunker` and `getBunkerHealth` exist but nothing calls them.
- **Files:** `src/graphics/environments/BunkerEnvironment.ts`, `src/systems/EnemySystem.ts`, `src/core/RunController.ts`, `src/ui/HUDView.ts`, `src/data/stages.ts`.
- **Fix:**
  1. Enemies within the bunker radius stop and attack it, using their contact damage and cooldown.
  2. The HUD shows a bunker HP bar.
  3. Bunker HP reaching 0 ends the run as `gameover`, with the reason "BUNKER BREACHED".
  4. Surviving 10 minutes counts as victory.
- **Wiring test (e2e):** start the bunker stage and `spawnSwarm` at the bunker. Assert bunker HP drops, and the run ends when it reaches 0.

#### P11-12 Daily operation, threat levels and endless leaderboard reachable

- **Bugs:**
  - `getDailyOperation` and `hasAttemptedDaily` are never called.
  - Threats cannot be selected.
  - The `supply_starvation` and `jammed_frequency` threats have no effect.
  - `judgment_hour` caps the minute at 8, so the final boss (minute 10) never spawns and the run cannot be won.
  - `endlessHighScores` is never shown.
- **Files:** `src/ui/TitleScreen.ts`, `src/ui/DeployModal.ts`, `src/core/DailyOperation.ts`, `src/systems/WaveDirector.ts`, `src/systems/PickupSystem.ts`, `src/data/threatModifiers.ts`, `src/ui/EndRunModal.ts` (War Archives tab).
- **Fix:**
  1. Add a "DAILY OPERATION" title button that starts `startRun(getDailyOperation(today))`. The first attempt is recorded; later attempts that day are labelled practice.
  2. Threats are chosen in `DeployModal`, and the chosen threats are shown on the end screen.
  3. Implement `supply_starvation` (no medkit or heal crate rewards) and `jammed_frequency` (minimap and boss warning banner hidden; HUD shows static).
  4. For `judgment_hour`: compress the timeline so the final boss spawns at minute 8.
  5. Add an Endless tab to War Archives showing `endlessHighScores`.
- **Wiring tests (e2e):**
  - The daily button gives the same seed twice on the same day, and `getSave()` records one attempt.
  - With `judgment_hour`, `fastForward(8 * 60)` spawns `skynet_tde_core`.
  - With `supply_starvation`, destroying 20 crates never heals.

#### P11-13 Emit `boss:defeated` and `weapon:evolved` from real code

- **Bug:** neither event is emitted anywhere in `src/`; only the tests emit them. That makes 12 achievements impossible and leaves 4 weapons that can never be unlocked. Codex evolution recipes are never revealed.
- **Files:** `src/systems/EnemySystem.ts` (or `RunController` on `enemy:killed` with `isBoss`), `src/systems/PickupSystem.ts` / `src/state/RunState.ts` (wherever `checkAndEvolveWeapon` succeeds), `tests/unit/p7_01_achievements.test.ts`, `tests/unit/p7_02_codex.test.ts`.
- **Fix:** emit `boss:defeated { archetype, x, z }` when a boss dies, and `weapon:evolved { from, to, name }` when an evolution is applied. Rewrite the P7-01 and P7-02 tests so they no longer emit these events themselves.
- **Wiring test (e2e):**
  - `spawnBoss('infiltrator_csm101')` then `damageEnemy('boss', 1e9)`: assert the boss achievement is in `getSave()`.
  - Grant a level-8 Ithaca plus its passive, then `triggerVault` and collect it: assert the evolution recipe is marked discovered in `getSave()`.
  - Add a unit check that every achievement's trigger event has at least one emitter in `src/`. This test may scan source text; it is the one allowed exception, and it must be documented as a static check, not a behaviour test.

#### P11-14 Interactables exist in every run

- **Bugs:**
  - Drums and cars spawn only in the constructor, and `startRun` clears them.
  - `lastFlareDropTime` is never reset, so supply drops stop after the first run.
  - Drums are inserted into the spatial grid after weapons update and the grid is cleared before the next pass, so weapons can never hit them.
  - A drum kill emits `enemy:killed`, and the enemy is then killed again, giving double XP and double `endRun`.
  - `Game.ts` pushes car colliders onto `obstacleColliders` every tick.
- **Files:** `src/systems/InteractiveEnvironmentSystem.ts`, `src/core/Game.ts`, `src/core/RunController.ts`.
- **Fix:**
  1. Add `reset()`, which clears, respawns, and resets the flare timer; call it from `startRun`.
  2. Insert drums into the grid during the grid rebuild step in `Game.fixedUpdate`.
  3. Drum explosions deal damage through `applyDamageToTarget` only. They never emit `enemy:killed` themselves.
  4. Build the collider list for each tick as `staticColliders.concat(carColliders)` into a reused array, instead of pushing onto it.
- **Wiring test (e2e):**
  - Start two runs in a row; assert `getSceneCensus().fuelDrums > 0` in both.
  - `damageEnemy` on a drum: nearby enemies take damage and `kills` increases by exactly the number of enemies killed.
  - `obstacleColliders` stays constant across 600 ticks.

#### P11-15 Loadout abilities match the spec

- **Gaps:**
  - John Connor's "Rally" is only +35% Might, with no ally squad.
  - Sapper's "Overcharge" is a single cooldown reset, not 4 s with no cooldowns.
  - The Reprogrammed T-800 still has a dash and no regen.
  - Sarah Connor has no unique passive.
- **Files:** `src/core/RunController.ts`, `src/state/RunState.ts`, `src/data/upgrades.ts` (loadouts), `src/systems/weapons/AllySummon.ts`.
- **Fix:**
  1. Rally summons 3 temporary allies for 8 s through `AllySummon`.
  2. Overcharge sets `cooldownMultiplier` to 0 for 4 s (respecting the floor elsewhere).
  3. The T-800 loadout gets `canDash: false` and regen of 1 HP/s.
  4. Sarah Connor: +1 projectile on straight-shot weapons and +15% fire rate.
- **Wiring test (e2e per loadout):** start with the loadout and press the ability key, then assert the effect through `getState()`/`getSceneCensus()`: ally count, cooldown timers stay at 0 for 4 s, dash refused, HP regenerates.

#### P11-16 Interactive tutorial

- **Gap:** P8-04 asked for a guided 60-second Boot Camp; what shipped is a 6-slide slideshow.
- **Files:** `src/ui/TutorialModal.ts` → new `src/core/TutorialRun.ts`, `src/data/tutorial.ts`.
- **Fix:** a scripted run with no wave director. Each step shows a prompt and waits for its condition: move 5 m, aim, dash once, collect 5 gems, pick a level-up, open a pre-placed vault that evolves a weapon. Skippable; on completion it records the tutorial as seen.
- **Wiring test (e2e):** drive the tutorial with keyboard input only and assert that each step advances only after its condition is met.

---

### Group D — Hollow or broken content

#### P11-17 Boss attacks that do nothing

- **Bugs:**
  - **HK Aerial missile salvo:** circles are placed 3.8 m from the player with a 2.2 m hit radius, so it can never hit.
  - **HK Tank searchlight:** the "sweep" check `inFront` compares an angle with itself, so it is always true.
  - **T-1000 puddle:** `isPuddle` is never read, so the T-1000 stays targetable.
  - **T-1000 regen counters:** only EMP's slow stops regen; napalm does not.
  - **Missing telegraphs** on attacks of 15 damage or more: Tank twin cannon (18×2), Core spokes (16), T-1000 reappear (24), and Self-Destruct elite (28).
  - **Attack timers** keep counting below 0 while the player is out of range, so attacks fire with no telegraph when the player re-enters range.
- **Files:** `src/systems/enemies/HKAerialBehaviour.ts`, `HKTankBehaviour.ts`, `T1000Behaviour.ts`, `SkynetCoreBehaviour.ts`, `T800Behaviour.ts`, `InfiltratorBehaviour.ts`, `NewEnemyBehaviours.ts`, `src/systems/WeaponSystem.ts`, `src/systems/weapons/GroundZone.ts`, `src/data/enemies.ts`.
- **Fix:**
  1. **Salvo:** place one circle on the player's position and 5 within 3 m of it.
  2. **Sweep:** use a rotating beam angle and check the player's angle against it within ±15°; the lock takes 3 s.
  3. **T-1000 untargetable:** `applyDamageToTarget` returns false while `state.isPuddle === 1`.
  4. **Napalm counter:** `GroundZone` sets `state.burnTimer`; T-1000 regen stops while `burnTimer > 0` or `slowTimer > 0`.
  5. **Telegraphs:** add one to each listed attack, at least 0.4 s long.
  6. **Timers:** clamp attack timers at 0 while out of range, and always start the telegraph before firing.
  7. **Data:** move every boss attack damage value into `src/data/enemies.ts`.
- **Wiring tests (real-system unit, one per behaviour):**
  - A stationary player inside the salvo takes damage.
  - The T-1000 in puddle form takes 0 damage from `applyDamageToTarget`.
  - A T-800 whose player re-enters range shows a telegraph for at least 0.4 s before the bolt spawns.

#### P11-18 Enemy features that do nothing

- **Bugs:**
  - **Aerostat:** the mark only plays a sound and a particle; there is no speed buff.
  - **Hydrobots** spawn one at a time instead of as a formation of 12.
  - **Plasma Turret** spawns at the screen edge and is teleported by the leash, so it is never a fixed emplacement.
  - **T-1 and T-600 Minigunner** appear from minute 2; the spec says minute 3 or later.
  - **Elite scale and tint** only work for instanced enemies.
  - **Hydrobot meshes** allocate about 6 geometries per spawn.
- **Files:** `src/systems/enemies/NewEnemyBehaviours.ts`, `src/systems/WaveDirector.ts`, `src/systems/EnemySystem.ts`, `src/data/waves.ts`, `src/data/enemies.ts`, `src/graphics/meshes/NewEnemyMeshes.ts`.
- **Fix:**
  1. **Aerostat:** enemies within 8 m of a marked player get +20% speed for 4 s (data-driven).
  2. **Hydrobots:** WaveDirector supports `formation: { count: 12, spread: 3 }` spawns.
  3. **Turret:** spawns at a world position 15–25 m ahead of the player, has `leashExempt: true`, and despawns once it is more than 60 m behind.
  4. **Wave pools:** fix the T-1 and Minigunner starting minutes.
  5. **Elites:** apply scale and tint in each behaviour's `createVisual`.
  6. **Meshes:** share the Hydrobot geometries as static class members.
- **Wiring tests (real-system unit):**
  - After a mark, enemies' effective speed is 1.2× for 4 s.
  - One hydrobot spawn event creates 12 enemies.
  - The turret's position is unchanged after the player runs 60 m away.

#### P11-19 Passive and weapon stats that do nothing or backfire

- **Bugs:**
  - `durationMultiplier` and `speedMultiplier` (Ammo Belt and others) are never read, so those passives have no effect.
  - The K-9 bite sets `armorStripMultiplier = 1.4`, which _reduces_ damage taken by 29%.
  - Orbiters ignore the weapon's `area` stat.
  - With auto-aim off, Strike targets random spots, which re-introduces B6.
- **Files:** `src/systems/weapons/*.ts`, `src/systems/WeaponSystem.ts`.
- **Fix:**
  1. Every pattern multiplies projectile lifetime/zone duration by `durationMultiplier` and projectile speed by `speedMultiplier`.
  2. The K-9 bite applies a vulnerability (`armorStripMultiplier = 0.7`) so the target takes about 43% more damage.
  3. Orbiter radius is `baseRadius * stats.area * areaMultiplier`.
  4. Strike always uses `findNearestN`, whatever the auto-aim setting.
- **Wiring tests (real-system unit):**
  - With Ammo Belt at max, a napalm zone lives longer by the expected factor.
  - A bitten Infiltrator takes more damage than an unbitten one.
  - With auto-aim off, strikes land on enemies.

#### P11-20 Audio and lighting features half-wired

- **Gaps:**
  - Nothing emits `vfx:muzzle`, so muzzle flashes never use the light pool.
  - Only 4 of about 40 SFX call sites pass a position for stereo panning, and pan uses world dx instead of screen-space x.
  - Music layers set `.gain.value` every frame, which causes zipper noise.
  - "Adaptive music" is one track through three filters, while CHANGELOG calls it "multi-track".
- **Files:** `src/systems/weapons/*.ts`, `src/systems/enemies/*.ts`, `src/audio/AudioEngine.ts`, `src/graphics/SceneManager.ts`, `CHANGELOG.md`, `README.md`.
- **Fix:**
  1. Weapon patterns emit `vfx:muzzle` when they fire.
  2. Every combat SFX call passes `(x, z)`; `AudioEngine` converts this to screen-space pan through a `worldToPan` callback supplied by `SceneManager`.
  3. Use `setTargetAtTime` for layer gains.
  4. Rename the feature in the docs to "dynamic filter mix" until real stems exist; real stems must be cleared assets (see P0-03).
- **Wiring test (e2e):** fire the M-25 for 1 s and assert `getSceneCensus().visibleLights > 0` at some point during it. A unit test with a mocked AudioContext asserts that an explosion at screen right produces `pan > 0.3`.

---

### Group E — Hygiene, tests and documentation

#### P11-21 Debug API leaks and e2e build isolation

- **Bugs:**
  - `ErrorReporter.ts` reads `window.__GAME_DEBUG__`, which puts the string back into the production bundle.
  - `scripts/start-e2e.mjs` builds the e2e version into the same `dist/` folder as production, so a deploy made after an e2e run would ship god mode.
- **Files:** `src/core/ErrorReporter.ts`, `src/core/Game.ts`, `scripts/start-e2e.mjs`, `vite.config.ts`, `.github/workflows/ci-deploy.yml`.
- **Fix:**
  1. Pass a `getSeed` callback into `ErrorReporter` from `Game`.
  2. Build e2e into `dist-e2e/` (`build.outDir` driven by an env variable) and preview that folder.
  3. In CI, build production last, from a clean folder, and upload only `dist/`.
  4. Add `dist-e2e/` to `.gitignore`.
- **Acceptance:** a CI step that runs `! grep -r "__GAME_DEBUG__" dist/assets` passes. Grepping a _build artifact_ is the correct check here.

#### P11-22 Engine leaks and hot-path costs

- **Bugs:**
  - `InstancedPool` growth never calls `InstancedMesh.dispose()`, so the old instance buffer leaks.
  - Calling an `EventBus` unsubscribe twice can delete a newer listener set for the same event.
  - `mergeOldestCore` runs an O(n²) scan per spawn.
  - The audio retrigger gap is tracked per voice slot, not per sound.
  - Debris spawns twice on boss death.
  - Each debris chunk clones its material, costing up to 300 draw calls.
  - Several later-phase subscribers drop their unsubscribe handles: `HUDView`, `SceneManager`, `PostProcessing`, `InputManager`, `GameLoop`.
- **Files:** `src/graphics/InstancedPool.ts`, `src/core/EventBus.ts`, `src/systems/PickupSystem.ts`, `src/audio/AudioEngine.ts`, `src/systems/ParticleSystem.ts`, `src/systems/EnemySystem.ts`, plus the five subscriber files above.
- **Fix:**
  1. Call `oldMesh.dispose()` when an `InstancedPool` grows.
  2. Make unsubscribe idempotent by checking that the same set instance is still registered.
  3. Do the gem merge through a spatial-grid query.
  4. Track the retrigger gap per sound key.
  5. Spawn boss debris in one place only.
  6. Use one shared debris material per tint, or an `InstancedMesh`.
  7. Store and dispose the unsubscribe handles.
- **Wiring tests (unit):**
  - Growing an `InstancedPool` 4 times disposes 3 meshes.
  - Double unsubscribe leaves a newer listener intact.
  - Merging with 1000 cores takes under 2 ms (`performance.now()` budget, real `PickupSystem`).

#### P11-23 Performance budget measured honestly

- **Bugs:**
  - `check-bundle-size.mjs` only measures `index-*.js` and skips `three-vendor`.
  - Stage environments are imported statically, so the split chunk still loads eagerly.
  - The perf spec makes no FPS or draw-call assertions.
  - Its geometry-growth limit was loosened from 5% to 10%.
- **Files:** `scripts/check-bundle-size.mjs`, `src/core/Game.ts`, `src/graphics/environments/index.ts`, `tests/e2e/perf.spec.ts`.
- **Fix:**
  1. The size check sums every JS file referenced by `dist/index.html` plus its `modulepreload` links.
  2. Lazy-load stage environments with `import()` when the run starts.
  3. The perf spec asserts draw calls ≤ 60 with 500 enemies and geometry growth ≤ 5%; FPS is logged, not asserted.
- **Acceptance:** CI fails when initial JS exceeds the budget; set the budget to the current total + 5% and record the number in the roadmap.

#### P11-24 Replace hollow tests

- **Files:** every test file listed below.
- **Fix:** rewrite each one as a wiring test. Do not delete coverage: the new test must cover the same behaviour through real code.

  | Test file                                                                                  | What is wrong                                                                                                                             |
  | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
  | `p1_01_death.test.ts`                                                                      | Never checks `SaveManager.addRunResults`. Case 3 counts calls the test itself makes. Nothing covers B12 (`endRun` while a modal is open). |
  | `p1_04_pickup_freeze.test.ts`                                                              | Re-implements the level-up emission inside the test.                                                                                      |
  | `p1_07_vault_choice.test.ts`                                                               | Case 3 decrements the counter itself.                                                                                                     |
  | `p1_09_render_interpolation.test.ts`                                                       | The B14 case passes without the fix.                                                                                                      |
  | `p3_02_enemy_registry.test.ts`                                                             | Checks array lengths only; covered by P11-02.                                                                                             |
  | `p3_04_split_game.test.ts`                                                                 | Line-count assertions and heavy mocks. Keep the line-count check as a separate static check and add behaviour tests.                      |
  | `p7_01_achievements.test.ts`, `p7_02_codex.test.ts`                                        | Emit events by hand; covered by P11-13.                                                                                                   |
  | `p9_03_dynamic_lighting.test.ts`                                                           | Emits `vfx:muzzle` by hand; covered by P11-20.                                                                                            |
  | `p10_01_ci_hardening.test.ts`, `p10_04_versioning.test.ts`, `p10_05_release_audit.test.ts` | Grep config files. Delete them; CI itself is the check.                                                                                   |
  | `combatMath.test.ts`                                                                       | The newly added case re-implements the formula inline.                                                                                    |

- **Acceptance:** each rewritten test fails on `18851fb` (or on a deliberately broken local copy, if the fix already landed) and passes now. Note it in the commit body.

#### P11-25 Balance: early-game survivability and data-over-code

- **Observation (playtest of `18851fb`):** an idle player died at 0:14 with the starting loadout. Hydrobot swarms appear from minute 0.
- **Hard-coded numbers to move:**
  - into `src/data/*`: the recoil table (`WeaponSystem`), ally HP and taunt, drum damage (220), boss attack damage, Self-Destruct damage (28);
  - into `src/data/stages.ts`: Dog patrol and MeleeSweep timings.
- **Files:** `src/data/waves.ts`, `src/data/balance.ts`, the systems listed.
- **Fix:**
  1. Hydrobots appear from minute 1.
  2. **Target:** with the default loadout and no meta upgrades, a stationary player auto-firing survives at least 45 s, and a player circling at radius 8 m survives at least 120 s.
  3. Move the numbers listed above.
  4. Replace `Date.now()` in the Dog patrol and `setInterval` in `MeleeSweep` with simulated time.
- **Wiring test (real-system unit, seeded):** simulate 45 s with a stationary player and assert `hp > 0`. Run with 3 seeds.

#### P11-26 UI correctness leftovers

- **Bugs:**
  - Reroll and Banish call `show()` again without `a11y.deactivate()`, so the old keydown listener stays attached and arrow keys skip cards.
  - `EndRunModal` hides without deactivating, leaking one listener per run.
  - `getFocusables` lets hidden elements through because of `|| el.style.display !== 'none'`.
  - Gamepad Banish removes the first card when the Banish button itself is selected.
  - `prevPlayerPos` is not reset in `startRun`, so the first frame of a run can jump.
  - The `LevelUpModal` ticker uses `globalRNG` instead of `vfxRNG`.
  - `i18n` is never imported.
- **Files:** `src/ui/LevelUpModal.ts`, `src/ui/EndRunModal.ts`, `src/ui/A11yHelper.ts`, `src/core/Game.ts`, `src/core/RunController.ts`, `src/i18n/*`, `src/ui/TitleScreen.ts`, `src/ui/PauseModal.ts`, `src/ui/HUDView.ts`.
- **Fix:**
  1. `show()` deactivates any previous activation, and `hide()` always deactivates.
  2. Fix the visibility filter in `getFocusables`.
  3. Banish uses the last _focused card_ index.
  4. Reset `prevPlayerPos` in `startRun`.
  5. Switch the ticker to `vfxRNG`.
  6. Route the title, pause, level-up and end-run strings through `t()`, and add a `pseudo` locale (wraps strings in `⟦…⟧`) behind a dev setting.
- **Wiring tests (e2e):**
  - After 2 rerolls, one ArrowRight press moves exactly one card.
  - With the `pseudo` locale, the title buttons render with `⟦`.

#### P11-27 Documentation and asset honesty

- **Files:** `README.md`, `CHANGELOG.md`, `ASSETS.md`, `CLAUDE.md`, `src/ui/TitleScreen.ts`.
- **Fix:**
  1. **README:** remove the claim that the Fiedel film score is included and the "60 FPS" claim; update the interpolation note (it has shipped).
  2. **CHANGELOG:** correct false entries (multi-track music, Lighthouse, any feature P11 found hollow), and add a 1.11.0 entry for this phase.
  3. **ASSETS.md:** change guessed sources ("Konami", "Rocksteady / WB", "Teyon / Reef", "Sound library", "Project-owned CC0") to `UNKNOWN (suspected: …)` unless proof is linked. Icons are `UNKNOWN` until the owner confirms.
  4. **Title screen:** add the fan-project disclaimer footer.
  5. **P10-05:** either add real Lighthouse CI (`@lhci/cli` dev dependency plus `lighthouserc.json`; this needs owner approval for the new dependency) or remove the claim. Do not keep the grep test.
- **Acceptance:** a human reviewer can match every README and CHANGELOG claim to code.
- **Still open, owner action:** P0-03, replacing assets marked REPLACE, needs the owner to choose replacements.

---

### Phase 11 exit criteria

- [ ] Every task above is DONE with a wiring test, and its commit body says the test fails on `18851fb`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:e2e` (including the `integration` project) all pass.
- [ ] Manual playtest checklist, recorded in the final commit body:
  - deploy → stage select → threat → play to a boss → vault → evolution → achievement toast;
  - die and start a new run, with no leftover boss mesh;
  - win → Continue (endless) → die, with results banked once;
  - reload with reduced motion on, and no screen shake.
- [ ] Production `dist/` contains no `__GAME_DEBUG__`.

---

## 5. Score Targets per Phase

| After phase                        | Correctness | Perf | Content | Feel | UX/A11y | Tests |        Assets/IP         | Overall |
| ---------------------------------- | :---------: | :--: | :-----: | :--: | :-----: | :---: | :----------------------: | :-----: |
| Today                              |      5      | 5.5  |    5    |  6   |   3.5   |   6   |            2             | **52**  |
| 0–1                                |      8      | 5.5  |    5    |  6   |   3.5   |   7   |            7             |   61    |
| 2–3                                |     8.5     | 8.5  |    5    |  6   |   3.5   |  7.5  |            7             |   67    |
| 4–5                                |     8.5     | 8.5  |   7.5   | 8.5  |    4    |   8   |            7             |   76    |
| 6–7                                |     8.5     | 8.5  |    9    | 8.5  |   4.5   |   8   |            7             |   82    |
| 8–10                               |      9      |  9   |    9    |  9   |   8.5   |   9   |            8             | **90+** |
| **Audited 2026-10-18 (`18851fb`)** |     5.5     | 7.5  |    6    |  7   |    5    |   6   |           2.5            | **62**  |
| 11                                 |     8.5     | 8.5  |    8    |  8   |   7.5   |  8.5  | 4 (owner: 8 after P0-03) |  78–82  |

The audited row shows where Phases 0–10 actually landed. After Phase 11, Assets/IP remains capped until the owner completes P0-03.

---

## 6. Handoff Prompt Template

Use this to dispatch a single task to an implementation agent:

```
You are working in the Terminator Survivors repo (TypeScript + Three.js + Vite).
Read CLAUDE.md and roadmap.md Section 3 (Working Rules) first.
Implement task <TASK-ID> from roadmap.md exactly as written.
- Only edit the files listed under the task (plus tests).
- Add the regression test described. For Phase 11 it must be a "wiring test"
  as defined at the top of Phase 11 (no hand-emitted events, no file greps,
  no mocking the system under test) and must fail on commit 18851fb.
- Run: npm run typecheck && npm run lint && npm run test:unit
- Commit with message "<type>(<area>): <TASK-ID> <summary>".
When finished, reply with: files changed, tests added, command output summary,
how a player reaches the change in the running game, and any TODO(roadmap)
comments you left. Do not claim anything you did not verify.
```

For a full phase, run the tasks in the listed order, then run `npm run build` and `npm run test:e2e` once at the end of the phase.
