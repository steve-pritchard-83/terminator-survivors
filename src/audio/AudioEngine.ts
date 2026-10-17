export const SFX_WAV_MANIFEST: Record<string, string[]> = {
  plasmaLight: [
    './audio/effects/S_PlasmaShot01.wav',
    './audio/effects/S_PlasmaShot02.wav',
    './audio/effects/S_PlasmaShot03.wav',
    './audio/effects/S_PlasmaShot04.wav'
  ],
  plasmaHeavy: [
    './audio/effects/S_Plasma_Aerial_New01.wav',
    './audio/effects/S_Plasma_Aerial_New02.wav',
    './audio/effects/S_LaserTank01.wav',
    './audio/effects/S_LaserTank02.wav'
  ],
  shotgun: [
    './audio/effects/S_Ithica01.wav',
    './audio/effects/S_Ithica02.wav',
    './audio/effects/Shotgun_shot_spas.wav'
  ],
  explosion: [
    './audio/effects/S_Explosion01.wav',
    './audio/effects/S_Explosion02.wav',
    './audio/effects/plasma_explosion.wav'
  ],
  empBlast: ['./audio/effects/S_HackingDevice_On.wav', './audio/effects/S_DetectiveModeOn.wav'],
  endoHit: ['./audio/effects/S_BulletHitMetal01.wav', './audio/effects/S_BulletHitMetal02.wav'],
  endoDestroy: ['./audio/effects/plasma_explosion.wav', './audio/effects/S_DoorLockBreak01.wav'],
  hkAlert: [
    './audio/effects/S_TurretAlarm.wav',
    './audio/effects/S_HUD_TurretAlarm2.wav',
    './audio/effects/S_Alterted.wav',
    './audio/effects/hk_heavy1a_m.wav'
  ],
  bossStinger: [
    './audio/effects/S_Splash_Screen_Drums_x1.wav',
    './audio/effects/hk_heavy1a_m.wav',
    './audio/effects/S_TurretAlarm.wav'
  ],
  pickupGem: ['./audio/effects/S_LootPickupStuff.wav', './audio/effects/S_LootPickupQuest.wav'],
  levelUp: [
    './audio/effects/S_ExpLevel.wav',
    './audio/effects/S_NewLevel.wav',
    './audio/effects/S_NewLevel2.wav',
    './audio/effects/S_NewLevel3.wav'
  ],
  vaultJackpot: [
    './audio/effects/S_ObjectiveComplete.wav',
    './audio/effects/S_HckingCompleat.wav',
    './audio/effects/S_AddtoArchive.wav'
  ],
  combatDive: [
    './audio/effects/S_Woosh.wav',
    './audio/effects/S_Swing01.wav',
    './audio/effects/S_Swing02.wav'
  ],
  playerHit: ['./audio/effects/S_BulletHitBody01.wav', './audio/effects/S_BulletHitBody02.wav'],
  uiClick: [
    './audio/effects/S_Click.wav',
    './audio/effects/S_Click02.wav',
    './audio/effects/S_Click03.wav',
    './audio/effects/S_Click04.wav'
  ],
  uiBeep: ['./audio/effects/S_ButtonBeep01.wav', './audio/effects/S_ButtonBeep02.wav'],
  uiBuy: ['./audio/effects/S_Buy.wav'],
  uiError: ['./audio/effects/S_DetectiveModeError.wav', './audio/effects/Frogger_Error.wav'],
  uiUpgradeApplied: ['./audio/effects/S_WeaponUpgradesApplied.wav'],
  uiModalOpen: [
    './audio/effects/S_HUD_DetectiveModeOnNew.wav',
    './audio/effects/S_HUD_Infiltrator_AnalysingIntelData1.wav',
    './audio/effects/S_HUD_Infiltrator_EnemyAnalysis.wav'
  ],
  uiModalClose: [
    './audio/effects/S_HUD_DetectiveModeOffNew.wav',
    './audio/effects/S_DetectiveModeOff.wav'
  ],
  runStart: ['./audio/effects/S_Splash_Screen_Drums_x1.wav', './audio/effects/S_NewQuest.wav'],
  playerTerminated: ['./audio/effects/terminated.wav'],
  runDefeat: ['./audio/effects/terminated.wav', './audio/effects/S_QuestFaild.wav'],
  runVictory: ['./audio/effects/S_ObjectiveComplete.wav']
};

