import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THREAT_MODIFIERS,
  computeThreatScrapMultiplier
} from '../../src/data/threatModifiers';
import { RunState } from '../../src/state/RunState';
import { WaveDirector } from '../../src/systems/WaveDirector';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunController } from '../../src/core/RunController';
import { SaveManager } from '../../src/state/SaveManager';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import type { ThreatModifierId } from '../../src/core/types';

describe('P6-05: Threat Levels (Difficulty Modifiers)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defines all 10 threat modifiers and computes scrap multipliers accurately', () => {
    const requiredThreats: ThreatModifierId[] = [
      'terminator_reinforcements',
      'plasma_overcharge',
      'relentless_pursuit',
      'emp_damping',
      'supply_starvation',
      'jammed_frequency',
      'scarcity_protocol',
      'hyperalloy_surge',
      'no_second_chances',
      'judgment_hour'
    ];

    for (const id of requiredThreats) {
      const def = THREAT_MODIFIERS[id];
      expect(def, `Threat ${id} must exist`).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.scrapBonusPercent).toBe(15);
    }

    expect(computeThreatScrapMultiplier([])).toBe(1.0);
    expect(computeThreatScrapMultiplier(['terminator_reinforcements'])).toBeCloseTo(1.15);
    expect(computeThreatScrapMultiplier(['terminator_reinforcements', 'plasma_overcharge'])).toBeCloseTo(1.30);
    expect(computeThreatScrapMultiplier(requiredThreats)).toBeCloseTo(2.50);
  });

  describe('RunState Threat Effects', () => {
    it('applies no_second_chances by forcing 0 revivals', () => {
      const runState = new RunState();
      // Normally defibrillator grants revivals
      runState.initRun('reese_2029', { defibrillator: 2 }, 1234, 'la_2029_wasteland', ['no_second_chances']);
      expect(runState.activeThreats.has('no_second_chances')).toBe(true);
      expect(runState.computedStats.revivals).toBe(0);
      expect(runState.revivalsLeft).toBe(0);
    });

    it('applies scarcity_protocol by halving meta upgrade bonus stats', () => {
      const normalRun = new RunState();
      normalRun.initRun('reese_2029', { armor_vest: 4 }, 1234);

      const scarcityRun = new RunState();
      scarcityRun.initRun('reese_2029', { armor_vest: 4 }, 1234, 'la_2029_wasteland', ['scarcity_protocol']);

      expect(scarcityRun.computedStats.armor).toBeCloseTo(normalRun.computedStats.armor * 0.5);
    });

    it('applies emp_damping by penalizing cooldown recovery', () => {
      const normalRun = new RunState();
      normalRun.initRun('reese_2029', {}, 1234);

      const empRun = new RunState();
      empRun.initRun('reese_2029', {}, 1234, 'la_2029_wasteland', ['emp_damping']);

      expect(empRun.computedStats.cooldownMultiplier).toBeGreaterThan(normalRun.computedStats.cooldownMultiplier);
    });
  });

  describe('WaveDirector Threat Effects', () => {
    it('applies terminator_reinforcements, plasma_overcharge, and hyperalloy_surge to wave spawns', () => {
      const runState = new RunState();
      runState.mode = 'playing';
      runState.activeThreats = new Set([
        'terminator_reinforcements',
        'plasma_overcharge',
        'hyperalloy_surge'
      ]);

      let spawnedHp = 0;
      let spawnedDmg = 0;
      let spawnedEliteChance = 0;

      const mockEnemySystem = {
        activeEnemies: [],
        spawnEnemy: vi.fn((_arch, _x, _z, hpMult, dmgMult) => {
          spawnedHp = hpMult;
          spawnedDmg = dmgMult;
        }),
        clear: vi.fn()
      } as any;

      const director = new WaveDirector(runState, mockEnemySystem);
      (director as any).spawnPerimeterEnemy = vi.fn((_pool, hpMult, dmgMult, eliteChance) => {
        spawnedHp = hpMult;
        spawnedDmg = dmgMult;
        spawnedEliteChance = eliteChance;
      });

      (director as any).spawnTimer = 999;
      director.update(0.1);

      // Base minute 0: hpMultiplier = 1.0, damageMultiplier = 1.0, eliteChance = 0.02
      expect(spawnedHp).toBeCloseTo(1.0 * 1.25);
      expect(spawnedDmg).toBeCloseTo(1.0 * 1.20);
      expect(spawnedEliteChance).toBeCloseTo(0.02 + 0.30);
    });

    it('judgment_hour compresses run to 8 minutes and triggers bi-minute boss sieges', () => {
      const runState = new RunState();
      runState.mode = 'playing';
      runState.activeThreats = new Set(['judgment_hour']);

      const spawnedBosses: string[] = [];
      const mockEnemySystem = {
        activeEnemies: [],
        spawnEnemy: vi.fn((arch) => {
          spawnedBosses.push(arch);
          return { maxHp: 3000 };
        }),
        clear: vi.fn()
      } as any;

      const director = new WaveDirector(runState, mockEnemySystem);

      // At minute 2 (120s): should trigger boss siege
      runState.timeSeconds = 120;
      director.update(0.1);

      expect(spawnedBosses.length).toBeGreaterThan(0);
    });
  });

  describe('EnemySystem Threat Effects', () => {
    it('relentless_pursuit accelerates enemy movement by 1.15x', () => {
      const runState = new RunState();
      runState.playerPos = { x: 0, z: 0 };
      const grid = new SpatialHashGrid(4.0);
      const mockAudio = { playEnemyDamaged: vi.fn() } as any;
      const mockBatch = { updateInstance: vi.fn(), removeInstance: vi.fn(), updateBatch: vi.fn() } as any;
      const mockParticles = {} as any;

      const enemySystem = new EnemySystem(runState, grid, mockAudio, mockParticles, mockBatch);

      // Spawn enemy at (0, 10)
      const e = enemySystem.spawnEnemy('skynet_crab_drone', 0, 10);

      // Update without relentless_pursuit
      enemySystem.update(0.1, 0, []);
      const distNormal = 10 - e.z;

      // Reset and enable relentless_pursuit
      enemySystem.clear();
      runState.activeThreats.add('relentless_pursuit');
      const e2 = enemySystem.spawnEnemy('skynet_crab_drone', 0, 10);
      enemySystem.update(0.1, 0, []);
      const distFast = 10 - e2.z;

      expect(distFast).toBeGreaterThan(distNormal);
      expect(distFast / distNormal).toBeCloseTo(1.15, 1);
    });
  });

  describe('RunController Scrap Multiplier Integration', () => {
    it('awards bonus scrap based on active threats at run end', () => {
      const runState = new RunState();
      const saveManager = new SaveManager();
      const mockAudio = { playRunEnd: vi.fn(), stopMusic: vi.fn() } as any;
      const mockUI = {
        levelUpModal: { hide: vi.fn() },
        vaultModal: { hide: vi.fn() },
        hudView: { damageNumbers: { clear: vi.fn() }, hide: vi.fn(), onPauseClicked: null },
        endRunModal: { show: vi.fn() },
        titleScreen: { show: vi.fn(), hide: vi.fn() }
      } as any;
      const mockHost = {
        runState,
        saveManager,
        audioEngine: mockAudio,
        uiManager: mockUI,
        sceneManager: {} as any,
        inputManager: { clearDashRequest: vi.fn() } as any,
        weaponSystem: { clear: vi.fn() } as any,
        enemySystem: { clear: vi.fn(), activeEnemies: [] } as any,
        pickupSystem: { clear: vi.fn() } as any,
        particles: { clear: vi.fn() } as any,
        waveDirector: { reset: vi.fn() } as any,
        gameLoop: {} as any
      };

      const controller = new RunController(mockHost);

      // Run with 2 threats (+30% bonus scrap)
      runState.initRun('reese_2029', {}, 1234, 'la_2029_wasteland', ['terminator_reinforcements', 'plasma_overcharge']);
      runState.alloyScrapEarned = 100;
      runState.kills = 50;
      runState.timeSeconds = 200;

      controller.endRun(true);

      // 100 * 1.30 = 130 scrap added to saveManager
      expect(saveManager.getData().alloyScrap).toBe(130);

      controller.dispose();
    });
  });
});
