import { describe, it, expect } from 'vitest';
import { RunState } from '../../src/state/RunState';

describe('P1-02 revivals', () => {
  it('does not refill consumed revivals when an in-run passive is applied', () => {
    const runState = new RunState();
    // Start with 1 revival from defibrillator meta-upgrade
    runState.initRun('reese_2029', { defibrillator: 1 });
    expect(runState.revivalsLeft).toBe(1);

    // Take lethal damage and consume revival
    runState.takeDamage(999);
    const result = runState.resolveLethalDamage();
    expect(result).toBe('revived');
    expect(runState.revivalsLeft).toBe(0);

    // Apply an in-run passive upgrade (e.g., High-Brass Shells / might_shells)
    runState.applyUpgrade({
      kind: 'passive',
      id: 'might_shells',
      title: 'High-Brass Shells',
      subtitle: '',
      currentLevel: 0,
      nextLevel: 1,
      description: '+12% damage to all weapons.',
      accentColor: '#ff9900'
    });

    // Used revival must NOT refill back to 1!
    expect(runState.revivalsLeft).toBe(0);
  });

  it('resets revivalsLeft cleanly across runs with no state leakage', () => {
    const runState = new RunState();
    // Run 1: has 2 revivals, ends without consuming them
    runState.initRun('reese_2029', { defibrillator: 2 });
    expect(runState.revivalsLeft).toBe(2);

    // Run 2: starts with 0 revivals
    runState.initRun('reese_2029', {});
    expect(runState.revivalsLeft).toBe(0);
  });
});
