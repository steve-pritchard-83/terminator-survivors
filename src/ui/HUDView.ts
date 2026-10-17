import type { RunState } from '../state/RunState';
import { ALL_WEAPONS, PASSIVES } from '../data/weapons';

export class HUDView {
  public readonly container: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly killsEl: HTMLElement;
  private readonly scrapEl: HTMLElement;
  private readonly weaponRack: HTMLElement;
  private readonly passiveRack: HTMLElement;
  private readonly bossBarContainer: HTMLElement;
  private readonly bossTitle: HTMLElement;
  private readonly bossFill: HTMLElement;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'screen-layer';
    this.container.setAttribute('data-testid', 'hud-container');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="hud-top-bar">
        <div class="xp-bar-container">
          <div class="xp-bar-fill" id="hud-xp-fill"></div>
        </div>
        <div class="hud-info-row">
          <div data-testid="hud-level" id="hud-level-text">LV 01 // DN38416</div>
          <div class="hud-clock" data-testid="hud-timer" id="hud-clock-text">00:00</div>
          <div>TERMINATIONS: <span id="hud-kills-text" style="color:var(--color-red)">0</span></div>
          <div>SCRAP: <span id="hud-scrap-text" style="color:var(--color-amber)">0</span></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <div style="display:flex; gap:12px;">
            <div class="hud-equipment-rack" id="hud-weapon-rack"></div>
            <div class="hud-equipment-rack" id="hud-passive-rack"></div>
          </div>
          <div style="width:140px; height:8px; background:rgba(30,0,0,0.8); border:1px solid var(--color-red); border-radius:2px;">
            <div id="hud-hp-fill" style="width:100%; height:100%; background:var(--color-red); box-shadow:0 0 6px var(--color-red);"></div>
          </div>
        </div>
      </div>

      <div class="boss-bar-container" id="hud-boss-bar">
        <div class="boss-title" id="hud-boss-title">WARNING // HUNTER-KILLER GOLIATH</div>
        <div style="width:100%; height:8px; background:#220000; border-radius:1px;">
          <div class="boss-bar-fill" id="hud-boss-fill"></div>
        </div>
      </div>

      <div class="touch-zone-left" data-testid="touch-joystick-zone" id="touch-zone-left"></div>
      <div class="joystick-base" id="joystick-base">
        <div class="joystick-knob" id="joystick-knob"></div>
      </div>
      <div class="btn-mobile-dash" data-testid="btn-mobile-dash" id="btn-mobile-dash">DASH</div>
      <div style="position:absolute; bottom:14px; left:18px; font-family:var(--font-telemetry); font-size:12px; color:rgba(77, 210, 255, 0.78); text-shadow:0 0 6px rgba(77, 210, 255, 0.4); pointer-events:none; letter-spacing:1px;">
        [WASD / L-CLICK] MOVE &nbsp;//&nbsp; [MOUSE] LASER AIM &nbsp;//&nbsp; [SPACE / R-CLICK] DIVE
      </div>
    `;

    root.appendChild(this.container);

    this.xpFill = this.container.querySelector('#hud-xp-fill')!;
    this.hpFill = this.container.querySelector('#hud-hp-fill')!;
    this.clockEl = this.container.querySelector('#hud-clock-text')!;
    this.levelEl = this.container.querySelector('#hud-level-text')!;
    this.killsEl = this.container.querySelector('#hud-kills-text')!;
    this.scrapEl = this.container.querySelector('#hud-scrap-text')!;
    this.weaponRack = this.container.querySelector('#hud-weapon-rack')!;
    this.passiveRack = this.container.querySelector('#hud-passive-rack')!;
    this.bossBarContainer = this.container.querySelector('#hud-boss-bar')!;
    this.bossTitle = this.container.querySelector('#hud-boss-title')!;
    this.bossFill = this.container.querySelector('#hud-boss-fill')!;
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public update(runState: RunState, activeBoss: { name: string; hp: number; maxHp: number } | null): void {
    // XP bar
    const xpPercent = Math.min(100, (runState.xp / runState.xpToNext) * 100);
    this.xpFill.style.width = `${xpPercent}%`;

    // HP bar
    const hpPercent = Math.max(0, Math.min(100, (runState.hp / runState.maxHp) * 100));
    this.hpFill.style.width = `${hpPercent}%`;

    // Timer (MM:SS)
    const sec = Math.floor(runState.timeSeconds);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    this.clockEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    this.levelEl.textContent = `LV ${runState.level.toString().padStart(2, '0')} // DN38416`;
    this.killsEl.textContent = `${runState.kills}`;
    this.scrapEl.textContent = `${runState.alloyScrapEarned}`;

    // Weapon slots
    this.weaponRack.innerHTML = '';
    for (const [wId, slot] of runState.weapons.entries()) {
      const def = ALL_WEAPONS[wId];
      const slotEl = document.createElement('div');
      slotEl.className = 'rack-slot';
      slotEl.style.color = def?.iconColor ?? '#fff';
      slotEl.textContent = slot.evolved ? '★' : `${slot.level}`;
      this.weaponRack.appendChild(slotEl);
    }

    // Passive slots
    this.passiveRack.innerHTML = '';
    for (const [pId, lv] of runState.passives.entries()) {
      const def = PASSIVES[pId];
      const slotEl = document.createElement('div');
      slotEl.className = 'rack-slot';
      slotEl.style.color = def?.iconColor ?? '#00e5ff';
      slotEl.textContent = `P${lv}`;
      this.passiveRack.appendChild(slotEl);
    }

    // Boss Bar
    if (activeBoss && activeBoss.hp > 0) {
      this.bossBarContainer.style.display = 'flex';
      this.bossTitle.textContent = activeBoss.name;
      const bossPercent = Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.maxHp) * 100));
      this.bossFill.style.width = `${bossPercent}%`;
    } else {
      this.bossBarContainer.style.display = 'none';
    }
  }
}
