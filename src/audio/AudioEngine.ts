const fx = (file: string): string => `./audio/effects/${file}`;
/** `name_01.wav` .. `name_NN.wav` (converted one-shots, see SOUND_SOURCING.md). */
const seq = (name: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => fx(`${name}_${String(i + 1).padStart(2, '0')}.wav`));

export const SFX_WAV_MANIFEST: Record<string, string[]> = {
  // Player guns
  plasmaLight: seq('plasma_player', 4),
  plasmaHeavy: [
    fx('S_Plasma_Aerial_New01.wav'),
    fx('S_Plasma_Aerial_New02.wav'),
    fx('S_LaserTank01.wav'),
    fx('S_LaserTank02.wav')
  ],
  railgun: seq('railgun', 4),
  shotgun: [fx('S_Ithica01.wav'), fx('S_Ithica02.wav'), fx('Shotgun_shot_spas.wav'), ...seq('shotgun_extra', 1)],
  shotgunAuto: seq('shotgun_auto', 4),
  pumpRack: seq('pump_rack', 3),
  strikeLock: seq('strike_lock', 1),
  strikeBeam: seq('strike_beam', 4),
  droneZap: seq('drone_zap', 4),
  servo: seq('servo', 3),
  throw: seq('throw', 2),
  launchGrenade: seq('launch_grenade', 1),
  launchRocket: seq('launch_rocket', 2),
  fireWhoosh: seq('fire_whoosh', 3),
  glassBreak: seq('glass_break', 3),
  empBlast: seq('emp', 3),
  swing: seq('swing', 4),
  // Enemy guns
  enemyPlasma: seq('enemy_plasma', 4),
  enemyHeavy: seq('enemy_heavy', 4),
  minigun: seq('minigun', 1),
  // Impacts, deaths and explosions
  endoHit: seq('hit_metal', 4),
  endoDestroy: seq('death_endo', 4),
  deathMachine: seq('death_machine', 4),
  deathBoss: seq('death_boss', 3),
  explodeSmall: seq('explode_small', 3),
  explodeMed: [...seq('explode_med', 3), fx('plasma_explosion.wav')],
  explodeLarge: [...seq('explode_large', 3), fx('S_Explosion01.wav')],
  explodeDrum: seq('explode_drum', 3),
  hitLiquid: seq('hit_liquid', 3),
  playerHit: seq('player_hit', 3),
  stepPlayer: seq('step', 4),
  stepEndo: seq('step_endo', 4),
  revive: seq('revive', 1),
  // Cues
  hkAlert: [
    fx('S_TurretAlarm.wav'),
    fx('S_HUD_TurretAlarm2.wav'),
    fx('S_Alterted.wav'),
    fx('hk_heavy1a_m.wav')
  ],
  aerialRockets: seq('aerial_rockets', 1),
  bombBeep: seq('bomb_beep', 1),
  bossAerial: seq('boss_aerial', 3),
  bossTank: seq('boss_tank', 2),
  bossCore: seq('boss_core', 2),
  flareLaunch: seq('flare_launch', 1),
  bossStinger: [fx('S_Splash_Screen_Drums_x1.wav'), fx('hk_heavy1a_m.wav'), fx('S_TurretAlarm.wav')],
  // Pickups and rewards
  // A salvaged power cell latching in with a short charge-up (plasma reload click + energy layer)
  pickupGem: seq('pickup_cell', 3),
  lootHeal: seq('loot_heal', 2),
  lootScrap: seq('loot_scrap', 3),
  crateBreak: seq('crate_break', 3),
  vaultOpen: seq('vault_open', 2),
  levelUp: [fx('S_ExpLevel.wav'), fx('S_NewLevel.wav'), fx('S_NewLevel2.wav'), fx('S_NewLevel3.wav')],
  vaultJackpot: [fx('S_ObjectiveComplete.wav'), fx('S_HckingCompleat.wav'), fx('S_AddtoArchive.wav')],
  achievement: seq('achievement', 2),
  evolution: seq('evolution', 2),
  // Ambience
  ambDistant: seq('amb_distant', 4),
  ambBed: [fx('amb_battle_loop.mp3')],
  // UI
  uiClick: [fx('S_Click.wav'), fx('S_Click02.wav')],
  uiBeep: [fx('S_ButtonBeep01.wav'), fx('S_ButtonBeep02.wav')],
  uiBuy: [fx('S_Buy.wav')],
  uiError: [fx('S_DetectiveModeError.wav'), ...seq('ui_no_ammo', 1)],
  uiUpgradeApplied: [fx('S_WeaponUpgradesApplied.wav')],
  uiModalOpen: [
    fx('S_HUD_DetectiveModeOnNew.wav'),
    fx('S_HUD_Infiltrator_AnalysingIntelData1.wav'),
    fx('S_HUD_Infiltrator_EnemyAnalysis.wav')
  ],
  uiModalClose: [fx('S_HUD_DetectiveModeOffNew.wav'), fx('S_DetectiveModeOff.wav')],
  runStart: [fx('S_Splash_Screen_Drums_x1.wav'), fx('S_NewQuest.wav')],
  playerTerminated: [fx('terminated.wav')],
  runDefeat: [fx('terminated.wav'), fx('S_QuestFaild.wav')],
  runVictory: [fx('S_ObjectiveComplete.wav')]
};

