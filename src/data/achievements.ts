import type { BaseWeaponId } from '../core/types';

export type AchievementCategory =
  | 'kills'
  | 'survival'
  | 'progression'
  | 'combat'
  | 'stages'
  | 'threat'
  | 'mastery';

export interface AchievementReward {
  type: 'loadout' | 'weapon' | 'scrap' | 'cosmetic' | 'upgrade';
  id?: string;
  amount?: number;
  description: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  reward: AchievementReward;
  target?: number;
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  // --- KILLS (1-6) ---
  first_blood: {
    id: 'first_blood',
    title: 'First Machine Down',
    description: 'Destroy your first Skynet machine.',
    category: 'kills',
    reward: { type: 'scrap', amount: 50, description: '+50 Alloy Scrap' },
    target: 1
  },
  skynet_threat: {
    id: 'skynet_threat',
    title: 'Scrap Collector',
    description: 'Destroy 100 total machines.',
    category: 'kills',
    reward: { type: 'scrap', amount: 100, description: '+100 Alloy Scrap' },
    target: 100
  },
  terminator_hunter: {
    id: 'terminator_hunter',
    title: 'Machine Hunter',
    description: 'Destroy 500 total machines.',
    category: 'kills',
    reward: { type: 'weapon', id: 'm79_thumper', description: 'Unlocks Weapon: M79 Thumper Grenade' },
    target: 500
  },
  mass_dismantler: {
    id: 'mass_dismantler',
    title: 'One-Man Army',
    description: 'Destroy 1,000 machines in a single run.',
    category: 'kills',
    reward: { type: 'weapon', id: 'napalm_canister', description: 'Unlocks Weapon: Napalm Canister' },
    target: 1000
  },
  salvage_czar: {
    id: 'salvage_czar',
    title: 'Scrap Titan',
    description: 'Destroy 5,000 total lifetime machines.',
    category: 'kills',
    reward: { type: 'scrap', amount: 1500, description: '+1500 Alloy Scrap' },
    target: 5000
  },
  genocide_protocol: {
    id: 'genocide_protocol',
    title: 'Terminator Terminator',
    description: 'Destroy 10,000 total lifetime machines.',
    category: 'kills',
    reward: { type: 'scrap', amount: 3000, description: '+3000 Alloy Scrap' },
    target: 10000
  },

  // --- SURVIVAL (7-13) ---
  survivor_1m: {
    id: 'survivor_1m',
    title: 'Stay Low',
    description: 'Survive for 1 minute in any stage.',
    category: 'survival',
    reward: { type: 'scrap', amount: 50, description: '+50 Alloy Scrap' },
    target: 60
  },
  survivor_3m: {
    id: 'survivor_3m',
    title: 'Guerrilla Warfare',
    description: 'Survive for 3 minutes in any stage.',
    category: 'survival',
    reward: { type: 'scrap', amount: 100, description: '+100 Alloy Scrap' },
    target: 180
  },
  survivor_5m: {
    id: 'survivor_5m',
    title: 'Hold The Line',
    description: 'Survive for 5 minutes in any stage.',
    category: 'survival',
    reward: { type: 'weapon', id: 'm16_carbine', description: 'Unlocks Weapon: M16 Carbine' },
    target: 300
  },
  survivor_8m: {
    id: 'survivor_8m',
    title: 'Against All Odds',
    description: 'Survive for 8 minutes in any stage.',
    category: 'survival',
    reward: { type: 'scrap', amount: 400, description: '+400 Alloy Scrap' },
    target: 480
  },
  judgment_survivor: {
    id: 'judgment_survivor',
    title: 'Judgment Day Prevented',
    description: 'Survive a full 10-minute deployment (Standard Victory).',
    category: 'survival',
    reward: { type: 'loadout', id: 'john_connor', description: 'Unlocks Operative: John Connor' },
    target: 600
  },
  endless_veteran: {
    id: 'endless_veteran',
    title: 'The Long War',
    description: 'Survive 15 minutes in Endless Mode.',
    category: 'survival',
    reward: { type: 'scrap', amount: 1500, description: '+1500 Alloy Scrap' },
    target: 900
  },
  endless_master: {
    id: 'endless_master',
    title: 'Eternal Resistance',
    description: 'Survive 20 minutes in Endless Mode.',
    category: 'survival',
    reward: { type: 'scrap', amount: 3000, description: '+3000 Alloy Scrap' },
    target: 1200
  },

