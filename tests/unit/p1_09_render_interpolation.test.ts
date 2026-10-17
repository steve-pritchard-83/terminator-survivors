import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneManager } from '../../src/graphics/SceneManager';
import { PlayerSystem } from '../../src/systems/PlayerSystem';
import { RunState } from '../../src/state/RunState';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';

// Mock WebGLRenderer & PostProcessing for headless jsdom test
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    getPixelRatio = () => 1;
    render = vi.fn();
    dispose = vi.fn();
    toneMapping = 0;
    toneMappingExposure = 1;
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});

vi.mock('../../src/graphics/PostProcessing', () => {
  return {
    PostProcessingManager: class {
      setSize = vi.fn();
      update = vi.fn();
      render = vi.fn();
      triggerEmpGlitch = vi.fn();
      triggerDamageFlash = vi.fn();
    }
  };
});

describe('P1-09 render interpolation and camera target', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
  });

  it('worldToScreen uses its own scratch vector and does NOT mutate currentCameraTarget (fixes B14)', () => {
    const container = document.createElement('div');
    const sm = new SceneManager(container);

    // Initial camera tracking setup
    sm.updateCamera(25, -40, 1.0);
    const targetBefore = sm.getCameraTarget();
    expect(targetBefore.x).toBeCloseTo(25, 2);
    expect(targetBefore.z).toBeCloseTo(-40, 2);

    // Call worldToScreen multiple times with divergent coordinates
    const screenPos1 = sm.worldToScreen(100, 50, -200);
    const screenPos2 = sm.worldToScreen(-500, 0, 800);

    // Assert camera target remained completely unchanged
    const targetAfter = sm.getCameraTarget();
    expect(targetAfter.x).toBe(targetBefore.x);
    expect(targetAfter.y).toBe(targetBefore.y);
    expect(targetAfter.z).toBe(targetBefore.z);

    // worldToScreen returns valid numbers or null without side effects
    if (screenPos1) {
      expect(typeof screenPos1.x).toBe('number');
      expect(typeof screenPos1.y).toBe('number');
    }
    if (screenPos2) {
      expect(typeof screenPos2.x).toBe('number');
    }
  });

  it('PlayerSystem.setInterpolatedPosition correctly lerps mesh position by alpha', () => {
    const runState = new RunState();
    runState.initRun('reese_2029', {});
    runState.playerPos.x = 20;
    runState.playerPos.z = 10;

    const playerMesh = new KyleReeseMesh();
    const playerSystem = new PlayerSystem(runState, playerMesh);

    const prevPos = { x: 10, z: 0 };

    // At alpha = 0.0, mesh is at prevPos
    const pos0 = playerSystem.setInterpolatedPosition(0.0, prevPos);
    expect(pos0.x).toBeCloseTo(10, 4);
    expect(pos0.z).toBeCloseTo(0, 4);
    expect(playerMesh.group.position.x).toBeCloseTo(10, 4);
    expect(playerMesh.group.position.z).toBeCloseTo(0, 4);

    // At alpha = 0.5, mesh is exactly halfway
    const posHalf = playerSystem.setInterpolatedPosition(0.5, prevPos);
    expect(posHalf.x).toBeCloseTo(15, 4);
    expect(posHalf.z).toBeCloseTo(5, 4);
    expect(playerMesh.group.position.x).toBeCloseTo(15, 4);
    expect(playerMesh.group.position.z).toBeCloseTo(5, 4);

    // At alpha = 1.0, mesh is at current runState.playerPos
    const pos1 = playerSystem.setInterpolatedPosition(1.0, prevPos);
    expect(pos1.x).toBeCloseTo(20, 4);
    expect(pos1.z).toBeCloseTo(10, 4);
    expect(playerMesh.group.position.x).toBeCloseTo(20, 4);
    expect(playerMesh.group.position.z).toBeCloseTo(10, 4);
  });

  it('SceneManager.updateCamera smoothly moves currentCameraTarget toward interpolated coords using frame dt', () => {
    const container = document.createElement('div');
    const sm = new SceneManager(container);

    // Frame 1 with small dt (e.g. 144Hz dt = 0.0069s)
    const dt = 1 / 144;
    sm.updateCamera(10, 20, dt);
    const target1 = sm.getCameraTarget();

    // Lerp factor is dt * 28 = ~0.194
    expect(target1.x).toBeGreaterThan(0);
    expect(target1.x).toBeLessThan(10);
    expect(target1.z).toBeGreaterThan(0);
    expect(target1.z).toBeLessThan(20);

    // After many 144Hz frames, it converges to target
    for (let i = 0; i < 60; i++) {
      sm.updateCamera(10, 20, dt);
    }
    const finalTarget = sm.getCameraTarget();
    expect(finalTarget.x).toBeCloseTo(10, 2);
    expect(finalTarget.z).toBeCloseTo(20, 2);
  });
});
