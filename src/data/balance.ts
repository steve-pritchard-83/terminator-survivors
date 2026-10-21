// Armor-strip multiplier applied by a K-9 bite; lower means the target takes more damage (1 / 0.7 = ~1.43x).
export const K9_BITE_ARMOR_STRIP = 0.7;
export const MAX_REVIVAL_CHANCE = 0.5;
export const REVIVE_INVULNERABILITY_SECONDS = 2.0;
export const HIT_STOP_GLOBAL_COOLDOWN = 0.25;

// Damage dealt by enemy and boss attacks (T-1000 numbers are in T1000_TUNING).
export const ENEMY_ATTACK_DAMAGE = {
  t800Bolt: 15,
  infiltratorCharge: 28,
  infiltratorBurst: 15,
  infiltratorSpray: 10,
  tankMortar: 35,
  tankCannon: 18,
  tankSearchlightBarrage: 24,
  aerialSearchlightBoss: 28,
  aerialSearchlight: 18,
  aerialStrafe: 22,
  aerialSalvo: 20,
  aerialDive: 45,
  coreSpoke: 16,
  coreNova: 18,
  corePull: 14,
  t1ConeBolt: 12,
  motoDash: 20,
  turretBolt: 22,
  minigunnerBurst: 14
};

// In-run ambience: looped battle bed plus a randomly timed distant explosion.
export const AMBIENCE = { bedGain: 0.2, distantGain: 0.32, distantMinSeconds: 8, distantMaxSeconds: 20 };
// Seconds between player footstep sounds while moving.
export const FOOTSTEP_INTERVAL_SECONDS = 0.34;
// Metal footsteps of the nearest walking endoskeleton within `radius` metres.
export const ENDO_STEP = { intervalSeconds: 0.42, radius: 10 };

// Elite "Self-Destruct" affix: the blast is telegraphed for `delaySeconds` after the elite dies.
export const SELF_DESTRUCT_BLAST = { damage: 28, radius: 3.8, delaySeconds: 0.7 };

// Readability limits (too many overlapping effects made boss fights unplayable)
export const SHAKE_TRAUMA_CAP = 0.5;
export const SHAKE_EVENT_CAP = 0.3;
export const EXPLOSION_VISUAL_SCALE_CAP = 1.4;
export const EXPLOSION_SMOKE_END = 6.0;
/** Seconds the Tank mortar impact circle is shown before it lands (the charge itself lasts 3 s). */
export const TANK_MORTAR_WARNING_SECONDS = 1.5;

// Phones and small screens: camera is closer (the arena was too small to read) and the scene is
// brighter (mobile screens and outdoor light made it too dark).
export const VIEW_PROFILES = {
  desktop: { cameraZoom: 1.0, exposure: 1.2, hemiIntensity: 1.25, ambientIntensity: 1.05 },
  compact: { cameraZoom: 0.7, exposure: 1.7, hemiIntensity: 1.8, ambientIntensity: 1.6 }
};
/** Screens at or below this width (CSS px) use the compact profile, as do coarse-pointer devices. */
export const COMPACT_VIEW_MAX_WIDTH = 960;

// Pause between the player dying and the defeat movie starting, so the death and its sound are seen first.
export const DEFEAT_MOVIE_LEAD_IN_MS = 1400;

// Seconds a destroyed endoskeleton or crab drone stays on screen collapsing before it is removed.
export const DEATH_ANIMATION_SECONDS = 0.6;

// T-1000 boss tuning (softened after playtest: it was too hard)
export const T1000_TUNING = {
  slashDamage: 12,
  reappearDamage: 15,
  slashCooldown: 2.4,
  lungeCooldown: 5.0,
  lungeSpeed: 12.0,
  puddleFirstCooldown: 10.0,
  puddleRepeatCooldown: 12.0,
  puddleDurationSeconds: 1.5,
  regenFractionPerSecond: 0.01
};
