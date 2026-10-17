import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DamageNumbers } from '../../src/ui/DamageNumbers';

describe('P2-05 damage numbers', () => {
  let container: HTMLElement;
  let damageNumbers: DamageNumbers;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'floating-text-layer';
    document.body.appendChild(container);
    damageNumbers = new DamageNumbers(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('pre-allocates a bounded pool of 64 DOM elements and never exceeds 64 nodes', () => {
    expect(container.children.length).toBe(64);

    // Simulate 500 hits across 500 distinct enemy IDs in rapid succession
    for (let i = 0; i < 500; i++) {
      damageNumbers.onEnemyDamaged(10 + i, false, 100, 200, i + 1);
    }

    // DOM node count under #floating-text-layer must remain exactly 64
    expect(container.children.length).toBe(64);
    expect(damageNumbers.getActiveCount()).toBe(64);
  });

  it('does not invoke window.setTimeout during hit spawning or updates', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    for (let i = 0; i < 100; i++) {
      damageNumbers.onEnemyDamaged(25, i % 2 === 0, 150, 250, 42);
    }
    damageNumbers.spawnText('+10 ALLOY', '#00ff88', 120, 180);
    damageNumbers.update(0.05);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('aggregates hits on the same enemy within 0.15s into one number', () => {
    // Hit 1: 50 damage on enemy 77
    damageNumbers.onEnemyDamaged(50, false, 200, 300, 77);
    expect(damageNumbers.getActiveCount()).toBe(1);

    const activeEl = Array.from(container.children).find(
      (el) => (el as HTMLElement).style.display !== 'none'
    ) as HTMLElement;
    expect(activeEl).toBeDefined();
    expect(activeEl.textContent).toBe('-50');

    // Advance 0.05s (well within 0.15s window)
    damageNumbers.update(0.05);

    // Hit 2: 75 damage on enemy 77
    damageNumbers.onEnemyDamaged(75, false, 205, 305, 77);
    expect(damageNumbers.getActiveCount()).toBe(1);
    expect(activeEl.textContent).toBe('-125');

    // Hit 3: 40 crit damage on enemy 77
    damageNumbers.onEnemyDamaged(40, true, 210, 310, 77);
    expect(damageNumbers.getActiveCount()).toBe(1);
    expect(activeEl.textContent).toBe('-165 CRIT!');
    expect(activeEl.style.color).toBe('var(--color-amber)');
  });

  it('does not aggregate hits on the same enemy after 0.15s has elapsed', () => {
    damageNumbers.onEnemyDamaged(50, false, 100, 100, 88);
    expect(damageNumbers.getActiveCount()).toBe(1);

    // Advance time past the 0.15s aggregation window (e.g. 0.20s)
    damageNumbers.update(0.2);

    // Next hit on enemy 88 should create a second distinct number
    damageNumbers.onEnemyDamaged(30, false, 100, 100, 88);
    expect(damageNumbers.getActiveCount()).toBe(2);

    const visibleElements = Array.from(container.children).filter(
      (el) => (el as HTMLElement).style.display !== 'none'
    );
    expect(visibleElements.length).toBe(2);
    const texts = visibleElements.map((el) => el.textContent);
    expect(texts).toContain('-50');
    expect(texts).toContain('-30');
  });

  it('does not aggregate hits across different enemies', () => {
    damageNumbers.onEnemyDamaged(20, false, 100, 100, 1);
    damageNumbers.onEnemyDamaged(30, false, 150, 150, 2);

    expect(damageNumbers.getActiveCount()).toBe(2);
    const visibleElements = Array.from(container.children).filter(
      (el) => (el as HTMLElement).style.display !== 'none'
    );
    expect(visibleElements.length).toBe(2);
    expect(visibleElements.map((el) => el.textContent)).toEqual(['-20', '-30']);
  });

  it('respects damageNumbers setting mode (all, crits, off)', () => {
    // Mode: 'all' (default)
    expect(damageNumbers.getMode()).toBe('all');
    damageNumbers.onEnemyDamaged(15, false, 50, 50, 10);
    damageNumbers.onEnemyDamaged(35, true, 60, 60, 11);
    expect(damageNumbers.getActiveCount()).toBe(2);
    damageNumbers.clear();
    expect(damageNumbers.getActiveCount()).toBe(0);

    // Mode: 'crits'
    damageNumbers.setMode('crits');
    expect(damageNumbers.getMode()).toBe('crits');
    damageNumbers.onEnemyDamaged(15, false, 50, 50, 12); // should be dropped
    expect(damageNumbers.getActiveCount()).toBe(0);
    damageNumbers.onEnemyDamaged(50, true, 60, 60, 13); // should be displayed
    expect(damageNumbers.getActiveCount()).toBe(1);
    damageNumbers.clear();

    // Mode: 'off'
    damageNumbers.setMode('off');
    expect(damageNumbers.getMode()).toBe('off');
    damageNumbers.onEnemyDamaged(15, false, 50, 50, 14); // should be dropped
    damageNumbers.onEnemyDamaged(50, true, 60, 60, 15); // should be dropped
    expect(damageNumbers.getActiveCount()).toBe(0);
  });

  it('fades out and deactivates numbers after duration expires', () => {
    damageNumbers.onEnemyDamaged(40, false, 100, 100, 99);
    expect(damageNumbers.getActiveCount()).toBe(1);

    // Mid-lifetime: remains active with updated transform/opacity
    damageNumbers.update(0.4);
    expect(damageNumbers.getActiveCount()).toBe(1);

    // Duration expired (0.75s total duration)
    damageNumbers.update(0.4); // total 0.8s
    expect(damageNumbers.getActiveCount()).toBe(0);

    const visibleElements = Array.from(container.children).filter(
      (el) => (el as HTMLElement).style.display !== 'none'
    );
    expect(visibleElements.length).toBe(0);
  });

  it('supports spawnText for pickup notifications and clear() resets all slots', () => {
    damageNumbers.spawnText('CRATE REWARD', '#00ff88', 120, 220);
    expect(damageNumbers.getActiveCount()).toBe(1);

    damageNumbers.clear();
    expect(damageNumbers.getActiveCount()).toBe(0);
  });
});
