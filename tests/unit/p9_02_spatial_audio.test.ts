import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';

class MockStereoPannerNode {
  pan = { value: 0 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode {
  gain = { value: 1.0 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: any = null;
  playbackRate = { value: 1.0 };
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockSpatialAudioContext {
  destination = {};
  state = 'running';
  createdPanners: MockStereoPannerNode[] = [];
  createdGains: MockGainNode[] = [];
  createdSources: MockAudioBufferSourceNode[] = [];

  createStereoPanner() {
    const p = new MockStereoPannerNode();
    this.createdPanners.push(p);
    return p as any;
  }
  createGain() {
    const g = new MockGainNode();
    this.createdGains.push(g);
    return g as any;
  }
  createBufferSource() {
    const s = new MockAudioBufferSourceNode();
    this.createdSources.push(s);
    return s as any;
  }
  decodeAudioData = vi.fn();
  resume = vi.fn().mockResolvedValue(undefined);
}

describe('P9-02: Spatial Audio (StereoPannerNode & Distance Attenuation)', () => {
  let audio: AudioEngine;

  beforeEach(() => {
    audio = new AudioEngine();
  });

  it('calculates stereo pan accurately based on relative horizontal position', () => {
    // Sound directly centered with player
    const center = audio.calculateSpatialParams(10, 20, 10, 20);
    expect(center.pan).toBeCloseTo(0, 2);

    // Sound to the right of player
    const right = audio.calculateSpatialParams(18, 20, 10, 20, 8, 16);
    expect(right.pan).toBe(0.5);

    // Sound to the left of player
    const left = audio.calculateSpatialParams(2, 20, 10, 20, 8, 16);
    expect(left.pan).toBe(-0.5);

    // Sound far beyond pan spread clamps strictly to -1.0 and 1.0
    const farRight = audio.calculateSpatialParams(100, 20, 10, 20, 8, 16);
    expect(farRight.pan).toBe(1.0);

    const farLeft = audio.calculateSpatialParams(-100, 20, 10, 20, 8, 16);
    expect(farLeft.pan).toBe(-1.0);
  });

  it('attenuates volume smoothly with distance for off-screen explosions', () => {
    // Close explosion within reference radius (8 units) -> full attenuation (1.0)
    const close = audio.calculateSpatialParams(14, 20, 10, 20, 8, 16);
    expect(close.dist).toBeLessThanOrEqual(8);
    expect(close.attenuation).toBe(1.0);

    // Distant explosion (30 units away) -> significantly attenuated
    const distant = audio.calculateSpatialParams(40, 20, 10, 20, 8, 16);
    expect(distant.dist).toBe(30);
    expect(distant.attenuation).toBeLessThan(0.4);
    expect(distant.attenuation).toBeGreaterThanOrEqual(0.12);
  });

  it('maps viewport screen coordinates to normalized stereo pan', () => {
    const screenWidth = 1920;
    expect(audio.calculateScreenPan(screenWidth / 2, screenWidth)).toBeCloseTo(0, 2);
    expect(audio.calculateScreenPan(0, screenWidth)).toBeCloseTo(-1.0, 2);
    expect(audio.calculateScreenPan(screenWidth, screenWidth)).toBeCloseTo(1.0, 2);
    expect(audio.calculateScreenPan(screenWidth * 0.75, screenWidth)).toBeCloseTo(0.5, 2);
  });

  it('routes through StereoPannerNode when Web Audio context supports createStereoPanner', () => {
    const mockCtx = new MockSpatialAudioContext();
    const originalAudioContext = window.AudioContext;
    window.AudioContext = vi.fn(() => mockCtx) as any;

    try {
      const spatialAudio = new AudioEngine();
      spatialAudio.init();

      // Supply a dummy buffer for 'explosion'
      spatialAudio.setAudioBufferForTesting('explosion', [{} as any]);

      // Trigger explosion positioned to the far right (x=30, playerX=10, dx=20 > 18 -> clamped 1.0)
      spatialAudio.playExplosion(1.0, 30, 0, 10, 0);

      expect(mockCtx.createdPanners.length).toBeGreaterThanOrEqual(1);
      const activePanner = mockCtx.createdPanners[mockCtx.createdPanners.length - 1];
      expect(activePanner.pan.value).toBe(1.0);
      expect(activePanner.connect).toHaveBeenCalled();
    } finally {
      window.AudioContext = originalAudioContext;
    }
  });

  it('executes spatial audio methods safely without coordinates (backward compatibility)', () => {
    expect(() => {
      audio.playExplosion(1.2);
      audio.playPlasmaShot(true);
      audio.playShotgunBlast();
      audio.playEndoHit();
      audio.playEndoDestroy();
    }).not.toThrow();
  });
});
