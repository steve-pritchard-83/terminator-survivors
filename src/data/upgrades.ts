import type { BaseWeaponId, LoadoutId, MetaUpgradeId, PlayerComputedStats } from '../core/types';

export interface LoadoutAbilityConfig {
  id: string;
  name: string;
  description: string;
  cooldown: number; // in seconds
  duration?: number; // active buff duration if applicable
}

export interface LoadoutConfig {
  id: LoadoutId;
  name: string;
  callsign: string;
  startingWeapon: BaseWeaponId;
  description: string;
  bonusStats: Partial<PlayerComputedStats>;
  unlockRequirement: string;
  cost: number;
  invulnerabilityDuration?: number; // Configurable i-frame duration in seconds
  ability: LoadoutAbilityConfig;
}

export const LOADOUTS: Record<LoadoutId, LoadoutConfig> = {
  reese_2029: {
    id: 'reese_2029',
    name: 'Kyle Reese — Tech-Com Sergeant',
    callsign: 'DN38416',
    startingWeapon: 'ithaca_37',
    description:
      'Veteran guerilla fighter of the 132nd Tech-Com division. Starts with Ithaca 37 shotgun spread.',
    bonusStats: { moveSpeed: 0.6, bonusAmount: 0 },
    unlockRequirement: 'Available by default.',
    cost: 0,
    ability: {
      id: 'pipebomb_barrage',
      name: 'Pipe-bomb Barrage',
      description: 'Throws 4 heavy pipe-bombs outward in a radial burst.',
      cooldown: 22
    }
  },
  reese_1984: {
    id: 'reese_1984',
    name: 'Kyle Reese — 1984 Protector',
    callsign: 'ALLEYWAY SURVIVOR',
    startingWeapon: 'pipe_bomb',
    description:
      'Wearing the stolen trenchcoat. Increased explosive area and salvage magnet range.',
    bonusStats: { areaMultiplier: 0.25, magnetRadius: 1.5 },
    unlockRequirement: 'Survive 4 minutes in Sector 44 or 500 Alloy Scrap.',
    cost: 500,
    ability: {
      id: 'sawed_off_dual_wield',
      name: 'Sawed-off Dual Wield',
      description: 'Doubles firing rate and adds +2 projectiles for 6 seconds.',
      cooldown: 28,
      duration: 6
    }
  },
  techcom_sapper: {
    id: 'techcom_sapper',
    name: 'Tech-Com Heavy Sapper',
    callsign: 'PLASMA CORPS',
    startingWeapon: 'm25_plasma',
    description:
      'Heavy weapons specialist armed with a captured Westinghouse 40W phased plasma rifle.',
    bonusStats: { mightMultiplier: 0.15, cooldownMultiplier: -0.12 },
    unlockRequirement: 'Destroy 1 HK-Tank or 1,200 Alloy Scrap.',
    cost: 1200,
    ability: {
      id: 'plasma_overcharge',
      name: 'Plasma Overcharge',
      description: 'Immediately resets all weapon cooldowns and emits an EMP shockwave.',
      cooldown: 30
    }
  },
  john_connor: {
    id: 'john_connor',
    name: 'John Connor — Resistance General',
    callsign: 'TECH-COM COMMANDER',
    startingWeapon: 'seeker_drone',
    description:
      'The military mastermind of the Resistance. Starts with Seeker Drones, +1 Projectile, and +1 Revival.',
    bonusStats: { bonusAmount: 1, xpGainMultiplier: 0.25, revivals: 1 },
    unlockRequirement: 'Defeat the Skynet Time Displacement Core or 3,000 Alloy Scrap.',
    cost: 3000,
    ability: {
      id: 'tactical_rally',
      name: 'Tactical Rally',
      description: 'Rallies Resistance forces, granting +35% Might and tactical firepower for 10s.',
      cooldown: 35,
      duration: 10
    }
  },
  sarah_connor: {
    id: 'sarah_connor',
    name: 'Sarah Connor — Legend of the Resistance',
    callsign: 'MOTHER OF THE FUTURE',
    startingWeapon: 'ithaca_37',
    description:
      'Trained for the coming war. High maneuverability, superior fire rate, and area denial.',
    bonusStats: { moveSpeed: 1.2, cooldownMultiplier: -0.15 },
    unlockRequirement: 'Survive 10 minutes in Cyberdyne Factory or 2,000 Alloy Scrap.',
    cost: 2000,
    ability: {
      id: 'molotov_perimeter',
      name: 'Molotov Perimeter',
      description: 'Ignites a defensive ring of 6 lingering flame zones around the player.',
      cooldown: 24
    }
  },
  reprogrammed_t800: {
    id: 'reprogrammed_t800',
    name: 'Reprogrammed T-800 — Cybernetic Guardian',
    callsign: 'MODEL 101',
    startingWeapon: 'm25_plasma',
    description:
      'Living tissue over metal endoskeleton. Massive armor and survivability at the cost of agility.',
    bonusStats: { maxHp: 150, armor: 3, mightMultiplier: 0.25, moveSpeed: -1.0 },
    unlockRequirement: 'Defeat Skynet TDE Core or 4,500 Alloy Scrap.',
    cost: 4500,
    ability: {
      id: 'endo_overdrive',
      name: 'Endo Overdrive',
      description: 'Overclocks servo-hydraulics: invulnerability and +60% move speed for 5s.',
      cooldown: 40,
      duration: 5
    }
  }
};

