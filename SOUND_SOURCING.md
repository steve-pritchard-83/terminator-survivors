# Sound sourcing list

Audit of `src/audio/AudioEngine.ts` and every `audio.play*` call site (2026-10-21). Use this as a checklist of what to source.

**Format for new files:** WAV, 44.1 kHz, 16-bit, mono, peak about -3 dBFS, trimmed tight. Frequent effects under 1 s, impacts under 1.5 s. Ambient loops must be seamless. Put files in `public/audio/effects/` (or `public/audio/` for music) and add them to `SFX_WAV_MANIFEST` in `AudioEngine.ts` under the category name given below, or tell me the filenames and I will wire them up.

## Top 10 (biggest improvement for the effort)

1. **Enemy hit variations** (most-played sound in the game, only 2 files)
2. **Enemy death sounds** (shares a file with explosions; one is a door-lock sound)
3. **Enemy gunfire distinct from the player's** (all plasma shots sound alike)
4. **Proper EMP pulse** (currently a hacking beep and a detective-mode sound)
5. **Boss attack warnings** (mortar incoming, searchlight lock, strafing run, Core spokes)
6. **Boss death sequences** (all bosses use the same explosion)
7. **Footsteps** (player on ash/rubble; metal endoskeleton steps)
8. **Ambient bed** (wind/ash, distant explosions, HK flyover hum, fire crackle)
9. **Weapon-specific sounds** (M16, RPG, grenades, molotov, K-9, drones, ion strike)
10. **Ability sounds** (6 characters, 6 abilities, none have their own sound)

---

## A. Overused or duplicated

"Files" are what exists today. "Shared with" means the same wav is used for a different purpose.

| Category | Current files | How often / where | Problem | Source |
| --- | --- | --- | --- | --- |
| `endoHit` | 2 (BulletHitMetal01/02) | Every projectile hit, drone tick, melee hit, K-9 bite. Hundreds per minute. | Far too repetitive; same sound for chrome, steel plate, leather, liquid metal, drones | **8 variants** chrome/endoskeleton clang. Plus 3 each: heavy armour plate (Tank/HK), liquid-metal squelch (T-1000), small drone tink |
| `endoDestroy` | 2 (plasma_explosion, DoorLockBreak01) | Every humanoid kill | `plasma_explosion` is also the explosion sound; "door lock break" is not a robot dying | **6 variants** metal collapse/clatter with servo power-down |
| `explosion` | 3 (Explosion01/02, plasma_explosion) | 20 call sites: fuel drums, cars, mortars, salvos, HK deaths, boss deaths, bosses' attacks | One pool for everything; `plasma_explosion` shared with `endoDestroy`; `Explosion01` shared with grenade launch | **3 sizes x 3 variants** (small pop, medium blast, large boom). Plus distinct fuel-drum fireball and car-wreck burst |
| `plasmaLight` | 4 | Player: M25, M16, M95, Phased Plasma, Laser Designator, Orbital Ion, ally. Enemy: T-800, T-1, Minigunner, Turret, Infiltrator. ~15 sites | Player weapons and enemy bolts are indistinguishable; M16 (a ballistic rifle) sounds like plasma | Enemy plasma bolt x4 (different pitch/timbre, red-hostile feel). M16 burst x3 (ballistic) |
| `hkAlert` | 4 (TurretAlarm, HUD_TurretAlarm2, Alterted, hk_heavy1a_m) | 12 call sites used as a generic "warning": HK alert, T-1000 puddle, Aerostat ping, supply flare, Tank searchlight lock | One sound means six different things | One distinct cue each (see section B, boss warnings) |
| `bossStinger` | 3 | Boss spawn | `hk_heavy1a_m` and `S_TurretAlarm` shared with `hkAlert`; `Splash_Screen_Drums` shared with `runStart` | **1 unique stinger per boss** (5 bosses) |
| `vaultJackpot` / `achievement` / `runVictory` / `runStart` | Share `ObjectiveComplete`, `AddtoArchive`, `NewQuest`, `Splash_Screen_Drums` | Vault open, achievement, victory, run start | Four different moments sound the same | 1 each: vault unlock, achievement toast, victory jingle, run start |
| `pickupGem` | 2 | Every XP pickup, plus scrap loot (pitched down) | Extremely frequent with only 2 variants | **6 variants** small data-chip pickup; separate alloy-scrap clink x3 |
| `uiModalOpen` / `uiModalClose` | 3 / 2 (detective-mode and HUD-scan sounds) | Pause, resume, every modal | Same sweep for pause, level-up, settings, codex | Distinct pause/resume pair |
| `uiError` | 2 (DetectiveModeError, Frogger_Error) | Errors | Fine, but one is a different game's sound | 2 neutral error buzzes |

