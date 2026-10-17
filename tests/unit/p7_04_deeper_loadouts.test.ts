import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LOADOUTS } from '../../src/data/upgrades';
import { RunState } from '../../src/state/RunState';
import { InputManager } from '../../src/input/InputManager';
import { InputRouter } from '../../src/core/InputRouter';
import { RunController } from '../../src/core/RunController';
import { HUDView } from '../../src/ui/HUDView';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import type { LoadoutId } from '../../src/core/types';

describe('P7-04: Deeper Loadouts & Active Abilities', () => {
  let runState: RunState;
  let audio: AudioEngine;
  let grid: SpatialHashGrid;
  let particles: ParticleSystem;
  let playerMesh: KyleReeseMesh;
  let weaponSystem: WeaponSystem;

  beforeEach(() => {
    runState = new RunState();
    audio = new AudioEngine();
    grid = new SpatialHashGrid();
    particles = new ParticleSystem();
    playerMesh = new KyleReeseMesh();
    weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
  });

  it('defines active abilities on all 6 loadouts including Sarah Connor and Reprogrammed T-800', () => {
    const loadoutIds: LoadoutId[] = [
      'reese_2029',
      'reese_1984',
      'techcom_sapper',
      'john_connor',
      'sarah_connor',
      'reprogrammed_t800'
    ];

    for (const id of loadoutIds) {
      const cfg = LOADOUTS[id];
      expect(cfg).toBeDefined();
      expect(cfg.ability).toBeDefined();
      expect(cfg.ability.name.length).toBeGreaterThan(0);
      expect(cfg.ability.cooldown).toBeGreaterThan(0);
      expect(cfg.ability.description.length).toBeGreaterThan(0);
    }

    // Verify Sarah Connor specific stats
    expect(LOADOUTS.sarah_connor.startingWeapon).toBe('ithaca_37');
    expect(LOADOUTS.sarah_connor.bonusStats.moveSpeed).toBeGreaterThan(1.0);
    expect(LOADOUTS.sarah_connor.ability.id).toBe('molotov_perimeter');

    // Verify Reprogrammed T-800 specific stats
    expect(LOADOUTS.reprogrammed_t800.startingWeapon).toBe('m25_plasma');
    expect(LOADOUTS.reprogrammed_t800.bonusStats.maxHp).toBe(150);
    expect(LOADOUTS.reprogrammed_t800.bonusStats.armor).toBe(3);
    expect(LOADOUTS.reprogrammed_t800.ability.id).toBe('endo_overdrive');
  });

  it('RunState handles ability triggers, cooldowns, and active buff durations', () => {
    runState.initRun('reese_1984', {});
    expect(runState.abilityCooldownTimer).toBe(0);
    expect(runState.isAbilityActive).toBe(false);

    // Initial stats before ability
    const initialCooldown = runState.computedStats.cooldownMultiplier;
    const initialBonusAmount = runState.computedStats.bonusAmount;

    // Trigger Sawed-off Dual Wield
    const triggered = runState.triggerAbility();
    expect(triggered).toBe(true);
    expect(runState.abilityCooldownTimer).toBe(28);
    expect(runState.isAbilityActive).toBe(true);
    expect(runState.abilityActiveDuration).toBe(6);

    // Buffs should be applied during active duration
    expect(runState.computedStats.cooldownMultiplier).toBeLessThan(initialCooldown);
    expect(runState.computedStats.bonusAmount).toBe(initialBonusAmount + 2);

    // Re-triggering while on cooldown returns false
    expect(runState.triggerAbility()).toBe(false);

    // Simulate 3 seconds passing: still active
    runState.updateTimers(3.0);
    expect(runState.isAbilityActive).toBe(true);
    expect(runState.abilityActiveDuration).toBeCloseTo(3.0, 1);
    expect(runState.abilityCooldownTimer).toBeCloseTo(25.0, 1);

    // Simulate 4 more seconds passing: active duration expires
    runState.updateTimers(4.0);
    expect(runState.isAbilityActive).toBe(false);
    expect(runState.abilityActiveDuration).toBe(0);
    expect(runState.abilityCooldownTimer).toBeCloseTo(21.0, 1);
    // Stats revert to normal
    expect(runState.computedStats.bonusAmount).toBe(initialBonusAmount);
  });

  it('InputRouter triggers ability when keyboard or gamepad ability input is activated', () => {
    const inputManager = new InputManager();
    const mockUiManager: any = {
      hudView: {
        showControllerNotification: vi.fn(),
        setGamepadActive: vi.fn(),
        update: vi.fn()
      },
      updateGamepad: vi.fn()
    };
    const mockSceneManager: any = {};
    const mockHost: any = {
      inputManager,
      uiManager: mockUiManager,
      sceneManager: mockSceneManager,
      runState,
      audioEngine: audio
    };

    runState.initRun('reese_2029', {});
    const router = new InputRouter(mockHost, vi.fn());

    // Trigger via test helper
    inputManager.triggerAbilityForTest();
    router.update(0.016);

    expect(runState.abilityCooldownTimer).toBe(22);
  });

  it('RunController handles abilities for all loadouts correctly', () => {
    const spawnProjSpy = vi.spyOn(weaponSystem, 'spawnProjectile');
    const spawnEmpSpy = vi.spyOn(weaponSystem, 'spawnEmpShockwave');
    const spawnZoneSpy = vi.spyOn(weaponSystem, 'spawnGroundZone');

    const mockHost: any = {
      runState,
      saveManager: { recordRunHistory: vi.fn() },
      audioEngine: audio,
      sceneManager: { addScreenShake: vi.fn(), postProcessing: { triggerDamageFlash: vi.fn() } },
      weaponSystem,
      enemySystem: { activeEnemies: [] },
      pickupSystem: { pickups: [] },
      particles,
      uiManager: {
        levelUpModal: { hide: vi.fn() },
        vaultModal: { hide: vi.fn() },
        hudView: { hide: vi.fn(), update: vi.fn(), damageNumbers: { clear: vi.fn() }, triggerBossWarning: vi.fn() },
        titleScreen: { show: vi.fn() },
        endRunModal: { show: vi.fn() }
      },
      inputManager: { clearDashRequest: vi.fn() },
      gameLoop: { hitStop: vi.fn() }
    };

    const controller = new RunController(mockHost);

    // 1. Reese 2029 pipebomb barrage
    controller.handleAbilityTriggered('reese_2029', 'pipebomb_barrage', 0, 0);
    expect(spawnProjSpy).toHaveBeenCalledTimes(4);

    // 2. Tech-Com Sapper overcharge
    runState.weapons.set('m25_plasma', { id: 'm25_plasma', level: 1, evolved: false, cooldownTimer: 5.0 });
    controller.handleAbilityTriggered('techcom_sapper', 'plasma_overcharge', 0, 0);
    expect(runState.weapons.get('m25_plasma')?.cooldownTimer).toBe(0);
    expect(spawnEmpSpy).toHaveBeenCalledWith(0, 0, 14, true);

    // 3. Sarah Connor molotov perimeter
    controller.handleAbilityTriggered('sarah_connor', 'molotov_perimeter', 0, 0);
    expect(spawnZoneSpy).toHaveBeenCalledTimes(6);

    // 4. Reprogrammed T-800 endo overdrive
    controller.handleAbilityTriggered('reprogrammed_t800', 'endo_overdrive', 0, 0);
    expect(runState.invulnerabilityTimer).toBe(5.0);
  });

  it('HUDView updates active ability cooldown and readiness state', () => {
    const root = document.createElement('div');
    const hud = new HUDView(root);
    runState.initRun('sarah_connor', {});

    // Ready state
    hud.update(runState, null);
    const abilityEl = root.querySelector('#hud-ability-status')!;
    expect(abilityEl.textContent).toContain('Molotov Perimeter: READY');

    // On cooldown
    runState.abilityCooldownTimer = 18.4;
    hud.update(runState, null);
    expect(abilityEl.textContent).toContain('18.4s');

    // Active state
    runState.isAbilityActive = true;
    runState.abilityActiveDuration = 4.2;
    hud.update(runState, null);
    expect(abilityEl.textContent).toContain('ACTIVE (4.2s)');
  });
});