import type { GamepadManager } from '../input/GamepadManager';

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
  explosion: { maxVoices: 3, minRetriggerMs: 30 },
  endoDestroy: { maxVoices: 3, minRetriggerMs: 30 }
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
    pitchJitter = 0.06
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
      slot.source = source;

      source.buffer = buffer;
      const jitter = 1.0 + (Math.random() - 0.5) * pitchJitter;
      source.playbackRate.value = playbackRate * jitter;
      gain.gain.value = gainValue;

      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start(0);
      source.onended = () => {
        if (slot.source === source) {
          slot.source = null;
        }
        source.disconnect();
        gain.disconnect();
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

  private playXpTactileClick(combo = 0): void {
    if (this.isMuted) return;
    if (!this.initialized) {
      this.init();
    }
    if (!this.ctx || !this.sfxGain) return;

    try {
      const now = this.ctx.currentTime;
      const step = Math.min(16, Math.max(0, combo));
      // Pentatonic ascending crystal pitch ratio
      const semitones = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36, 38][step] ?? 0;
      const pitchMult = Math.pow(2, semitones / 12);

      // 1. Crisp mechanical micro-switch click transient (2.8kHz -> 920Hz in 9ms)
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(2800 * Math.min(1.35, pitchMult), now);
      clickOsc.frequency.exponentialRampToValueAtTime(920, now + 0.009);
      clickGain.gain.setValueAtTime(0.42, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.011);
      clickOsc.connect(clickGain);
      clickGain.connect(this.sfxGain);
      clickOsc.start(now);
      clickOsc.stop(now + 0.012);

      // 2. Crystalline harmonic chime ping (1180Hz * pitchMult)
      const chimeOsc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chimeOsc.type = 'sine';
      const baseFreq = 1046.5 * pitchMult; // C6 ascending
      chimeOsc.frequency.setValueAtTime(baseFreq, now + 0.002);
      chimeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.015, now + 0.075);
      chimeGain.gain.setValueAtTime(0.001, now);
      chimeGain.gain.linearRampToValueAtTime(0.28, now + 0.004);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      chimeOsc.connect(chimeGain);
      chimeGain.connect(this.sfxGain);
      chimeOsc.start(now);
      chimeOsc.stop(now + 0.09);

      // 3. Subtle low-end tactile thump (145Hz -> 58Hz in 18ms) for physical weight on phone speakers
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(145, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(58, now + 0.018);
      thumpGain.gain.setValueAtTime(0.32, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.sfxGain);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.022);
    } catch {
      // Ignore synthesis errors in restricted contexts
    }
  }

  // Authentic WAV Sound Effect Triggers (Combat & UI)
  public playPlasmaShot(isHeavy = false): void {
    this.playSample(isHeavy ? 'plasmaHeavy' : 'plasmaLight', isHeavy ? 0.65 : 0.5);
  }

  public playShotgunBlast(): void {
    this.triggerHaptic(12, 80);
    this.playSample('shotgun', 0.72);
  }

  public playExplosion(scale = 1.0): void {
    this.triggerHaptic(scale > 1.3 ? [28, 30, 40] : 22, 90);
    this.playSample('explosion', Math.min(0.9, 0.55 * scale), scale > 1.3 ? 0.88 : 1.0);
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

  public playEndoHit(): void {
    this.playSample('endoHit', 0.42);
  }

  public playEndoDestroy(): void {
    this.triggerHaptic(10, 65);
    this.playSample('endoDestroy', 0.52, 1.05);
  }

  public playBossStinger(): void {
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
  }

  public playSearchlightAlert(): void {
    this.triggerHaptic([35, 50, 35, 50, 55], 250);
    this.playSample('hkAlert', 0.62, 1.0, 0.0);
  }

  public playPickupGem(combo = 0): void {
    this.triggerHaptic(9, 24);
    this.playXpTactileClick(combo);
    const pitch = Math.min(1.5, 1.05 + (combo % 14) * 0.035);
    this.playSample('pickupGem', 0.42, pitch, 0.02);
  }

  public playLevelUp(): void {
    this.triggerHaptic([18, 35, 22, 35, 45], 150);
    this.playSample('levelUp', 0.78, 1.0, 0.0);
  }

  public playVaultJackpot(): void {
    this.triggerHaptic([22, 40, 28, 40, 60], 150);
    this.playSample('vaultJackpot', 0.85, 1.0, 0.0);
  }

  public playCombatDive(): void {
    this.triggerHaptic(16, 60);
    this.playSample('combatDive', 0.68);
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
