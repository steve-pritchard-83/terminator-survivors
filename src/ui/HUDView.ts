import type { RunState } from '../state/RunState';
import { LOADOUTS } from '../data/upgrades';
import { DamageNumbers } from './DamageNumbers';
import { globalEvents } from '../core/EventBus';
import { icon, passiveIcon, weaponIcon } from './icons';
import { IS_MOBILE } from '../data/performance';
import { BASE_WEAPONS, EVOLUTION_LEVEL, PASSIVES } from '../data/weapons';
import type { BaseWeaponId } from '../core/types';

/**
 * Minimal in-run HUD: health, thin XP bar with level, timer, ability cooldown (only when the
 * loadout has one), boss bar + boss alert, pause button, and floating damage numbers.
 */
export class HUDView {
  public readonly container: HTMLElement;
  public readonly damageNumbers: DamageNumbers;
  private readonly xpBar: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly abilityEl: HTMLElement;
  private readonly abilityText: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossTitle: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly pauseBtn: HTMLElement;
  private readonly bossWarningBanner: HTMLElement;
  private readonly bossWarningText: HTMLElement;
  private readonly floatingTextLayer: HTMLElement;
  private readonly fpsCounterEl: HTMLElement;
  private readonly buildEl: HTMLElement;
  private lastBuildKey = '';
  private readonly tipEl: HTMLElement;
  private readonly pointers: Record<'boss' | 'vault', HTMLElement>;
  private tipTimer: number | null = null;
  /** Called the first time any weapon is ready to evolve in a run */
  public onEvolutionReady: (() => void) | null = null;
  public onPauseClicked: (() => void) | null = null;
  private lastXp = 0;
  private lastLevel = 1;
  private xpPulseTimer: number | null = null;
  private bossWarningTimer: number | null = null;
  private readonly unsubs: Array<() => void> = [];

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'screen-layer hudm';
    this.container.setAttribute('data-testid', 'hud-container');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="hudm-fps" id="hud-fps-counter" style="display:none;">FPS: 60</div>

      <div class="hudm-xp" id="hud-xp-container"><div class="hudm-xp-fill" id="hud-xp-fill"></div></div>

      <div class="hudm-top">
        <div class="hudm-chip" data-testid="hud-level"><span id="hud-level-text">LV 1</span></div>
        <div class="hudm-chip hudm-clock" data-testid="hud-timer"><span id="hud-clock-text">00:00</span></div>
        <button class="hudm-pause" data-testid="btn-hud-pause" id="btn-hud-pause" aria-label="Pause">${icon('pause')}</button>
      </div>

      <div class="hudm-build" id="hud-build" data-testid="hud-build" aria-label="Equipped weapons and passives"></div>

      <div class="hudm-tip" id="hud-tip" data-testid="hud-tip" role="status" aria-live="polite"></div>

      <div class="hudm-boss" id="hud-boss-bar" data-testid="hud-boss-bar">
        <div class="hudm-boss-title">${icon('boss')}<span id="hud-boss-title">BOSS</span></div>
        <div class="hudm-bar hudm-bar-boss"><div class="hudm-boss-fill" id="hud-boss-fill"></div></div>
      </div>

      <div class="hudm-alert" id="hud-boss-warning" data-testid="hud-boss-warning">
        ${icon('bossAlert')}<span id="hud-boss-warning-text"></span>
      </div>

      <div class="hudm-pointer is-boss" id="hud-ptr-boss" aria-hidden="true"></div>
      <div class="hudm-pointer is-vault" id="hud-ptr-vault" aria-hidden="true"></div>

      <div class="hud-floating-text-layer" id="floating-text-layer" data-testid="floating-text-layer"></div>

      <div class="hudm-bottom">
        <div class="hudm-ability btn-mobile-ability" id="btn-mobile-ability" data-testid="hud-ability-status" style="display:none;">
          ${weaponIcon('pipe_bomb', { size: 18 })}<span id="hud-ability-text"></span>
        </div>
        <div class="hudm-hp">
          <span class="hudm-hp-icon">${icon('health')}</span>
          <div class="hudm-bar hudm-bar-hp"><div class="hudm-hp-fill" id="hud-hp-fill"></div></div>
          <span class="hudm-revives" id="hud-revives" style="display:none; font-size:11px; color:var(--t-accent); white-space:nowrap;"></span>
        </div>
      </div>

