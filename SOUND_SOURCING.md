# Sound sourcing list

Updated 2026-10-21 after wiring the owner's sound library. Sounds live in `SFX_WAV_MANIFEST` in `src/audio/AudioEngine.ts`.

**Format for new files:** WAV, 44.1 kHz, 16-bit, mono, trimmed tight. Files must sit **directly** in `public/audio/effects/` (subfolders there are not shipped). Name them `category_01.wav`, `category_02.wav`… and wiring is one line. The raw library the current files came from is at `Documents/TerminatorSurvivors_sound_library` (outside the repo).

## Done

| Category | Files | Used for |
| --- | --- | --- |
| `endoHit` | 7 metal/car hits | every hit on an enemy |
| `endoDestroy` | 7 sparks/electrical | humanoid deaths |
| `deathDrone`, `deathMachine`, `deathBoss` | 5, 4, 3 | small, large/flying, boss deaths |
| `explodeSmall`, `explodeMed`, `explodeLarge` | 5, 7, 6 | explosions picked by size |
| `explodeDrum` | 3 | fuel drums |
| `plasmaLight` | 8 | M-25 |
| `rifle`, `railgun` | 8, 4 | M-16, M95A1 (set by `sfx` in `src/data/weapons.ts`) |
| `shotgun` | 8 | Ithaca, Trench Sweeper |
| `throw`, `launchGrenade`, `launchRocket` | 2, 1, 2 | pipe bombs; M79/MM1; RPG/Tandem (set by `launchSfx`) |
| `enemyPlasma`, `enemyHeavy`, `minigun` | 8, 7, 1 | enemy fire, now distinct from the player's |
| `empBlast` | 3 | EMP |
| `fireWhoosh` | 5 | napalm, molotov, firestorm |
| `swing` | 10 | blades, claws, lunges |
| `playerHit` | 6 | player damage |
| `stepPlayer` | 8 | footsteps |
| `lootHeal`, `lootScrap`, `crateBreak`, `vaultOpen` | 2, 3, 4, 2 | crates and vaults |
| `achievement` | 2 | achievement toast (no longer shares the vault sound) |
| `aerialRockets`, `bombBeep` | 1, 1 | HK missile salvo warning, Self-Destruct elite |
| `ambBed`, `ambDistant` | 60 s loop, 7 | battle ambience and random distant explosions |

## Still missing

- **Per-boss stingers** (5) and boss phase-change cues; `bossStinger` and `hkAlert` still share files.
- **Telegraph cues:** Tank mortar whistle, searchlight lock, strafing run, Core spokes, T-1000 landing.
- **Character abilities** (6), none with their own sound.
- **Weapons:** shotgun pump rack, molotov glass break, laser designator/ion charge and beam, K-9 bark/bite, drone hum/zap, T-800 ally boot-up.
- **Enemies:** endoskeleton footsteps, HK flyover hum, tank treads, T-1000 liquid-metal sounds.
- **UI:** distinct pause/resume pair, level-up card hover/select, reroll, banish; `uiError` still includes a sound from another game.
- **Music:** real calm/combat/boss stems (the game has one track split by filters).

The library has candidates for some of these that were not wired: `Objects/Turret` (servo turn), `Objects/SilverFish` (skitter), `Reload` (pump racks), `Objects/S_BombBeep*` (longer countdowns) and the character voice folders (unheard, so skipped).
