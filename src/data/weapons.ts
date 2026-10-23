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

/**
 * A named perk a weapon gains at a level (and keeps): multipliers for damage, cooldown, area, speed and
 * duration, extra projectiles and pierce. Gives each weapon its own character on top of the shared curve.
 */
export interface WeaponSignature {
  name: string;
  text: string;
  damage?: number;
  cooldown?: number;
  area?: number;
  speed?: number;
  duration?: number;
  amount?: number;
  pierce?: number;
}

export function buildWeaponLevels(
  base: Omit<WeaponLevelStats, 'level' | 'description'>,
  descs: string[],
  amountNoun = 'PROJECTILE',
  signatures: Partial<Record<4 | 8, WeaponSignature>> = {}
): WeaponLevelStats[] {
  const levels: WeaponLevelStats[] = [];
  const perks = { damage: 1, cooldown: 1, area: 1, speed: 1, duration: 1, amount: 0, pierce: 0 };

  for (let idx = 0; idx < 8; idx++) {
    const lv = idx + 1;
    const mult = 1 + idx * 0.22;
    const sig = signatures[lv as 4 | 8];
    if (sig) {
      perks.damage *= sig.damage ?? 1;
      perks.cooldown *= sig.cooldown ?? 1;
      perks.area *= sig.area ?? 1;
      perks.speed *= sig.speed ?? 1;
      perks.duration *= sig.duration ?? 1;
      perks.amount += sig.amount ?? 0;
      perks.pierce += sig.pierce ?? 0;
    }
    const stats: Omit<WeaponLevelStats, 'description'> = {
      level: lv,
      damage: Math.round(base.damage * mult * perks.damage),
      cooldown: Number((base.cooldown * Math.pow(0.94, idx) * perks.cooldown).toFixed(2)),
      area: Number((base.area * (1 + idx * 0.08) * perks.area).toFixed(2)),
      speed: Number((base.speed * (1 + idx * 0.06) * perks.speed).toFixed(2)),
      amount: base.amount + (lv >= 3 ? 1 : 0) + (lv >= 6 ? 1 : 0) + (lv === 8 ? 1 : 0) + perks.amount,
      duration: Number((base.duration * (1 + idx * 0.08) * perks.duration).toFixed(2)),
      pierce: base.pierce + Math.floor(idx / 2) + perks.pierce
    };

    let description: string;
    if (idx === 0) {
      description = descs[0] ?? `Level 1 Tech-Com issue.`;
    } else {
      description = formatWeaponStatDiff(stats, levels[idx - 1], amountNoun);
      if (sig) description = `★ ${sig.name}: ${sig.text} · ${description}`;
    }

    levels.push({
      ...stats,
      description
    });
  }

  return levels;
}

