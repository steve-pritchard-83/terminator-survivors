export type DamageNumberMode = 'all' | 'crits' | 'off';

export interface DamageNumberSlot {
  element: HTMLDivElement;
  active: boolean;
  screenX: number;
  screenY: number;
  elapsed: number;
  duration: number;
  damageSum: number;
  isCrit: boolean;
  enemyId?: number;
  aggregateTimer: number;
}

export class DamageNumbers {
  public static readonly MAX_POOL_SIZE = 64;
  public static readonly AGGREGATE_WINDOW = 0.15; // 150 ms hit aggregation window
  public static readonly DURATION = 0.75; // 750 ms total lifetime

  private readonly pool: DamageNumberSlot[] = [];
  private readonly container: HTMLElement;
  private mode: DamageNumberMode = 'all';

  constructor(container: HTMLElement) {
    this.container = container;
    this.initPool();
  }

  private initPool(): void {
    for (let i = 0; i < DamageNumbers.MAX_POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'floating-text-callout';
      el.style.display = 'none';
      this.container.appendChild(el);

      this.pool.push({
        element: el,
        active: false,
        screenX: 0,
        screenY: 0,
        elapsed: 0,
        duration: DamageNumbers.DURATION,
        damageSum: 0,
        isCrit: false,
        enemyId: undefined,
        aggregateTimer: 0
      });
    }
  }

  public setMode(mode: DamageNumberMode): void {
    this.mode = mode;
  }

  public getMode(): DamageNumberMode {
    return this.mode;
  }

  public onEnemyDamaged(
    damage: number,
    isCrit: boolean,
    screenX: number,
    screenY: number,
    enemyId?: number
  ): void {
    if (this.mode === 'off') return;
    if (this.mode === 'crits' && !isCrit) return;

    // Check for active aggregate window on the same enemy
    if (enemyId !== undefined) {
      const existing = this.pool.find(
        (slot) => slot.active && slot.enemyId === enemyId && slot.aggregateTimer > 0
      );

      if (existing) {
        existing.damageSum += damage;
        if (isCrit) {
          existing.isCrit = true;
          existing.element.style.color = 'var(--color-amber)';
          existing.element.style.fontSize = '1.25rem';
        }
        existing.element.textContent = existing.isCrit
          ? `-${existing.damageSum} CRIT!`
          : `-${existing.damageSum}`;
        existing.screenX = screenX;
        existing.screenY = screenY;
        existing.aggregateTimer = DamageNumbers.AGGREGATE_WINDOW;
        // Reset elapsed slightly so the updated aggregate number pops and stays readable
        existing.elapsed = Math.min(existing.elapsed, 0.15);
        this.renderSlot(existing);
        return;
      }
    }

    // Allocate slot from pool
    const slot = this.acquireSlot();
    slot.active = true;
    slot.damageSum = damage;
    slot.isCrit = isCrit;
    slot.enemyId = enemyId;
    slot.aggregateTimer = DamageNumbers.AGGREGATE_WINDOW;
    slot.elapsed = 0;
    slot.duration = DamageNumbers.DURATION;
    slot.screenX = screenX;
    slot.screenY = screenY;

    const el = slot.element;
    el.textContent = isCrit ? `-${damage} CRIT!` : `-${damage}`;
    el.style.color = isCrit ? 'var(--color-amber)' : 'var(--color-chrome)';
    el.style.fontSize = isCrit ? '1.25rem' : '1.0rem';
    el.style.display = 'block';

    this.renderSlot(slot);
  }

  public spawnText(text: string, color: string, screenX: number, screenY: number): void {
    const slot = this.acquireSlot();
    slot.active = true;
    slot.damageSum = 0;
    slot.isCrit = false;
    slot.enemyId = undefined;
    slot.aggregateTimer = 0;
    slot.elapsed = 0;
    slot.duration = DamageNumbers.DURATION;
    slot.screenX = screenX;
    slot.screenY = screenY;

    const el = slot.element;
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = '1.0rem';
    el.style.display = 'block';

    this.renderSlot(slot);
  }

  private acquireSlot(): DamageNumberSlot {
    // 1. Look for inactive slot
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        return this.pool[i];
      }
    }

    // 2. All slots active: steal the oldest active slot (highest elapsed)
    let oldest = this.pool[0];
    for (let i = 1; i < this.pool.length; i++) {
      if (this.pool[i].elapsed > oldest.elapsed) {
        oldest = this.pool[i];
      }
    }
    return oldest;
  }

  public update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const slot = this.pool[i];
      if (!slot.active) continue;

      slot.elapsed += dt;
      if (slot.aggregateTimer > 0) {
        slot.aggregateTimer = Math.max(0, slot.aggregateTimer - dt);
      }

      if (slot.elapsed >= slot.duration) {
        this.deactivateSlot(slot);
      } else {
        this.renderSlot(slot);
      }
    }
  }

  private deactivateSlot(slot: DamageNumberSlot): void {
    slot.active = false;
    slot.enemyId = undefined;
    slot.aggregateTimer = 0;
    slot.element.style.display = 'none';
  }

  private renderSlot(slot: DamageNumberSlot): void {
    const t = Math.min(1.0, slot.elapsed / slot.duration);
    // Ease out upwards motion: -36px over lifetime
    const yOffset = -36 * (1 - (1 - t) * (1 - t));

    // Scale: pop up to 1.15 at t=0.25, then settle to 0.9
    let scale = 1.0;
    if (t < 0.25) {
      scale = 1.0 + (t / 0.25) * 0.15;
    } else {
      scale = 1.15 - ((t - 0.25) / 0.75) * 0.25;
    }
    if (slot.isCrit) {
      scale *= 1.1;
    }

    // Opacity: stay 1 until 60% of duration, then fade to 0
    const opacity = t < 0.6 ? 1.0 : 1.0 - (t - 0.6) / 0.4;

    const el = slot.element;
    el.style.transform = `translate3d(${Math.round(slot.screenX)}px, ${Math.round(slot.screenY + yOffset)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    el.style.opacity = Math.max(0, opacity).toFixed(3);
  }

  public clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.deactivateSlot(this.pool[i]);
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }
}
