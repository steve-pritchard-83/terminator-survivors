export type BaseWeaponId =
  | 'ithaca_37'
  | 'pipe_bomb'
  | 'm25_plasma'
  | 'seeker_drone'
  | 'emp_emitter'
  | 'm79_thumper'
  | 'napalm_canister'
  | 'laser_designator';

export type EvolvedWeaponId =
  | 'trench_sweeper'
  | 'thermite_buster'
  | 'm95a1_plasma'
  | 'perimeter_ring'
  | 'emp_supernova'
  | 'mm1_barrage'
  | 'firestorm_wall'
  | 'orbital_ion';

export type WeaponId = BaseWeaponId | EvolvedWeaponId;

export type PassiveId =
  | 'might_shells'
  | 'blast_radius'
  | 'phase_inductor'
  | 'telemetry_cpu'
  | 'flux_coil'
  | 'bandolier'
  | 'fuel_tank'
  | 'comms_uplink';

export type EnemyArchetypeId =
  | 'skynet_crab_drone'
  | 't600_rusted'
  | 't700_scout'
  | 't800_endoskeleton'
  | 'hk_aerial_patrol'
  | 'infiltrator_csm101'
  | 'hk_tank_goliath'
  | 'hk_aerial_squadron_leader'
  | 't1000_prototype'
  | 'skynet_tde_core';

export type LoadoutId = 'reese_2029' | 'reese_1984' | 'techcom_sapper' | 'john_connor';

export type MetaUpgradeId =
  | 'armor_vest'
  | 'combat_stims'
  | 'plasma_overclock'
  | 'servo_greaves'
  | 'salvage_magnet'
  | 'phase_capacitor'
  | 'scavenger_protocol'
  | 'defibrillator';

export type GameMode =
  'title' | 'playing' | 'levelup' | 'vault' | 'paused' | 'gameover' | 'victory';

export interface WeaponLevelStats {
  level: number;
  damage: number;
  cooldown: number;
  area: number;
  speed: number;
  amount: number;
  duration: number;
  pierce: number;
  description: string;
}

export type WeaponPatternId =
  | 'SpreadShot'
  | 'StraightShot'
  | 'Lobbed'
  | 'Nova'
  | 'Orbiters'
  | 'GroundZone'
  | 'Strike';

export interface WeaponPatternParams {
  spreadAngle?: number;
  ringFull?: boolean;
  projectileVisual?: 'pellet' | 'plasma' | 'heavy_plasma' | 'bomb';
  projectileRadius?: number;
  flashColor?: number;
  sfx?: 'shotgun' | 'plasma_light' | 'plasma_heavy' | 'emp' | 'none';
  parallelOffset?: number;
  jitterAngle?: number;
  jitterPos?: number;
  arcSpread?: number;
  minDist?: number;
  maxDist?: number;
  vy?: number;
  flightTime?: number;
  areaRadius?: number;
  baseRadius?: number;
  shakeTrauma?: number;
  isSupernova?: boolean;
  slowDuration?: number;
  armorStrip?: number;
  healAmount?: number;
  droneCount?: number;
  orbitRadius?: number;
  orbitSpeedMult?: number;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  codeName: string;
  isEvolved: boolean;
  pairedPassive?: PassiveId;
  evolvesInto?: EvolvedWeaponId;
  evolvesFrom?: BaseWeaponId;
  iconColor: string;
  pattern: WeaponPatternId;
  patternParams?: WeaponPatternParams;
  levels: WeaponLevelStats[];
}

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  codeName: string;
  maxLevel: number;
  evolvesWeapon: BaseWeaponId;
  iconColor: string;
  descriptionPerLevel: string;
  statPerLevel: Partial<PlayerComputedStats>;
}

export interface PlayerComputedStats {
  maxHp: number;
  regenPerSec: number;
  moveSpeed: number;
  armor: number;
  mightMultiplier: number;
  areaMultiplier: number;
  cooldownMultiplier: number;
  speedMultiplier: number;
  durationMultiplier: number;
  bonusAmount: number;
  magnetRadius: number;
  critChance: number;
  luckMultiplier: number;
  xpGainMultiplier: number;
  revivals: number;
}

export interface SpatialEntity {
  id: number;
  x: number;
  z: number;
  radius: number;
  type: 'enemy' | 'pickup' | 'crate';
  _queryStamp?: number;
}

export interface ActiveEnemy extends SpatialEntity {
  type: 'enemy';
  archetype: EnemyArchetypeId;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  isBoss: boolean;
  isFlying: boolean;
  xpValue: number;
  hitFlashTimer: number;
  slowTimer: number;
  armorStripMultiplier: number;
  attackCooldown: number;
  chargeTimer?: number;
  searchlightAngle?: number;
  searchlightAlertTimer?: number;
  phaseState?: number;
  state?: Record<string, number>;
}

export interface ActiveWeaponSlot {
  id: WeaponId;
  level: number;
  evolved: boolean;
  cooldownTimer: number;
}

export interface UpgradeChoice {
  kind: 'weapon' | 'passive' | 'heal' | 'scrap';
  id: WeaponId | PassiveId | 'medkit' | 'scrap_cache';
  title: string;
  subtitle: string;
  currentLevel: number;
  nextLevel: number;
  description: string;
  synergyHint?: string;
  accentColor: string;
}

export interface MetaSaveData {
  version: number;
  alloyScrap: number;
  totalKills: number;
  bestTimeSeconds: number;
  victories: number;
  unlockedLoadouts: LoadoutId[];
  selectedLoadout: LoadoutId;
  upgrades: Record<MetaUpgradeId, number>;
  settings: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    crtScanlines: boolean;
    autoAim: boolean;
  };
}

export interface PerfTelemetry {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  heapMB?: number;
}

export interface GameDebugAPI {
  getState: () => {
    mode: GameMode;
    fps: number;
    timeSeconds: number;
    seed: number;
    level: number;
    xp: number;
    xpToNext: number;
    pendingLevelUps: number;
    hp: number;
    maxHp: number;
    kills: number;
    alloyScrap: number;
    activeEnemies: number;
    playerPos: { x: number; z: number };
    isDashing: boolean;
    dashCooldown: number;
    weapons: Array<{ id: WeaponId; level: number; evolved: boolean }>;
    passives: Array<{ id: PassiveId; level: number }>;
  };
  grantXp: (amount: number) => void;
  spawnBoss: (archetype: EnemyArchetypeId) => void;
  spawnSwarm: (archetype: EnemyArchetypeId, count: number) => void;
  getPerf: () => PerfTelemetry;
  triggerVault: () => void;
  fastForward: (seconds: number) => void;
  setGodMode: (enabled: boolean) => void;
  togglePause?: () => void;
  pauseGame?: () => void;
  resumeGame?: () => void;
}

declare global {
  interface Window {
    __GAME_DEBUG__?: GameDebugAPI;
  }
}
