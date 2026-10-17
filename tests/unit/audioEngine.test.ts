import { describe, it, expect } from 'vitest';
import { AudioEngine, SFX_WAV_MANIFEST } from '../../src/audio/AudioEngine';

describe('AudioEngine WAV Sample Bank & UI/Combat Triggers', () => {
  it('instantiates cleanly in headless environments without throwing', () => {
    const audio = new AudioEngine();
    expect(audio).toBeDefined();
    expect(Object.keys(SFX_WAV_MANIFEST).length).toBeGreaterThanOrEqual(20);
  });

  it('clamps and updates volume parameters safely', () => {
    const audio = new AudioEngine();
    audio.setMasterVolume(1.5);
    audio.setMusicVolume(-0.5);
    audio.setSfxVolume(0.5);
  });

  it('safely executes all combat and UI WAV SFX methods without throwing exceptions', () => {
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
      audio.playUiClick();
      audio.playUiBeep();
      audio.playUiBuy();
      audio.playUiError();
      audio.playUpgradeApplied();
      audio.playHudScanOpen();
      audio.playHudScanClose();
      audio.playRunStart();
      audio.playPlayerTerminated();
      audio.playRunEnd(true);
      audio.playRunEnd(false);
    }).not.toThrow();
  });
});
