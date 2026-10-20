# TODO

Result of auditing the old `roadmap.md` against the code (2026-10-21, commit `9107914`).
Phases 0–10 and Phase 11 tasks P11-00 to P11-13 are done. The rest of Phase 11 (P11-14 to P11-27) has no commits; the code confirms it is still open. Full original specs are in git history (`git show 9107914:roadmap.md`).

Order is by player impact. Do one at a time; typecheck after each.

## Real bugs (fix)

1. **Interactables break after the first run** (P11-14). `InteractiveEnvironmentSystem` has no `reset()`: drums and cars spawn only in the constructor, `lastFlareDropTime` never resets (supply drops stop after run 1). `Game.ts:167` pushes car colliders onto `obstacleColliders` every tick (unbounded growth). Drums are not in the spatial grid when weapons run, and a drum kill can emit `enemy:killed` and then kill again (double XP / double `endRun`).
2. **Boss attacks that do nothing** (P11-17).
   - HK Aerial salvo circles land 3.8 m from the player with a 2.2 m radius, so they never hit.
   - HK Tank searchlight "in front" check compares an angle with itself.
   - T-1000 `isPuddle` is set but never read in `WeaponSystem.applyDamageToTarget`, so it stays targetable.
   - Napalm does not stop T-1000 regen (no `burnTimer` anywhere).
   - Attack timers keep counting below 0 out of range, so attacks fire with no telegraph.
3. **K-9 bite makes enemies tougher** (P11-19). `DogUnit.ts:169` sets `armorStripMultiplier = 1.4`; `WeaponSystem.ts:400` divides by it, so damage taken drops 29%. Use 0.7.
4. **`durationMultiplier` / `speedMultiplier` are never read** (P11-19). Ammo Belt and similar passives do nothing. Orbiters ignore weapon `area`.
5. **Enemy features that do nothing** (P11-18). Aerostat mark gives no speed buff; Hydrobots spawn singly (no formation of 12); Plasma Turret is teleported by the leash instead of staying put; T-1 / T-600 Minigunner appear before minute 3.
6. **Early game too deadly** (P11-25). An idle player died at 0:14; Hydrobot swarms appear from minute 0. Move them to minute 1 and check a stationary player survives 45 s. `DogUnit.ts:125` uses `Date.now()` and `MeleeSweep.ts:35` uses `setInterval` (should use simulated time).
7. **Production build leaks the debug API** (P11-21). `ErrorReporter.ts:31` reads `window.__GAME_DEBUG__`, and `scripts/start-e2e.mjs` builds into the same `dist/` as production. Pass a `getSeed` callback instead, and build e2e into `dist-e2e/`.
8. **Modal listener leaks** (P11-26). Reroll/Banish call `show()` again without `a11y.deactivate()`; `EndRunModal` hides without deactivating; `getFocusables` lets hidden elements through; `prevPlayerPos` is not reset in `startRun`.

## Honesty fixes (cheap, do together)

9. **README claims** (P11-27). Line 36 says the Brad Fiedel score is included; line 71 claims 60 FPS. The title screen has no fan-project disclaimer footer (the README has one).
10. **ASSETS.md** guessed sources ("Konami", "Rocksteady / WB", …) should read `UNKNOWN (suspected: …)`. Owner must still choose replacements for REPLACE rows (P0-03) before any public release.

## Owner decisions

- **P0-03:** replace the assets marked REPLACE in `ASSETS.md` (commercial-game SFX names, film score). Blocks public release.
- **Which features to cut.** The cheapest long-term saving is deleting modes you don't play: Daily operation, endless leaderboard, threat levels, bunker stage, i18n scaffold, gamepad haptics, extra stages.

## Dropped on purpose (cost more than they are worth)

Interactive 60 s tutorial (P11-16), audio panning/muzzle-light wiring and true music stems (P11-20), InstancedPool/EventBus/debris micro-fixes (P11-22), bundle-size and perf budgets (P11-23), rewriting hollow tests (P11-24; the hollow tests were deleted instead), `i18n` routing (P11-26 part).
