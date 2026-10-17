import type { BaseWeaponId, LoadoutId, MetaUpgradeId, PlayerComputedStats } from '../core/types';

export interface LoadoutConfig {
  id: LoadoutId;
  name: string;
  callsign: string;
  startingWeapon: BaseWeaponId;
  description: string;
  bonusStats: Partial<PlayerComputedStats>;
  unlockRequirement: string;
  cost: number;
}

export const LOADOUTS: Record<LoadoutId, LoadoutConfig> = {
  reese_2029: {
    id: 'reese_2029',
    name: 'Kyle Reese — Tech-Com Sergeant',
    callsign: 'DN38416',
    startingWeapon: 'ithaca_37',
    description: 'Veteran guerilla fighter of the 132nd Tech-Com division. Starts with Ithaca 37 shotgun spread.',
    bonusStats: { moveSpeed: 0.6, bonusAmount: 0 },
    unlockRequirement: 'Available by default.',
    cost: 0
  },
  reese_1984: {
    id: 'reese_1984',
    name: 'Kyle Reese — 1984 Protector',
    callsign: 'ALLEYWAY SURVIVOR',
    startingWeapon: 'pipe_bomb',
    description: 'Wearing the stolen trenchcoat. Increased explosive area and salvage magnet range.',
    bonusStats: { areaMultiplier: 0.25, magnetRadius: 1.5 },
    unlockRequirement: 'Survive 10 minutes in Sector 44 or 500 Alloy Scrap.',
    cost: 500
  },
  techcom_sapper: {
    id: 'techcom_sapper',
    name: 'Tech-Com Heavy Sapper',
    callsign: 'PLASMA CORPS',
    startingWeapon: 'm25_plasma',
    description: 'Heavy weapons specialist armed with a captured Westinghouse 40W phased plasma rifle.',
    bonusStats: { mightMultiplier: 0.15, cooldownMultiplier: -0.12 },
    unlockRequirement: 'Destroy 1 HK-Tank or 1,200 Alloy Scrap.',
    cost: 1200
  },
  john_connor: {
    id: 'john_connor',
    name: 'John Connor — Resistance General',
    callsign: 'TECH-COM COMMANDER',
    startingWeapon: 'seeker_drone',
    description: 'The military mastermind of the Resistance. Starts with Seeker Drones, +1 Projectile, and +1 Revival.',
    bonusStats: { bonusAmount: 1, xpGainMultiplier: 0.25, revivals: 1 },
    unlockRequirement: 'Defeat the Skynet Time Displacement Core or 3,000 Alloy Scrap.',
    cost: 3000
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
  }
};