import type { GamepadManager } from '../input/GamepadManager';
import { AMBIENCE } from '../data/balance';

export type GunSound = 'plasmaLight' | 'plasmaHeavy' | 'railgun';
export type EnemyShotSound = 'light' | 'heavy' | 'minigun';
export type LaunchSound = 'throw' | 'grenade' | 'rocket';

const PUMP_RACK_DELAY_MS = 350;
const BOSS_SIGNATURES: Record<string, string> = {
  hk_aerial_squadron_leader: 'bossAerial',
  hk_tank_goliath: 'bossTank',
  skynet_tde_core: 'bossCore'
};

export interface VoiceLimitConfig {
  maxVoices: number;
  minRetriggerMs: number;
}

export const DEFAULT_VOICE_CONFIG: VoiceLimitConfig = {
  maxVoices: 4,
  minRetriggerMs: 30
};

export const CATEGORY_VOICE_LIMITS: Record<string, VoiceLimitConfig> = {
  endoHit: { maxVoices: 6, minRetriggerMs: 30 },
  playerHit: { maxVoices: 6, minRetriggerMs: 30 },
  endoDestroy: { maxVoices: 3, minRetriggerMs: 30 },
  deathMachine: { maxVoices: 2, minRetriggerMs: 80 },
  deathBoss: { maxVoices: 1, minRetriggerMs: 500 },
  explodeSmall: { maxVoices: 3, minRetriggerMs: 40 },
  explodeMed: { maxVoices: 3, minRetriggerMs: 40 },
  explodeLarge: { maxVoices: 2, minRetriggerMs: 80 },
  explodeDrum: { maxVoices: 2, minRetriggerMs: 80 },
  enemyPlasma: { maxVoices: 4, minRetriggerMs: 50 },
  enemyHeavy: { maxVoices: 2, minRetriggerMs: 90 },
  minigun: { maxVoices: 2, minRetriggerMs: 250 },
  rifle: { maxVoices: 4, minRetriggerMs: 40 },
  swing: { maxVoices: 4, minRetriggerMs: 60 },
  throw: { maxVoices: 2, minRetriggerMs: 90 },
  launchGrenade: { maxVoices: 2, minRetriggerMs: 90 },
  launchRocket: { maxVoices: 2, minRetriggerMs: 120 },
  fireWhoosh: { maxVoices: 2, minRetriggerMs: 150 },
  stepPlayer: { maxVoices: 2, minRetriggerMs: 120 },
  stepEndo: { maxVoices: 2, minRetriggerMs: 150 },
  droneZap: { maxVoices: 3, minRetriggerMs: 60 },
  hitLiquid: { maxVoices: 4, minRetriggerMs: 40 },
  pumpRack: { maxVoices: 2, minRetriggerMs: 200 },
  shotgunAuto: { maxVoices: 3, minRetriggerMs: 60 },
  strikeBeam: { maxVoices: 2, minRetriggerMs: 120 },
  ambDistant: { maxVoices: 1, minRetriggerMs: 2000 },
  bombBeep: { maxVoices: 3, minRetriggerMs: 60 }
};

interface VoiceSlot {
  lastStartTime: number;
  source: AudioBufferSourceNode | null;
}

export class AudioEngine {
  public gamepadManager: GamepadManager | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // Adaptive music intensity layers
  private calmGain: GainNode | null = null;
  private combatGain: GainNode | null = null;
  private bossGain: GainNode | null = null;
  private calmFilter: BiquadFilterNode | null = null;
  private combatFilter: BiquadFilterNode | null = null;
  private bossFilter: BiquadFilterNode | null = null;

  private calmLevel = 1.0;
  private combatLevel = 0.15;
  private bossLevel = 0.0;
  private intensityLayer: 'calm' | 'combat' | 'boss' = 'calm';

  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicAudioElement: HTMLAudioElement | null = null;
  private readonly sfxBuffers = new Map<string, AudioBuffer[]>();
  private readonly voiceSlots = new Map<string, VoiceSlot[]>();

  private isMuted = false;
  private masterVol = 0.8;
  private musicVol = 0.7;
  private sfxVol = 0.85;

  private initialized = false;

  constructor() {
    const unlockAudio = () => {
      this.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }
  }

