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

export class AudioEngine {
  public gamepadManager: GamepadManager | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicAudioElement: HTMLAudioElement | null = null;
  private readonly sfxBuffers = new Map<string, AudioBuffer[]>();

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
      const isAutomated =
        typeof navigator !== 'undefined' &&
        (navigator.webdriver === true || /jsdom|HeadlessChrome/i.test(navigator.userAgent));
      if (isAutomated) {
        this.initialized = true;
        return;
      }

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.masterVol;
      this.musicGain.gain.value = this.musicVol;
      this.sfxGain.gain.value = this.sfxVol;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

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
    }
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

    const isAutomated =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver === true || /jsdom|HeadlessChrome/i.test(navigator.userAgent));
    if (isAutomated) {
      return true;
    }

    const list = this.sfxBuffers.get(category);
    if (this.ctx && this.sfxGain && list && list.length > 0) {
      const buffer = list[Math.floor(Math.random() * list.length)];
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      const jitter = 1.0 + (Math.random() - 0.5) * pitchJitter;
      source.playbackRate.value = playbackRate * jitter;
      gain.gain.value = gainValue;

      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start(0);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
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
        el.play()?.catch?.(() => {});
        return true;
      } catch {
        return false;
      }
    }

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
        if (!this.musicAudioElement && typeof Audio !== 'undefined') {
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
    source.connect(this.musicGain);
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

  public playEndoHit(): void {
    this.playSample('endoHit', 0.42);
  }

  public playEndoDestroy(): void {
    this.triggerHaptic(10, 65);
    this.playSample('endoDestroy', 0.52, 1.05);
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
