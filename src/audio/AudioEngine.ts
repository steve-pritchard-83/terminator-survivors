const SFX_WAV_MANIFEST: Record<string, string[]> = {
  plasmaLight: [
    './audio/effects/S_PlasmaShot01.wav',
    './audio/effects/S_PlasmaShot02.wav'
  ],
  plasmaHeavy: [
    './audio/effects/S_Plasma_Aerial_New01.wav',
    './audio/effects/S_LaserTank01.wav'
  ],
  shotgun: [
    './audio/effects/S_Ithica01.wav',
    './audio/effects/Shotgun_shot_spas.wav'
  ],
  explosion: [
    './audio/effects/S_Explosion01.wav',
    './audio/effects/plasma_explosion.wav'
  ],
  endoHit: [
    './audio/effects/S_BulletHitMetal01.wav',
    './audio/effects/S_BulletHitMetal02.wav'
  ],
  endoDestroy: [
    './audio/effects/plasma_explosion.wav',
    './audio/effects/S_Explosion01.wav'
  ],
  hkAlert: [
    './audio/effects/hk_heavy1a_m.wav'
  ],
  combatDive: [
    './audio/effects/S_Swing01.wav'
  ],
  playerHit: [
    './audio/effects/S_BulletHitBody01.wav'
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
    // Lazy initialize on first user interaction
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
      this.loadSfxWavBank();
    } catch {
      // AudioContext unavailable in test/restricted environments
    }
  }

  private async loadSfxWavBank(): Promise<void> {
    if (!this.ctx) return;
    for (const [category, urls] of Object.entries(SFX_WAV_MANIFEST)) {
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
    }
  }

  private playSample(category: string, gainValue = 0.65, playbackRate = 1.0): boolean {
    if (!this.ctx || !this.sfxGain || this.isMuted) return false;
    const list = this.sfxBuffers.get(category);
    if (!list || list.length === 0) return false;

    const buffer = list[Math.floor(Math.random() * list.length)];
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate * (0.95 + Math.random() * 0.1);
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

  private async loadBackgroundMusic(): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch('./audio/backgroundmusic.mp3');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      this.musicBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.startMusic();
    } catch {
      // Fallback to HTMLAudioElement if WebAudio decoding fails
      try {
        if (!this.musicAudioElement) {
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

  // 12 Hybrid Authentic WAV + Procedural Web Audio API SFX Generators
  public playPlasmaShot(isHeavy = false): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample(isHeavy ? 'plasmaHeavy' : 'plasmaLight', isHeavy ? 0.65 : 0.5)) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const startFreq = isHeavy ? 1400 : 2000;
    const endFreq = isHeavy ? 180 : 260;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playShotgunBlast(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample('shotgun', 0.72)) {
      return;
    }
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.28;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.06));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  public playExplosion(scale = 1.0): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample('explosion', Math.min(0.9, 0.55 * scale), scale > 1.3 ? 0.85 : 1.0)) {
      return;
    }
    const now = this.ctx.currentTime;
    const duration = Math.min(1.2, 0.5 * scale);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + duration);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playEmpBlast(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playSample('plasmaHeavy', 0.45, 0.65);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.5);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playEndoHit(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample('endoHit', 0.4)) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playEndoDestroy(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample('endoDestroy', 0.5, 1.15)) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.22);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playSearchlightAlert(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playSample('hkAlert', 0.55);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.28);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playPickupGem(combo = 0): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const pitch = 520 * Math.pow(1.05946, combo % 16);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playLevelUp(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const freqs = [330, 440, 554, 659, 880];
    freqs.forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.06;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.25);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  public playVaultJackpot(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const freqs = [440, 554, 659, 880, 1108, 1318];
    freqs.forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.35);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  public playCombatDive(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample('combatDive', 0.65)) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.22);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.22);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playPlayerHit(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (this.playSample('playerHit', 0.7)) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
