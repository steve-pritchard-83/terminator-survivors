import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { globalEvents } from '../../src/core/EventBus';
import { HUDView } from '../../src/ui/HUDView';

describe('P4-06 Pickup Magnet Feel & Combo Counter', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let pickupSystem: PickupSystem;

  beforeEach(() => {
    runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.playerPos.x = 0;
    runState.playerPos.z = 0;
    runState.computedStats.magnetRadius = 8.0;

    audio = new AudioEngine();
    vi.spyOn(audio, 'playPickupGem').mockImplementation(() => {});

    particles = new ParticleSystem();
    vi.spyOn(particles, 'spawnDashAfterimage').mockImplementation(() => {});

    pickupSystem = new PickupSystem(runState, audio, particles);
  });

  it('spawns core gem and pops outward upon entering magnet radius during the first 0.15s', () => {
    // Spawn a gem at (3, 0)
    pickupSystem.spawnDataCore(3, 0, 10);
    const p = pickupSystem.pickups[0];
    expect(p).toBeDefined();
    expect(p.attracted).toBe(false);

    // Initial update step: dt = 0.05s (< 0.15s)
    pickupSystem.update(0.05);

    expect(p.attracted).toBe(true);
    expect(p.attractTime).toBeCloseTo(0.05, 3);
    // Gem was at x = 3, player at x = 0.
    // The outward pop pushes gem away from player (x > 3).
    expect(p.x).toBeGreaterThan(3.0);
  });

  it('accelerates toward the player after 0.15s outward pop phase', () => {
    // Spawn gem at (5, 0)
    pickupSystem.spawnDataCore(5, 0, 10);
    const p = pickupSystem.pickups[0];

    // Finish 0.15s pop phase
    pickupSystem.update(0.15);
    const popX = p.x;

    // Next step dt = 0.05s (attractTime = 0.20s, t = 0.05s, speed = 6 + 30 * 0.05 = 7.5 m/s)
    pickupSystem.update(0.05);
    const distAfterFirstPull = p.x;
    expect(distAfterFirstPull).toBeLessThan(popX);

    // Next step dt = 0.05s (attractTime = 0.25s, t = 0.10s, speed = 6 + 30 * 0.1 = 9 m/s)
    pickupSystem.update(0.05);
    const step1DistDelta = popX - distAfterFirstPull;
    const step2DistDelta = distAfterFirstPull - p.x;

    // Speed increases over time (accelerating curve)
    expect(step2DistDelta).toBeGreaterThan(step1DistDelta);
  });

  it('increments combo count and plays increasing pitch on rapid pickups', () => {
    const comboEvents: number[] = [];
    globalEvents.on('pickup:combo', ({ combo }) => {
      comboEvents.push(combo);
    });

    // Spawn 3 gems right at player position
    pickupSystem.spawnDataCore(0, 0, 10);
    pickupSystem.spawnDataCore(0, 0, 10);
    pickupSystem.spawnDataCore(0, 0, 10);

    pickupSystem.update(0.016);

    expect(pickupSystem.getComboCount()).toBe(3);
    expect(comboEvents).toEqual([1, 2, 3]);
    expect(audio.playPickupGem).toHaveBeenCalledWith(1);
    expect(audio.playPickupGem).toHaveBeenCalledWith(2);
    expect(audio.playPickupGem).toHaveBeenCalledWith(3);
  });

  it('resets combo after 1.2s timeout and emits pickup:combo_reset', () => {
    let resetFired = false;
    globalEvents.on('pickup:combo_reset', () => {
      resetFired = true;
    });

    pickupSystem.spawnDataCore(0, 0, 10);
    pickupSystem.update(0.016);
    expect(pickupSystem.getComboCount()).toBe(1);

    // Advance 0.8s: combo still active
    pickupSystem.update(0.8);
    expect(pickupSystem.getComboCount()).toBe(1);
    expect(resetFired).toBe(false);

    // Advance past 1.2s
    pickupSystem.update(0.5);
    expect(pickupSystem.getComboCount()).toBe(0);
    expect(resetFired).toBe(true);
  });

  it('HUD displays combo counter for combo >= 2 and hides on reset', () => {
    const root = document.createElement('div');
    new HUDView(root);
    const comboEl = root.querySelector('#hud-combo-counter') as HTMLElement;

    expect(comboEl).not.toBeNull();
    expect(comboEl.style.display).toBe('none');

    // Emit combo 1: should still be hidden (only displays for combo >= 2)
    globalEvents.emit('pickup:combo', { combo: 1 });
    expect(comboEl.style.display).toBe('none');

    // Emit combo 2: should display with text "x2 DATA LINK"
    globalEvents.emit('pickup:combo', { combo: 2 });
    expect(comboEl.style.display).toBe('block');
    expect(comboEl.textContent).toBe('x2 DATA LINK');
    expect(comboEl.classList.contains('pop')).toBe(true);

    // Emit combo 5
    globalEvents.emit('pickup:combo', { combo: 5 });
    expect(comboEl.textContent).toBe('x5 DATA LINK');

    // Emit reset: should hide
    globalEvents.emit('pickup:combo_reset');
    expect(comboEl.style.display).toBe('none');
  });
});
