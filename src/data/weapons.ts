import type {
  BaseWeaponId,
  EvolvedWeaponId,
  PassiveDefinition,
  PassiveId,
  WeaponDefinition,
  WeaponId,
  WeaponLevelStats
} from '../core/types';

export function formatWeaponStatDiff(
  curr: Omit<WeaponLevelStats, 'description'>,
  prev: Omit<WeaponLevelStats, 'description'>,
  amountNoun = 'PROJECTILE'
): string {
  const diffs: string[] = [];

  if (curr.damage !== prev.damage) {
    const pct = Math.round(((curr.damage - prev.damage) / prev.damage) * 100);
    diffs.push(`${pct >= 0 ? '+' : ''}${pct}% DMG`);
  }

  if (curr.amount !== prev.amount) {
    const diff = curr.amount - prev.amount;
    diffs.push(`${diff >= 0 ? '+' : ''}${diff} ${amountNoun}`);
  }

  if (curr.cooldown !== prev.cooldown) {
    const pct = Math.round(((curr.cooldown - prev.cooldown) / prev.cooldown) * 100);
    diffs.push(`${pct >= 0 ? '+' : ''}${pct}% CD`);
  }

  if (curr.area !== prev.area) {
    const pct = Math.round(((curr.area - prev.area) / prev.area) * 100);
    diffs.push(`${pct >= 0 ? '+' : ''}${pct}% AREA`);
  }

  if (curr.speed !== prev.speed) {
    const pct = Math.round(((curr.speed - prev.speed) / prev.speed) * 100);
    diffs.push(`${pct >= 0 ? '+' : ''}${pct}% SPEED`);
  }

  if (curr.duration !== prev.duration) {
    const pct = Math.round(((curr.duration - prev.duration) / prev.duration) * 100);
    diffs.push(`${pct >= 0 ? '+' : ''}${pct}% DURATION`);
  }

  if (curr.pierce !== prev.pierce) {
    const diff = curr.pierce - prev.pierce;
    diffs.push(`${diff >= 0 ? '+' : ''}${diff} PIERCE`);
  }

  return diffs.join(' · ');
}

export function buildWeaponLevels(
  base: Omit<WeaponLevelStats, 'level' | 'description'>,
  descs: string[],
  amountNoun = 'PROJECTILE'
): WeaponLevelStats[] {
  const levels: WeaponLevelStats[] = [];

  for (let idx = 0; idx < 8; idx++) {
    const lv = idx + 1;
    const mult = 1 + idx * 0.22;
    const stats: Omit<WeaponLevelStats, 'description'> = {
      level: lv,
      damage: Math.round(base.damage * mult),
      cooldown: Number((base.cooldown * Math.pow(0.94, idx)).toFixed(2)),
      area: Number((base.area * (1 + idx * 0.08)).toFixed(2)),
      speed: Number((base.speed * (1 + idx * 0.06)).toFixed(2)),
      amount: base.amount + (lv >= 3 ? 1 : 0) + (lv >= 6 ? 1 : 0) + (lv === 8 ? 1 : 0),
      duration: Number((base.duration * (1 + idx * 0.08)).toFixed(2)),
      pierce: base.pierce + Math.floor(idx / 2)
    };

    let description: string;
    if (idx === 0) {
      description = descs[0] ?? `Level 1 Tech-Com issue.`;
    } else {
      description = formatWeaponStatDiff(stats, levels[idx - 1], amountNoun);
    }

    levels.push({
      ...stats,
      description
    });
  }

  return levels;
}