/** Signature perks at levels 4 and 8 (see buildWeaponLevels). */
const SIGNATURES: Record<BaseWeaponId, Partial<Record<4 | 8, WeaponSignature>>> = {
  ithaca_37: {
    4: { name: 'Slug Load', text: 'Pellets punch through the front rank', pierce: 2 },
    8: { name: 'Dragon\'s Breath', text: 'A wider, denser cone', amount: 3 }
  },
  pipe_bomb: {
    4: { name: 'Shrapnel Casing', text: 'Bigger blasts', area: 1.25 },
    8: { name: 'Cluster Charge', text: 'Two more bombs per throw', amount: 2 }
  },
  m25_plasma: {
    4: { name: 'Overcharged Cell', text: 'Hotter bolts', damage: 1.3 },
    8: { name: 'Phase Lance', text: 'Faster bolts that pass through lines', pierce: 4, speed: 1.3 }
  },
  seeker_drone: {
    4: { name: 'Wide Orbit', text: 'Drones sweep a larger ring', area: 1.3 },
    8: { name: 'Swarm Protocol', text: 'Two more drones', amount: 2 }
  },
  emp_emitter: {
    4: { name: 'Capacitor Dump', text: 'Wider pulses', area: 1.3 },
    8: { name: 'Rapid Discharge', text: 'Pulses come far faster', cooldown: 0.7 }
  },
  laser_designator: {
    4: { name: 'Hard Lock', text: 'Heavier strikes', damage: 1.35 },
    8: { name: 'Fire Mission', text: 'Two more strikes per call', amount: 2 }
  },
  rpg_launcher: {
    4: { name: 'HEAT Round', text: 'Harder-hitting warheads', damage: 1.3 },
    8: { name: 'Thermobaric', text: 'Much larger blasts', area: 1.4 }
  },
  molotov: {
    4: { name: 'Napalm Mix', text: 'Fires burn longer', duration: 1.5 },
    8: { name: 'Wildfire', text: 'More flasks, wider pools', amount: 2, area: 1.2 }
  },
  resistance_k9: {
    4: { name: 'Trained Handler', text: 'Faster bites', cooldown: 0.8 },
    8: { name: 'Alpha', text: 'Savage bites', damage: 1.4 }
  },
  reprogrammed_t800: {
    4: { name: 'Combat Chip', text: 'Harder hits', damage: 1.3 },
    8: { name: 'Mission Override', text: 'Relentless attack rate', cooldown: 0.75 }
  },
  coltan_knife: {
    4: { name: 'Serrated Edge', text: 'Longer reach', area: 1.25 },
    8: { name: 'Whirlwind', text: 'An extra sweep, cutting deeper', amount: 1, damage: 1.2 }
  }
};

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
      'PELLET',
      SIGNATURES.ithaca_37
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
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.5, minDist: 5, maxDist: 13, vy: 4.5, flightTime: 0.8, areaRadius: 2.5, launchSfx: 'throw' },
    knockback: 16,
    levels: buildWeaponLevels(
      { damage: 45, cooldown: 2.4, area: 1.35, speed: 12, amount: 1, duration: 1.2, pierce: 99 },
      ['Lobs a homemade fuse pipe bomb detonating in a fiery explosion.'],
      'BOMB',
      SIGNATURES.pipe_bomb
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
      { damage: 30, cooldown: 0.6, area: 1.0, speed: 28, amount: 1, duration: 1.2, pierce: 1 },
      ['Fires high-velocity violet phased plasma bolts at nearest machine.'],
      'BOLT',
      SIGNATURES.m25_plasma
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
      'DRONE',
      SIGNATURES.seeker_drone
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
      'PULSE',
      SIGNATURES.emp_emitter
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
      'STRIKE',
      SIGNATURES.laser_designator
    )
  },
  rpg_launcher: {
    id: 'rpg_launcher',
    name: 'RPG-7 Heavy Launcher',
    codeName: 'ANTI-ARMOR THERMITE',
    isEvolved: false,
    pairedPassive: 'infrared_goggles',
    evolvesInto: 'tandem_warhead',
    iconColor: '#ff3b00',
    pattern: 'Lobbed',
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.15, minDist: 8, maxDist: 18, vy: 5.5, flightTime: 0.65, areaRadius: 3.8, launchSfx: 'rocket' },
    knockback: 25,
    levels: buildWeaponLevels(
      { damage: 75, cooldown: 3.2, area: 1.5, speed: 18, amount: 1, duration: 1.0, pierce: 99 },
      ['Fires a high-impact shaped charge rocket detonating in a massive explosion.'],
      'BOMB',
      SIGNATURES.rpg_launcher
    )
  },
  molotov: {
    id: 'molotov',
    name: 'Incendiary Molotov',
    codeName: 'PROMETHEUM TRAIL',
    isEvolved: false,
    pairedPassive: 'fuel_tank',
    evolvesInto: 'firestorm_lane',
    iconColor: '#ff7700',
    pattern: 'GroundZone',
    patternParams: { baseRadius: 1.6, isLine: true, lineSpacing: 2.2, deploySfx: 'glass' },
    knockback: 4,
    levels: buildWeaponLevels(
      { damage: 20, cooldown: 2.8, area: 1.2, speed: 12, amount: 3, duration: 3.5, pierce: 99 },
      ['Hurls an incendiary cocktail creating a burning lane of fire.'],
      'CANISTER',
      SIGNATURES.molotov
    )
  },
  resistance_k9: {
    id: 'resistance_k9',
    name: 'Resistance K-9 Scout',
    codeName: 'INFILTRATOR DETECTOR',
    isEvolved: false,
    pairedPassive: 'dog_tags',
    evolvesInto: 'k9_pack',
    iconColor: '#38bdf8',
    pattern: 'DogUnit',
    patternParams: { baseRadius: 1.2 },
    knockback: 10,
    levels: buildWeaponLevels(
      { damage: 35, cooldown: 0.5, area: 1.0, speed: 10.5, amount: 1, duration: 1.0, pierce: 1 },
      ['Loyal scout dog that bites machines, revealing Infiltrators and T-1000s.'],
      'PROJECTILE',
      SIGNATURES.resistance_k9
    )
  },
  reprogrammed_t800: {
    id: 'reprogrammed_t800',
    name: 'Reprogrammed T-800 Ally',
    codeName: 'CYBERDYNE PROTECTOR',
    isEvolved: false,
    pairedPassive: 'polaroid_luck',
    evolvesInto: 'guardian_protocol',
    iconColor: '#00e5ff',
    pattern: 'AllySummon',
    patternParams: { baseRadius: 2.5 },
    knockback: 12,
    levels: buildWeaponLevels(
      { damage: 40, cooldown: 0.65, area: 1.0, speed: 28, amount: 1, duration: 1.0, pierce: 2 },
      ['Captured Terminator reprogrammed to protect Reese with plasma suppressive fire.'],
      'BOLT',
      SIGNATURES.reprogrammed_t800
    )
  },
  coltan_knife: {
    id: 'coltan_knife',
    name: 'Coltan Combat Knife',
    codeName: 'HYPERALLOY BLADE',
    isEvolved: false,
    pairedPassive: 'might_shells',
    evolvesInto: 'hyperalloy_blade',
    iconColor: '#e2e8f0',
    pattern: 'MeleeSweep',
    patternParams: { arcAngle: Math.PI * 0.65, flashColor: 0x00e5ff },
    knockback: 20,
    levels: buildWeaponLevels(
      { damage: 55, cooldown: 1.1, area: 1.2, speed: 1.0, amount: 1, duration: 0.16, pierce: 99 },
      ['Slashes an arc with a heavy coltan blade, severing endoskeleton joints.'],
      'PROJECTILE',
      SIGNATURES.coltan_knife
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
    patternParams: { spreadAngle: Math.PI * 2, ringFull: true, projectileVisual: 'pellet', flashColor: 0xff5500, projectileRadius: 0.4, sfx: 'shotgun_auto' },
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
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.5, minDist: 5, maxDist: 13, vy: 4.5, flightTime: 0.8, areaRadius: 4.2, launchSfx: 'throw' },
    knockback: 22,
    levels: [
      {
        level: 1,
        damage: 351,
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
    patternParams: { projectileVisual: 'heavy_plasma', flashColor: 0xff00ea, jitterAngle: 0.1, jitterPos: 0.4, projectileRadius: 0.6, sfx: 'railgun' },
    knockback: 10,
    levels: [
      {
        level: 1,
        damage: 170,
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
        damage: 311,
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
        damage: 612,
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
  },
  tandem_warhead: {
    id: 'tandem_warhead',
    name: 'Tandem Warhead RPG',
    codeName: 'SUPERWEAPON: BUNKER BREAKER',
    isEvolved: true,
    evolvesFrom: 'rpg_launcher',
    iconColor: '#ff2200',
    pattern: 'Lobbed',
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.25, minDist: 8, maxDist: 20, vy: 6.5, flightTime: 0.6, areaRadius: 5.5, launchSfx: 'rocket' },
    knockback: 35,
    levels: [
      {
        level: 1,
        damage: 716,
        cooldown: 2.0,
        area: 2.8,
        speed: 22,
        amount: 2,
        duration: 1.0,
        pierce: 99,
        description: 'Dual-stage shaped charges that obliterate heavy machine armor in colossal detonations.'
      }
    ]
  },
  firestorm_lane: {
    id: 'firestorm_lane',
    name: 'Firestorm Incendiary Lane',
    codeName: 'SUPERWEAPON: SCORCHED HIGHWAY',
    isEvolved: true,
    evolvesFrom: 'molotov',
    iconColor: '#ff5500',
    pattern: 'GroundZone',
    patternParams: { baseRadius: 2.2, isLine: true, lineSpacing: 2.6, deploySfx: 'glass' },
    knockback: 6,
    levels: [
      {
        level: 1,
        damage: 101,
        cooldown: 1.8,
        area: 1.8,
        speed: 14,
        amount: 6,
        duration: 5.5,
        pierce: 99,
        description: 'Unleashes long continuous highways of prometheum fire that scorch and melt entire columns of machines.'
      }
    ]
  },
  k9_pack: {
    id: 'k9_pack',
    name: 'Resistance K-9 Wolfpack',
    codeName: 'SUPERWEAPON: PACK HUNT',
    isEvolved: true,
    evolvesFrom: 'resistance_k9',
    iconColor: '#00f0ff',
    pattern: 'DogUnit',
    patternParams: { baseRadius: 1.8 },
    knockback: 18,
    levels: [
      {
        level: 1,
        damage: 306,
        cooldown: 0.32,
        area: 1.4,
        speed: 12.5,
        amount: 3,
        duration: 1.0,
        pierce: 3,
        description: 'Pack of 3 cybernetically armored war dogs that hunt down and shred synthetic machines together.'
      }
    ]
  },
  guardian_protocol: {
    id: 'guardian_protocol',
    name: 'Guardian Protocol T-800',
    codeName: 'SUPERWEAPON: CONNOR GUARDIAN',
    isEvolved: true,
    evolvesFrom: 'reprogrammed_t800',
    iconColor: '#00ffff',
    pattern: 'AllySummon',
    patternParams: { baseRadius: 3.5 },
    knockback: 20,
    levels: [
      {
        level: 1,
        damage: 347,
        cooldown: 0.28,
        area: 1.5,
        speed: 34,
        amount: 2,
        duration: 1.2,
        pierce: 6,
        description: 'Armored heavy Terminator with 750 HP, dual heavy plasma miniguns, and an impenetrable taunt aura.'
      }
    ]
  },
  hyperalloy_blade: {
    id: 'hyperalloy_blade',
    name: 'Hyperalloy Combat Blade',
    codeName: 'SUPERWEAPON: VIBRO-CLEAVER',
    isEvolved: true,
    evolvesFrom: 'coltan_knife',
    iconColor: '#d946ef',
    pattern: 'MeleeSweep',
    patternParams: { arcAngle: Math.PI * 2.0, flashColor: 0xd946ef },
    knockback: 30,
    levels: [
      {
        level: 1,
        damage: 1331,
        cooldown: 0.75,
        area: 1.8,
        speed: 1.0,
        amount: 1,
        duration: 0.2,
        pierce: 99,
        description: 'Full 360-degree sonic vibro-cleave that slices through all surrounding endoskeletons in a single stroke.'
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
    evolvesWeapon: ['ithaca_37', 'coltan_knife'],
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
  fuel_tank: {
    id: 'fuel_tank',
    name: 'Promethium Fuel Tank',
    codeName: 'PROPELLANT CELL',
    maxLevel: 5,
    evolvesWeapon: 'molotov',
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
  },
  infrared_goggles: {
    id: 'infrared_goggles',
    name: 'Infrared Tactical Goggles',
    codeName: 'CRITICAL TARGETER',
    maxLevel: 5,
    evolvesWeapon: 'rpg_launcher',
    iconColor: '#ff3b00',
    descriptionPerLevel: '+20% critical damage and +4% critical strike chance.',
    statPerLevel: { critMultiplier: 0.2, critChance: 0.04 }
  },
  polaroid_luck: {
    id: 'polaroid_luck',
    name: "Sarah's Polaroid",
    codeName: 'FORTUNE UPLINK',
    maxLevel: 5,
    evolvesWeapon: 'reprogrammed_t800',
    iconColor: '#e2e8f0',
    descriptionPerLevel: '+25% Luck and +10% XP gain.',
    statPerLevel: { luckMultiplier: 0.25, xpGainMultiplier: 0.1 }
  },
  dog_tags: {
    id: 'dog_tags',
    name: 'Fallen Comrade Dog Tags',
    codeName: 'SURVIVOR RESOLVE',
    maxLevel: 5,
    evolvesWeapon: 'resistance_k9',
    iconColor: '#f59e0b',
    descriptionPerLevel: '+15% chance to survive lethal damage and +10 max HP.',
    statPerLevel: { revivalChance: 0.15, maxHp: 10 }
  }
};

/** A base weapon at this level evolves (with its paired passive) when the next data vault opens */
export const EVOLUTION_LEVEL = 7;

export function canEvolveWeapon(
  weaponId: WeaponId,
  weaponLevel: number,
  activePassives: Map<PassiveId, number>
): EvolvedWeaponId | null {
  if (weaponLevel < EVOLUTION_LEVEL) return null;
  const baseDef = BASE_WEAPONS[weaponId as BaseWeaponId];
  if (!baseDef || !baseDef.pairedPassive || !baseDef.evolvesInto) return null;
  const passiveLevel = activePassives.get(baseDef.pairedPassive) ?? 0;
  if (passiveLevel >= 1) {
    return baseDef.evolvesInto;
  }
  return null;
}
