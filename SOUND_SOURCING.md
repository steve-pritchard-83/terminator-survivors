# Sound sourcing list

Updated 2026-10-21 after the declutter (variant pools capped at 3–4, cut weapons' sounds removed). Sounds live in `SFX_WAV_MANIFEST` in `src/audio/AudioEngine.ts`.

**Format for new files:** WAV, 44.1 kHz, 16-bit, mono, trimmed tight. Files must sit **directly** in `public/audio/effects/` (subfolders there are not shipped). Name them `category_01.wav`, `category_02.wav`… and wiring is one line. The raw library the current files came from is at `Documents/TerminatorSurvivors_sound_library` (outside the repo).

## Done

| Category | Files | Used for |
| --- | --- | --- |
| `endoHit` | 4 metal/car hits | every hit on an enemy |
| `endoDestroy` | 4 sparks/electrical | humanoid deaths |
| `deathDrone`, `deathMachine`, `deathBoss` | 3, 4, 3 | small, large/flying, boss deaths |
| `explodeSmall`, `explodeMed`, `explodeLarge` | 3, 4, 4 | explosions picked by size |
| `explodeDrum` | 3 | fuel drums |
| `plasmaLight` | 4 | M-25 |
| `railgun` | 4 | M95A1 (set by `sfx` in `src/data/weapons.ts`) |
| `shotgun` | 4 | Ithaca |
| `throw`, `launchGrenade`, `launchRocket` | 2, 1, 2 | pipe bombs; fallback; RPG/Tandem (set by `launchSfx`) |
| `enemyPlasma`, `enemyHeavy`, `minigun` | 4, 4, 1 | enemy fire, now distinct from the player's |
| `empBlast` | 3 | EMP |
| `fireWhoosh` | 3 | molotov, Firestorm Lane |
| `swing` | 4 | blades, claws, lunges |
| `playerHit` | 3 | player damage |
| `stepPlayer` | 4 | footsteps |
| `lootHeal`, `lootScrap`, `crateBreak`, `vaultOpen` | 2, 3, 3, 2 | crates and vaults |
| `achievement` | 2 | achievement toast (no longer shares the vault sound) |
| `aerialRockets`, `bombBeep` | 1, 1 | HK missile salvo warning, Self-Destruct elite |
| `ambBed`, `ambDistant` | 60 s loop, 4 | battle ambience and random distant explosions |
| `pumpRack` | 3 | Ithaca racks a shell 0.35 s after each blast |
| `shotgunAuto` | 4 (SPAS, Remington) | Trench Sweeper Auto-12 (no pump rack) |
| `glassBreak` | 3 | molotov, Firestorm Lane |
| `strikeLock`, `strikeBeam` | 1, 4 | laser designator and orbital ion |
| `droneZap` | 4 | seeker drones and perimeter ring hits |
| `servo` | 3 | T-800 ally reboot |
| `stepEndo` | 4 metal steps | nearest walking endoskeleton within 10 m |
| `hitLiquid` | 3 water hits | hits on the T-1000 |
| `bossAerial`, `bossTank`, `bossCore` | 3, 2, 2 | engine/alarm layered on the boss stinger |
| `revive`, `evolution`, `flareLaunch` | 1, 1, 1 | revive, weapon evolution, supply-drop flare |
| `uiError` | `S_NoAmmo` replaces the other game's error sound | |

## Still missing (checked against the library on 2026-10-21; nothing suitable there)

- **K-9:** bark, growl, bite. The library has no animal sounds.
- **Telegraph cues:** Tank mortar incoming whistle, searchlight lock-on tone, strafing run, Core spoke charge, T-1000 landing.
- **Boss stingers** for the Infiltrator and T-1000, and phase-change cues.
- **T-1000 liquid-metal** morph and flow sounds (only hits are covered).
- **UI:** a distinct pause/resume pair, level-up card hover/select, reroll.
- **Music:** real calm/combat/boss stems (the game has one track split by filters).

## In the library but not wired (they need positional loops or new behaviour)

- Loops: `Objects/S_AerialEngine*` and `S_DroneEngine` (flyover and drone hum), `Objects/TankContainers/S_TankMovement` (treads), `Ambient Part1/Fire` and `Objects/BarrelFire` (fire crackle for craters and wrecks), `Objects/S_LaserBeamLoop`.
- `All/S_NearMiss*` (enemy bolts passing close), `Objects/SilverFish/SilverFishRun*` (crab drone skitter), `Objects/S_FuseBurning` (pipe-bomb fuse).
- Voice folders (John Connor, Resistance soldiers, radio station lines) were skipped because their content can't be checked from file names.
