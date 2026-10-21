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
    startingWeapon: 'm25_plasma',
    description:
      'Veteran guerilla fighter of the 132nd Tech-Com division. Starts with the Westinghouse M-25 plasma rifle.',
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
  reroll_protocol: {
    id: 'reroll_protocol',
    name: 'Requisition Protocol',
    description: '+1 field upgrade reroll option per level.',
    maxLevel: 3,
    baseCost: 350,
    costMultiplier: 2.0,
    statPerLevel: { rerolls: 1 }
  },
};

/** Costs of the permanent upgrades cut from the game, so old saves get that scrap back (see SaveManager v4). */
export const REMOVED_UPGRADE_COSTS: Record<string, { baseCost: number; costMultiplier: number }> = {
  salvage_magnet: { baseCost: 75, costMultiplier: 1.45 },
  blast_dampeners: { baseCost: 130, costMultiplier: 1.5 },
  extended_capacitors: { baseCost: 110, costMultiplier: 1.5 },
  plasma_accelerator: { baseCost: 100, costMultiplier: 1.45 },
  tactical_relay: { baseCost: 120, costMultiplier: 1.5 },
  banish_protocol: { baseCost: 350, costMultiplier: 2.0 },
  skip_protocol: { baseCost: 250, costMultiplier: 1.8 },
  veteran_resilience: { baseCost: 400, costMultiplier: 2.2 }
};
