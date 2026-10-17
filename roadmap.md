# Terminator Survivors — Audit & Roadmap

> **Audience:** this file is written to be handed to an implementation agent (including a smaller LLM) one phase at a time. Every task names the files to touch, the exact change, and how to prove it is done. Read **Section 3 (Working Rules)** before starting any task.

Audit date: 2026-10-17 · Commit audited: `421acc4` · Size: ~10.4k lines TypeScript (`src/`), 8 unit test files (40 tests, all passing), 3 Playwright specs.

---

## 1. Audit Scorecard

| # | Category | Score | Summary |
|---|----------|:----:|---------|
| 1 | Architecture & code organisation | **6.5 / 10** | Clean folder split (core / systems / graphics / ui / data), typed event bus, data-driven weapons/enemies/waves. But `EnemySystem` and `WeaponSystem` are big `if/switch` ladders keyed on string IDs, `Game.ts` is a god object, and pause state is tracked twice (`isPaused` + `runState.mode`). |
| 2 | Correctness | **5 / 10** | Several real gameplay bugs (Section 2.1): death can fire `endRun` multiple times in one frame, revivals refill on every passive pick, multi-level XP is dropped, level-up can re-trigger while the modal is open, drone damage ignores Might and weapon stats. |
| 3 | Performance & memory | **5.5 / 10** | Good: instanced endoskeletons, spatial hash, particle pool. Bad: a new `THREE.Mesh` per bullet/pellet/XP gem, per-boss meshes never `dispose()`d (GPU leak across runs), one DOM node + `setTimeout` per damage number, pixel-ratio governor does not resize the post-processing composer. |
| 4 | Gameplay depth & content | **5 / 10** | 8 weapons / 8 passives / 8 evolutions / 10 enemy types / 1 map / 10-minute run. Boss "abilities" in the README (T-1000 puddle teleport, blade flurries, regen) are visual-only — not implemented. Weapon level descriptions do not match the generic stat formula. Only one stage. |
| 5 | Game feel ("juice") | **6 / 10** | Screen shake, hit flash, bloom, damage flash, dash afterimage, combo pitch on pickups are present. Missing: knockback (promised in text), hit-stop, enemy death debris, low-HP feedback, readable telegraphs for most attacks. |
| 6 | Presentation (art & audio) | **7 / 10** | Strong procedural Three.js look, chunked endless environment, volumetric searchlights, real SFX library, gapless music. No music intensity layering, no voice limiting, all SFX at same spatial position. |
| 7 | UX & accessibility | **3.5 / 10** | Zero ARIA roles/labels, no reduced-motion / screen-shake / flash toggles, no key remapping, no colour-blind support, no first-run tutorial, no pause-on-blur. Gamepad and touch support are good. |
| 8 | Testing & CI | **6 / 10** | Typecheck + Vitest + Playwright (desktop, mobile, offline) in CI. No lint, no coverage gate, no tests for the bugs above, no performance budget test. |
| 9 | Documentation accuracy | **5 / 10** | README is polished but over-claims (fixed-timestep "lerped rendering" — `alpha` is ignored; T-1000 abilities; "heavy knockback"). No CLAUDE.md / contributor guide. |
| 10 | Asset & IP hygiene | **2 / 10** | Music described as Brad Fiedel's score, a third-party "Terminator" font, and SFX files whose names suggest they were extracted from other commercial games (`Frogger_Error.wav`, `S_DetectiveMode*.wav`, `S_HUD_Infiltrator_*.wav`). No provenance or licence record exists. This is the single biggest risk to publishing the game publicly. |

### Overall: **52 / 100**

A solid, playable vertical slice with good technical bones. To be "the best Terminator game available" it needs: (1) bugs and leaks fixed, (2) a scalable architecture for enemies/weapons, (3) 3–5× more content with real boss mechanics, (4) proper game feel, accessibility and meta-progression, and (5) a clean asset-provenance story.

---

## 2. Detailed Findings (referenced by task IDs later)

### 2.1 Correctness bugs