      <div class="touch-zone-left" data-testid="touch-joystick-zone" id="touch-zone-left"></div>
      <div class="joystick-base" id="joystick-base">
        <div class="joystick-knob" id="joystick-knob"></div>
      </div>
    `;

    root.appendChild(this.container);

    const q = <T extends HTMLElement>(sel: string): T => this.container.querySelector(sel)!;
    this.xpBar = q('#hud-xp-container');
    this.xpFill = q('#hud-xp-fill');
    this.hpFill = q('#hud-hp-fill');
    this.clockEl = q('#hud-clock-text');
    this.levelEl = q('#hud-level-text');
    this.abilityEl = q('#btn-mobile-ability');
    this.abilityText = q('#hud-ability-text');
    this.bossBar = q('#hud-boss-bar');
    this.bossTitle = q('#hud-boss-title');
    this.bossFill = q('#hud-boss-fill');
    this.pauseBtn = q('#btn-hud-pause');
    this.bossWarningBanner = q('#hud-boss-warning');
    this.bossWarningText = q('#hud-boss-warning-text');
    this.floatingTextLayer = q('#floating-text-layer');
    this.fpsCounterEl = q('#hud-fps-counter');
    this.buildEl = q('#hud-build');
    this.tipEl = q('#hud-tip');
    this.pointers = { boss: q('#hud-ptr-boss'), vault: q('#hud-ptr-vault') };
    this.damageNumbers = new DamageNumbers(this.floatingTextLayer);

    this.unsubs.push(
      globalEvents.on('achievement:unlocked', ({ title, rewardDescription }) => {
        this.showAchievementNotification(title, rewardDescription);
      }),
      globalEvents.on('settings:updated', (s) => {
        this.damageNumbers.setMode(s.damageNumbers);
        this.fpsCounterEl.style.display = s.showFps ? 'block' : 'none';
      })
    );

    this.pauseBtn.addEventListener('click', () => {
      this.onPauseClicked?.();
    });
  }

  public showAchievementNotification(title: string, rewardDesc: string): void {
    const toast = document.createElement('div');
    toast.className = 'hudm-toast';
    toast.innerHTML = `${icon('achievement')}<div><div class="hudm-toast-title">${title}</div><div class="hudm-toast-sub">${rewardDesc}</div></div>`;
    this.container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4000);
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public showControllerNotification(name: string, connected: boolean): void {
    this.container.querySelector('.hudm-controller')?.remove();

    const notif = document.createElement('div');
    notif.className = connected ? 'hudm-controller' : 'hudm-controller hudm-controller-lost';
    notif.innerHTML = connected
      ? `${icon('controller')}<span>${name}</span>`
      : `${icon('disconnected')}<span>CONTROLLER DISCONNECTED</span>`;
    this.container.appendChild(notif);
    window.setTimeout(() => notif.remove(), 3000);
  }

  /** Shows a short tip above the health bar for a few seconds. */
  public showTip(text: string, seconds = 7): void {
    this.tipEl.textContent = text;
    this.tipEl.classList.add('is-visible');
    if (this.tipTimer !== null) window.clearTimeout(this.tipTimer);
    this.tipTimer = window.setTimeout(() => this.tipEl.classList.remove('is-visible'), seconds * 1000);
  }

  /** Equipped weapons and passives with level pips; a weapon ready to evolve glows. Rebuilt only on change. */
  private updateBuild(runState: RunState): void {
    const weapons = [...runState.weapons.values()];
    const passives = [...runState.passives.entries()];
    const key = weapons.map((w) => `${w.id}${w.level}${w.evolved}`).join() + '|' + passives.join();
    if (key === this.lastBuildKey) return;
    this.lastBuildKey = key;
    const pips = (level: number, max: number) =>
      `<span class="hudm-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
    const weaponCells = weapons.map((w) => {
      const def = BASE_WEAPONS[w.id as BaseWeaponId];
      const ready = !w.evolved && w.level >= EVOLUTION_LEVEL && Boolean(def?.pairedPassive && runState.passives.has(def.pairedPassive));
      if (ready) this.onEvolutionReady?.();
      const cls = w.evolved ? ' is-evolved' : ready ? ' is-ready' : '';
      return `<div class="hudm-slot${cls}">${weaponIcon(w.id, { size: 20 })}${w.evolved ? '' : pips(w.level, 8)}</div>`;
    });
    const passiveCells = passives.map(
      ([id, level]) => `<div class="hudm-slot is-passive">${passiveIcon(id, { size: 16 })}${pips(level, PASSIVES[id]?.maxLevel ?? 5)}</div>`
    );
    this.buildEl.innerHTML = `<div class="hudm-build-row">${weaponCells.join('')}</div><div class="hudm-build-row">${passiveCells.join('')}</div>`;
  }

  public update(
    runState: RunState,
    activeBoss: { name: string; hp: number; maxHp: number } | null,
    fps?: number
  ): void {
    this.updateBuild(runState);
    if (this.fpsCounterEl.style.display !== 'none' && typeof fps === 'number') {
      const ms = fps > 0 ? (1000 / fps).toFixed(1) : '0.0';
      this.fpsCounterEl.textContent = `FPS ${fps} ${ms}MS`;
    }

    // XP bar + pickup pulse
    if (runState.xp > this.lastXp || runState.level > this.lastLevel) {
      this.xpBar.classList.add('hudm-xp-pulse');
      if (this.xpPulseTimer !== null) window.clearTimeout(this.xpPulseTimer);
      this.xpPulseTimer = window.setTimeout(() => {
        this.xpBar.classList.remove('hudm-xp-pulse');
        this.xpPulseTimer = null;
      }, 115);
    }
    this.lastXp = runState.xp;
    this.lastLevel = runState.level;
    this.xpFill.style.width = `${Math.min(100, (runState.xp / runState.xpToNext) * 100)}%`;
    this.levelEl.textContent = `LV ${runState.level}`;

    // Health bar
    const hpPercent = Math.max(0, Math.min(100, (runState.hp / runState.maxHp) * 100));
    this.hpFill.style.width = `${hpPercent}%`;
    this.hpFill.classList.toggle('hud-low-hp-pulse', runState.hp > 0 && runState.hp / runState.maxHp < 0.25);
    const revivesEl = this.container.querySelector('#hud-revives') as HTMLElement | null;
    if (revivesEl) {
      if (runState.revivalsLeft > 0) {
        revivesEl.style.display = 'inline';
        revivesEl.textContent = `♥×${runState.revivalsLeft}`;
      } else {
        revivesEl.style.display = 'none';
      }
    }

    // Timer (MM:SS)
    const sec = Math.floor(runState.timeSeconds);
    this.clockEl.textContent = `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

    // Ability: only shown when the loadout has one
    const ability = LOADOUTS[runState.loadoutId]?.ability;
    if (ability) {
      this.abilityEl.style.display = 'flex';
      if (runState.isAbilityActive) {
        this.abilityText.textContent = `${runState.abilityActiveDuration.toFixed(1)}s`;
        this.abilityEl.dataset.state = 'active';
      } else if (runState.abilityCooldownTimer > 0) {
        this.abilityText.textContent = `${runState.abilityCooldownTimer.toFixed(1)}s`;
        this.abilityEl.dataset.state = 'cooldown';
      } else {
        // Phones tap the chip; keyboards also get the key
        this.abilityText.textContent = IS_MOBILE ? 'BOMBS' : 'BOMBS · E';
        this.abilityEl.dataset.state = 'ready';
      }
      this.abilityEl.title = `${ability.name}: ${ability.description}`;
    } else {
      this.abilityEl.style.display = 'none';
    }

    // Boss bar
    if (activeBoss && activeBoss.hp > 0) {
      this.bossBar.style.display = 'flex';
      this.bossTitle.textContent = activeBoss.name;
      this.bossFill.style.width = `${Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.maxHp) * 100))}%`;
    } else {
      this.bossBar.style.display = 'none';
    }
  }

  /** Edge arrow toward an off-screen boss or data vault (null hides it). */
  public setPointer(kind: 'boss' | 'vault', at: { x: number; y: number; angle: number } | null): void {
    const el = this.pointers[kind];
    if (!at) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%) rotate(${at.angle}rad)`;
  }

  public triggerBossWarning(bossName: string): void {
    this.bossWarningText.textContent = bossName.toUpperCase();
    this.bossWarningBanner.style.display = 'flex';
    if (this.bossWarningTimer !== null) window.clearTimeout(this.bossWarningTimer);
    this.bossWarningTimer = window.setTimeout(() => {
      this.bossWarningBanner.style.display = 'none';
      this.bossWarningTimer = null;
    }, 3800);
  }

  public spawnFloatingText(text: string, color: string, screenX: number, screenY: number): void {
    this.damageNumbers.spawnText(text, color, screenX, screenY);
  }

  public updateDamageNumbers(dt: number): void {
    this.damageNumbers.update(dt);
  }

  public dispose(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
  }
}
