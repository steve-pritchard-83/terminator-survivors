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
  mass: number;
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
    xpValue: 3,
    color: 0x8a9ba8,
    mass: 1.0
  },
  t600_rusted: {
    archetype: 't600_rusted',
    name: 'Series 600 Heavy Walker',
    maxHp: 60,
    speed: 2.3,
    damage: 16,
    radius: 0.8,
    isBoss: false,
    isFlying: false,
    xpValue: 7,
    color: 0x4a4642,
    mass: 4.5
  },
  t700_scout: {
    archetype: 't700_scout',
    name: 'Series 700 Endoskeleton Runner',
    maxHp: 40,
    speed: 4.1,
    damage: 14,
    radius: 0.65,
    isBoss: false,
    isFlying: false,
    xpValue: 5,
    color: 0x7a8694,
    mass: 2.5
  },
  t800_endoskeleton: {
    archetype: 't800_endoskeleton',
    name: 'Cyberdyne Series 800 Model 101',
    maxHp: 88,
    speed: 3.0,
    damage: 22,
    radius: 0.75,
    isBoss: false,
    isFlying: false,
    xpValue: 12,
    color: 0x9ca8b8,
    mass: 6.0
  },
  hk_aerial_patrol: {
    archetype: 'hk_aerial_patrol',
    name: 'Hunter-Killer Aerial Gunship',
    maxHp: 210,
    speed: 3.5,
    damage: 28,
    radius: 1.8,
    isBoss: false,
    isFlying: true,
    xpValue: 30,
    color: 0x6e7b8c,
    mass: 12.0
  },
  infiltrator_csm101: {
    archetype: 'infiltrator_csm101',
    name: 'Infiltrator Unit CSM-101',
    maxHp: 950,
    speed: 3.2,
    damage: 32,
    radius: 1.2,
    isBoss: true,
    isFlying: false,
    xpValue: 180,
    color: 0xb52222,
    mass: 25.0
  },
  hk_tank_goliath: {
    archetype: 'hk_tank_goliath',
    name: 'Hunter-Killer Tank Goliath',
    maxHp: 2400,
    speed: 1.9,
    damage: 48,
    radius: 2.8,
    isBoss: true,
    isFlying: false,
    xpValue: 400,
    color: 0x556677,
    mass: 100.0
  },
  hk_aerial_squadron_leader: {
    archetype: 'hk_aerial_squadron_leader',
    name: 'HK-Aerial Command Gunship',
    maxHp: 3600,
    speed: 3.8,
    damage: 45,
    radius: 2.4,
    isBoss: true,
    isFlying: true,
    xpValue: 650,
    color: 0x778899,
    mass: 50.0
  },
  t1000_prototype: {
    archetype: 't1000_prototype',
    name: 'Liquid Metal Prototype T-1000',
    maxHp: 5600,
    speed: 4.6,
    damage: 60,
    radius: 1.1,
    isBoss: true,
    isFlying: false,
    xpValue: 950,
    color: 0xdce8f8,
    mass: 30.0
  },
  skynet_tde_core: {
    archetype: 'skynet_tde_core',
    name: 'Skynet Time Displacement Core',
    maxHp: 8500,
    speed: 1.3,
    damage: 70,
    radius: 3.5,
    isBoss: true,
    isFlying: false,
    xpValue: 1500,
    color: 0x00e5ff,
    mass: 200.0
  }
};