  // --- BOSSES / COMBAT (14-18) ---
  hk_aerial_slayer: {
    id: 'hk_aerial_slayer',
    title: 'Anti-Air Ace',
    description: 'Destroy the HK-Aerial Squadron Leader.',
    category: 'combat',
    reward: { type: 'weapon', id: 'rpg_launcher', description: 'Unlocks Weapon: RPG-7 Launcher' }
  },
  hk_tank_slayer: {
    id: 'hk_tank_slayer',
    title: 'Giant Slayer',
    description: 'Destroy the HK-Tank Goliath.',
    category: 'combat',
    reward: { type: 'weapon', id: 'laser_designator', description: 'Unlocks Weapon: Laser Designator' }
  },
  t1000_slayer: {
    id: 't1000_slayer',
    title: 'Liquid Metal Frostbite',
    description: 'Destroy the T-1000 Prototype.',
    category: 'combat',
    reward: { type: 'weapon', id: 'molotov', description: 'Unlocks Weapon: Molotov Cocktail' }
  },
  skynet_core_slayer: {
    id: 'skynet_core_slayer',
    title: 'Core Meltdown',
    description: 'Destroy the Skynet Central TDE Core.',
    category: 'combat',
    reward: { type: 'weapon', id: 'reprogrammed_t800', description: 'Unlocks Weapon: Reprogrammed T-800' }
  },
  untouchable_boss: {
    id: 'untouchable_boss',
    title: 'Ghost of the Resistance',
    description: 'Defeat any boss encounter without taking damage during its presence.',
    category: 'combat',
    reward: { type: 'cosmetic', id: 'title_ghost', description: 'Cosmetic Title: Ghost' }
  },

  // --- WEAPON EVOLUTIONS (19-25) ---
  first_evolution: {
    id: 'first_evolution',
    title: 'Future Tech',
    description: 'Evolve any weapon at a Tech-Com Bunker Vault.',
    category: 'progression',
    reward: { type: 'scrap', amount: 250, description: '+250 Alloy Scrap' }
  },
  trench_sweeper_evo: {
    id: 'trench_sweeper_evo',
    title: 'Room Cleaner',
    description: 'Evolve Ithaca 37 into Trench Sweeper.',
    category: 'progression',
    reward: { type: 'scrap', amount: 300, description: '+300 Alloy Scrap' }
  },
  thermite_buster_evo: {
    id: 'thermite_buster_evo',
    title: 'Demolition Expert',
    description: 'Evolve Thermite Pipe Bomb into Thermite Buster.',
    category: 'progression',
    reward: { type: 'scrap', amount: 300, description: '+300 Alloy Scrap' }
  },
  m95a1_plasma_evo: {
    id: 'm95a1_plasma_evo',
    title: 'Heavy Plasma Dominance',
    description: 'Evolve M25 Plasma Rifle into M95A1 Heavy Plasma.',
    category: 'progression',
    reward: { type: 'scrap', amount: 300, description: '+300 Alloy Scrap' }
  },
  emp_supernova_evo: {
    id: 'emp_supernova_evo',
    title: 'Tachyon Surge',
    description: 'Evolve EMP Emitter into EMP Supernova.',
    category: 'progression',
    reward: { type: 'scrap', amount: 300, description: '+300 Alloy Scrap' }
  },
  perimeter_ring_evo: {
    id: 'perimeter_ring_evo',
    title: 'Orbital Defense',
    description: 'Evolve Seeker Drone into Perimeter Ring.',
    category: 'progression',
    reward: { type: 'scrap', amount: 300, description: '+300 Alloy Scrap' }
  },
  arsenal_complete: {
    id: 'arsenal_complete',
    title: 'Walking Armory',
    description: 'Possess 3 evolved weapons simultaneously in a single deployment.',
    category: 'progression',
    reward: { type: 'scrap', amount: 1000, description: '+1000 Alloy Scrap' }
  },

