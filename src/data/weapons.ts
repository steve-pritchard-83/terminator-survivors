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
    patternParams: { projectileVisual: 'bomb', arcSpread: 0.5, minDist: 5, maxDist: 13, vy: 4.5, flightTime: 0.8, areaRadius: 2.5, launchSfx: 'throw' },
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
    patternParams: { projectileVisual: 'bomb', arcSpread: Math.PI * 2, minDist: 6, maxDist: 15, vy: 5.5, flightTime: 0.7, areaRadius: 3.2, launchSfx: 'grenade' },
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
  },
  m16_carbine: {
    id: 'm16_carbine',
    name: 'M-16 Plasma Carbine',
    codeName: 'TECH-COM 5.56 PLASMA',
    isEvolved: false,
    pairedPassive: 'ammo_belt',
    evolvesInto: 'phased_plasma_assault',
    iconColor: '#00b4d8',
    pattern: 'StraightShot',
    patternParams: { projectileVisual: 'plasma', flashColor: 0x00b4d8, parallelOffset: 0, jitterAngle: 0.08, projectileRadius: 0.3, sfx: 'rifle' },
    knockback: 7,
    levels: buildWeaponLevels(
      { damage: 22, cooldown: 0.85, area: 1.0, speed: 32, amount: 3, duration: 0.9, pierce: 2 },
      ['Fires a 3-round burst of phased plasma cartridges.'],
      'BOLT'
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
      'BOMB'
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
      'CANISTER'
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
      'PROJECTILE'
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
      'BOLT'
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
      'PROJECTILE'
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
    patternParams: { projectileVisual: 'heavy_plasma', flashColor: 0xff00ea, jitterAngle: 0.1, jitterPos: 0.4, projectileRadius: 0.6, sfx: 'railgun' },
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
    patternParams: { projectileVisual: 'bomb', arcSpread: Math.PI * 2, minDist: 6, maxDist: 15, vy: 5.5, flightTime: 0.7, areaRadius: 3.2, launchSfx: 'grenade' },
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
  },
  phased_plasma_assault: {
    id: 'phased_plasma_assault',
    name: 'Phased Plasma Assault Carbine',
    codeName: 'SUPERWEAPON: ION CYCLER',
    isEvolved: true,
    evolvesFrom: 'm16_carbine',
    iconColor: '#38bdf8',
    pattern: 'StraightShot',
    patternParams: { projectileVisual: 'heavy_plasma', flashColor: 0x38bdf8, parallelOffset: 0.1, jitterAngle: 0.05, projectileRadius: 0.45, sfx: 'plasma_heavy' },
    knockback: 12,
    levels: [
      {
        level: 1,
        damage: 65,
        cooldown: 0.35,
        area: 1.35,
        speed: 38,
        amount: 5,
        duration: 1.2,
        pierce: 6,
        description: 'Continuous 5-round ionized hyper-bursts that shred enemy armor and energy shields.'
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
        damage: 220,
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
        damage: 60,
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
        damage: 105,
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
        damage: 125,
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
        damage: 160,
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
  },
  ammo_belt: {
    id: 'ammo_belt',
    name: 'Munitions Ammo Belt',
    codeName: 'DURATION EXTENDER',
    maxLevel: 5,
    evolvesWeapon: 'm16_carbine',
    iconColor: '#00b4d8',
    descriptionPerLevel: '+15% projectile duration and +5% projectile speed.',
    statPerLevel: { durationMultiplier: 0.15, speedMultiplier: 0.05 }
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
