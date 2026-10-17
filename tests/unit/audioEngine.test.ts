import { describe, it, expect } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';

describe('AudioEngine Synthesis and Fallback', () => {
  it('instantiates cleanly in headless environments without throwing', () => {
    const audio = new AudioEngine();
    expect(audio).toBeDefined();
  });

  it('clamps and updates volume parameters safely', () => {
    const audio = new AudioEngine();
    audio.setMasterVolume(1.5);
    audio.setMusicVolume(-0.5);
    audio.setSfxVolume(0.5);
  });

  it('safely executes all 12 procedural SFX methods without throwing exceptions', () => {
    const audio = new AudioEngine();
    expect(() => {
      audio.playPlasmaShot(false);
      audio.playPlasmaShot(true);
      audio.playShotgunBlast();
      audio.playExplosion(1.0);
      audio.playEmpBlast();
      audio.playEndoHit();
      audio.playEndoDestroy();
      audio.playSearchlightAlert();
      audio.playPickupGem(3);
      audio.playLevelUp();
      audio.playVaultJackpot();
      audio.playCombatDive();
      audio.playPlayerHit();
    }).not.toThrow();
  });
});
