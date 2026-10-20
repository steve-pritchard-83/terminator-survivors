# TODO

Result of auditing the old `roadmap.md` against the code, then working through it (2026-10-21).
Full original specs are in git history (`git show 9107914:roadmap.md`, Phase 11 section).

Typecheck, 112 unit tests, a production build and the e2e smoke test pass. `dist/` contains no `__GAME_DEBUG__`; the e2e build goes to `dist-e2e/`.

## Fixed in this pass

- Debug API no longer leaks into production (`ErrorReporter` takes a seed provider; e2e builds into `dist-e2e/`).
- K-9 bite makes targets take ~43% more damage (was 29% less); value in `src/data/balance.ts`.
- `durationMultiplier` / `speedMultiplier` now apply to spread, straight, ground-zone and orbiter weapons; orbiters use the weapon's `area`. Lobbed and Nova do not use these stats yet.
- Interactables respawn every run, car colliders are rebuilt per tick, drums are in the spatial grid, drum blasts no longer double-kill.
- HK Aerial salvo can hit, HK Tank searchlight is a turning beam, T-1000 puddle is untargetable, fire (ground zones) stops T-1000 regen.
- Aerostat mark buffs nearby enemies +20% for 4 s, Hydrobots spawn as a formation of 12, Plasma Turret is a fixed emplacement that despawns far behind the player.
- Hydrobots start at minute 1, T-1 and T-600 Minigunner at minute 3. Tunables are in `src/data/waves.ts`.
- Melee slash fade and dog patrol use simulated time.
- Level-up modal: re-activation no longer stacks key listeners, Banish uses the last focused card, hidden elements are not focusable, ticker uses `vfxRNG`.
- README no longer claims the film score, "60 FPS" or planned interpolation; title screen has the fan-project disclaimer; ASSETS.md guessed sources are marked `UNKNOWN (suspected: …)` and icons are `UNKNOWN`.
- `tests/e2e/game-desktop.spec.ts` updated for the Deploy modal.

## Still open

1. **Balance not measured.** An idle player died at 0:14 before the Hydrobot change. Nobody has checked that a stationary player now survives 45 s. Play it once or simulate it.
2. **Boss telegraphs and timers** (P11-17 remainder). No telegraph on the Tank twin cannon (18x2), Core spokes (16), T-1000 reappear hit (24) or Self-Destruct elite (28). Attack timers keep counting below 0 while the player is out of range, so attacks can fire with no warning on re-entry. Boss attack damage values are still hard-coded in the behaviour files.
3. **Elites** (P11-18 remainder): scale and tint only work for instanced enemies. Hydrobot meshes allocate about 6 geometries per spawn (and now spawn 12 at a time, so share them).
4. **Modal leftovers** (P11-26 remainder): `EndRunModal` and other modals should be checked for listener leaks now that `activate()` is idempotent; `i18n` is still never imported.
5. **Unverified by play.** The fixes above typecheck and the smoke test passes, but none of the boss, turret, formation or interactable changes have been playtested. Run a boss fight at each of minutes 2, 4, 6, 8 with `__GAME_DEBUG__.spawnBoss`.

## Owner decisions

- **P0-03:** replace the assets marked REPLACE in `ASSETS.md` (commercial-game SFX names, film score, `terminated.wav`). Blocks any public release.
- **Which features to cut.** The cheapest long-term saving is deleting modes you don't play: Daily operation, endless leaderboard, threat levels, bunker stage, i18n scaffold, gamepad haptics, extra stages.

## Dropped on purpose

Interactive 60 s tutorial (P11-16), audio panning/muzzle-light wiring and true music stems (P11-20), InstancedPool/EventBus/debris micro-fixes (P11-22), bundle-size and perf budgets (P11-23), rewriting hollow tests (P11-24; they were deleted), full `i18n` routing.
