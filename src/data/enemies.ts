import type { EnemyArchetypeId } from '../core/types';

export interface EnemyStatsConfig {
  archetype: EnemyArchetypeId;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  isBoss: boolean;
  isFlying: boolean;
  xpValue: number;
  color: number;
}

export const ENEMY_CONFIGS: Record<EnemyArchetypeId, EnemyStatsConfig> = {
  skynet_crab_drone: {
    archetype: 'skynet_crab_drone',
    name: 'Skynet Recon Scuttler',
    maxHp: 18,
    speed: 4.8,
    damage: 8,
    radius: 0.5,
    isBoss: false,
    isFlying: false,
    xpValue: 1,
    color: 0x8a9ba8
  },
  t600_rusted: {
    archetype: 't600_rusted',
    name: 'Series 600 Heavy Walker',
    maxHp: 65,
    speed: 2.2,
    damage: 16,
    radius: 0.8,
    isBoss: false,
    isFlying: false,
    xpValue: 3,
    color: 0x4a4642
  },
  t700_scout: {
    archetype: 't700_scout',
    name: 'Series 700 Endoskeleton Runner',
    maxHp: 42,
    speed: 4.0,
    damage: 14,
    radius: 0.65,
    isBoss: false,
    isFlying: false,
    xpValue: 2,
    color: 0x7a8694
  },
  t800_endoskeleton: {
    archetype: 't800_endoskeleton',
    name: 'Cyberdyne Series 800 Model 101',
    maxHp: 95,
    speed: 2.9,
    damage: 22,
    radius: 0.75,
    isBoss: false,
    isFlying: false,
    xpValue: 5,
    color: 0x9ca8b8
  },
  hk_aerial_patrol: {
    archetype: 'hk_aerial_patrol',
    name: 'Hunter-Killer Aerial Gunship',
    maxHp: 240,
    speed: 3.4,
    damage: 28,
    radius: 1.8,
    isBoss: false,
    isFlying: true,
    xpValue: 15,
    color: 0x6e7b8c
  },
  infiltrator_csm101: {
    archetype: 'infiltrator_csm101',
    name: 'Infiltrator Unit CSM-101',
    maxHp: 1400,
    speed: 3.1,
    damage: 35,
    radius: 1.2,
    isBoss: true,
    isFlying: false,
    xpValue: 80,
    color: 0xb52222
  },
  hk_tank_goliath: {
    archetype: 'hk_tank_goliath',
    name: 'Hunter-Killer Tank Goliath',
    maxHp: 4500,
    speed: 1.8,
    damage: 55,
    radius: 2.8,
    isBoss: true,
    isFlying: false,
    xpValue: 200,
    color: 0x556677
  },
  hk_aerial_squadron_leader: {
    archetype: 'hk_aerial_squadron_leader',
    name: 'HK-Aerial Command Gunship',
    maxHp: 6500,
    speed: 3.8,
    damage: 48,
    radius: 2.4,
    isBoss: true,
    isFlying: true,
    xpValue: 350,
    color: 0x778899
  },
  t1000_prototype: {
    archetype: 't1000_prototype',
    name: 'Liquid Metal Prototype T-1000',
    maxHp: 11000,
    speed: 4.6,
    damage: 65,
    radius: 1.1,
    isBoss: true,
    isFlying: false,
    xpValue: 600,
    color: 0xdce8f8
  },
  skynet_tde_core: {
    archetype: 'skynet_tde_core',
    name: 'Skynet Time Displacement Core',
    maxHp: 20000,
    speed: 1.2,
    damage: 75,
    radius: 3.5,
    isBoss: true,
    isFlying: false,
    xpValue: 1000,
    color: 0x00e5ff
  }
};
