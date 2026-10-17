import { describe, it, expect, vi } from 'vitest';
import { StateMachine, GAME_MODE_TRANSITIONS } from '../../src/core/StateMachine';
import { RunState } from '../../src/state/RunState';
import type { GameMode } from '../../src/core/types';

describe('P3-01 game state machine replacing isPaused', () => {
  const ALL_MODES: GameMode[] = [
    'title',
    'playing',
    'levelup',
    'vault',
    'paused',
    'gameover',
    'victory'
  ];

  describe('49-cell transition matrix test (all from x to combinations)', () => {
    ALL_MODES.forEach((from) => {
      ALL_MODES.forEach((to) => {
        const isSelf = from === to;
        const allowedTargets = GAME_MODE_TRANSITIONS[from];
        const isAllowed = isSelf || (allowedTargets && allowedTargets.includes(to));

        it(`evaluates transition from '${from}' to '${to}' (expected: ${isAllowed ? 'ALLOWED' : 'FORBIDDEN'})`, () => {
          // Dev mode: throws on illegal, succeeds on legal
          const devMachine = new StateMachine<GameMode>(from, GAME_MODE_TRANSITIONS, undefined, true);
          expect(devMachine.canTransition(to)).toBe(Boolean(isAllowed));

          if (isAllowed) {
            expect(devMachine.transition(to)).toBe(true);
            expect(devMachine.getState()).toBe(to);
          } else {
            expect(() => devMachine.transition(to)).toThrowError(
              `Illegal state transition from '${from}' to '${to}'`
            );
            expect(devMachine.getState()).toBe(from);
          }

          // Prod mode: returns false on illegal without throwing
          const prodMachine = new StateMachine<GameMode>(from, GAME_MODE_TRANSITIONS, undefined, false);
          if (isAllowed) {
            expect(prodMachine.transition(to)).toBe(true);
            expect(prodMachine.getState()).toBe(to);
          } else {
            expect(prodMachine.transition(to)).toBe(false);
            expect(prodMachine.getState()).toBe(from);
          }
        });
      });
    });
  });

  describe('StateMachine lifecycle & callbacks', () => {
    it('notifies onTransition callback only on actual state changes', () => {
      const onTransition = vi.fn();
      const sm = new StateMachine<GameMode>('title', GAME_MODE_TRANSITIONS, onTransition, true);

      sm.transition('playing');
      expect(onTransition).toHaveBeenCalledTimes(1);
      expect(onTransition).toHaveBeenCalledWith('title', 'playing');

      // Self-transition does not trigger onTransition
      sm.transition('playing');
      expect(onTransition).toHaveBeenCalledTimes(1);
    });

    it('allows unconditional state reset via reset()', () => {
      const sm = new StateMachine<GameMode>('gameover', GAME_MODE_TRANSITIONS, undefined, true);
      sm.reset('playing');
      expect(sm.getState()).toBe('playing');
    });
  });

  describe('RunState integration with StateMachine', () => {
    it('defaults to title mode on initialization', () => {
      const runState = new RunState();
      expect(runState.mode).toBe('title');
    });

    it('transitions cleanly through normal gameplay loop', () => {
      const runState = new RunState();
      runState.stateMachine.throwInDev = true;

      // Start run
      runState.initRun('reese_2029', {});
      expect(runState.mode).toBe('playing');

      // Pause and resume
      runState.mode = 'paused';
      expect(runState.mode).toBe('paused');
      runState.mode = 'playing';
      expect(runState.mode).toBe('playing');

      // Level-up modal
      runState.mode = 'levelup';
      expect(runState.mode).toBe('levelup');
      runState.mode = 'playing';
      expect(runState.mode).toBe('playing');

      // Vault modal
      runState.mode = 'vault';
      expect(runState.mode).toBe('vault');
      runState.mode = 'playing';
      expect(runState.mode).toBe('playing');

      // Gameover and return to title
      runState.mode = 'gameover';
      expect(runState.mode).toBe('gameover');
      runState.mode = 'title';
      expect(runState.mode).toBe('title');
    });

    it('enforces transition guards and throws in dev on illegal transition', () => {
      const runState = new RunState();
      runState.stateMachine.throwInDev = true;
      expect(runState.mode).toBe('title');

      expect(() => {
        runState.mode = 'gameover';
      }).toThrowError("Illegal state transition from 'title' to 'gameover'");
    });

    it('re-initializes run state cleanly from gameover or victory without throwing', () => {
      const runState = new RunState();
      runState.stateMachine.throwInDev = true;
      runState.initRun('reese_2029', {});
      runState.mode = 'victory';

      // initRun resets to title then transitions to playing
      expect(() => {
        runState.initRun('reese_2029', {});
      }).not.toThrow();
      expect(runState.mode).toBe('playing');
    });
  });
});
