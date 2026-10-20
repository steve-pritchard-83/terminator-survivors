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

// Elite "Self-Destruct" affix: the blast is telegraphed for `delaySeconds` after the elite dies.
export const SELF_DESTRUCT_BLAST = { damage: 28, radius: 3.8, delaySeconds: 0.7 };

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
