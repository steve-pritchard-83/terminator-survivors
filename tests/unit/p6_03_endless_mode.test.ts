import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunState } from '../../src/state/RunState';
import { WaveDirector } from '../../src/systems/WaveDirector';
import { SaveManager } from '../../src/state/SaveManager';
import { EndRunModal } from '../../src/ui/EndRunModal';
import { WAVE_TIMELINE, RUN_DURATION_MINUTES } from '../../src/data/waves';

describe('P6-03: Endless Mode Mechanics & High-Scores', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('RunState manages isEndless flag and resets on initRun', () => {
    const runState = new RunState();
    expect(runState.isEndless).toBe(false);

    runState.isEndless = true;
    expect(runState.isEndless).toBe(true);

    runState.initRun('reese_2029', {});
    expect(runState.isEndless).toBe(false);
  });

  it('WaveDirector caps at 10 minutes normally, but allows unlimited progression in endless mode', () => {
    const runState = new RunState();
    runState.mode = 'playing';
    const mockEnemySystem = {
      activeEnemies: [],
      spawnEnemy: vi.fn(() => ({ maxHp: 5000 })),
      clear: vi.fn()
    } as any;

    const director = new WaveDirector(runState, mockEnemySystem);

    // 1. Normal mode at minute 12 (720 seconds) caps at RUN_DURATION_MINUTES (10)
    runState.timeSeconds = 720;
    director.update(0.1);
    expect((director as any).currentMinute).toBe(RUN_DURATION_MINUTES);

    // 2. Enable endless mode at minute 12 (720s) -> currentMinute advances to 12
    director.reset();
    runState.isEndless = true;
    runState.timeSeconds = 720;
    director.update(0.1);
    expect((director as any).currentMinute).toBe(12);
  });

  it('scales enemy HP and damage exponentially by 1.15x compound per minute past minute 10', () => {
    const runState = new RunState();
    runState.mode = 'playing';
    runState.isEndless = true;
    runState.timeSeconds = 720; // Minute 12 (2 minutes past 10)

    let spawnedHpMult = 0;
    let spawnedDmgMult = 0;

    const mockEnemySystem = {
      activeEnemies: [],
      spawnEnemy: vi.fn((_arch, _x, _z, hpMult, dmgMult) => {
        spawnedHpMult = hpMult;
        spawnedDmgMult = dmgMult;
      }),
      clear: vi.fn()
    } as any;

    const director = new WaveDirector(runState, mockEnemySystem);
    // Force spawn timer to trigger
    (director as any).spawnTimer = 999;
    director.update(0.1);

    const baseEntry = WAVE_TIMELINE[10];
    const expectedScale = Math.pow(1.15, 2);
    expect(spawnedHpMult).toBeCloseTo(baseEntry.hpMultiplier * expectedScale, 2);
    expect(spawnedDmgMult).toBeCloseTo(baseEntry.damageMultiplier * expectedScale, 2);
  });

  it('spawns rotating machine bosses every 3 minutes past minute 10', () => {
    const runState = new RunState();
    runState.mode = 'playing';
    runState.isEndless = true;

    const spawnedBosses: string[] = [];
    const mockEnemySystem = {
      activeEnemies: [],
      spawnEnemy: vi.fn((arch) => {
        spawnedBosses.push(arch);
        return { maxHp: 5000 };
      }),
      clear: vi.fn()
    } as any;

    const director = new WaveDirector(runState, mockEnemySystem);

    // Minute 13: first rotating boss (13 - 10 = 3 => % 3 === 0) -> hk_aerial_squadron_leader
    runState.timeSeconds = 13 * 60;
    director.update(0.1);

    expect(spawnedBosses).toContain('hk_aerial_squadron_leader');

    // Minute 16: second rotating boss -> hk_tank_goliath
    runState.timeSeconds = 16 * 60;
    director.update(0.1);

    expect(spawnedBosses).toContain('hk_tank_goliath');
  });

  it('SaveManager tracks and updates endless high scores', () => {
    const sm = new SaveManager();
    const data = sm.getData();
    expect(data.endlessHighScores).toBeDefined();
    expect(data.endlessHighScores?.bestTimeSeconds).toBe(0);

    // Record run 1 in endless
    sm.addRunResults(150, 750, 200, false, 2, true);
    expect(sm.getData().endlessHighScores?.bestTimeSeconds).toBe(750);
    expect(sm.getData().endlessHighScores?.maxKills).toBe(150);
    expect(sm.getData().endlessHighScores?.maxScrap).toBe(200);

    // Record run 2 in endless with lower time but higher kills
    sm.addRunResults(220, 680, 150, false, 3, true);
    expect(sm.getData().endlessHighScores?.bestTimeSeconds).toBe(750); // Preserved best
    expect(sm.getData().endlessHighScores?.maxKills).toBe(220); // Updated higher kills
    expect(sm.getData().endlessHighScores?.maxScrap).toBe(200); // Preserved best
  });

  it('EndRunModal displays CONTINUE THE WAR option and handles activation', () => {
    const root = document.createElement('div');
    const modal = new EndRunModal(root);

    let continued = false;
    let returned = false;

    modal.show(
      true,
      600,
      100,
      15,
      250,
      12345,
      () => { returned = true; },
      () => { continued = true; }
    );

    const continueBtn = root.querySelector('#btn-continue-war') as HTMLElement;
    expect(continueBtn.style.display).toBe('block');

    continueBtn.click();
    expect(continued).toBe(true);
    expect(returned).toBe(false);
    expect(modal.isVisible()).toBe(false);
  });
});
