import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getQualityProfile,
  detectPresetFromFps
} from '../../src/graphics/qualityPresets';
import { SceneManager } from '../../src/graphics/SceneManager';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { SaveManager } from '../../src/state/SaveManager';
import { globalEvents } from '../../src/core/EventBus';

let mockSetPixelRatio: any;

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    private pixelRatio = 1.5;
    shadowMap = { enabled: false };
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
      setBloomEnabled = vi.fn();
      update = vi.fn();
      render = vi.fn();
      triggerEmpGlitch = vi.fn();
      triggerDamageFlash = vi.fn();
    }
  };
});

describe('P9-05: Quality Presets (Low / Medium / High / Ultra & 5s Auto-Detect)', () => {
  beforeEach(() => {
    mockSetPixelRatio = vi.fn();
  });

  it('defines distinct profiles for Low, Medium, High, and Ultra with valid caps and flags', () => {
    const low = getQualityProfile('low');
    expect(low.pixelRatio).toBe(1.0);
    expect(low.bloom).toBe(false);
    expect(low.shadows).toBe(false);
    expect(low.dynamicLights).toBe(false);
    expect(low.atmosphere).toBe(false);
    expect(low.particleCap).toBe(30);
    expect(low.debrisCap).toBe(12);

    const med = getQualityProfile('medium');
    expect(med.pixelRatio).toBe(1.25);
    expect(med.bloom).toBe(true);
    expect(med.shadows).toBe(false);
    expect(med.dynamicLights).toBe(true);
    expect(med.atmosphere).toBe(true);
    expect(med.particleCap).toBe(60);
    expect(med.debrisCap).toBe(24);

    const high = getQualityProfile('high');
    expect(high.pixelRatio).toBe(1.5);
    expect(high.bloom).toBe(true);
    expect(high.shadows).toBe(true);
    expect(high.dynamicLights).toBe(true);
    expect(high.atmosphere).toBe(true);
    expect(high.particleCap).toBe(100);
    expect(high.debrisCap).toBe(48);

    const ultra = getQualityProfile('ultra');
    expect(ultra.pixelRatio).toBe(2.0);
    expect(ultra.bloom).toBe(true);
    expect(ultra.shadows).toBe(true);
    expect(ultra.dynamicLights).toBe(true);
    expect(ultra.atmosphere).toBe(true);
    expect(ultra.particleCap).toBe(160);
    expect(ultra.debrisCap).toBe(72);
  });

  it('detectPresetFromFps classifies hardware accurately based on average FPS', () => {
    expect(detectPresetFromFps(60, 1)).toBe('high');
    expect(detectPresetFromFps(60, 2)).toBe('ultra');
    expect(detectPresetFromFps(50, 1)).toBe('medium');
    expect(detectPresetFromFps(35, 1)).toBe('low');
  });

  it('ParticleSystem updates particle and debris caps via quality:preset_changed event', () => {
    const particles = new ParticleSystem();

    globalEvents.emit('quality:preset_changed', { preset: 'low' });
    expect(particles.getCaps().particleCap).toBe(30);
    expect(particles.getCaps().debrisCap).toBe(12);

    globalEvents.emit('quality:preset_changed', { preset: 'ultra' });
    expect(particles.getCaps().particleCap).toBe(160);
    expect(particles.getCaps().debrisCap).toBe(72);

    particles.dispose();
  });

  it('SaveManager persists and sanitizes qualityPreset cleanly', () => {
    localStorage.clear();
    const saveManager = new SaveManager();

    expect(saveManager.getData().settings.qualityPreset).toBe('high');

    saveManager.updateSettings({
      ...saveManager.getData().settings,
      qualityPreset: 'medium'
    });
    expect(saveManager.getData().settings.qualityPreset).toBe('medium');

    // Reload save manager
    const reloaded = new SaveManager();
    expect(reloaded.getData().settings.qualityPreset).toBe('medium');
  });

  it('SceneManager automatically detects quality preset after first 5 seconds of FPS sampling', () => {
    const container = document.createElement('div');
    const sceneManager = new SceneManager(container);

    const detectedSpy = vi.fn();
    const unbind = globalEvents.on('quality:autodetected', detectedSpy);

    // Initial status: not detected yet
    expect(sceneManager.getAutoDetectionStatus().detected).toBe(false);

    // Feed 3 seconds of 35 FPS
    for (let i = 0; i < 30; i++) {
      sceneManager.adjustQuality(35, 0.1);
    }
    expect(sceneManager.getAutoDetectionStatus().detected).toBe(false);

    // Feed another 2.5 seconds of 35 FPS (total > 5.0 seconds)
    for (let i = 0; i < 25; i++) {
      sceneManager.adjustQuality(35, 0.1);
    }

    expect(sceneManager.getAutoDetectionStatus().detected).toBe(true);
    expect(detectedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'low'
      })
    );
    expect(sceneManager.getQualityPreset()).toBe('low');

    unbind();
    sceneManager.dispose();
  });
});
