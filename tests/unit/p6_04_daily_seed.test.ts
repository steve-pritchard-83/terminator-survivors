import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashDateStringToSeed,
  formatDateKey,
  getDailyOperation
} from '../../src/core/DailyOperation';
import { SaveManager } from '../../src/state/SaveManager';
import { RunState } from '../../src/state/RunState';
import { RunController } from '../../src/core/RunController';

describe('P6-04: Daily Seeded Operations', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('Deterministic Date Hashing and Config', () => {
    it('produces consistent 32-bit seed from date string', () => {
      const seed1 = hashDateStringToSeed('2026-10-18');
      const seed2 = hashDateStringToSeed('2026-10-18');
      const seedDiff = hashDateStringToSeed('2026-10-19');

      expect(seed1).toBe(seed2);
      expect(typeof seed1).toBe('number');
      expect(seed1).toBeGreaterThan(0);
      expect(seed1).not.toBe(seedDiff);
    });

    it('formats date into UTC YYYY-MM-DD correctly', () => {
      const fixedDate = new Date(Date.UTC(2029, 6, 11)); // July 11, 2029
      const key = formatDateKey(fixedDate);
      expect(key).toBe('2029-07-11');
    });

    it('generates deterministic daily operation with valid stage and loadout', () => {
      const fixedDate = new Date(Date.UTC(2029, 6, 11));
      const op1 = getDailyOperation(fixedDate);
      const op2 = getDailyOperation(fixedDate);

      expect(op1.dateKey).toBe('2029-07-11');
      expect(op1.seed).toBe(op2.seed);
      expect(op1.stageId).toBe(op2.stageId);
      expect(op1.loadoutId).toBe(op2.loadoutId);

      // Verify valid stage and loadout IDs
      const validStages = [
        'la_2029_wasteland',
        'cyberdyne_factory',
        'tech_noir_1984',
        'skynet_central_tde',
        'century_city_bunker'
      ];
      const validLoadouts = ['reese_2029', 'reese_1984', 'techcom_sapper', 'john_connor'];

      expect(validStages).toContain(op1.stageId);
      expect(validLoadouts).toContain(op1.loadoutId);
    });
  });

  describe('SaveManager Daily Tracking', () => {
    it('checks and records single daily attempt per date', () => {
      const sm = new SaveManager();
      const testDateKey = '2029-07-11';

      expect(sm.hasAttemptedDaily(testDateKey)).toBe(false);
      expect(sm.getDailyAttempt(testDateKey)).toBeNull();

      sm.recordDailyAttempt({
        dateKey: testDateKey,
        completed: true,
        score: 18500,
        timeSeconds: 600,
        kills: 350,
        alloyScrap: 280
      });

      expect(sm.hasAttemptedDaily(testDateKey)).toBe(true);
      const record = sm.getDailyAttempt(testDateKey);
      expect(record).toBeDefined();
      expect(record?.score).toBe(18500);
      expect(record?.completed).toBe(true);
      expect(record?.kills).toBe(350);
    });
  });

  describe('RunController Daily Integration', () => {
    it('initializes daily run and records daily score upon endRun', () => {
      const runState = new RunState();
      const saveManager = new SaveManager();
      const mockAudio = {
        playRunEnd: vi.fn(),
        stopMusic: vi.fn(),
        playHudScanClose: vi.fn()
      } as any;
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
      const dailyKey = '2029-07-11';

      // Start as daily run
      runState.initRun('reese_2029', {}, 99999, 'cyberdyne_factory');
      runState.isDailyOperation = true;
      runState.dailyDateKey = dailyKey;
      runState.timeSeconds = 500;
      runState.kills = 120;
      runState.alloyScrapEarned = 150;

      controller.endRun(true);

      expect(saveManager.hasAttemptedDaily(dailyKey)).toBe(true);
      const attempt = saveManager.getDailyAttempt(dailyKey);
      expect(attempt?.completed).toBe(true);
      expect(attempt?.timeSeconds).toBe(500);
      expect(attempt?.kills).toBe(120);
      expect(attempt?.score).toBe(500 * 10 + 120 * 25 + 150 * 2);

      controller.dispose();
    });
  });
});
