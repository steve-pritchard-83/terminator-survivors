import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, globalEvents } from '../../src/core/EventBus';
import { PickupSystem } from '../../src/systems/PickupSystem';
import { RunState } from '../../src/state/RunState';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { Game } from '../../src/core/Game';

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
    info = {
      render: { calls: 42, lines: 0, triangles: 1200, points: 0 },
      memory: { geometries: 15, textures: 8 }
    };
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
      setPixelRatio = vi.fn();
      update = vi.fn();
      render = vi.fn();
      triggerEmpGlitch = vi.fn();
      triggerDamageFlash = vi.fn();
    }
  };
});

describe('P3-05 Event subscription hygiene', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    Element.prototype.scrollIntoView = vi.fn();
    globalEvents.clear();
  });

  afterEach(() => {
    globalEvents.clear();
  });

  describe('EventBus listenerCount', () => {
    it('accurately reports listener count when adding and removing listeners', () => {
      const bus = new EventBus();
      expect(bus.listenerCount('enemy:killed')).toBe(0);

      const unbind1 = bus.on('enemy:killed', () => {});
      expect(bus.listenerCount('enemy:killed')).toBe(1);

      const unbind2 = bus.on('enemy:killed', () => {});
      expect(bus.listenerCount('enemy:killed')).toBe(2);

      unbind1();
      expect(bus.listenerCount('enemy:killed')).toBe(1);

      unbind2();
      expect(bus.listenerCount('enemy:killed')).toBe(0);
    });
  });

  describe('PickupSystem disposal and event cleanup', () => {
    it('constructs and disposes PickupSystem leaving listenerCount at 0', () => {
      const runState = new RunState();
      const audio = new AudioEngine();

      expect(globalEvents.listenerCount('enemy:killed')).toBe(0);
      expect(globalEvents.listenerCount('crate:destroyed')).toBe(0);

      const system = new PickupSystem(runState, audio);
      expect(globalEvents.listenerCount('enemy:killed')).toBe(1);
      expect(globalEvents.listenerCount('crate:destroyed')).toBe(1);

      system.dispose();
      expect(globalEvents.listenerCount('enemy:killed')).toBe(0);
      expect(globalEvents.listenerCount('crate:destroyed')).toBe(0);
    });

    it('constructing and disposing PickupSystem twice leaves listenerCount(enemy:killed) === 0', () => {
      const runState = new RunState();
      const audio = new AudioEngine();

      expect(globalEvents.listenerCount('enemy:killed')).toBe(0);

      const system1 = new PickupSystem(runState, audio);
      expect(globalEvents.listenerCount('enemy:killed')).toBe(1);
      system1.dispose();
      expect(globalEvents.listenerCount('enemy:killed')).toBe(0);

      const system2 = new PickupSystem(runState, audio);
      expect(globalEvents.listenerCount('enemy:killed')).toBe(1);
      system2.dispose();
      expect(globalEvents.listenerCount('enemy:killed')).toBe(0);
    });
  });

  describe('Game disposal cleanup', () => {
    it('constructing and disposing Game leaves all event subscriptions cleaned up', () => {
      const root = document.createElement('div');
      const game = new Game(root);

      expect(globalEvents.listenerCount('enemy:killed')).toBeGreaterThan(0);
      expect(globalEvents.listenerCount('levelup:triggered')).toBeGreaterThan(0);
      expect(globalEvents.listenerCount('vault:opened')).toBeGreaterThan(0);
      expect(globalEvents.listenerCount('boss:spawned')).toBeGreaterThan(0);

      game.dispose();

      expect(globalEvents.listenerCount('enemy:killed')).toBe(0);
      expect(globalEvents.listenerCount('crate:destroyed')).toBe(0);
      expect(globalEvents.listenerCount('levelup:triggered')).toBe(0);
      expect(globalEvents.listenerCount('vault:opened')).toBe(0);
      expect(globalEvents.listenerCount('boss:spawned')).toBe(0);
      expect(globalEvents.listenerCount('camera:shake')).toBe(0);
      expect(globalEvents.listenerCount('player:damaged')).toBe(0);
      expect(globalEvents.listenerCount('enemy:damaged')).toBe(0);
      expect(globalEvents.listenerCount('pickup:reward')).toBe(0);
    });
  });
});
