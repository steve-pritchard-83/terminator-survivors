import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { SaveManager } from '../../src/state/SaveManager';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { EndRunModal } from '../../src/ui/EndRunModal';
import { RunController } from '../../src/core/RunController';
import type { ActiveEnemy, RunHistoryRecord } from '../../src/core/types';

describe('P7-03: Run summary & history', () => {
  let root: HTMLElement;
  let saveManager: SaveManager;
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let particles: ParticleSystem;
  let playerMesh: KyleReeseMesh;
  let weaponSystem: WeaponSystem;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement('div');
    document.body.appendChild(root);

    saveManager = new SaveManager();
    runState = new RunState();
    runState.initRun('reese_2029', {});

    grid = new SpatialHashGrid();
    audio = new AudioEngine();
    particles = new ParticleSystem();
    playerMesh = new KyleReeseMesh();
    weaponSystem = new WeaponSystem(runState, grid, audio, particles, playerMesh);
  });

  it('WeaponSystem tracks damage dealt per weapon correctly', () => {
    const enemy: ActiveEnemy = {
      id: 1,
      type: 'enemy',
      archetype: 't800_endoskeleton',
      x: 0,
      z: 2,
      hp: 500,
      maxHp: 500,
      radius: 0.5,
      speed: 2,
      damage: 10,
      xpValue: 5,
      mass: 1.0,
      armorStripMultiplier: 1.0,
      hitFlashTimer: 0,
      isBoss: false,
      isFlying: false,
      slowTimer: 0,
      attackCooldown: 0
    };
    grid.insert(enemy);

    // Initial damage map is empty
    expect(weaponSystem.getDamageByWeapon()).toEqual({});

    // Spawn a projectile from plasma_rifle hitting enemy
    (weaponSystem as any).spawnProjectile({
      weaponId: 'plasma_rifle',
      meshCategory: 'plasma',
      x: 0,
      y: 0.5,
      z: 2,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: 0,
      damage: 40,
      radius: 1.0,
      pierceLeft: 1,
      life: 0,
      maxLife: 2
    });

    weaponSystem.update(0.016, [enemy]);

    const dmgRecord = weaponSystem.getDamageByWeapon();
    expect(dmgRecord['plasma_rifle']).toBeGreaterThanOrEqual(40);
  });

  it('RunState records kills by archetype and level up progression timeline', () => {
    expect(runState.killsByType.size).toBe(0);
    expect(runState.levelUpTimeline.length).toBe(0);

    runState.recordKill('skynet_crab_drone');
    runState.recordKill('skynet_crab_drone');
    runState.recordKill('t800_endoskeleton');

    expect(runState.killsByType.get('skynet_crab_drone')).toBe(2);
    expect(runState.killsByType.get('t800_endoskeleton')).toBe(1);

    runState.timeSeconds = 45;
    runState.level = 2;
    runState.recordLevelUp('Plasma Rifle Mk II');

    expect(runState.levelUpTimeline).toHaveLength(1);
    expect(runState.levelUpTimeline[0]).toEqual({
      level: 2,
      timeSeconds: 45,
      choiceTitle: 'Plasma Rifle Mk II'
    });

    // Resetting on initRun clears both
    runState.initRun('reese_2029', {});
    expect(runState.killsByType.size).toBe(0);
    expect(runState.levelUpTimeline.length).toBe(0);
  });

  it('SaveManager records and limits run history to the previous 20 runs', () => {
    expect(saveManager.getRunHistory()).toEqual([]);

    for (let i = 1; i <= 25; i++) {
      const record: RunHistoryRecord = {
        id: `run_${i}`,
        date: new Date().toISOString(),
        durationSeconds: 100 + i,
        stageId: 'la_2029_wasteland',
        loadoutId: 'reese_2029',
        outcome: i % 2 === 0 ? 'victory' : 'defeat',
        levelReached: 5 + i,
        kills: 50 + i * 10,
        scrapEarned: 200 + i * 5,
        weaponDamageBreakdown: { ithaca_37: 1000 * i },
        killsByType: { scout_drone: 20 + i },
        levelUpTimeline: [{ level: 2, timeSeconds: 30, choiceTitle: 'Upgrade' }]
      };
      saveManager.recordRunHistory(record);
    }

    const history = saveManager.getRunHistory();
    expect(history.length).toBe(20);
    // Most recent run should be at the front
    expect(history[0].id).toBe('run_25');
    expect(history[19].id).toBe('run_6');
  });

  it('EndRunModal renders tabbed summaries for debrief, weapons, casualties, timeline and archives', () => {
    const modal = new EndRunModal(root, saveManager, audio);

    const record: RunHistoryRecord = {
      id: 'test_run_1',
      date: new Date().toISOString(),
      durationSeconds: 125,
      stageId: 'la_2029_wasteland',
      loadoutId: 'reese_2029',
      outcome: 'victory',
      levelReached: 6,
      kills: 88,
      scrapEarned: 350,
      topWeapon: { id: 'ithaca_37', damage: 15400 },
      weaponDamageBreakdown: { ithaca_37: 15400, pipe_bomb: 4600 },
      killsByType: { scout_drone: 60, t800_endoskeleton: 28 },
      levelUpTimeline: [
        { level: 2, timeSeconds: 22, choiceTitle: 'Ithaca 37 Mk II' },
        { level: 3, timeSeconds: 58, choiceTitle: 'Combat Stims' }
      ]
    };

    saveManager.recordRunHistory(record);

    modal.show(
      true,
      125,
      88,
      6,
      350,
      1337,
      vi.fn(),
      undefined,
      record
    );

    expect(modal.isVisible()).toBe(true);

    // Verify Debrief content
    const statsEl = modal.container.querySelector('#end-stats')!;
    expect(statsEl.textContent).toContain('02:05');
    expect(statsEl.textContent).toContain('88');
    expect(statsEl.textContent).toContain('LV 6');
    expect(statsEl.textContent).toContain('+350');

    // Switch to Weapons tab and verify telemetry
    modal.switchTab('weapons');
    const weaponsList = modal.container.querySelector('#end-weapons-list')!;
    expect(weaponsList.textContent).toContain('Ithaca 37');
    expect(weaponsList.textContent).toContain('15,400 DMG');
    expect(weaponsList.textContent).toContain('Pipe Bomb');

    // Switch to Casualties tab
    modal.switchTab('casualties');
    const casualtiesList = modal.container.querySelector('#end-casualties-list')!;
    expect(casualtiesList.textContent).toContain('60');
    expect(casualtiesList.textContent).toContain('28');

    // Switch to Timeline tab
    modal.switchTab('timeline');
    const timelineList = modal.container.querySelector('#end-timeline-list')!;
    expect(timelineList.textContent).toContain('Ithaca 37 Mk II');
    expect(timelineList.textContent).toContain('Combat Stims');

    // Switch to Archives tab
    modal.switchTab('archives');
    const archivesList = modal.container.querySelector('#end-archives-list')!;
    expect(archivesList.textContent).toContain('VICTORY');
    expect(archivesList.textContent).toContain('Ithaca 37');

    // Direct showArchives method opens archives
    modal.showArchives(vi.fn());
    expect(modal.container.querySelector('#end-title')!.textContent).toBe('TECH-COM ARCHIVES');
  });

  it('RunController.endRun integrates telemetry and logs to SaveManager', () => {
    const mockHost: any = {
      runState,
      saveManager,
      audioEngine: audio,
      sceneManager: { addScreenShake: vi.fn(), postProcessing: { triggerDamageFlash: vi.fn() } },
      weaponSystem,
      enemySystem: { activeEnemies: [] },
      pickupSystem: { pickups: [] },
      particles,
      uiManager: {
        levelUpModal: { hide: vi.fn() },
        vaultModal: { hide: vi.fn() },
        hudView: { hide: vi.fn(), damageNumbers: { clear: vi.fn() }, show: vi.fn(), triggerBossWarning: vi.fn() },
        titleScreen: { show: vi.fn() },
        endRunModal: { show: vi.fn() }
      },
      inputManager: { clearDashRequest: vi.fn() },
      gameLoop: { hitStop: vi.fn() }
    };

    runState.timeSeconds = 80;
    runState.kills = 30;
    runState.level = 4;
    runState.recordKill('hk_aerial_patrol');
    runState.recordLevelUp('Armor Vest');
    weaponSystem.damageByWeapon.set('ithaca_37', 5000);

    const controller = new RunController(mockHost);
    controller.endRun(true);

    const history = saveManager.getRunHistory();
    expect(history.length).toBe(1);
    expect(history[0].outcome).toBe('victory');
    expect(history[0].topWeapon?.id).toBe('ithaca_37');
    expect(history[0].topWeapon?.damage).toBe(5000);
    expect(history[0].killsByType['hk_aerial_patrol']).toBe(1);
    expect(history[0].levelUpTimeline[0].choiceTitle).toBe('Armor Vest');

    expect(mockHost.uiManager.endRunModal.show).toHaveBeenCalledWith(
      true,
      80,
      30,
      4,
      expect.any(Number),
      expect.any(Number),
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        outcome: 'victory',
        topWeapon: { id: 'ithaca_37', damage: 5000 }
      }),
      undefined
    );
  });
});