export const BASE_WEAPONS: Record<BaseWeaponId, WeaponDefinition> = {
  ithaca_37: {
    id: 'ithaca_37',
    name: 'Ithaca 37 Shotgun',
    codeName: 'TECH-COM 12GA',
    isEvolved: false,
    pairedPassive: 'might_shells',
    evolvesInto: 'trench_sweeper',
    iconColor: '#ff9900',
    pattern: 'SpreadShot',
    patternParams: { spreadAngle: 0.42, ringFull: false, projectileVisual: 'pellet', flashColor: 0xff9900, projectileRadius: 0.25 },
    knockback: 18,
    levels: buildWeaponLevels(
      { damage: 24, cooldown: 1.15, area: 1.0, speed: 22, amount: 5, duration: 0.45, pierce: 2 },
      ['Fires a 5-pellet buckshot spread with heavy knockback.'],
      'PELLET'
    )
  },
  pipe_bomb: {
    id: 'pipe_bomb',
    name: 'Thermite Pipe Bomb',
    codeName: 'TECH-COM DEMO',
    isEvolved: false,
    pairedPassive: 'blast_radius',
    evolvesInto: 'thermite_buster',
    iconColor: '#ff4411',
    pattern: 'Lobbed',
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.5, minDist: 5, maxDist: 13, vy: 4.5, flightTime: 0.8, areaRadius: 2.5 },
    knockback: 16,
    levels: buildWeaponLevels(
      { damage: 45, cooldown: 2.4, area: 1.35, speed: 12, amount: 1, duration: 1.2, pierce: 99 },
      ['Lobs a homemade fuse pipe bomb detonating in a fiery explosion.'],
      'BOMB'
    )
  },
  m25_plasma: {
    id: 'm25_plasma',
    name: 'Westinghouse M-25',
    codeName: '40W PHASED PLASMA',
    isEvolved: false,
    pairedPassive: 'phase_inductor',
    evolvesInto: 'm95a1_plasma',
    iconColor: '#d400ff',
    pattern: 'StraightShot',
    patternParams: { projectileVisual: 'plasma', flashColor: 0xd400ff, parallelOffset: 0.12, projectileRadius: 0.35, sfx: 'plasma_light' },
    knockback: 6,
    levels: buildWeaponLevels(
      { damage: 30, cooldown: 0.75, area: 1.0, speed: 28, amount: 1, duration: 1.2, pierce: 1 },
      ['Fires high-velocity violet phased plasma bolts at nearest machine.'],
      'BOLT'
    )
  },
  seeker_drone: {
    id: 'seeker_drone',
    name: 'Captured Seeker Drone',
    codeName: 'SKYNET REPROGRAMMED',
    isEvolved: false,
    pairedPassive: 'telemetry_cpu',
    evolvesInto: 'perimeter_ring',
    iconColor: '#00e5ff',
    pattern: 'Orbiters',
    patternParams: { droneCount: 2, orbitRadius: 2.4, orbitSpeedMult: 1.0 },
    knockback: 5,
    levels: buildWeaponLevels(
      { damage: 18, cooldown: 3.2, area: 1.1, speed: 4.2, amount: 2, duration: 2.6, pierce: 99 },
      ['Two captured micro-drones orbit Kyle, slicing through approaching machines.'],
      'DRONE'
    )
  },
  emp_emitter: {
    id: 'emp_emitter',
    name: 'EMP Pulse Emitter',
    codeName: 'FLUX DISRUPTOR',
    isEvolved: false,
    pairedPassive: 'flux_coil',
    evolvesInto: 'emp_supernova',
    iconColor: '#4dd2ff',
    pattern: 'Nova',
    patternParams: { baseRadius: 3.8, isSupernova: false, shakeTrauma: 0.22, slowDuration: 2.0 },
    knockback: 14,
    levels: buildWeaponLevels(
      { damage: 14, cooldown: 1.45, area: 1.25, speed: 1.0, amount: 1, duration: 0.35, pierce: 99 },
      ['Emits an expanding electromagnetic ring that damages and slows machines.'],
      'PULSE'
    )
  },
  m79_thumper: {
    id: 'm79_thumper',
    name: 'M79 Grenade Thumper',
    codeName: '40MM HIGH EXPLOSIVE',
    isEvolved: false,
    pairedPassive: 'bandolier',
    evolvesInto: 'mm1_barrage',
    iconColor: '#ffbb00',
    pattern: 'Lobbed',
    patternParams: { projectileVisual: 'bomb', arcSpread: Math.PI * 2, minDist: 6, maxDist: 15, vy: 5.5, flightTime: 0.7, areaRadius: 3.2 },
    knockback: 15,
    levels: buildWeaponLevels(
      { damage: 52, cooldown: 2.1, area: 1.2, speed: 16, amount: 1, duration: 0.8, pierce: 99 },
      ['Lobs high-arcing 40mm HE grenades at heavy enemy clusters.'],
      'GRENADE'
    )
  },
  napalm_canister: {
    id: 'napalm_canister',
    name: 'Napalm Canister',
    codeName: 'PROMETHEUM FUEL',
    isEvolved: false,
    pairedPassive: 'fuel_tank',
    evolvesInto: 'firestorm_wall',
    iconColor: '#ff2200',
    pattern: 'GroundZone',
    patternParams: { baseRadius: 2.0, minDist: 4, maxDist: 7 },
    knockback: 3,
    levels: buildWeaponLevels(
      { damage: 16, cooldown: 2.6, area: 1.3, speed: 10, amount: 1, duration: 3.0, pierce: 99 },
      ['Throws a fuel canister creating lingering burning ground fire.'],
      'CANISTER'
    )
  },
  laser_designator: {
    id: 'laser_designator',
    name: 'Bunker Laser Targeter',
    codeName: 'ION STRIKE UPLINK',
    isEvolved: false,
    pairedPassive: 'comms_uplink',
    evolvesInto: 'orbital_ion',
    iconColor: '#ff0055',
    pattern: 'Strike',
    patternParams: { baseRadius: 2.5, shakeTrauma: 0.32 },
    knockback: 20,
    levels: buildWeaponLevels(
      { damage: 60, cooldown: 2.8, area: 1.1, speed: 40, amount: 1, duration: 0.5, pierce: 99 },
      ['Paints heavy targets with a red laser, calling down Resistance artillery.'],
      'STRIKE'
    )
  }
};

