import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneManager } from '../../src/graphics/SceneManager';

let mockSetPixelRatio: any;
let mockPostProcessingSetSize: any;
let mockPostProcessingSetPixelRatio: any;

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    private pixelRatio = 1.5;
    setSize = vi.fn();
    setPixelRatio = vi.fn((ratio: number) => {
      this.pixelRatio = ratio;
      mockSetPixelRatio?.(ratio);
    });
    getPixelRatio = () => this.pixelRatio;
    render = vi.fn();
    dispose = vi.fn();
    toneMapping = 0;
    toneMappingExposure = 1;
    shadowMap = { enabled: false };
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});

vi.mock('../../src/graphics/PostProcessing', () => {
  return {
    PostProcessingManager: class {
      setSize = vi.fn((w: number, h: number) => {
        mockPostProcessingSetSize?.(w, h);
      });
      setPixelRatio = vi.fn((ratio: number) => {
        mockPostProcessingSetPixelRatio?.(ratio);
      });
      setBloomEnabled = vi.fn();
      update = vi.fn();
      render = vi.fn();
      triggerEmpGlitch = vi.fn();
      triggerDamageFlash = vi.fn();
    }
  };
});

describe('P1-10 quality governor hysteresis and sizing (fixes B8)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1.5, configurable: true });
    mockSetPixelRatio = vi.fn();
    mockPostProcessingSetSize = vi.fn();
    mockPostProcessingSetPixelRatio = vi.fn();
  });

  it('does not drop quality when low FPS lasts less than 3 consecutive seconds', () => {
    const container = document.createElement('div');
    const sm = new SceneManager(container);
    expect(sm.renderer.getPixelRatio()).toBe(1.5);
    mockSetPixelRatio.mockClear();

    // Run low FPS for 2.5 seconds (dt = 0.5s x 5 ticks)
    for (let i = 0; i < 5; i++) {
      sm.adjustQuality(30, 0.5);
    }

    const state = sm.getQualityGovernorState();
    expect(state.lowFpsDuration).toBeCloseTo(2.5, 2);
    expect(state.pixelRatio).toBe(1.5);
    expect(mockSetPixelRatio).not.toHaveBeenCalled();
  });

  it('resets low FPS duration when FPS recovers before 3 seconds (suppressing oscillation)', () => {
    const container = document.createElement('div');
    const sm = new SceneManager(container);

    // Low FPS for 2 seconds
    for (let i = 0; i < 4; i++) {
      sm.adjustQuality(35, 0.5);
    }
    expect(sm.getQualityGovernorState().lowFpsDuration).toBeCloseTo(2.0, 2);

    // Frame with normal FPS (48) resets low FPS counter
    sm.adjustQuality(48, 0.5);
    expect(sm.getQualityGovernorState().lowFpsDuration).toBe(0);
    expect(sm.renderer.getPixelRatio()).toBe(1.5);
  });

  it('drops quality to 1.0 after 3 consecutive seconds of low FPS and resizes post-processing and composer', () => {
    const container = document.createElement('div');
    const sm = new SceneManager(container);

    // 3.0 consecutive seconds of 30 FPS
    for (let i = 0; i < 6; i++) {
      sm.adjustQuality(30, 0.5);
    }

    expect(sm.renderer.getPixelRatio()).toBe(1.0);
    expect(mockSetPixelRatio).toHaveBeenCalledWith(1.0);
    expect(mockPostProcessingSetPixelRatio).toHaveBeenCalledWith(1.0);
    expect(mockPostProcessingSetSize).toHaveBeenCalled();

    // Cooldown must now be set to 5 seconds
    const state = sm.getQualityGovernorState();
    expect(state.cooldownTimer).toBeCloseTo(5.0, 2);
  });

  it('enforces 5-second cooldown before allowing another quality change', () => {
    const container = document.createElement('div');
    const sm = new SceneManager(container);

    // Trigger drop to 1.0
    for (let i = 0; i < 6; i++) {
      sm.adjustQuality(30, 0.5);
    }
    expect(sm.renderer.getPixelRatio()).toBe(1.0);
    mockSetPixelRatio.mockClear();

    // Now FPS jumps back to 60 for 3 seconds, but cooldown is 5s
    for (let i = 0; i < 6; i++) {
      sm.adjustQuality(60, 0.5);
    }
    // High FPS timer accumulated 3s, but cooldown still has 2s left (5s - 3s = 2s)
    expect(sm.renderer.getPixelRatio()).toBe(1.0);
    expect(mockSetPixelRatio).not.toHaveBeenCalled();

    // Advance remaining 2 seconds of cooldown with high FPS
    for (let i = 0; i < 4; i++) {
      sm.adjustQuality(60, 0.5);
    }

    // Now cooldown expired and high FPS is sustained -> quality restores to 1.5
    expect(sm.renderer.getPixelRatio()).toBe(1.5);
    expect(mockSetPixelRatio).toHaveBeenCalledWith(1.5);
    expect(mockPostProcessingSetPixelRatio).toHaveBeenCalledWith(1.5);
  });
});