  // --- LEVEL & SCRAP (26-30) ---
  level_10: {
    id: 'level_10',
    title: 'Rookie Rebel',
    description: 'Reach Level 10 in a single deployment.',
    category: 'progression',
    reward: { type: 'scrap', amount: 100, description: '+100 Alloy Scrap' },
    target: 10
  },
  level_20: {
    id: 'level_20',
    title: 'Seasoned Combatant',
    description: 'Reach Level 20 in a single deployment.',
    category: 'progression',
    reward: { type: 'weapon', id: 'resistance_k9', description: 'Unlocks Weapon: Resistance K-9' },
    target: 20
  },
  level_30: {
    id: 'level_30',
    title: 'Apex Survivor',
    description: 'Reach Level 30 in a single deployment.',
    category: 'progression',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' },
    target: 30
  },
  scrap_collector_1k: {
    id: 'scrap_collector_1k',
    title: 'Mother Lode',
    description: 'Extract 1,000 alloy scrap in a single run.',
    category: 'progression',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' },
    target: 1000
  },
  scrap_bank_5k: {
    id: 'scrap_bank_5k',
    title: 'Tech-Com War Chest',
    description: 'Accumulate 5,000 total lifetime alloy scrap.',
    category: 'progression',
    reward: { type: 'scrap', amount: 1000, description: '+1000 Alloy Scrap' },
    target: 5000
  },

  // --- STAGES (31-35) ---
  clear_wasteland: {
    id: 'clear_wasteland',
    title: 'Wasteland Veteran',
    description: 'Achieve victory in Los Angeles 2029 Wasteland.',
    category: 'stages',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' }
  },
  clear_cyberdyne: {
    id: 'clear_cyberdyne',
    title: 'Cyberdyne Saboteur',
    description: 'Achieve victory in Cyberdyne Systems Assembly Plant.',
    category: 'stages',
    reward: { type: 'scrap', amount: 600, description: '+600 Alloy Scrap' }
  },
  clear_tech_noir: {
    id: 'clear_tech_noir',
    title: 'Flashback 1984',
    description: 'Achieve victory in Tech Noir Alley 1984.',
    category: 'stages',
    reward: { type: 'scrap', amount: 700, description: '+700 Alloy Scrap' }
  },
  clear_skynet_central: {
    id: 'clear_skynet_central',
    title: 'Core Breaker',
    description: 'Achieve victory in Skynet Central TDE Facility.',
    category: 'stages',
    reward: { type: 'scrap', amount: 800, description: '+800 Alloy Scrap' }
  },
  clear_bunker: {
    id: 'clear_bunker',
    title: 'Last Bastion Guard',
    description: 'Achieve victory in Century City Resistance Bunker.',
    category: 'stages',
    reward: { type: 'scrap', amount: 900, description: '+900 Alloy Scrap' }
  },

  // --- THREATS & MODES (36-40) ---
  threat_initiate: {
    id: 'threat_initiate',
    title: 'Hazard Pay',
    description: 'Achieve victory with at least 1 Threat Modifier active.',
    category: 'threat',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' },
    target: 1
  },
  threat_veteran: {
    id: 'threat_veteran',
    title: 'Extreme Hostility',
    description: 'Achieve victory with at least 3 Threat Modifiers active.',
    category: 'threat',
    reward: { type: 'scrap', amount: 1000, description: '+1000 Alloy Scrap' },
    target: 3
  },
  threat_nightmare: {
    id: 'threat_nightmare',
    title: 'Nightmare Protocol',
    description: 'Achieve victory with at least 5 Threat Modifiers active.',
    category: 'threat',
    reward: { type: 'scrap', amount: 2000, description: '+2000 Alloy Scrap' },
    target: 5
  },
  daily_operative: {
    id: 'daily_operative',
    title: 'Field Operative Duty',
    description: 'Complete a Daily Seeded Operation.',
    category: 'mastery',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' }
  },
  techcom_legend: {
    id: 'techcom_legend',
    title: 'Legend of the Resistance',
    description: 'Unlock 3 loadouts and survive at least 5 deployments.',
    category: 'mastery',
    reward: { type: 'scrap', amount: 5000, description: '+5000 Alloy Scrap' }
  }
};

export const TOTAL_ACHIEVEMENTS = Object.keys(ACHIEVEMENTS).length;

export const DEFAULT_UNLOCKED_WEAPONS: BaseWeaponId[] = [
  'ithaca_37',
  'pipe_bomb',
  'm25_plasma',
  'seeker_drone',
  'emp_emitter',
  'coltan_knife'
];