export const EVOLVED_WEAPONS: Record<EvolvedWeaponId, WeaponDefinition> = {
  trench_sweeper: {
    id: 'trench_sweeper',
    name: 'Trench Sweeper Auto-12',
    codeName: 'SUPERWEAPON: FLECHETTE CYCLER',
    isEvolved: true,
    evolvesFrom: 'ithaca_37',
    iconColor: '#ffa500',
    pattern: 'SpreadShot',
    patternParams: { spreadAngle: Math.PI * 2, ringFull: true, projectileVisual: 'pellet', flashColor: 0xff5500, projectileRadius: 0.4 },
    knockback: 24,
    levels: [
      {
        level: 1,
        damage: 72,
        cooldown: 0.55,
        area: 1.45,
        speed: 26,
        amount: 12,
        duration: 0.6,
        pierce: 6,
        description:
          'Unleashes relentless 360-degree bursts of incendiary tungsten flechettes that ignite endoskeletons.'
      }
    ]
  },
  thermite_buster: {
    id: 'thermite_buster',
    name: 'Thermite Bunker Buster',
    codeName: 'SUPERWEAPON: SLAG CHARGE',
    isEvolved: true,
    evolvesFrom: 'pipe_bomb',
    iconColor: '#ff3300',
    pattern: 'Lobbed',
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.5, minDist: 5, maxDist: 13, vy: 4.5, flightTime: 0.8, areaRadius: 4.2 },
    knockback: 22,
    levels: [
      {
        level: 1,
        damage: 140,
        cooldown: 1.6,
        area: 2.4,
        speed: 14,
        amount: 3,
        duration: 2.5,
        pierce: 99,
        description:
          'Triple cluster thermite charges that detonate and leave bubbling molten slag pools melting chassis armor.'
      }
    ]
  },
  m95a1_plasma: {
    id: 'm95a1_plasma',
    name: 'Westinghouse M95A1 Heavy',
    codeName: 'SUPERWEAPON: TWIN PLASMA BEAM',
    isEvolved: true,
    evolvesFrom: 'm25_plasma',
    iconColor: '#e600ff',
    pattern: 'StraightShot',
    patternParams: { projectileVisual: 'heavy_plasma', flashColor: 0xff00ea, jitterAngle: 0.1, jitterPos: 0.4, projectileRadius: 0.6, sfx: 'plasma_heavy' },
    knockback: 10,
    levels: [
      {
        level: 1,
        damage: 88,
        cooldown: 0.22,
        area: 1.25,
        speed: 34,
        amount: 2,
        duration: 1.5,
        pierce: 8,
        description:
          'Twin-linked rapid violet phased plasma laser streams that pierce rows of machines with explosive sparks.'
      }
    ]
  },
  perimeter_ring: {
    id: 'perimeter_ring',
    name: 'Perimeter Defense Ring',
    codeName: 'SUPERWEAPON: SKYNET NET',
    isEvolved: true,
    evolvesFrom: 'seeker_drone',
    iconColor: '#00ffff',
    pattern: 'Orbiters',
    patternParams: { droneCount: 5, orbitRadius: 3.2, orbitSpeedMult: 1.6 },
    knockback: 8,
    levels: [
      {
        level: 1,
        damage: 54,
        cooldown: 1.0,
        area: 1.6,
        speed: 6.5,
        amount: 6,
        duration: 999,
        pierce: 99,
        description:
          'Permanent impenetrable barrier of 6 high-speed armored razor drones firing outward violet plasma arcs.'
      }
    ]
  },
  emp_supernova: {
    id: 'emp_supernova',
    name: 'Tech-Com EMP Supernova',
    codeName: 'SUPERWEAPON: ZERO GRID',
    isEvolved: true,
    evolvesFrom: 'emp_emitter',
    iconColor: '#00ccff',
    pattern: 'Nova',
    patternParams: { baseRadius: 6.5, isSupernova: true, shakeTrauma: 0.35, slowDuration: 2.0, armorStrip: 0.3, healAmount: 1 },
    knockback: 22,
    levels: [
      {
        level: 1,
        damage: 45,
        cooldown: 0.95,
        area: 2.6,
        speed: 1.0,
        amount: 1,
        duration: 0.6,
        pierce: 99,
        description:
          'Massive pulsating electromagnetic shockwave that freezes machines, permanently strips 30% armor, and restores player HP.'
      }
    ]
  },
  mm1_barrage: {
    id: 'mm1_barrage',
    name: 'MM1 40mm Rotary Barrage',
    codeName: 'SUPERWEAPON: CARPET THUMPER',
    isEvolved: true,
    evolvesFrom: 'm79_thumper',
    iconColor: '#ffd700',
    pattern: 'Lobbed',
    patternParams: { projectileVisual: 'bomb', arcSpread: Math.PI * 2, minDist: 6, maxDist: 15, vy: 5.5, flightTime: 0.7, areaRadius: 3.2 },
    knockback: 18,
    levels: [
      {
        level: 1,
        damage: 155,
        cooldown: 1.35,
        area: 1.8,
        speed: 18,
        amount: 6,
        duration: 1.0,
        pierce: 99,
        description:
          'Unleashes continuous 6-round rolling 40mm artillery carpet bombardments across the wasteland.'
      }
    ]
  },
  firestorm_wall: {
    id: 'firestorm_wall',
    name: 'Skynet Firestorm Wall',
    codeName: 'SUPERWEAPON: NAPALM RING',
    isEvolved: true,
    evolvesFrom: 'napalm_canister',
    iconColor: '#ff5500',
    pattern: 'GroundZone',
    patternParams: { baseRadius: 3.2, minDist: 4, maxDist: 7 },
    knockback: 5,
    levels: [
      {
        level: 1,
        damage: 52,
        cooldown: 1.8,
        area: 2.2,
        speed: 12,
        amount: 4,
        duration: 4.5,
        pierce: 99,
        description:
          'Expanding ring-walls of chemical blue-orange fire that scorch the earth and incinerate approaching machines.'
      }
    ]
  },
  orbital_ion: {
    id: 'orbital_ion',
    name: 'Captured HK-Orbital Ion',
    codeName: 'SUPERWEAPON: SKY BEAM',
    isEvolved: true,
    evolvesFrom: 'laser_designator',
    iconColor: '#ff00aa',
    pattern: 'Strike',
    patternParams: { baseRadius: 3.5, shakeTrauma: 0.32 },
    knockback: 30,
    levels: [
      {
        level: 1,
        damage: 185,
        cooldown: 1.8,
        area: 2.0,
        speed: 45,
        amount: 3,
        duration: 0.7,
        pierce: 99,
        description:
          'Sweeps colossal sky-piercing cyan-magenta orbital ion beams across enemy hordes every 1.8 seconds.'
      }
    ]
  }
};