export interface MetaUpgradeConfig {
  id: MetaUpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  statPerLevel: Partial<PlayerComputedStats>;
}

export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeConfig> = {
  armor_vest: {
    id: 'armor_vest',
    name: 'Titanium Kevlar Vest',
    description: '+5% armor damage mitigation per level.',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.6,
    statPerLevel: { armor: 1 }
  },
  combat_stims: {
    id: 'combat_stims',
    name: 'Combat Adrenaline Stims',
    description: '+15 max HP and +0.3 HP/sec regeneration per level.',
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.5,
    statPerLevel: { maxHp: 15, regenPerSec: 0.3 }
  },
  plasma_overclock: {
    id: 'plasma_overclock',
    name: 'Munitions Overclock',
    description: '+8% Might (damage) to all weapons per level.',
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.65,
    statPerLevel: { mightMultiplier: 0.08 }
  },
  servo_greaves: {
    id: 'servo_greaves',
    name: 'Hydraulic Servo Greaves',
    description: '+6% movement speed per level.',
    maxLevel: 5,
    baseCost: 80,
    costMultiplier: 1.5,
    statPerLevel: { moveSpeed: 0.35 }
  },
  salvage_magnet: {
    id: 'salvage_magnet',
    name: 'Salvage Tractor Magnet',
    description: '+20% attraction radius for Skynet data cores.',
    maxLevel: 5,
    baseCost: 75,
    costMultiplier: 1.45,
    statPerLevel: { magnetRadius: 1.4 }
  },
  phase_capacitor: {
    id: 'phase_capacitor',
    name: 'Phase Capacitor Bank',
    description: '-5% weapon cooldown across all arms per level.',
    maxLevel: 5,
    baseCost: 180,
    costMultiplier: 1.7,
    statPerLevel: { cooldownMultiplier: -0.05 }
  },
  scavenger_protocol: {
    id: 'scavenger_protocol',
    name: 'Scavenger Protocol',
    description: '+12% XP and Alloy Scrap acquisition per level.',
    maxLevel: 5,
    baseCost: 130,
    costMultiplier: 1.55,
    statPerLevel: { xpGainMultiplier: 0.12 }
  },
  defibrillator: {
    id: 'defibrillator',
    name: 'Emergency Defibrillator',
    description: 'Grants +1 revival when Kyle Reese falls in battle.',
    maxLevel: 1,
    baseCost: 1000,
    costMultiplier: 1.0,
    statPerLevel: { revivals: 1 }
  },
  crit_core: {
    id: 'crit_core',
    name: 'Focus Targeting Sensor',
    description: '+3% critical strike chance and +15% crit damage per level.',
    maxLevel: 5,
    baseCost: 160,
    costMultiplier: 1.6,
    statPerLevel: { critChance: 0.03, critMultiplier: 0.15 }
  },
  high_caliber: {
    id: 'high_caliber',
    name: 'High-Caliber Munitions',
    description: '+10% projectile blast area and +10% projectile speed per level.',
    maxLevel: 5,
    baseCost: 140,
    costMultiplier: 1.55,
    statPerLevel: { areaMultiplier: 0.1, speedMultiplier: 0.1 }
  },
  blast_dampeners: {
    id: 'blast_dampeners',
    name: 'Kinetic Blast Dampeners',
    description: '+1 armor and +10 max HP per level.',
    maxLevel: 5,
    baseCost: 130,
    costMultiplier: 1.5,
    statPerLevel: { armor: 1, maxHp: 10 }
  },
  extended_capacitors: {
    id: 'extended_capacitors',
    name: 'Extended Capacitors',
    description: '+15% weapon effect and zone duration per level.',
    maxLevel: 5,
    baseCost: 110,
    costMultiplier: 1.5,
    statPerLevel: { durationMultiplier: 0.15 }
  },
  plasma_accelerator: {
    id: 'plasma_accelerator',
    name: 'Hyper-Coil Accelerator',
    description: '+12% projectile flight speed per level.',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.45,
    statPerLevel: { speedMultiplier: 0.12 }
  },
  tactical_relay: {
    id: 'tactical_relay',
    name: 'Tactical Field Relay',
    description: '+15% Luck per level (improves loot drop and upgrade rolls).',
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.5,
    statPerLevel: { luckMultiplier: 0.15 }
  },
  reroll_protocol: {
    id: 'reroll_protocol',
    name: 'Requisition Protocol',
    description: '+1 field upgrade reroll option per level.',
    maxLevel: 3,
    baseCost: 350,
    costMultiplier: 2.0,
    statPerLevel: { rerolls: 1 }
  },
  veteran_resilience: {
    id: 'veteran_resilience',
    name: 'Veteran Survival Grit',
    description: '+15% revival chance and 5% low-HP damage reduction per level.',
    maxLevel: 3,
    baseCost: 400,
    costMultiplier: 2.2,
    statPerLevel: { revivalChance: 0.15, lowHpDamageReduction: 0.05 }
  }
};
