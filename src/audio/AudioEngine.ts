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
  empBlast: [
    './audio/effects/S_HackingDevice_On.wav',
    './audio/effects/S_DetectiveModeOn.wav'
  ],
  endoHit: [
    './audio/effects/S_BulletHitMetal01.wav',
    './audio/effects/S_BulletHitMetal02.wav'
  ],
  endoDestroy: [
    './audio/effects/plasma_explosion.wav',
    './audio/effects/S_DoorLockBreak01.wav'
  ],
  hkAlert: [
    './audio/effects/S_TurretAlarm.wav',
    './audio/effects/S_HUD_TurretAlarm2.wav',
    './audio/effects/S_Alterted.wav',
    './audio/effects/hk_heavy1a_m.wav'
  ],
  pickupGem: [
    './audio/effects/S_LootPickupStuff.wav',
    './audio/effects/S_LootPickupQuest.wav'
  ],
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
  playerHit: [
    './audio/effects/S_BulletHitBody01.wav',
    './audio/effects/S_BulletHitBody02.wav'
  ],
  uiClick: [
    './audio/effects/S_Click.wav',
    './audio/effects/S_Click02.wav',
    './audio/effects/S_Click03.wav',
    './audio/effects/S_Click04.wav'
  ],
  uiBeep: [
    './audio/effects/S_ButtonBeep01.wav',
    './audio/effects/S_ButtonBeep02.wav'
  ],
  uiBuy: [
    './audio/effects/S_Buy.wav'
  ],
  uiError: [
    './audio/effects/S_DetectiveModeError.wav',
    './audio/effects/Frogger_Error.wav'
  ],
  uiUpgradeApplied: [
    './audio/effects/S_WeaponUpgradesApplied.wav'
  ],
  uiModalOpen: [
    './audio/effects/S_HUD_DetectiveModeOnNew.wav',
    './audio/effects/S_HUD_Infiltrator_AnalysingIntelData1.wav',
    './audio/effects/S_HUD_Infiltrator_EnemyAnalysis.wav'
  ],
  uiModalClose: [
    './audio/effects/S_HUD_DetectiveModeOffNew.wav',
    './audio/effects/S_DetectiveModeOff.wav'
  ],
  runStart: [
    './audio/effects/S_Splash_Screen_Drums_x1.wav',
    './audio/effects/S_NewQuest.wav'
  ],
  runDefeat: [
    './audio/effects/S_QuestFaild.wav'
  ],
  runVictory: [
    './audio/effects/S_ObjectiveComplete.wav'
  ]
};

export class AudioEngine {
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

  // Authentic WAV Sound Effect Triggers (Combat & UI)
  public playPlasmaShot(isHeavy = false): void {
    this.playSample(isHeavy ? 'plasmaHeavy' : 'plasmaLight', isHeavy ? 0.65 : 0.5);
  }

  public playShotgunBlast(): void {
    this.playSample('shotgun', 0.72);
  }

  public playExplosion(scale = 1.0): void {
    this.playSample('explosion', Math.min(0.9, 0.55 * scale), scale > 1.3 ? 0.88 : 1.0);
  }

  public playEmpBlast(): void {
    this.playSample('empBlast', 0.7, 1.0, 0.02);
  }

  public playEndoHit(): void {
    this.playSample('endoHit', 0.42);
  }

  public playEndoDestroy(): void {
    this.playSample('endoDestroy', 0.52, 1.05);
  }

  public playSearchlightAlert(): void {
    this.playSample('hkAlert', 0.62, 1.0, 0.0);
  }

  public playPickupGem(combo = 0): void {
    const pitch = Math.min(1.45, 1.0 + (combo % 12) * 0.035);
    this.playSample('pickupGem', 0.55, pitch, 0.0);
  }

  public playLevelUp(): void {
    this.playSample('levelUp', 0.78, 1.0, 0.0);
  }

  public playVaultJackpot(): void {
    this.playSample('vaultJackpot', 0.85, 1.0, 0.0);
  }

  public playCombatDive(): void {
    this.playSample('combatDive', 0.68);
  }

  public playPlayerHit(): void {
    this.playSample('playerHit', 0.72);
  }

  // Dedicated Authentic UI Sound Effects
  public playUiClick(): void {
    this.playSample('uiClick', 0.65, 1.0, 0.02);
  }

  public playUiBeep(): void {
    this.playSample('uiBeep', 0.45, 1.0, 0.0);
  }

  public playUiBuy(): void {
    this.playSample('uiBuy', 0.75, 1.0, 0.0);
  }

  public playUiError(): void {
    this.playSample('uiError', 0.65, 1.0, 0.0);
  }

  public playUpgradeApplied(): void {
    this.playSample('uiUpgradeApplied', 0.8, 1.0, 0.0);
  }

  public playHudScanOpen(): void {
    this.playSample('uiModalOpen', 0.68, 1.0, 0.0);
  }

  public playHudScanClose(): void {
    this.playSample('uiModalClose', 0.6, 1.0, 0.0);
  }

  public playRunStart(): void {
    this.playSample('runStart', 0.82, 1.0, 0.0);
  }

  public playRunEnd(victory: boolean): void {
    this.playSample(victory ? 'runVictory' : 'runDefeat', 0.82, 1.0, 0.0);
  }
}
