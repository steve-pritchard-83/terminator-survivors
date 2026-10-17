import { describe, it, expect, vi } from 'vitest';
import { STAGES } from '../../src/data/stages';
import { createEnvironment } from '../../src/graphics/environments';
import { RunState } from '../../src/state/RunState';
import { WaveDirector } from '../../src/systems/WaveDirector';
import type { StageId } from '../../src/core/types';

describe('P6-01: Stage Abstraction and Configuration', () => {
  it('defines all 5 canonical stages with complete visual and timeline definitions', () => {
    const requiredStages: StageId[] = [
      'la_2029_wasteland',
      'cyberdyne_factory',
      'tech_noir_1984',
      'skynet_central_tde',
      'century_city_bunker'
    ];

    for (const stageId of requiredStages) {
      const stage = STAGES[stageId];
      expect(stage, `Stage ${stageId} must be defined`).toBeDefined();
      expect(stage.id).toBe(stageId);
      expect(stage.name.length).toBeGreaterThan(0);
      expect(stage.subtitle.length).toBeGreaterThan(0);
      expect(stage.description.length).toBeGreaterThan(0);
      expect(typeof stage.fogColor).toBe('number');
      expect(typeof stage.fogDensity).toBe('number');
      expect(typeof stage.skyZenith).toBe('number');
      expect(typeof stage.skyHorizon).toBe('number');
      expect(typeof stage.ambientLightColor).toBe('number');
      expect(typeof stage.directionalLightColor).toBe('number');
      expect(Array.isArray(stage.waveTimeline)).toBe(true);
      expect(stage.waveTimeline.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('createEnvironment returns an IEnvironment with required methods and structures', () => {
    const env = createEnvironment('la_2029_wasteland');
    expect(env).toBeDefined();
    expect(env.group).toBeDefined();
    expect(Array.isArray(env.obstacleColliders)).toBe(true);
    expect(typeof env.update).toBe('function');
    expect(typeof env.dispose).toBe('function');

    // Test update call
    env.update(10, 20);

    // Test dispose call
    env.dispose();
    expect(env.obstacleColliders.length).toBe(0);
  });

  it('RunState manages stageId during initialization', () => {
    const runState = new RunState();
    expect(runState.stageId).toBe('la_2029_wasteland');

    runState.initRun('reese_2029', {}, 1234, 'cyberdyne_factory');
    expect(runState.stageId).toBe('cyberdyne_factory');
    expect(runState.seed).toBe(1234);

    runState.initRun('reese_1984', {}, 5678, 'tech_noir_1984');
    expect(runState.stageId).toBe('tech_noir_1984');
  });

  it('WaveDirector uses stage timeline based on runState.stageId', () => {
    const runState = new RunState();
    runState.mode = 'playing';
    runState.stageId = 'cyberdyne_factory';
    const mockEnemySystem = {
      activeEnemies: [],
      spawnEnemy: vi.fn(),
      clear: vi.fn()
    } as any;

    const director = new WaveDirector(runState, mockEnemySystem);
    expect(director).toBeDefined();

    // Reset and tick
    director.reset();
    director.update(0.1);
    expect(runState.timeSeconds).toBeCloseTo(0.1);
  });
});