| ID | File:line | Bug | Impact |
|----|-----------|-----|--------|
| B1 | `src/core/Game.ts:167-181`, `src/systems/EnemySystem.ts:304-314` | `player:damaged` is emitted for every hit. Once `hp` hits 0, `takeDamage` still returns ≥1 (mitigation floors at 1), so every further hit in the same frame calls `endRun(false)` again. | Duplicate `addRunResults` → scrap/kills counted multiple times; end modal re-shown. |
| B2 | `src/state/RunState.ts:152` | `revivalsLeft = Math.max(revivalsLeft, base.revivals)` runs on every `recalculateStats()` (i.e. every passive pick). | Used revivals are silently refilled. Also `initRun` never resets `revivalsLeft`, so state leaks between runs. |
| B3 | `src/state/RunState.ts:161-171` | `addXp` levels up at most once per call even if XP exceeds several thresholds. | Big XP drops (bosses give 180–1500 XP) waste levels or cause a chain of single level-ups on later pickups. |
| B4 | `src/systems/PickupSystem.ts:121-160`, `src/core/Game.ts:200-211` | Pickup loop keeps collecting after a level-up in the same frame; a second `levelup:triggered` replaces the open modal's callback. | Lost upgrade choices; modal state confusion. |
| B5 | `src/systems/WeaponSystem.ts:575` | Seeker drone / Perimeter Ring damage is hard-coded (`18 + level*4`, `48`), ignores `mightMultiplier`, weapon level table and crit design; applied every fixed tick (60×/s) producing 60 damage numbers/s per enemy. | Balance broken; floating-text spam. |
| B6 | `src/systems/WeaponSystem.ts:363` | Orbital Ion fires a hard-coded 3 strikes, ignoring `amount` and `bonusAmount`. Laser Designator targets the same `nearest` enemy for every strike. | Passives that add projectiles do nothing; strikes stack on one target. |
| B7 | `src/systems/PickupSystem.ts:179-191` | Boss vault without an evolution applies `choices[0]` of a random shuffle 3× — includes medkit/scrap filler and never shows the player what they got. | Feels random/unrewarding. |
| B8 | `src/graphics/SceneManager.ts:136-142` | `adjustQuality` calls `renderer.setPixelRatio` but never resizes the `EffectComposer`/bloom targets; can also oscillate between 1.0 and 1.5 every 0.5 s. | Blurry/mismatched post-processing, frame hitches. |
| B9 | `src/core/Game.ts:420-422`, `src/core/GameLoop.ts` | `render(alpha)` ignores `alpha`; camera is moved in `fixedUpdate`. | Judder on 120/144 Hz displays; README claim is false. |
| B10 | `src/core/RNG.ts`, multiple files | `globalRNG` is never reseeded per run, and 50 call-sites use `Math.random()` anyway. | No reproducible runs; blocks daily-seed mode and deterministic tests. |
| B11 | `src/systems/EnemySystem.ts:483-527` | Boss/HK/T-1000/Infiltrator/Core meshes and cloned reticle materials are removed but never `dispose()`d. Same for pickup meshes, enemy bolts and transient VFX (`WeaponSystem.ts:133-136`). | GPU memory grows every run. |
| B12 | `src/core/Game.ts:258-286` | `endRun` can be called while a level-up/vault modal is open (e.g. napalm kills the Core). | Overlapping modals. |
| B13 | `src/systems/EnemySystem.ts:265-271` | Contact damage cooldown only decrements while in contact; an enemy that touches, leaves, and returns hits instantly. Minor. | Spiky damage. |
| B14 | `src/graphics/SceneManager.ts:116-128` | `worldToScreen` reuses `tempTarget`, the vector also used by `updateCamera`. Works by accident today. | Fragile; will break if call order changes. |

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
2. **Before starting a task**, read every file listed under *Files*. Do not edit files not listed unless the task says "and any callers"; if you must, explain why in the commit body.
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
10. If a task is ambiguous, implement the smallest version that satisfies the *Acceptance criteria* and leave a `// TODO(roadmap <task-id>):` comment describing what was skipped.

### Definition of Done (every task)
- [ ] Acceptance criteria met.
- [ ] Typecheck and unit tests pass.
- [ ] New/changed behaviour covered by a test (or the task states why not, e.g. purely visual).
- [ ] No new `Math.random()` in gameplay code, no undisposed per-entity GPU resources.
- [ ] README updated if a user-visible feature or control changed.

---

## 4. Phase Overview

| Phase | Theme | Goal | Est. size |
|------:|-------|------|-----------|
| 0 | Foundations & asset provenance | Make the project safe to publish and easy for agents to work in | S |
| 1 | Correctness | Fix every bug in 2.1 with regression tests | M |
| 2 | Performance | Hold 60 FPS with 600 enemies on a mid-range laptop; no memory growth across runs | M |
| 3 | Architecture | Registries for enemies/weapons, state machine, split `Game.ts` | L |
| 4 | Game feel | Knockback, hit-stop, telegraphs, death debris, low-HP feedback | M |
| 5 | Combat content | Real boss fights, elites, new enemies and weapons | L |
| 6 | Stages & modes | 3 new stages, endless mode, daily seeded run, threat levels | L |
| 7 | Meta-progression | Achievements, codex, run history, deeper loadouts | M |
| 8 | UX & accessibility | Menus, settings, remapping, tutorial, a11y | M |
| 9 | Audio & visual polish | Adaptive music, voice limiting, lighting, weather | M |
| 10 | Release engineering | Lint, coverage, perf budget, telemetry, versioning | S |

