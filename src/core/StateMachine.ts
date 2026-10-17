import type { GameMode } from './types';

export type StateTransitionTable<T extends string> = {
  [from in T]: readonly T[];
};

export const GAME_MODE_TRANSITIONS: StateTransitionTable<GameMode> = {
  title: ['playing'],
  playing: ['paused', 'levelup', 'vault', 'gameover', 'victory'],
  paused: ['playing', 'title'],
  levelup: ['playing'],
  vault: ['playing'],
  gameover: ['title'],
  victory: ['title', 'playing']
};

export function isDev(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return Boolean(import.meta.env.DEV);
    }
  } catch {
    // Ignore environment resolution errors
  }
  return false;
}

export class StateMachine<T extends string = GameMode> {
  private current: T;
  private readonly transitions: StateTransitionTable<T>;
  private readonly onTransition?: (from: T, to: T) => void;
  public throwInDev: boolean;

  constructor(
    initialState: T,
    transitions: StateTransitionTable<T>,
    onTransition?: (from: T, to: T) => void,
    throwInDev = isDev()
  ) {
    this.current = initialState;
    this.transitions = transitions;
    this.onTransition = onTransition;
    this.throwInDev = throwInDev;
  }

  public getState(): T {
    return this.current;
  }

  public reset(state: T): void {
    this.current = state;
  }

  public canTransition(to: T): boolean {
    if (this.current === to) return true;
    const allowed = this.transitions[this.current];
    return allowed ? allowed.includes(to) : false;
  }

  public transition(to: T): boolean {
    if (this.current === to) {
      return true;
    }
    const allowed = this.transitions[this.current];
    if (!allowed || !allowed.includes(to)) {
      if (this.throwInDev) {
        throw new Error(`Illegal state transition from '${this.current}' to '${to}'`);
      }
      return false;
    }
    const from = this.current;
    this.current = to;
    this.onTransition?.(from, to);
    return true;
  }
}
