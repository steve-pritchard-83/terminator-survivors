import type { EnemyArchetypeId, EliteAffix } from '../core/types';
import { SELF_DESTRUCT_BLAST } from './balance';
export type { EliteAffix };

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
  t600_rusted: {
    archetype: 't600_rusted',
    name: 'Series 600 Heavy Walker',
    maxHp: 44,
    speed: 2.7,
    damage: 14,
    radius: 0.8,
    isBoss: false,
    isFlying: false,
    xpValue: 6,
    color: 0x4a4642,
    mass: 4.5
  },
  t800_endoskeleton: {
    archetype: 't800_endoskeleton',
    name: 'Cyberdyne Series 800 Model 101',
    maxHp: 80,
    speed: 3.0,
    damage: 22,
    radius: 0.75,
    isBoss: false,
    isFlying: false,
    xpValue: 16,
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
    maxHp: 380,
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
    maxHp: 3800,
    speed: 3.8,
    damage: 40,
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
    maxHp: 30000,
    speed: 1.3,
    damage: 70,
    radius: 3.5,
    isBoss: true,
    isFlying: false,
    xpValue: 1500,
    color: 0x00e5ff,
    mass: 200.0
  },
  t1_minigun_tracked: {
    archetype: 't1_minigun_tracked',
    name: 'T-1 Heavy Battlefield Chassis',
    maxHp: 160,
    speed: 2.0,
    damage: 20,
    radius: 1.4,
    isBoss: false,
    isFlying: false,
    xpValue: 15,
    color: 0x5a6068,
    mass: 20.0
  },
  moto_terminator: {
    archetype: 'moto_terminator',
    name: 'Moto-Terminator Flanker',
    maxHp: 75,
    speed: 6.8,
    damage: 22,
    radius: 0.9,
    isBoss: false,
    isFlying: false,
    xpValue: 14,
    color: 0x2b2b30,
    mass: 8.0
  },
  plasma_turret: {
    archetype: 'plasma_turret',
    name: 'Skynet Perimeter Defense Turret',
    maxHp: 220,
    speed: 0,
    damage: 25,
    radius: 1.2,
    isBoss: false,
    isFlying: false,
    xpValue: 20,
    color: 0x37474f,
    mass: 50.0
  },
};


export interface EliteAffixConfig {
  id: EliteAffix;
  name: string;
  tintColor: number;
  description: string;
}

export const ELITE_AFFIXES: Record<EliteAffix, EliteAffixConfig> = {
  Armored: {
    id: 'Armored',
    name: 'Armored',
    tintColor: 0x90a4ae,
    description: '-50% damage taken until armor stripped by EMP'
  },
  Overclocked: {
    id: 'Overclocked',
    name: 'Overclocked',
    tintColor: 0xffab00,
    description: '+60% movement speed'
  },
  'Self-Destruct': {
    id: 'Self-Destruct',
    name: 'Self-Destruct',
    tintColor: 0xff1744,
    description: 'Detonates upon termination in a telegraphed blast'
  },
};

export function applyEliteAffix(enemy: import('../core/types').ActiveEnemy, affix: EliteAffix): void {
  enemy.isElite = true;
  enemy.affix = affix;
  enemy.scale = 1.4;
  enemy.radius *= 1.4;
  enemy.hp = Math.round(enemy.hp * 2.0);
  enemy.maxHp = enemy.hp;

  if (affix === 'Overclocked') {
    enemy.speed = Number((enemy.speed * 1.6).toFixed(2));
  }
}

export function handleEliteDeath(
  enemy: import('../core/types').ActiveEnemy,
  ctx: import('../systems/enemies/EnemyBehaviour').EnemyContext
): void {
  if (enemy.affix === 'Self-Destruct') {
    // The blast lands after a short telegraphed delay so the player can move out of it
    ctx.audio.playBombBeep(enemy.x, enemy.z, ctx.runState.playerPos.x, ctx.runState.playerPos.z);
    ctx.scheduleBlast?.(enemy.x, enemy.z, SELF_DESTRUCT_BLAST.radius, SELF_DESTRUCT_BLAST.damage, SELF_DESTRUCT_BLAST.delaySeconds);
  }
}
