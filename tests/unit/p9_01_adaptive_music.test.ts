import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';

describe('P9-01: Adaptive Music & Boss Stinger', () => {
  let audio: AudioEngine;

  beforeEach(() => {
    audio = new AudioEngine();
  });

  it('starts in calm intensity layer by default', () => {
    const intensity = audio.getMusicIntensity();
    expect(intensity.layer).toBe('calm');
    expect(intensity.calm).toBeCloseTo(1.0, 1);
    expect(intensity.boss).toBe(0.0);
  });

  it('smoothly ramps up combat layer when enemy density increases', () => {
    // 0 enemies -> calm
    audio.updateMusicIntensity(0, false, 1.0);
    expect(audio.getMusicIntensity().layer).toBe('calm');

    // High enemy swarm (30 enemies) over several frames -> transitions to combat layer
    for (let i = 0; i < 10; i++) {
      audio.updateMusicIntensity(30, false, 0.1);
    }
    const highIntensity = audio.getMusicIntensity();
    expect(highIntensity.layer).toBe('combat');
    expect(highIntensity.combat).toBeGreaterThan(0.7);
    expect(highIntensity.calm).toBeLessThan(0.4);
    expect(highIntensity.boss).toBe(0.0);
  });

  it('prioritizes boss layer when a boss is active', () => {
    // Transition to boss state
    for (let i = 0; i < 10; i++) {
      audio.updateMusicIntensity(5, true, 0.1);
    }
    const bossIntensity = audio.getMusicIntensity();
    expect(bossIntensity.layer).toBe('boss');
    expect(bossIntensity.boss).toBeGreaterThan(0.7);
  });

  it('playBossStinger immediately activates boss layer and triggers stinger sample', () => {
    const playSampleSpy = vi.spyOn(audio as any, 'playSample').mockReturnValue(true);

    audio.playBossStinger();

    const intensity = audio.getMusicIntensity();
    expect(intensity.layer).toBe('boss');
    expect(intensity.boss).toBe(1.0);
    expect(intensity.calm).toBeCloseTo(0.05, 2);
    expect(playSampleSpy).toHaveBeenCalledWith('bossStinger', 0.95, 0.9);
  });

  it('stopMusic resets music layers back to calm defaults', () => {
    // First get into boss state
    audio.updateMusicIntensity(10, true, 1.0);
    expect(audio.getMusicIntensity().layer).toBe('boss');

    audio.stopMusic();

    const resetIntensity = audio.getMusicIntensity();
    expect(resetIntensity.layer).toBe('calm');
    expect(resetIntensity.calm).toBe(1.0);
    expect(resetIntensity.boss).toBe(0.0);
  });
});