  private readonly loadingCategories = new Set<string>();

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        this.initialized = true;
        return;
      }

      const isHeadlessPlaywright =
        typeof navigator !== 'undefined' &&
        (navigator.webdriver === true || /HeadlessChrome/i.test(navigator.userAgent));
      if (isHeadlessPlaywright) {
        this.initialized = true;
        return;
      }

      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.masterVol;
      this.musicGain.gain.value = this.musicVol;
      this.sfxGain.gain.value = this.sfxVol;

      // Setup adaptive music layers
      this.calmGain = this.ctx.createGain();
      this.combatGain = this.ctx.createGain();
      this.bossGain = this.ctx.createGain();

      this.calmGain.gain.value = this.calmLevel;
      this.combatGain.gain.value = this.combatLevel;
      this.bossGain.gain.value = this.bossLevel;

      if (typeof this.ctx.createBiquadFilter === 'function') {
        this.calmFilter = this.ctx.createBiquadFilter();
        this.calmFilter.type = 'lowpass';
        this.calmFilter.frequency.value = 650;

        this.combatFilter = this.ctx.createBiquadFilter();
        this.combatFilter.type = 'peaking';
        this.combatFilter.frequency.value = 2200;
        this.combatFilter.gain.value = 3.5;

        this.bossFilter = this.ctx.createBiquadFilter();
        this.bossFilter.type = 'highpass';
        this.bossFilter.frequency.value = 400;

        this.calmFilter.connect(this.calmGain);
        this.combatFilter.connect(this.combatGain);
        this.bossFilter.connect(this.bossGain);
      }

      this.calmGain.connect(this.musicGain);
      this.combatGain.connect(this.musicGain);
      this.bossGain.connect(this.musicGain);

      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      } else {
        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }

      this.initialized = true;
      this.loadBackgroundMusic();
      // Preload core high-frequency UI & combat categories asynchronously
      void this.ensureCategoryLoaded('uiClick');
      void this.ensureCategoryLoaded('uiBeep');
      void this.ensureCategoryLoaded('shotgun');
      void this.ensureCategoryLoaded('plasmaLight');
      void this.ensureCategoryLoaded('pickupGem');
    } catch {
      // AudioContext unavailable in test/restricted environments
      this.initialized = true;
    }
  }

  public getCompressor(): DynamicsCompressorNode | null {
    return this.compressor;
  }

  public setAudioBufferForTesting(category: string, buffers: AudioBuffer[]): void {
    this.sfxBuffers.set(category, buffers);
  }

  private getVoiceSlots(category: string): VoiceSlot[] {
    let slots = this.voiceSlots.get(category);
    if (!slots) {
      const config = CATEGORY_VOICE_LIMITS[category] ?? DEFAULT_VOICE_CONFIG;
      slots = [];
      for (let i = 0; i < config.maxVoices; i++) {
        slots.push({ lastStartTime: -Infinity, source: null });
      }
      this.voiceSlots.set(category, slots);
    }
    return slots;
  }

  private acquireVoiceSlot(category: string): VoiceSlot | null {
    const config = CATEGORY_VOICE_LIMITS[category] ?? DEFAULT_VOICE_CONFIG;
    const slots = this.getVoiceSlots(category);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.source === null && now - slot.lastStartTime >= config.minRetriggerMs) {
        slot.lastStartTime = now;
        return slot;
      }
    }
    return null;
  }

  private async ensureCategoryLoaded(category: string): Promise<void> {
    if (!this.ctx || this.sfxBuffers.has(category) || this.loadingCategories.has(category)) return;
    const urls = SFX_WAV_MANIFEST[category];
    if (!urls || urls.length === 0) return;

    this.loadingCategories.add(category);
    const decodedList: AudioBuffer[] = [];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok || !this.ctx) continue;
        const buf = await res.arrayBuffer();
        const audioBuf = await this.ctx.decodeAudioData(buf);
        decodedList.push(audioBuf);
      } catch {
        // Ignore individual WAV decode errors in headless/test mode
      }
    }
    if (decodedList.length > 0) {
      this.sfxBuffers.set(category, decodedList);
    }
    this.loadingCategories.delete(category);
  }

  private playSample(
    category: string,
    gainValue = 0.65,
    playbackRate = 1.0,
    pitchJitter = 0.06,
    pan = 0
  ): boolean {
    if (this.isMuted) return false;
    if (!this.initialized) {
      this.init();
    }

    const slot = this.acquireVoiceSlot(category);
    if (!slot) {
      return false; // Drop requests beyond concurrent voice cap or within minRetriggerMs
    }

    const list = this.sfxBuffers.get(category);
    if (this.ctx && this.sfxGain && list && list.length > 0) {
      const buffer = list[Math.floor(Math.random() * list.length)];
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      let panner: StereoPannerNode | null = null;
      if (typeof this.ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.001) {
        panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
      }
      slot.source = source;

      source.buffer = buffer;
      const jitter = 1.0 + (Math.random() - 0.5) * pitchJitter;
      source.playbackRate.value = playbackRate * jitter;
      gain.gain.value = gainValue;

      source.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.sfxGain);
      } else {
        gain.connect(this.sfxGain);
      }
      source.start(0);
      source.onended = () => {
        if (slot.source === source) {
          slot.source = null;
        }
        source.disconnect();
        gain.disconnect();
        if (panner) {
          panner.disconnect();
        }
      };
      return true;
    }

    const isAutomated =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver === true || /jsdom|HeadlessChrome/i.test(navigator.userAgent));
    if (isAutomated) {
      slot.source = null;
      return true;
    }

    // Trigger lazy decode for subsequent plays of this category
    void this.ensureCategoryLoaded(category);

    // Immediate HTMLAudioElement fallback while buffers are still decoding on initial click
    const urls = SFX_WAV_MANIFEST[category];
    if (urls && urls.length > 0 && typeof Audio !== 'undefined') {
      try {
        const url = urls[Math.floor(Math.random() * urls.length)];
        const el = new Audio(url);
        el.volume = Math.max(0, Math.min(1, this.masterVol * this.sfxVol * gainValue));
        el.playbackRate = playbackRate;
        el.onended = () => {
          slot.source = null;
        };
        el.play()?.catch?.(() => {
          slot.source = null;
        });
        return true;
      } catch {
        slot.source = null;
        return false;
      }
    }

    slot.source = null;
    return false;
  }

  private async loadBackgroundMusic(): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch('./audio/backgroundmusic.mp3');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      this.musicBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.startMusic();
    } catch {
      try {
        const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
        if (!isJsdom && !this.musicAudioElement && typeof Audio !== 'undefined') {
          this.musicAudioElement = new Audio('./audio/backgroundmusic.mp3');
          this.musicAudioElement.loop = true;
          this.musicAudioElement.volume = this.masterVol * this.musicVol;
          this.musicAudioElement.play().catch(() => {});
        }
      } catch {
        // Ignored
      }
    }
  }

  public startMusic(): void {
    if (!this.ctx || !this.musicBuffer || !this.musicGain) return;
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch {}
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;

    if (this.calmFilter && this.combatFilter && this.bossFilter) {
      source.connect(this.calmFilter);
      source.connect(this.combatFilter);
      source.connect(this.bossFilter);
    } else if (this.calmGain && this.combatGain && this.bossGain) {
      source.connect(this.calmGain);
      source.connect(this.combatGain);
      source.connect(this.bossGain);
    } else {
      source.connect(this.musicGain);
    }

    source.start(0);
    this.musicSource = source;
  }

  public stopMusic(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch {}
      this.musicSource = null;
    }
    if (this.musicAudioElement) {
      this.musicAudioElement.pause();
    }
    this.intensityLayer = 'calm';
    this.calmLevel = 1.0;
    this.combatLevel = 0.15;
    this.bossLevel = 0.0;
    if (this.calmGain) this.calmGain.gain.value = 1.0;
    if (this.combatGain) this.combatGain.gain.value = 0.15;
    if (this.bossGain) this.bossGain.gain.value = 0.0;
  }

  public getMusicIntensity(): {
    layer: 'calm' | 'combat' | 'boss';
    calm: number;
    combat: number;
    boss: number;
  } {
    return {
      layer: this.intensityLayer,
      calm: this.calmLevel,
      combat: this.combatLevel,
      boss: this.bossLevel
    };
  }

  public updateMusicIntensity(enemyCount: number, hasBoss: boolean, dt = 0.016): void {
    let targetCalm = 1.0;
    let targetCombat = 0.15;
    let targetBoss = 0.0;

    if (hasBoss) {
      this.intensityLayer = 'boss';
      targetCalm = 0.05;
      targetCombat = 0.35;
      targetBoss = 0.95;
    } else if (enemyCount >= 20) {
      this.intensityLayer = 'combat';
      targetCalm = 0.15;
      targetCombat = 0.9;
      targetBoss = 0.0;
    } else if (enemyCount >= 6) {
      this.intensityLayer = 'combat';
      const factor = Math.min(1, (enemyCount - 6) / 14);
      targetCalm = 1.0 - 0.75 * factor;
      targetCombat = 0.15 + 0.75 * factor;
      targetBoss = 0.0;
    } else {
      this.intensityLayer = 'calm';
      targetCalm = 1.0;
      targetCombat = 0.15;
      targetBoss = 0.0;
    }

    const blendRate = 2.5;
    const step = Math.min(1, dt * blendRate);
    this.calmLevel += (targetCalm - this.calmLevel) * step;
    this.combatLevel += (targetCombat - this.combatLevel) * step;
    this.bossLevel += (targetBoss - this.bossLevel) * step;

    if (this.calmGain) this.calmGain.gain.value = this.calmLevel;
    if (this.combatGain) this.combatGain.gain.value = this.combatLevel;
    if (this.bossGain) this.bossGain.gain.value = this.bossLevel;
  }

  public setMasterVolume(v: number): void {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.isMuted ? 0 : this.masterVol;
    if (this.musicAudioElement) {
      this.musicAudioElement.volume = this.isMuted ? 0 : this.masterVol * this.musicVol;
    }
  }

  public setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this.musicVol;
    if (this.musicAudioElement) {
      this.musicAudioElement.volume = this.isMuted ? 0 : this.masterVol * this.musicVol;
    }
  }

  public setSfxVolume(v: number): void {
    this.sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
  }

  private lastHapticTimeMs = 0;
  private iosHapticLabel: HTMLLabelElement | null = null;
  private iosHapticInput: HTMLInputElement | null = null;

  private ensureIosHapticSwitch(): void {
    if (this.iosHapticLabel || typeof document === 'undefined' || !document.body) return;
    try {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText =
        'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
      this.iosHapticLabel = label;
      this.iosHapticInput = input;
    } catch {
      // Ignore DOM errors in headless/test environments
    }
  }

  public triggerHaptic(pattern: number | number[] = 10, minIntervalMs = 22): void {
    if (this.isMuted || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (navigator.webdriver === true || /jsdom|HeadlessChrome/i.test(navigator.userAgent)) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastHapticTimeMs < minIntervalMs) return;
    this.lastHapticTimeMs = now;

    // 1. Xbox & Gamepad Controller Dual-Rumble Haptics
    try {
      this.gamepadManager?.triggerRumblePattern(pattern);
    } catch {
      // Suppress controller haptic errors
    }

    // 2. Mobile device navigator.vibrate
    try {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
        return;
      }
    } catch {
      // Fall through to iOS switch Taptic fallback
    }

    // 3. iOS 17.4+ / 18 Safari Taptic Engine switch fallback when triggered from user interaction
    try {
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        this.ensureIosHapticSwitch();
        if (this.iosHapticLabel && this.iosHapticInput) {
          this.iosHapticInput.checked = !this.iosHapticInput.checked;
        }
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Calculates stereo pan (-1 to 1) and distance attenuation (0.12 to 1)
   * relative to player/camera position.
   */
  public calculateSpatialParams(
    sourceX: number,
    sourceZ: number,
    playerX: number,
    playerZ: number,
    referenceDist = 8,
    maxPanSpread = 16
  ): { pan: number; attenuation: number; dist: number } {
    const dx = sourceX - playerX;
    const dz = sourceZ - playerZ;
    const dist = Math.hypot(dx, dz);
    const pan = Math.max(-1, Math.min(1, dx / maxPanSpread));
    const dropoff = Math.max(0, dist - referenceDist);
    const attenuation = Math.max(0.12, 1 / (1 + dropoff * 0.09));
    return { pan, attenuation, dist };
  }

  /**
   * Maps a viewport screen-space x coordinate (0 to screenWidth) to stereo pan (-1 to 1).
   */
  public calculateScreenPan(
    screenX: number,
    screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
  ): number {
    if (screenWidth <= 0) return 0;
    return Math.max(-1, Math.min(1, (screenX / screenWidth) * 2 - 1));
  }

  // Authentic WAV Sound Effect Triggers (Combat & UI)
  public playPlasmaShot(
    isHeavy = false,
    sourceX?: number,
    sourceZ?: number,
    playerX?: number,
    playerZ?: number
  ): void {
    let pan = 0;
    let attenuation = 1.0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 6, 16);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    const baseGain = isHeavy ? 0.65 : 0.5;
    this.playSample(isHeavy ? 'plasmaHeavy' : 'plasmaLight', baseGain * attenuation, 1.0, 0.06, pan);
  }

  /** Player gun shot; the sound is chosen per weapon in src/data/weapons.ts (`patternParams.sfx`). */
  public playGunShot(sound: GunSound): void {
    const gain: Record<GunSound, number> = { plasmaLight: 0.5, plasmaHeavy: 0.65, railgun: 0.55 };
    this.playSample(sound, gain[sound], 1.0, 0.06);
  }

  /** Hostile fire, kept distinct from the player's guns. */
  public playEnemyShot(
    sound: EnemyShotSound = 'light',
    sourceX?: number,
    sourceZ?: number,
    playerX?: number,
    playerZ?: number
  ): void {
    let pan = 0;
    let attenuation = 1.0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 6, 16);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    const category = sound === 'heavy' ? 'enemyHeavy' : sound === 'minigun' ? 'minigun' : 'enemyPlasma';
    const baseGain = sound === 'heavy' ? 0.6 : sound === 'minigun' ? 0.45 : 0.4;
    this.playSample(category, baseGain * attenuation, 1.0, 0.08, pan);
  }

  /** Pump shotguns rack a fresh shell after the blast; the automatic one doesn't. */
  public playShotgunBlast(automatic = false): void {
    this.triggerHaptic(12, 80);
    if (automatic) {
      this.playSample('shotgunAuto', 0.68, 1.0, 0.06);
      return;
    }
    this.playSample('shotgun', 0.72, 1.0, 0.06);
    setTimeout(() => this.playSample('pumpRack', 0.5, 1.0, 0.05), PUMP_RACK_DELAY_MS);
  }

  /** Laser designator / orbital ion: target-lock beep then the beam. */
  public playStrike(): void {
    this.playSample('strikeLock', 0.45, 1.0, 0.02);
    this.playSample('strikeBeam', 0.6, 1.0, 0.06);
  }

  /** Molotov bottle shattering before it ignites. */
  public playGlassBreak(): void {
    this.playSample('glassBreak', 0.55, 1.0, 0.08);
  }

  /** Seeker drone or perimeter ring zapping an enemy. */
  public playDroneZap(): void {
    this.playSample('droneZap', 0.35, 1.0, 0.12);
  }

  /** T-800 servos: ally reboot and the T-800 overdrive ability. */
  public playServo(): void {
    this.playSample('servo', 0.55, 1.0, 0.06);
  }

  public playRevive(): void {
    this.playSample('revive', 0.75, 1.0, 0.0);
  }

  public playEvolution(): void {
    this.playSample('evolution', 0.75, 1.0, 0.0);
  }

  public playFlareLaunch(): void {
    this.playSample('flareLaunch', 0.55, 1.0, 0.0);
  }

  /** Metal footstep of a nearby endoskeleton. */
  public playEndoStep(sourceX: number, sourceZ: number, playerX: number, playerZ: number): void {
    const { pan, attenuation } = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 4, 12);
    this.playSample('stepEndo', 0.3 * attenuation, 1.0, 0.15, pan);
  }

  public playExplosion(
    scale = 1.0,
    sourceX?: number,
    sourceZ?: number,
    playerX?: number,
    playerZ?: number
  ): void {
    let pan = 0;
    let attenuation = 1.0;
    let dist = 0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 8, 18);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
      dist = spatial.dist;
    }
    if (dist < 24) {
      this.triggerHaptic(scale > 1.3 ? [28, 30, 40] : 22, 90);
    }
    const finalGain = Math.min(0.9, 0.55 * scale * attenuation);
    const category = scale < 1.0 ? 'explodeSmall' : scale < 1.7 ? 'explodeMed' : 'explodeLarge';
    this.playSample(category, finalGain, 1.0, 0.08, pan);
  }

  /** Fuel drum fireball. */
  public playDrumExplosion(sourceX?: number, sourceZ?: number, playerX?: number, playerZ?: number): void {
    this.playExplosion(1.0, sourceX, sourceZ, playerX, playerZ);
    let attenuation = 1.0;
    let pan = 0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 8, 18);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    this.playSample('explodeDrum', 0.75 * attenuation, 1.0, 0.06, pan);
  }

  public playEmpBlast(): void {
    this.triggerHaptic([18, 25, 30], 100);
    this.playSample('empBlast', 0.7, 1.0, 0.02);
  }

  public playCritCrunch(): void {
    this.triggerHaptic([40, 45, 60], 50);
    if (this.gamepadManager) {
      this.gamepadManager.playRumble(110, 0.9, 0.6);
    }
    this.playSample('endoHit', 0.85, 0.72);
    if (this.ctx && this.sfxGain && !this.isMuted) {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(175, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.045);
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.052);
      } catch {
        // Fallback silently if audio context is in an unsupported state
      }
    }
  }

  /** `liquid` is the T-1000's liquid-metal splash instead of a metal clang. */
  public playEndoHit(
    sourceX?: number,
    sourceZ?: number,
    playerX?: number,
    playerZ?: number,
    liquid = false
  ): void {
    let pan = 0;
    let attenuation = 1.0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 6, 14);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    this.playSample(liquid ? 'hitLiquid' : 'endoHit', 0.42 * attenuation, 1.0, 0.06, pan);
  }

  public playEndoDestroy(
    sourceX?: number,
    sourceZ?: number,
    playerX?: number,
    playerZ?: number
  ): void {
    let pan = 0;
    let attenuation = 1.0;
    let dist = 0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 7, 16);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
      dist = spatial.dist;
    }
    if (dist < 20) {
      this.triggerHaptic(10, 65);
    }
    this.playSample('endoDestroy', 0.52 * attenuation, 1.0, 0.08, pan);
  }

  /** Blade, claw or lunge whoosh. */
  public playSwing(sourceX?: number, sourceZ?: number, playerX?: number, playerZ?: number): void {
    let pan = 0;
    let attenuation = 1.0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 6, 14);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    this.triggerHaptic(10, 30);
    this.playSample('swing', 0.55 * attenuation, 1.0, 0.12, pan);
  }

  /** A thrown bomb, a grenade leaving the launcher or a rocket igniting (not the impact). */
  public playLaunch(sound: LaunchSound = 'grenade'): void {
    this.triggerHaptic(sound === 'rocket' ? [14, 20] : 12, 30);
    if (sound === 'throw') this.playSample('throw', 0.5, 1.0, 0.1);
    else if (sound === 'rocket') this.playSample('launchRocket', 0.55, 1.0, 0.06);
    else this.playSample('launchGrenade', 0.5, 1.0, 0.08);
  }

  /** Whoosh of flammable liquid igniting on the ground (napalm, molotov, firestorm). */
  public playFireDeploy(): void {
    this.playSample('fireWhoosh', 0.5, 1.0, 0.08);
  }

  /** HK missile salvo being armed. */
  public playSalvoWarning(): void {
    this.playSample('aerialRockets', 0.6, 1.0, 0.0);
  }

  /** Self-Destruct elite counting down. */
  public playBombBeep(sourceX?: number, sourceZ?: number, playerX?: number, playerZ?: number): void {
    let pan = 0;
    let attenuation = 1.0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 6, 14);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    this.playSample('bombBeep', 0.55 * attenuation, 1.0, 0.0, pan);
  }

  public playFootstep(): void {
    this.playSample('stepPlayer', 0.22, 1.0, 0.12);
  }

  public playCrateBreak(): void {
    this.playSample('crateBreak', 0.6, 1.0, 0.08);
  }

  private ambSource: AudioBufferSourceNode | null = null;
  private ambGain: GainNode | null = null;
  private ambActive = false;
  private distantTimer = 0;

  /** Battle ambience bed and distant explosions for the length of a run. */
  public startAmbience(): void {
    this.ambActive = true;
    this.distantTimer = AMBIENCE.distantMinSeconds;
    void this.ensureCategoryLoaded('ambBed');
  }

  public stopAmbience(): void {
    this.ambActive = false;
    if (this.ambSource) {
      try {
        this.ambSource.stop();
        this.ambSource.disconnect();
      } catch {}
      this.ambSource = null;
    }
    this.ambGain?.disconnect();
    this.ambGain = null;
  }

  public updateAmbience(dt: number): void {
    if (!this.ambActive) return;
    if (!this.ambSource) this.startAmbienceLoop();
    this.distantTimer -= dt;
    if (this.distantTimer <= 0) {
      const { distantMinSeconds: min, distantMaxSeconds: max } = AMBIENCE;
      this.distantTimer = min + Math.random() * (max - min);
      this.playSample('ambDistant', AMBIENCE.distantGain, 1.0, 0.1, (Math.random() - 0.5) * 1.6);
    }
  }

  private startAmbienceLoop(): void {
    const buffer = this.sfxBuffers.get('ambBed')?.[0];
    if (!this.ctx || !this.sfxGain || !buffer) return;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(AMBIENCE.bedGain, this.ctx.currentTime + 2);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start(0);
    this.ambSource = source;
    this.ambGain = gain;
  }

  public playAchievement(): void {
    this.triggerHaptic([16, 30, 22], 120);
    this.playSample('achievement', 0.7, 1.0, 0.0);
  }

  /** Medkit and scrap rewards from crates. */
  public playLoot(kind: 'heal' | 'scrap'): void {
    this.triggerHaptic(12, 30);
    this.playSample(kind === 'heal' ? 'lootHeal' : 'lootScrap', 0.6, 1.0, 0.04);
  }

  /** Death sound by enemy kind: bosses and machines blow up, humanoids spark and collapse. */
  public playEnemyDeath(
    kind: 'boss' | 'machine' | 'humanoid',
    sourceX?: number,
    sourceZ?: number,
    playerX?: number,
    playerZ?: number
  ): void {
    let pan = 0;
    let attenuation = 1.0;
    if (sourceX !== undefined && sourceZ !== undefined && playerX !== undefined && playerZ !== undefined) {
      const spatial = this.calculateSpatialParams(sourceX, sourceZ, playerX, playerZ, 7, 16);
      pan = spatial.pan;
      attenuation = spatial.attenuation;
    }
    switch (kind) {
      case 'boss':
        this.triggerHaptic([40, 50, 60], 200);
        this.playSample('deathBoss', 0.9, 1.0, 0.04, pan);
        break;
      case 'machine':
        this.playSample('deathMachine', 0.6 * attenuation, 1.0, 0.08, pan);
        break;
      default:
        this.playEndoDestroy(sourceX, sourceZ, playerX, playerZ);
    }
  }

  /** Generic boss stinger plus, where the library has one, the boss's own engine or alarm. */
  public playBossStinger(archetype = ''): void {
    this.triggerHaptic([45, 60, 45, 60, 80], 350);
    if (this.gamepadManager) {
      this.gamepadManager.playRumble(250, 1.0, 0.8);
    }
    this.intensityLayer = 'boss';
    this.calmLevel = 0.05;
    this.combatLevel = 0.35;
    this.bossLevel = 1.0;
    if (this.calmGain) this.calmGain.gain.value = 0.05;
    if (this.combatGain) this.combatGain.gain.value = 0.35;
    if (this.bossGain) this.bossGain.gain.value = 1.0;

    this.playSample('bossStinger', 0.95, 0.9);
    const signature = BOSS_SIGNATURES[archetype];
    if (signature) this.playSample(signature, 0.7, 1.0, 0.0);
  }

  /**
   * Synthesised warning cues for telegraphed attacks (the sound library has nothing suitable):
   * a falling whistle for incoming mortar fire, a rising charge for the Core's nova and pull.
   */
  public playTelegraph(kind: 'mortar' | 'charge', seconds: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (kind === 'mortar') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2100, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + seconds);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + seconds * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + seconds);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + seconds * 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.05);
    }
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + seconds + 0.1);
  }

  public playSearchlightAlert(): void {
    this.triggerHaptic([35, 50, 35, 50, 55], 250);
    this.playSample('hkAlert', 0.62, 1.0, 0.0);
  }

  public playPickupGem(combo = 0): void {
    this.triggerHaptic(9, 24);
    const pitch = Math.min(1.5, 1.05 + (combo % 14) * 0.035);
    this.playSample('pickupGem', 0.75, pitch, 0.04);
  }

  public playLevelUp(): void {
    this.triggerHaptic([18, 35, 22, 35, 45], 150);
    this.playSample('levelUp', 0.78, 1.0, 0.0);
  }

  public playVaultJackpot(): void {
    this.triggerHaptic([22, 40, 28, 40, 60], 150);
    this.playSample('vaultOpen', 0.7, 1.0, 0.0);
    this.playSample('vaultJackpot', 0.85, 1.0, 0.0);
  }

  private heartbeatTimer = 0;

  public playHeartbeat(): void {
    this.triggerHaptic([25, 40, 20, 35], 90);
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      // 1st thump ("lub"): 65 Hz -> 32 Hz
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(65, now);
      osc1.frequency.exponentialRampToValueAtTime(32, now + 0.08);
      gain1.gain.setValueAtTime(0.65, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start(now);
      osc1.stop(now + 0.09);

      // 2nd thump ("dub"): 55 Hz -> 28 Hz after 0.12s
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(55, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(28, now + 0.19);
      gain2.gain.setValueAtTime(0.48, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.195);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.20);
    } catch {
      // Fallback silently if audio context is in an unsupported state
    }
  }

  public updateHeartbeat(dt: number, isLowHp: boolean): void {
    if (!isLowHp) {
      this.heartbeatTimer = 0;
      return;
    }
    this.heartbeatTimer -= dt;
    if (this.heartbeatTimer <= 0) {
      this.playHeartbeat();
      this.heartbeatTimer = 0.75;
    }
  }

  public playPlayerHit(): void {
    this.triggerHaptic([32, 35, 45], 90);
    this.playSample('playerHit', 0.72);
  }

  // Dedicated Authentic UI Sound Effects
  public playUiClick(): void {
    this.triggerHaptic(10, 20);
    this.playSample('uiClick', 0.65, 1.0, 0.02);
  }

  public playUiBeep(): void {
    this.triggerHaptic(8, 20);
    this.playSample('uiBeep', 0.45, 1.0, 0.0);
  }

  public playUiBuy(): void {
    this.triggerHaptic([12, 28, 20], 40);
    this.playSample('uiBuy', 0.75, 1.0, 0.0);
  }

  public playUiError(): void {
    this.triggerHaptic([25, 40, 25], 60);
    this.playSample('uiError', 0.65, 1.0, 0.0);
  }

  public playUpgradeApplied(): void {
    this.triggerHaptic([14, 30, 24], 40);
    this.playSample('uiUpgradeApplied', 0.8, 1.0, 0.0);
  }

  public playHudScanOpen(): void {
    this.triggerHaptic(12, 30);
    this.playSample('uiModalOpen', 0.68, 1.0, 0.0);
  }

  public playHudScanClose(): void {
    this.triggerHaptic(10, 30);
    this.playSample('uiModalClose', 0.6, 1.0, 0.0);
  }

  public playPlayerTerminated(): void {
    this.triggerHaptic([45, 60, 75, 90], 160);
    this.playSample('playerTerminated', 0.95, 1.0, 0.0);
  }

  public playRunStart(): void {
    this.triggerHaptic([20, 40, 35], 80);
    this.playSample('runStart', 0.82, 1.0, 0.0);
  }

  public playRunEnd(victory: boolean): void {
    this.triggerHaptic(victory ? [25, 45, 30, 45, 65] : [45, 60, 70], 120);
    this.playSample(victory ? 'runVictory' : 'runDefeat', 0.82, 1.0, 0.0);
  }
}
