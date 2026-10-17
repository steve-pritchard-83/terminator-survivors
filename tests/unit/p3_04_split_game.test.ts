import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from '../../src/core/Game';
import { RunController } from '../../src/core/RunController';
import { InputRouter } from '../../src/core/InputRouter';
import { DebugAPI } from '../../src/core/DebugAPI';
import { globalEvents } from '../../src/core/EventBus';
import fs from 'fs';
import path from 'path';

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

describe('P3-04 Split Game.ts into RunController, InputRouter, DebugAPI', () => {
  let root: HTMLElement;
  let game: Game;

  beforeEach(() => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    Element.prototype.scrollIntoView = vi.fn();
    root = document.createElement('div');
    game = new Game(root);
  });

  afterEach(() => {
    game.debugAPI?.dispose();
    game.runController.dispose();
  });

  it('ensures Game.ts has fewer than 200 lines and constructor wires components', () => {
    const gameFilePath = path.resolve(__dirname, '../../src/core/Game.ts');
    const content = fs.readFileSync(gameFilePath, 'utf-8');
    const lines = content.split('\n');
    expect(lines.length).toBeLessThan(200);

    expect(game.runController).toBeInstanceOf(RunController);
    expect(game.inputRouter).toBeInstanceOf(InputRouter);
    expect(game.debugAPI).toBeInstanceOf(DebugAPI);
    expect(game.runState).toBeDefined();
    expect(game.playerSystem).toBeDefined();
    expect(game.weaponSystem).toBeDefined();
    expect(game.enemySystem).toBeDefined();
  });

  describe('RunController flow', () => {
    it('manages run start and transitions runState to playing mode', () => {
      expect(game.runState.mode).toBe('title');
      game.startRun('reese_2029', 123456);

      expect(game.runState.mode).toBe('playing');
      expect(game.runState.seed).toBe(123456);
      expect(game.runState.weapons.size).toBeGreaterThan(0);
    });

    it('manages pause, resume, and abortToTitle transitions', () => {
      game.startRun('reese_2029', 123456);
      expect(game.runState.mode).toBe('playing');

      game.pauseGame();
      expect(game.runState.mode).toBe('paused');

      game.resumeFromPause();
      expect(game.runState.mode).toBe('playing');

      game.togglePause();
      expect(game.runState.mode).toBe('paused');

      game.abortToTitle();
      expect(game.runState.mode).toBe('title');
    });

    it('handles level-up modal flow and queues multiple level-ups', () => {
      game.startRun('reese_2029', 123456);
      const levelUpSpy = vi.spyOn(game.uiManager.levelUpModal, 'show');

      game.runState.pendingLevelUps = 2;
      game.runController.update(0.016);

      expect(game.runState.mode).toBe('levelup');
      expect(levelUpSpy).toHaveBeenCalledTimes(1);

      // Simulate player choosing an upgrade from the modal
      const choiceCallback = levelUpSpy.mock.calls[0][2];
      choiceCallback({
        kind: 'passive',
        id: 'might_shells',
        title: 'Might Shells',
        subtitle: 'Passive',
        currentLevel: 0,
        nextLevel: 1,
        description: '+10% Damage',
        accentColor: '#ff0000'
      });

      // Since pendingLevelUps was 2, one remains and should immediately prompt next level-up
      expect(game.runState.mode).toBe('levelup');
      expect(levelUpSpy).toHaveBeenCalledTimes(2);

      // Choose second upgrade
      const choiceCallback2 = levelUpSpy.mock.calls[1][2];
      choiceCallback2({
        kind: 'passive',
        id: 'blast_radius',
        title: 'Blast Radius',
        subtitle: 'Passive',
        currentLevel: 0,
        nextLevel: 1,
        description: '+15% Area',
        accentColor: '#ffaa00'
      });

      // No more pending level-ups -> resumes playing
      expect(game.runState.mode).toBe('playing');
    });

    it('handles vault opened modal and queues 3 bonus upgrades when weapon does not evolve', () => {
      game.startRun('reese_2029', 123456);
      const vaultSpy = vi.spyOn(game.uiManager.vaultModal, 'show');
      const levelUpSpy = vi.spyOn(game.uiManager.levelUpModal, 'show');

      globalEvents.emit('vault:opened', {
        upgradesAwarded: 3,
        evolvedWeapon: undefined,
        alloyBonus: 50
      });

      expect(game.runState.mode).toBe('vault');
      expect(vaultSpy).toHaveBeenCalledTimes(1);

      // Simulate user closing vault modal
      const onDismiss = vaultSpy.mock.calls[0][3];
      onDismiss();

      // Non-evolved vault awards 3 pending level-ups; one is immediately presented
      expect(game.runState.mode).toBe('levelup');
      expect(levelUpSpy).toHaveBeenCalledTimes(1);
    });

    it('tracks active boss telemetry and ends run on skynet core defeat', () => {
      game.startRun('reese_2029', 123456);
      expect(game.activeBoss).toBeNull();

      globalEvents.emit('boss:spawned', {
        archetype: 'hk_aerial',
        name: 'HK Aerial Overseer',
        maxHp: 5000
      });

      expect(game.activeBoss).toEqual({
        name: 'HK Aerial Overseer',
        hp: 5000,
        maxHp: 5000
      });

      // Defeating boss clears activeBoss
      globalEvents.emit('enemy:killed', {
        enemy: { isBoss: true, archetype: 'hk_aerial', hp: 0 } as any,
        x: 0,
        z: 0,
        xp: 100
      });
      expect(game.activeBoss).toBeNull();
      expect(game.runState.mode).toBe('playing');

      // Defeating Skynet Core ends run with victory
      globalEvents.emit('enemy:killed', {
        enemy: { isBoss: true, archetype: 'skynet_tde_core', hp: 0 } as any,
        x: 0,
        z: 0,
        xp: 500
      });
      expect(game.runState.mode).toBe('victory');
    });

    it('resolves lethal damage by triggering revival or game over', () => {
      game.startRun('reese_2029', 123456);
      game.runState.revivalsLeft = 1;
      game.runState.hp = 0;

      // With 1 revival left, update resolves to revived
      game.runController.update(0.016);
      expect(game.runState.revivalsLeft).toBe(0);
      expect(game.runState.hp).toBeGreaterThan(0);
      expect(game.runState.mode).toBe('playing');

      // Drop HP to 0 again with 0 revivals left
      game.runState.hp = 0;
      game.runController.update(0.016);
      expect(game.runState.mode).toBe('gameover');
    });
  });

  describe('InputRouter', () => {
    it('returns zero movement and null aim when mode is not playing', () => {
      expect(game.runState.mode).toBe('title');
      const input = game.inputRouter.update(0.016);
      expect(input.move).toEqual({ x: 0, z: 0 });
      expect(input.aim).toBeNull();
    });

    it('translates mouse aim into aim angle during gameplay', () => {
      game.startRun('reese_2029', 123456);
      vi.spyOn(game.inputManager, 'isMouseAimActive').mockReturnValue(true);
      vi.spyOn(game.inputManager, 'getMouseScreenPos').mockReturnValue({ x: 400, y: 300 });
      vi.spyOn(game.sceneManager, 'screenToWorldGround').mockReturnValue({ x: 10, y: 0, z: 0 } as any);

      const input = game.inputRouter.update(0.016);
      expect(input.aim).not.toBeNull();
      expect(typeof input.aim).toBe('number');
    });

    it('consumes dash requests and triggers combat dive', () => {
      game.startRun('reese_2029', 123456);
      const dashAudioSpy = vi.spyOn(game.audioEngine, 'playCombatDive');

      // Request dash
      (game.inputManager as any).dashRequested = true;
      game.inputRouter.update(0.016);

      expect(game.runState.isDashing).toBe(true);
      expect(dashAudioSpy).toHaveBeenCalled();
    });
  });

  describe('DebugAPI', () => {
    it('provides telemetry and debug controls on window.__GAME_DEBUG__', () => {
      const debugApi = window.__GAME_DEBUG__;
      expect(debugApi).toBeDefined();

      game.startRun('reese_2029', 123456);
      const state = debugApi?.getState();
      expect(state?.mode).toBe('playing');
      expect(state?.seed).toBe(123456);

      // Fast forward time
      debugApi?.fastForward(10);
      expect(game.runState.timeSeconds).toBe(10);

      // Set god mode
      debugApi?.setGodMode(true);
      expect(game.runState.godMode).toBe(true);

      // Grant XP
      debugApi?.grantXp(500);
      expect(game.runState.xp).toBeGreaterThan(0);
    });
  });
});