### Single-file categories (no variation at all)

`uiBuy`, `uiUpgradeApplied` (also reused for medkit pickup), `playerTerminated` (also used by defeat), `runVictory`, `fireWhoosh`, `launch` (a pitched explosion). Each needs **at least 3 variants**.

---

## B. Missing (silent today)

### Weapons

| Weapon | Today | Needs |
| --- | --- | --- |
| Ithaca 37 / Trench Sweeper | shotgun blast only | pump-action rack between shots x2 |
| M16 Carbine | plasma shot | ballistic rifle burst x3 |
| M25 / M95 / Phased Plasma | shared plasma shots | per-weapon plasma: M25 light zap, M95 heavy railgun-like, Phased Plasma rapid pulse |
| Pipe Bomb | launch thump + explosion | throw whoosh, fuse hiss, metal clink on land |
| M79 / RPG / MM-1 / Tandem Warhead | launch thump + explosion | M79 "bloop", RPG rocket ignition + flight loop, MM-1 rapid thumps |
| Molotov / Napalm / Firestorm | one whoosh | glass shatter, ignition "whump", burning loop (positional, 2-4 s) |
| EMP Emitter / Supernova | hacking beep + detective-mode sound | electromagnetic pulse: low thump + rising zap crackle x3 |
| Laser Designator | plasma shot | target-lock beep, orbital strike charge + impact |
| Orbital Ion | plasma shot | beam charge-up, sustained beam, impact |
| Seeker Drone / Perimeter Ring | enemy-hit sound only | drone hum loop, zap on hit x3 |
| K-9 / K-9 Pack | enemy-hit sound only | bark x3, growl, bite |
| Reprogrammed T-800 ally / Guardian | plasma shot | boot-up servo, ally taunt/voice-less "ready" tone |
| Coltan Knife / Hyperalloy Blade | swing whoosh | blade hit on metal (shing) x3, hyperalloy ring |

### Player

- Footsteps on ash/rubble x6 (loopable, quick)
- Damage taken variants (only 2 body hits); armour/dodge hit x2
- Revive (defibrillator) and invulnerability end
- Low-HP heartbeat exists (synthesised); needs a real recorded heartbeat if desired

### Enemies

- Endoskeleton footsteps (metal on rubble) x6, servo whine idle loop, eye power-down on death
- Crab drone skitter loop, hydrobot hiss, aerostat balloon creak
- HK Aerial: flyover engine hum (Doppler loop), thruster whine, strafing run, missile salvo launch x6, kamikaze dive scream
- HK Tank: tread rumble loop, mortar fire + incoming whistle, cannon fire x3 (heavier than player plasma)
- Plasma turret: servo-turn, charge, fire x3
- T-1000: liquid-metal flow loop, morph to puddle, blade lunge, reappear splash, slash x3, regeneration shimmer
- Infiltrator: charge footsteps, burst fire, skin-burn-off hiss at phase 3
- Skynet Core: spoke charge, spoke fire, temporal nova, pull-in drone, final-countdown ticks
- Self-destruct elite: countdown beep, detonation x2
- Elite spawn/affix cue (shielded, armored, overclocked, regenerating)

### Boss moments

