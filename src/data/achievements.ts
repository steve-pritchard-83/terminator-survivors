import type { BaseWeaponId } from '../core/types';

export type AchievementCategory =
  | 'kills'
  | 'survival'
  | 'progression'
  | 'combat'
  | 'stages'
  | 'mastery';

export interface AchievementReward {
  type: 'weapon' | 'scrap';
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
  // --- KILLS ---
  first_blood: {
    id: 'first_blood',
    title: 'First Machine Down',
    description: 'Destroy your first Skynet machine.',
    category: 'kills',
    reward: { type: 'scrap', amount: 50, description: '+50 Alloy Scrap' },
    target: 1
  },
  terminator_hunter: {
    id: 'terminator_hunter',
    title: 'Machine Hunter',
    description: 'Destroy 500 total machines.',
    category: 'kills',
    reward: { type: 'scrap', amount: 300, description: '+300 Alloy Scrap' },
    target: 500
  },
  mass_dismantler: {
    id: 'mass_dismantler',
    title: 'One-Man Army',
    description: 'Destroy 1,000 machines in a single run.',
    category: 'kills',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' },
    target: 1000
  },

  // --- SURVIVAL ---
  survivor_5m: {
    id: 'survivor_5m',
    title: 'Hold The Line',
    description: 'Survive for 5 minutes.',
    category: 'survival',
    reward: { type: 'scrap', amount: 200, description: '+200 Alloy Scrap' },
    target: 300
  },
  judgment_survivor: {
    id: 'judgment_survivor',
    title: 'Judgment Day Prevented',
    description: 'Survive a full 10-minute deployment.',
    category: 'survival',
    reward: { type: 'scrap', amount: 1000, description: '+1000 Alloy Scrap' },
    target: 600
  },

  // --- BOSSES ---
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
    description: 'Defeat any boss without taking damage while it is on the field.',
    category: 'combat',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' }
  },

  // --- PROGRESSION ---
  first_evolution: {
    id: 'first_evolution',
    title: 'Future Tech',
    description: 'Evolve any weapon.',
    category: 'mastery',
    reward: { type: 'scrap', amount: 250, description: '+250 Alloy Scrap' }
  },
  level_20: {
    id: 'level_20',
    title: 'Seasoned Combatant',
    description: 'Reach level 20 in a single run.',
    category: 'progression',
    reward: { type: 'weapon', id: 'resistance_k9', description: 'Unlocks Weapon: Resistance K-9' },
    target: 20
  },
  scrap_collector_1k: {
    id: 'scrap_collector_1k',
    title: 'Mother Lode',
    description: 'Earn 1,000 Alloy Scrap in a single run.',
    category: 'progression',
    reward: { type: 'scrap', amount: 500, description: '+500 Alloy Scrap' },
    target: 1000
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
