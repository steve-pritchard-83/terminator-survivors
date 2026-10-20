// Armor-strip multiplier applied by a K-9 bite; lower means the target takes more damage (1 / 0.7 = ~1.43x).
export const K9_BITE_ARMOR_STRIP = 0.7;
export const MAX_REVIVAL_CHANCE = 0.5;
export const REVIVE_INVULNERABILITY_SECONDS = 2.0;
export const HIT_STOP_GLOBAL_COOLDOWN = 0.25;

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
