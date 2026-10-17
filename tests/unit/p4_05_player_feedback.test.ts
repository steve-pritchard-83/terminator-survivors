import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { PlayerSystem } from '../../src/systems/PlayerSystem';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { CameronGradingShader } from '../../src/graphics/PostProcessing';
import { HUDView } from '../../src/ui/HUDView';

describe('P4-05 Player feedback', () => {
  let runState: RunState;
  let playerMesh: KyleReeseMesh;
  let playerSystem: PlayerSystem;
  let audio: AudioEngine;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    playerMesh = new KyleReeseMesh();
    playerSystem = new PlayerSystem(runState, playerMesh);
    audio = new AudioEngine();
  });

  describe('i-frame invulnerability and mesh flicker', () => {
    it('sets 0.5s invulnerability upon taking damage and blocks subsequent hits', () => {
      expect(runState.hp).toBe(100);
      expect(runState.invulnerabilityTimer).toBe(0);

      const hit1 = runState.takeDamage(20);
      expect(hit1).toBe(20);
      expect(runState.hp).toBe(80);
      expect(runState.invulnerabilityTimer).toBe(0.5);

      // Hit during i-frames should deal 0 damage
      const hit2 = runState.takeDamage(30);
      expect(hit2).toBe(0);
      expect(runState.hp).toBe(80);

      // Advance by 0.3s (still 0.2s of i-frames left)
      runState.updateTimers(0.3);
      expect(runState.invulnerabilityTimer).toBeCloseTo(0.2, 2);
      expect(runState.takeDamage(30)).toBe(0);
      expect(runState.hp).toBe(80);

      // Advance past remaining i-frames
      runState.updateTimers(0.25);
      expect(runState.invulnerabilityTimer).toBe(0);
      const hit3 = runState.takeDamage(25);
      expect(hit3).toBe(25);
      expect(runState.hp).toBe(55);
    });

    it('flickers playerMesh visibility during i-frames and restores visibility afterwards', () => {
      runState.takeDamage(20);
      expect(runState.invulnerabilityTimer).toBe(0.5);

      // During update with active i-frames, mesh visibility toggles based on timer
      playerSystem.update(0.02, { x: 0, z: 0 }, null, []);
      // At timer ~0.48: Math.floor(0.48 * 24) = 11 (odd) -> invisible
      expect(playerMesh.group.visible).toBe(false);

      playerSystem.update(0.045, { x: 0, z: 0 }, null, []);
      // At timer ~0.435: Math.floor(0.435 * 24) = 10 (even) -> visible
      expect(playerMesh.group.visible).toBe(true);

      // When i-frames expire, mesh is guaranteed visible
      runState.invulnerabilityTimer = 0;
      playerSystem.update(0.016, { x: 0, z: 0 }, null, []);
      expect(playerMesh.group.visible).toBe(true);
    });

    it('respects configurable invulnerabilityDuration from loadout data', () => {
      const customState = new RunState();
      customState.initRun('reese_2029', {});
      // Default is 0.5s
      expect(customState.invulnerabilityDuration).toBe(0.5);

      // Custom override
      customState.invulnerabilityDuration = 0.8;
      customState.takeDamage(10);
      expect(customState.invulnerabilityTimer).toBe(0.8);
    });
  });

  describe('Dash cooldown ring ground decal', () => {
    it('initializes dash ring with bright cyan color and full scale when dash is ready', () => {
      expect(playerSystem.dashRingMesh).toBeDefined();
      expect(playerSystem.dashRingMat.color.getHex()).toBe(0x00e5ff);
      expect(playerSystem.dashRingMat.opacity).toBeCloseTo(0.75, 2);
      expect(playerSystem.dashRingMesh.scale.x).toBe(1.0);
    });

    it('scales down and dims dash ring while on cooldown, scaling back up with recharge progress', () => {
      runState.triggerDash();
      expect(runState.isDashing).toBe(true);
      expect(runState.dashCooldownTimer).toBe(runState.dashCooldown);

      playerSystem.update(0.016, { x: 0, z: 0 }, null, []);
      // On cooldown: dimmed color and reduced scale
      expect(playerSystem.dashRingMat.color.getHex()).toBe(0x005577);
      expect(playerSystem.dashRingMesh.scale.x).toBeLessThan(0.7);

      // Halfway recharged
      runState.dashCooldownTimer = runState.dashCooldown * 0.5;
      playerSystem.update(0.016, { x: 0, z: 0 }, null, []);
      expect(playerSystem.dashRingMesh.scale.x).toBeCloseTo(0.8, 1);

      // Fully recharged
      runState.dashCooldownTimer = 0;
      playerSystem.update(0.016, { x: 0, z: 0 }, null, []);
      expect(playerSystem.dashRingMat.color.getHex()).toBe(0x00e5ff);
      expect(playerSystem.dashRingMesh.scale.x).toBe(1.0);
    });

    it('positions dash ring at player ground location in update and setInterpolatedPosition', () => {
      runState.playerPos = { x: 14.5, z: -8.2 };
      playerSystem.update(0.016, { x: 0, z: 0 }, null, []);
      expect(playerSystem.dashRingMesh.position.x).toBeCloseTo(14.5, 2);
      expect(playerSystem.dashRingMesh.position.y).toBe(0.02);
      expect(playerSystem.dashRingMesh.position.z).toBeCloseTo(-8.2, 2);

      playerSystem.setInterpolatedPosition(0.5, { x: 10, z: 0 });
      expect(playerSystem.dashRingMesh.position.x).toBeCloseTo(12.25, 2);
    });
  });

  describe('Ground aim reticle decal', () => {
    it('hides aim reticle when not aiming', () => {
      playerSystem.update(0.016, { x: 0, z: 0 }, null, [], null);
      expect(playerSystem.reticleGroup.visible).toBe(false);
    });

    it('shows aim reticle at world mouse ground position when mouse aim is active', () => {
      const mouseAim = { x: 12.0, z: 18.5 };
      playerSystem.update(0.016, { x: 0, z: 0 }, 1.2, [], mouseAim);
      expect(playerSystem.reticleGroup.visible).toBe(true);
      expect(playerSystem.reticleGroup.position.x).toBeCloseTo(12.0, 2);
      expect(playerSystem.reticleGroup.position.y).toBe(0.02);
      expect(playerSystem.reticleGroup.position.z).toBeCloseTo(18.5, 2);
    });

    it('shows aim reticle projected along target angle when gamepad stick aim is active', () => {
      runState.playerPos = { x: 0, z: 0 };
      const aimAngle = Math.PI / 2; // Facing +X
      playerSystem.update(0.016, { x: 0, z: 0 }, aimAngle, [], null);
      expect(playerSystem.reticleGroup.visible).toBe(true);
      expect(playerSystem.reticleGroup.position.x).toBeCloseTo(5.0, 1);
      expect(playerSystem.reticleGroup.position.z).toBeCloseTo(0, 1);
    });
  });

  describe('Low-HP (<25%) feedback (vignette pulse, heartbeat audio, HUD pulse)', () => {
    it('AudioEngine triggers heartbeat thump on low HP', () => {
      const playSpy = vi.spyOn(audio, 'playHeartbeat');

      // Normal HP: no heartbeat
      audio.updateHeartbeat(0.1, false);
      expect(playSpy).not.toHaveBeenCalled();

      // Low HP: triggers heartbeat immediately then sets cooldown
      audio.updateHeartbeat(0.1, true);
      expect(playSpy).toHaveBeenCalledTimes(1);

      // Before cooldown expires: does not trigger again
      audio.updateHeartbeat(0.2, true);
      expect(playSpy).toHaveBeenCalledTimes(1);

      // Once cooldown (0.75s) expires: triggers 2nd thump
      audio.updateHeartbeat(0.6, true);
      expect(playSpy).toHaveBeenCalledTimes(2);

      // When recovered from low HP: resets timer
      audio.updateHeartbeat(0.1, false);
      expect(playSpy).toHaveBeenCalledTimes(2);
    });

    it('CameronGradingShader defines uLowHpPulse uniform and applies lowHpVignette in fragment shader', () => {
      expect(CameronGradingShader.uniforms.uLowHpPulse).toBeDefined();
      expect(CameronGradingShader.uniforms.uLowHpPulse.value).toBe(0.0);
      expect(CameronGradingShader.fragmentShader).toContain('uLowHpPulse');
      expect(CameronGradingShader.fragmentShader).toContain('lowHpVignette');
    });

    it('HUDView adds pulse class and bright glow when HP < 25%', () => {
      const root = document.createElement('div');
      const hud = new HUDView(root);

      // 80% HP: normal
      runState.hp = 80;
      hud.update(runState, null);
      const hpFill = root.querySelector('#hud-hp-fill') as HTMLElement;
      expect(hpFill.classList.contains('hud-low-hp-pulse')).toBe(false);

      // 20% HP (< 25%): low-HP pulse active
      runState.hp = 20;
      hud.update(runState, null);
      expect(hpFill.classList.contains('hud-low-hp-pulse')).toBe(true);
      expect(hpFill.style.boxShadow).toContain('#ff0000');

      // Heal back to 50%: pulse deactivated
      runState.hp = 50;
      hud.update(runState, null);
      expect(hpFill.classList.contains('hud-low-hp-pulse')).toBe(false);
    });
  });
});
