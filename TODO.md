# TODO

Private project, kept local until the owner has playtested and decides to push (2026-10-21).

Typecheck, 117 unit tests, a production build and 2 e2e tests pass. `dist/` has no `__GAME_DEBUG__`.

## Done

- Removed: Daily operation, endless mode and leaderboard, threat levels, bunker defence stage, the four extra stages and their environments, the tutorial, the Deploy modal (Deploy now starts a run with the selected loadout), the i18n scaffold, and the achievements tied to them. Gamepad haptics kept. Victory now ends the run.
- Assets: audio and icons confirmed owner-made; `ASSETS.md` is a short summary.
- T-1000 softened (HP 3800, slower, smaller hits, longer puddle and lunge cooldowns, 1%/s regen); numbers are in `T1000_TUNING` in `src/data/balance.ts`.
- Hydrobot formation is 6 (was 12), spread 2.5 (`HYDROBOT_FORMATION` in `src/data/waves.ts`).
- Seeker Drone and Perimeter Ring have new visuals: dark hull, glowing eye, spinning rotor, soft halo, a ground ring showing the orbit path, and a magenta look for the evolved ring.
- Boss and enemy bug fixes: telegraphs for Tank twin cannon, Core spokes, T-1000 reappear (now dodgeable) and the Self-Destruct elite blast; attack cooldowns can no longer fire instantly when the player re-enters range (`attackTimer.ts`); elites that are not instanced get scale and an aura; Hydrobot geometry is shared; `EndRunModal` no longer leaks a key listener.
- Earlier this session: debug-API leak, K-9 bite, duration/speed passives, interactables, boss attacks that did nothing, Aerostat/Hydrobot/Turret behaviour, wave start minutes.
- A second e2e test spawns every enemy and boss type, fast-forwards, and fails on any runtime error. It is the playtest substitute, not a real playtest.

## Still open

1. **Playtest.** Nothing here has been played. Check: T-1000 difficulty after the nerf, the new drone and ring look, Hydrobot groups of 6, Aerostat speed buff, turret staying put, the first minute of a run (an idle player used to die at 0:14).
2. **Boss attack damage** values for Tank, Core, HK Aerial, Infiltrator and T-800 are still hard-coded in the behaviour files rather than `src/data`.
3. **HK Aerial** attacks other than the salvo were not reviewed for telegraphs.
4. **Leftovers from the removals** that compile but are now dead or odd: the Codex "Theater of War" tab lists a single stage, `hud-jammed` CSS, `StageId` is a one-value type, `STAGE_CODEX` has one entry. Delete if they bother you.
5. **Save compatibility.** Old saves keep their extra fields (`dailyAttempts`, `endlessHighScores`, `stageBestTimes`, `tutorialCompleted`); they are ignored on load and dropped on the next save.

## Decisions already made

- Keep local, do not push to `main` yet.
- Third-party font (`terminator-real-nfi`) is personal / non-commercial freeware; revisit only if the game is ever published.
- Dropped for good: interactive tutorial, audio panning and muzzle lights, music stems, performance and bundle budgets, i18n.
