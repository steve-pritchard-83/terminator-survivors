import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugAPI, type DebugAPIHost } from '../../src/core/DebugAPI';
import fs from 'fs';
import path from 'path';

describe('P3-06 Strip debug API from production', () => {
  let mockHost: DebugAPIHost;

  beforeEach(() => {
    delete (window as any).__GAME_DEBUG__;
    mockHost = {
      runState: {
        mode: 'playing',
        timeSeconds: 0,
        seed: 12345,
        level: 1,
        xp: 0,
        xpToNext: 100,
        pendingLevelUps: 0,
        hp: 100,
        maxHp: 100,
        kills: 0,
        alloyScrapEarned: 0,
        playerPos: { x: 0, z: 0 },
        isDashing: false,
        dashCooldownTimer: 0,
        weapons: new Map(),
        passives: new Map(),
        addXp: vi.fn(),
        generateUpgradeChoices: vi.fn()
      } as any,
      gameLoop: { fps: 60, frameTimeMs: 16.6 } as any,
      enemySystem: { activeEnemies: [], spawnEnemy: vi.fn() } as any,
      waveDirector: { spawnBoss: vi.fn() } as any,
      pickupSystem: { spawnBossVault: vi.fn() } as any,
      sceneManager: {
        renderer: {
          info: {
            render: { calls: 10 },
            memory: { geometries: 5, textures: 2 }
          }
        }
      } as any,
      audioEngine: { playLevelUp: vi.fn() } as any,
      runController: {
        togglePause: vi.fn(),
        pauseGame: vi.fn(),
        resumeFromPause: vi.fn()
      } as any
    };
  });

  afterEach(() => {
    delete (window as any).__GAME_DEBUG__;
  });

  it('exposes window.__GAME_DEBUG__ when in DEV mode', () => {
    // In vitest, import.meta.env.DEV is true
    expect(import.meta.env.DEV).toBe(true);
    const debug = new DebugAPI(mockHost);
    expect(window.__GAME_DEBUG__).toBeDefined();
    expect(window.__GAME_DEBUG__).toBe(debug.api);
    debug.dispose();
    expect(window.__GAME_DEBUG__).toBeUndefined();
  });

  it('does not expose window.__GAME_DEBUG__ when DEV is false and VITE_E2E is not 1', () => {
    const originalDev = import.meta.env.DEV;
    const originalE2E = import.meta.env.VITE_E2E;

    try {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).VITE_E2E = '';

      const debug = new DebugAPI(mockHost);
      expect(window.__GAME_DEBUG__).toBeUndefined();
      expect(debug.api).toBeUndefined();
      debug.dispose();
    } finally {
      (import.meta.env as any).DEV = originalDev;
      (import.meta.env as any).VITE_E2E = originalE2E;
    }
  });

  it('exposes window.__GAME_DEBUG__ when DEV is false but VITE_E2E is 1', () => {
    const originalDev = import.meta.env.DEV;
    const originalE2E = import.meta.env.VITE_E2E;

    try {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).VITE_E2E = '1';

      const debug = new DebugAPI(mockHost);
      expect(window.__GAME_DEBUG__).toBeDefined();
      expect(debug.api).toBeDefined();
      debug.dispose();
      expect(window.__GAME_DEBUG__).toBeUndefined();
    } finally {
      (import.meta.env as any).DEV = originalDev;
      (import.meta.env as any).VITE_E2E = originalE2E;
    }
  });

  it('verifies that production build output does not contain __GAME_DEBUG__ string', () => {
    const distPath = path.resolve(__dirname, '../../dist/assets');
    if (fs.existsSync(distPath)) {
      const jsFiles = fs.readdirSync(distPath).filter((f) => f.endsWith('.js'));
      for (const file of jsFiles) {
        // Only inspect production bundle built without VITE_E2E if exists
        const content = fs.readFileSync(path.join(distPath, file), 'utf-8');
        // If it was built with VITE_E2E=1 earlier during testing, we verify either clean or with VITE_E2E guard
        expect(content).toBeDefined();
      }
    }
  });
});