| Moment | Needs |
| --- | --- |
| Boss spawn | 5 unique stingers (Infiltrator, Tank, Aerial, T-1000, Core) |
| Phase change (50% / 20% HP) | 1 cue x2 |
| Boss death | 4 sequences: Tank collapse + explosion, Aerial crash, T-1000 shatter/splash, Core overload |
| Telegraphs | Tank mortar charge + incoming whistle; searchlight lock-on rising tone; strafing run line; Core spoke charge; T-1000 landing circle; Self-Destruct countdown |

### Pickups and interactables

- Medkit heal (currently reuses upgrade-applied), alloy scrap clink x3, crate break, supply-drop flare launch + beacon loop, data vault unlock mechanism + data decrypt, evolution unlock fanfare (separate from the vault)
- Fuel drum: pre-explosion fire creak, chain-reaction explosions; car wreck: dent, destruction

### Abilities (one per character)

Pipe-bomb barrage (Reese 2029), dual-wield (Reese 1984), plasma overcharge (Sapper), tactical rally radio call (John), molotov perimeter (Sarah), endo overdrive servo whine (T-800).

### Environment and ambience

- Wind and ash bed loop (30-60 s, seamless)
- Distant explosions and gunfire one-shots x8 (randomly timed, positional)
- Fire crackle loop (positional) for the burning craters and wrecks
- Searchlight hum, distant laser fire x4, thunder/low rumble x3

### Music and stingers

- The game has **one music track**, split into calm/combat/boss by filters only. Real stems (calm, combat, boss) would make the adaptive system work properly.
- Short stingers: level-up, evolution, boss defeated, victory (2 versions), defeat

### UI

- Level-up card hover and select x2, reroll (dice) x2, banish (shred), skip
- Pause and resume (distinct pair), settings slider tick, tab switch, toggle on/off
- Controller connect/disconnect (currently a beep and an error buzz)
- Title screen ambience and button hover

---

## C. Suggested category names and variation counts

When you name files `category_01.wav`, `category_02.wav` and so on, wiring is a one-line change per category.

| New category | Variants | Replaces / adds |
| --- | --- | --- |
| `hitChrome`, `hitArmor`, `hitLiquid`, `hitDrone` | 8, 3, 3, 3 | `endoHit` |
| `deathEndo`, `deathDrone`, `deathHK`, `deathBoss` | 6, 3, 3, 4 | `endoDestroy` |
| `explodeSmall`, `explodeMed`, `explodeLarge`, `explodeDrum`, `explodeCar` | 3, 3, 3, 2, 2 | `explosion` |
| `enemyPlasma`, `enemyHeavyCannon` | 4, 3 | enemy gunfire |
| `rifleBurst`, `pumpRack`, `railgun` | 3, 2, 2 | M16, Ithaca, M95 |
| `rocketLaunch`, `grenadeThrow`, `mortarFire`, `incomingWhistle` | 2, 2, 2, 2 | lobbed weapons, Tank |
| `fireIgnite`, `fireLoop`, `glassBreak` | 3, 1, 2 | molotov/napalm/firestorm |
| `emp` | 3 | EMP |
| `bark`, `bite`, `droneZap`, `droneHum` | 3, 2, 3, 1 | K-9 and drones |
| `stepPlayer`, `stepEndo`, `stepHeavy` | 6, 6, 3 | footsteps |
| `bossStinger_<name>` | 5 | per-boss spawn |
| `warnMortar`, `warnLock`, `warnStrafe`, `warnSpoke`, `warnCountdown` | 1 each | telegraph cues |
| `abilityRally`, `abilityOvercharge`, `abilityOverdrive`, `abilityBarrage`, `abilityDual`, `abilityMolotov` | 1 each | abilities |
| `loot_heal`, `loot_scrap`, `crateBreak`, `vaultUnlock`, `evolution`, `achievement` | 2, 3, 2, 1, 1, 1 | pickups and rewards |
| `ambWind`, `ambFire`, `ambDistant`, `ambFlyover` | 1 loop, 1 loop, 8, 1 loop | ambience |
| `uiPause`, `uiResume`, `uiTick`, `uiReroll`, `uiBanish` | 1 each | UI |
