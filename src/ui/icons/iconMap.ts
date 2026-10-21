import type { PassiveId, WeaponId } from '../../core/types';

/**
 * Single source of truth for which game-icons.net icons the game uses.
 * Values are game-icons ids. `npm run build:icons` reads every quoted id in this file
 * and writes only those icons into iconData.ts (generated, do not edit).
 */

/** Semantic UI icons. */
export const UI_ICONS = {
  health: 'heart-plus',
  level: 'upgrade',
  timer: 'stopwatch',
  kills: 'death-skull',
  boss: 'robot-golem',
  bossAlert: 'target-laser',
  alert: 'hazard-sign',
  pause: 'pause-button',
  play: 'play-button',
  resume: 'play-button',
  settings: 'cog',
  shop: 'shopping-cart',
  trophy: 'trophy',
  achievement: 'medal',
  codex: 'open-book',
  history: 'scroll-unfurled',
  armor: 'checked-shield',
  ability: 'power-lightning',
  controller: 'console-controller',
  disconnected: 'unplugged',
  exit: 'exit-door',
  back: 'return-arrow',
  soundOn: 'sound-on',
  soundOff: 'sound-off',
  scrap: 'metal-bar',
  locked: 'padlock',
  reroll: 'rolling-dices',
  banish: 'cancel',
  skip: 'fast-forward-button',
  vault: 'ammo-box',
  evolution: 'spiked-halo',
  star: 'round-star',
  victory: 'laurels-trophy',
  defeat: 'skull-crossed-bones',
  keyboard: 'keyboard',
  mouse: 'mouse'
} as const;

export type UiIconName = keyof typeof UI_ICONS;

/** One icon per weapon, evolutions share their base weapon's family. */
export const WEAPON_ICONS: Record<WeaponId, string> = {
  ithaca_37: 'shotgun',
  pipe_bomb: 'grenade',
  m25_plasma: 'laser-blast',
  seeker_drone: 'robot-antennas',
  emp_emitter: 'electric',
  m79_thumper: 'stun-grenade',
  napalm_canister: 'fire-bomb',
  laser_designator: 'target-laser',
  m16_carbine: 'rifle',
  rpg_launcher: 'missile-launcher',
  molotov: 'fire',
  resistance_k9: 'paw-print',
  reprogrammed_t800: 'robot-helmet',
  coltan_knife: 'sword-brandish',
  trench_sweeper: 'crossed-pistols',
  thermite_buster: 'mine-explosion',
  m95a1_plasma: 'laser-sparks',
  perimeter_ring: 'ringed-beam',
  emp_supernova: 'lightning-frequency',
  mm1_barrage: 'rocket',
  firestorm_wall: 'flamethrower',
  orbital_ion: 'crosshair',
  phased_plasma_assault: 'plasma-bolt',
  tandem_warhead: 'nuclear-bomb',
  firestorm_lane: 'chemical-bolt',
  k9_pack: 'wolf-head',
  guardian_protocol: 'robot-grab',
  hyperalloy_blade: 'swords-power'
};

export const PASSIVE_ICONS: Record<PassiveId, string> = {
  might_shells: 'bullets',
  blast_radius: 'explosion-rays',
  phase_inductor: 'vibrating-shield',
  telemetry_cpu: 'cpu',
  flux_coil: 'tesla-coil',
  bandolier: 'ammo-box',
  fuel_tank: 'speedometer',
  comms_uplink: 'radar-sweep',
  ammo_belt: 'clockwork',
  infrared_goggles: 'target-arrows',
  polaroid_luck: 'three-leaves',
  dog_tags: 'caduceus'
};