export const ALL_WEAPONS: Record<WeaponId, WeaponDefinition> = {
  ...BASE_WEAPONS,
  ...EVOLVED_WEAPONS
};

export const PASSIVES: Record<PassiveId, PassiveDefinition> = {
  might_shells: {
    id: 'might_shells',
    name: 'High-Brass Shells',
    codeName: 'MIGHT BOOSTER',
    maxLevel: 5,
    evolvesWeapon: 'ithaca_37',
    iconColor: '#ff9900',
    descriptionPerLevel: '+12% damage to all weapons.',
    statPerLevel: { mightMultiplier: 0.12 }
  },
  blast_radius: {
    id: 'blast_radius',
    name: 'Detonator Caps',
    codeName: 'BLAST MODIFIER',
    maxLevel: 5,
    evolvesWeapon: 'pipe_bomb',
    iconColor: '#ff4411',
    descriptionPerLevel: '+12% area of effect to all weapons.',
    statPerLevel: { areaMultiplier: 0.12 }
  },
  phase_inductor: {
    id: 'phase_inductor',
    name: '40-Watt Phase Inductor',
    codeName: 'COOLDOWN CYCLER',
    maxLevel: 5,
    evolvesWeapon: 'm25_plasma',
    iconColor: '#d400ff',
    descriptionPerLevel: '-8% weapon cooldown.',
    statPerLevel: { cooldownMultiplier: -0.08 }
  },
  telemetry_cpu: {
    id: 'telemetry_cpu',
    name: 'Skynet Telemetry CPU',
    codeName: 'TACTICAL PROCESSOR',
    maxLevel: 5,
    evolvesWeapon: 'seeker_drone',
    iconColor: '#00e5ff',
    descriptionPerLevel: '+15% projectile duration and orbit speed.',
    statPerLevel: { durationMultiplier: 0.15 }
  },
  flux_coil: {
    id: 'flux_coil',
    name: 'Flux Capacitor Coil',
    codeName: 'MAGNETIC FIELD',
    maxLevel: 5,
    evolvesWeapon: 'emp_emitter',
    iconColor: '#4dd2ff',
    descriptionPerLevel: '+25% pickup magnet range and +10% max HP.',
    statPerLevel: { magnetRadius: 1.8, maxHp: 15 }
  },
  bandolier: {
    id: 'bandolier',
    name: 'Ammo Bandolier',
    codeName: 'MUNITIONS RIG',
    maxLevel: 2,
    evolvesWeapon: 'm79_thumper',
    iconColor: '#ffbb00',
    descriptionPerLevel: '+1 projectile amount to all weapons.',
    statPerLevel: { bonusAmount: 1 }
  },
  fuel_tank: {
    id: 'fuel_tank',
    name: 'Promethium Fuel Tank',
    codeName: 'PROPELLANT CELL',
    maxLevel: 5,
    evolvesWeapon: 'napalm_canister',
    iconColor: '#ff2200',
    descriptionPerLevel: '+12% projectile speed and +8% Kyle movement speed.',
    statPerLevel: { speedMultiplier: 0.12, moveSpeed: 0.45 }
  },
  comms_uplink: {
    id: 'comms_uplink',
    name: 'Resistance Uplink',
    codeName: 'TARGETING SATELLITE',
    maxLevel: 5,
    evolvesWeapon: 'laser_designator',
    iconColor: '#ff0055',
    descriptionPerLevel: '+8% critical strike chance and +15% Luck.',
    statPerLevel: { critChance: 0.08, luckMultiplier: 0.15 }
  }
};

export function canEvolveWeapon(
  weaponId: WeaponId,
  weaponLevel: number,
  activePassives: Map<PassiveId, number>
): EvolvedWeaponId | null {
  if (weaponLevel < 8) return null;
  const baseDef = BASE_WEAPONS[weaponId as BaseWeaponId];
  if (!baseDef || !baseDef.pairedPassive || !baseDef.evolvesInto) return null;
  const passiveLevel = activePassives.get(baseDef.pairedPassive) ?? 0;
  if (passiveLevel >= 1) {
    return baseDef.evolvesInto;
  }
  return null;
}