Phases 0–3 must be done in order. Phases 4–9 may be done in any order after Phase 3. Phase 10 tasks can be pulled forward at any time.

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
- **Note for owner:** the game uses the *Terminator* name and characters. That is fine for a free, non-commercial fan project, but it cannot be sold or monetised without a licence from the rights holder. Add a short fan-project disclaimer to the title screen footer and README.

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
- **Steps:** In `initRun`, set `revivalsLeft = 0` before `recalculateStats()`, then after it set `revivalsLeft = computedStats.revivals`. Remove the `Math.max` line from `recalculateStats`; instead, if a passive increases `computedStats.revivals`, add only the *delta* to `revivalsLeft`.
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

| Boss | Phase 1 | Phase 2 (< 50% HP) | Phase 3 (< 20% HP) |
|------|---------|--------------------|--------------------|
| Infiltrator CSM-101 | 3-round plasma burst; walk-and-shoot | Charges in a straight line (cone telegraph), smashes cars | Skin burns away → endoskeleton visual, faster, calls 6 crab drones |
| HK Tank Goliath | Artillery reticle (existing) | Twin searchlight sweep — standing in light = 3 s lock then barrage | Crushes obstacles in path; spawns T-600s from rear hatch |
| HK Aerial Command | Strafing run line telegraph | Calls 2 HK patrol escorts; missile salvo (6 circles) | Dives for kamikaze impact (large circle) |
| T-1000 | Blade lunge (line) + slash combo | Liquid puddle: becomes untargetable 1.5 s, reappears behind player | Regenerates 2%/s unless hit by EMP or napalm (freeze/melt counterplay) |
| Skynet TDE Core | Rotating plasma spokes | Temporal nova (existing) + spawns T-800 waves | Time-displacement pulses that pull player toward core; final 30 s countdown |

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
- **M-16 Plasma Carbine** (Straight burst) → *Phased Plasma Assault*.
- **RPG Launcher** (Lobbed, single large) → *Tandem Warhead*.
- **Molotov / Incendiary** (GroundZone line) → *Firestorm Lane*.
- **Dog Unit (Resistance K-9)** (new pattern: autonomous ally that bites infiltrators, reveals T-1000) → *K-9 Pack*.
- **Reprogrammed T-800 Ally** (new pattern: summon with HP, taunts) → *Guardian Protocol* (very rare, late unlock).
- **Coltan Knife / Melee Sweep** (new pattern: arc) → *Hyperalloy Blade*.
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
- 10 stackable modifiers unlocked after first victory (e.g. *Enemy +25% HP*, *Pickups expire*, *No revives*, *Bosses enraged*, *Night vision only*). Each adds +X% scrap. Shown on run summary.

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
- Each loadout gets a unique active ability on a cooldown (bound to a new "Ability" input): Reese 2029 = *Pipe-bomb Barrage*, Reese 1984 = *Sawed-off Dual Wield* (10 s), Sapper = *Overcharge* (no cooldowns 4 s), John Connor = *Rally* (temporary ally squad). Add 2 new loadouts: **Sarah Connor** (T2 era, minigun-style passive) and **Reprogrammed T-800** (high HP, no dash, slow regen).

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

## 5. Score Targets per Phase

| After phase | Correctness | Perf | Content | Feel | UX/A11y | Tests | Assets/IP | Overall |
|-------------|:----------:|:----:|:-------:|:----:|:-------:|:-----:|:---------:|:-------:|
| Today | 5 | 5.5 | 5 | 6 | 3.5 | 6 | 2 | **52** |
| 0–1 | 8 | 5.5 | 5 | 6 | 3.5 | 7 | 7 | 61 |
| 2–3 | 8.5 | 8.5 | 5 | 6 | 3.5 | 7.5 | 7 | 67 |
| 4–5 | 8.5 | 8.5 | 7.5 | 8.5 | 4 | 8 | 7 | 76 |
| 6–7 | 8.5 | 8.5 | 9 | 8.5 | 4.5 | 8 | 7 | 82 |
| 8–10 | 9 | 9 | 9 | 9 | 8.5 | 9 | 8 | **90+** |

---

## 6. Handoff Prompt Template

Use this to dispatch a single task to an implementation agent:

```
You are working in the Terminator Survivors repo (TypeScript + Three.js + Vite).
Read CLAUDE.md and roadmap.md Section 3 (Working Rules) first.
Implement task <TASK-ID> from roadmap.md exactly as written.
- Only edit the files listed under the task (plus tests).
- Add the regression test described.
- Run: npm run typecheck && npm run test:unit
- Commit with message "<type>(<area>): <TASK-ID> <summary>".
When finished, reply with: files changed, tests added, command output summary,
and any TODO(roadmap) comments you left.
```

For a full phase, run the tasks in the listed order, then run `npm run build` and `npm run test:e2e` once at the end of the phase.
