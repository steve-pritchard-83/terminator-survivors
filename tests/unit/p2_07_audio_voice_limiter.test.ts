import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';

class MockAudioBufferSourceNode {
  buffer: any = null;
  playbackRate = { value: 1.0 };
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGainNode {
  gain = { value: 1.0 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockDynamicsCompressorNode {
  threshold = { value: -12 };
  knee = { value: 10 };
  ratio = { value: 12 };
  attack = { value: 0.003 };
  release = { value: 0.15 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  destination = {};
  state = 'running';
  createdSources: MockAudioBufferSourceNode[] = [];
  compressors: MockDynamicsCompressorNode[] = [];

  createBufferSource() {
    const s = new MockAudioBufferSourceNode();
    this.createdSources.push(s);
    return s as any;
  }
  createGain() {
    return new MockGainNode() as any;
  }
  createDynamicsCompressor() {
    const c = new MockDynamicsCompressorNode();
    this.compressors.push(c);
    return c as any;
  }
  decodeAudioData = vi.fn();
  resume = vi.fn().mockResolvedValue(undefined);
}

describe('P2-07 audio voice limiter', () => {
  let originalAudioContext: any;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    mockCtx = new MockAudioContext();
    window.AudioContext = vi.fn(() => mockCtx) as any;
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    vi.restoreAllMocks();
  });

  it('creates master DynamicsCompressorNode before destination', () => {
    const audio = new AudioEngine();
    audio.init();

    expect(mockCtx.compressors).toHaveLength(1);
    const comp = mockCtx.compressors[0];
    expect(comp.connect).toHaveBeenCalledWith(mockCtx.destination);
    expect(audio.getCompressor()).toBe(comp);
  });

  it('calling playEndoHit() 100x in one tick starts <= 6 sources', () => {
    const audio = new AudioEngine();
    audio.init();

    const mockBuffer = {} as AudioBuffer;
    audio.setAudioBufferForTesting('endoHit', [mockBuffer]);

    // Rapid-fire 100 hits in one tick
    for (let i = 0; i < 100; i++) {
      audio.playEndoHit();
    }

    expect(mockCtx.createdSources.length).toBeLessThanOrEqual(6);
    expect(mockCtx.createdSources.length).toBe(6);
  });

  it('calling playExplosion() 100x in one tick starts <= 3 sources', () => {
    const audio = new AudioEngine();
    audio.init();

    const mockBuffer = {} as AudioBuffer;
    audio.setAudioBufferForTesting('explosion', [mockBuffer]);

    for (let i = 0; i < 100; i++) {
      audio.playExplosion(1.0);
    }

    expect(mockCtx.createdSources.length).toBeLessThanOrEqual(3);
    expect(mockCtx.createdSources.length).toBe(3);
  });

  it('calling default category (plasmaShot) 100x in one tick starts <= 4 sources', () => {
    const audio = new AudioEngine();
    audio.init();

    const mockBuffer = {} as AudioBuffer;
    audio.setAudioBufferForTesting('plasmaLight', [mockBuffer]);

    for (let i = 0; i < 100; i++) {
      audio.playPlasmaShot(false);
    }

    expect(mockCtx.createdSources.length).toBeLessThanOrEqual(4);
    expect(mockCtx.createdSources.length).toBe(4);
  });

  it('enforces min retrigger interval when voice finishes', () => {
    let fakeNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);

    const audio = new AudioEngine();
    audio.init();

    const mockBuffer = {} as AudioBuffer;
    audio.setAudioBufferForTesting('endoDestroy', [mockBuffer]);

    // maxVoices for endoDestroy is 3
    audio.playEndoDestroy();
    audio.playEndoDestroy();
    audio.playEndoDestroy();
    expect(mockCtx.createdSources).toHaveLength(3);

    // Simulate voice 0 ending at fakeNow = 1010 (+10ms, < 30ms retrigger)
    fakeNow = 1010;
    mockCtx.createdSources[0].onended?.();

    // Calling again at +10ms should be dropped because minRetriggerMs (30ms) has not passed
    audio.playEndoDestroy();
    expect(mockCtx.createdSources).toHaveLength(3);

    // Advance to +35ms (> 30ms retrigger interval)
    fakeNow = 1035;
    audio.playEndoDestroy();
    expect(mockCtx.createdSources).toHaveLength(4);
  });
});
