import type { RunState } from '../state/RunState';
import { ALL_WEAPONS, PASSIVES } from '../data/weapons';
import { LOADOUTS } from '../data/upgrades';
import { DamageNumbers } from './DamageNumbers';
import { globalEvents } from '../core/EventBus';

export class HUDView {
  public readonly container: HTMLElement;
  public readonly damageNumbers: DamageNumbers;
  private readonly xpBarContainer: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly comboCounterEl: HTMLElement;
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
  private readonly mobileDashBtn: HTMLElement;
  private readonly dashStatusEl: HTMLElement;
  private readonly abilityStatusEl: HTMLElement;
  private readonly pauseBtn: HTMLElement;
  private readonly bossWarningBanner: HTMLElement;
  private readonly floatingTextLayer: HTMLElement;
  private readonly desktopHintEl: HTMLElement;
  private readonly fpsCounterEl: HTMLElement;
  public onPauseClicked: (() => void) | null = null;
  private lastXp = 0;
  private lastLevel = 1;
  private xpPulseTimer: number | null = null;
  private bossWarningTimer: number | null = null;
  private comboPopTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'screen-layer';
    this.container.setAttribute('data-testid', 'hud-container');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div id="hud-fps-counter" style="display:none; position:absolute; top:4px; right:10px; font-family:var(--font-telemetry); font-size:11px; color:var(--color-cyan); background:rgba(0,0,0,0.65); padding:2px 8px; border:1px solid rgba(77,210,255,0.4); border-radius:3px; z-index:100;">FPS: 60</div>
      <div class="hud-top-bar">
        <div class="xp-bar-container" id="hud-xp-container">
          <div class="xp-bar-fill" id="hud-xp-fill"></div>
        </div>
        <div class="hud-combo-counter" id="hud-combo-counter" data-testid="hud-combo-counter" style="display:none;">x0 DATA LINK</div>
        <div class="hud-info-row">
          <div data-testid="hud-level" id="hud-level-text">LV 01 // DN38416</div>
          <div class="hud-clock" data-testid="hud-timer" id="hud-clock-text">00:00</div>
          <div>TERMINATIONS: <span id="hud-kills-text" style="color:var(--color-red)">0</span></div>
          <div>SCRAP: <span id="hud-scrap-text" style="color:var(--color-amber)">0</span></div>
          <div id="hud-dash-status" style="color:var(--color-cyan); font-size:12px; font-weight:700;">DIVE: READY</div>
          <div id="hud-ability-status" data-testid="hud-ability-status" style="color:var(--color-amber); font-size:12px; font-weight:700;">SPEC: READY</div>
          <button class="btn-hud-pause" data-testid="btn-hud-pause" id="btn-hud-pause" aria-label="Pause Tactical Mission">❚❚ PAUSE</button>
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

      <div class="hud-boss-warning" id="hud-boss-warning" data-testid="hud-boss-warning">SKYNET PRIORITY THREAT DETECTED</div>
      <div class="hud-floating-text-layer" id="floating-text-layer" data-testid="floating-text-layer"></div>

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
      <div class="btn-mobile-dash" data-testid="btn-mobile-dash" id="btn-mobile-dash" role="button" aria-label="Tactical Dash">DASH</div>
      <div class="hud-desktop-hint">
        [WASD / L-CLICK] MOVE &nbsp;//&nbsp; [MOUSE] LASER AIM &nbsp;//&nbsp; [SPACE / R-CLICK] DIVE &nbsp;//&nbsp; [ESC] PAUSE
      </div>
    `;

    root.appendChild(this.container);

    this.xpBarContainer = this.container.querySelector('#hud-xp-container')!;
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
    this.mobileDashBtn = this.container.querySelector('#btn-mobile-dash')!;
    this.dashStatusEl = this.container.querySelector('#hud-dash-status')!;
    this.abilityStatusEl = this.container.querySelector('#hud-ability-status')!;
    this.pauseBtn = this.container.querySelector('#btn-hud-pause')!;
    this.bossWarningBanner = this.container.querySelector('#hud-boss-warning')!;
    this.floatingTextLayer = (this.container.querySelector('#floating-text-layer') ||
      this.container.querySelector('#hud-floating-text-layer'))!;
    this.desktopHintEl = this.container.querySelector('.hud-desktop-hint')!;
    this.fpsCounterEl = this.container.querySelector('#hud-fps-counter')!;
    this.damageNumbers = new DamageNumbers(this.floatingTextLayer);

    this.comboCounterEl = this.container.querySelector('#hud-combo-counter')!;

    globalEvents.on('pickup:combo', ({ combo }) => {
      this.updateCombo(combo);
    });

    globalEvents.on('pickup:combo_reset', () => {
      this.resetCombo();
    });

    globalEvents.on('achievement:unlocked', ({ title, rewardDescription }) => {
      this.showAchievementNotification(title, rewardDescription);
    });

    globalEvents.on('settings:updated', (s) => {
      this.damageNumbers.setMode(s.damageNumbers);
      this.fpsCounterEl.style.display = s.showFps ? 'block' : 'none';
    });

    this.pauseBtn.addEventListener('click', () => {
      this.onPauseClicked?.();
    });
  }

  public showAchievementNotification(title: string, rewardDesc: string): void {
    const banner = document.createElement('div');
    banner.className = 'hud-achievement-notification';
    banner.style.cssText = `
      position: absolute;
      top: 64px;
      right: 20px;
      background: rgba(10, 20, 30, 0.95);
      border: 1px solid var(--color-cyan);
      box-shadow: 0 0 14px rgba(77, 210, 255, 0.4);
      padding: 8px 14px;
      font-family: var(--font-display);
      border-radius: 4px;
      z-index: 100;
      pointer-events: none;
      animation: fadeInOut 4s forwards;
    `;
    banner.innerHTML = `
      <div style="font-size:10px; color:var(--color-amber); letter-spacing:1px;">★ INTEL SECURED</div>
      <div style="font-size:13px; color:#fff; font-weight:bold;">${title}</div>
      <div style="font-size:11px; color:var(--color-cyan);">${rewardDesc}</div>
    `;
    this.container.appendChild(banner);
    window.setTimeout(() => banner.remove(), 4000);
  }

  public updateCombo(combo: number): void {
    if (combo >= 2) {
      this.comboCounterEl.textContent = `x${combo} DATA LINK`;
      this.comboCounterEl.style.display = 'block';
      this.comboCounterEl.classList.remove('pop');
      void this.comboCounterEl.offsetWidth;
      this.comboCounterEl.classList.add('pop');
      if (this.comboPopTimer !== null) {
        window.clearTimeout(this.comboPopTimer);
      }
      this.comboPopTimer = window.setTimeout(() => {
        this.comboCounterEl.classList.remove('pop');
        this.comboPopTimer = null;
      }, 120);
    }
  }

  public resetCombo(): void {
    this.comboCounterEl.style.display = 'none';
    this.comboCounterEl.classList.remove('pop');
    if (this.comboPopTimer !== null) {
      window.clearTimeout(this.comboPopTimer);
      this.comboPopTimer = null;
    }
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public showControllerNotification(name: string, connected: boolean): void {
    const existing = this.container.querySelector('.hud-controller-notification');
    existing?.remove();

    const notif = document.createElement('div');
    notif.className = 'hud-controller-notification';
    notif.innerHTML = connected
      ? `<span style="font-size:16px;">🎮</span> <span>${name} CONNECTED // TACTICAL HAPTICS ENGAGED</span>`
      : `<span style="font-size:16px;">⚠</span> <span>CONTROLLER DISCONNECTED // FALLBACK CONTROLS ENGAGED</span>`;

    if (!connected) {
      notif.style.borderColor = 'var(--color-red)';
      notif.style.boxShadow = '0 0 20px rgba(255, 40, 40, 0.6)';
    }

    this.container.appendChild(notif);
    window.setTimeout(() => {
      notif.remove();
    }, 3600);
  }

  public setGamepadActive(active: boolean, isXbox: boolean): void {
    if (active) {
      this.desktopHintEl.innerHTML = isXbox
        ? '[LS / D-PAD] MOVE &nbsp;//&nbsp; [RS] TWIN-STICK AIM &nbsp;//&nbsp; [B / LB] DIVE &nbsp;//&nbsp; [Y / RB] ABILITY &nbsp;//&nbsp; [START] PAUSE'
        : '[STICK / D-PAD] MOVE &nbsp;//&nbsp; [RIGHT STICK] AIM &nbsp;//&nbsp; [B / LB] DIVE &nbsp;//&nbsp; [Y / RB] ABILITY &nbsp;//&nbsp; [START] PAUSE';
      this.mobileDashBtn.style.opacity = '0.35';
    } else {
      this.desktopHintEl.innerHTML =
        '[WASD / L-CLICK] MOVE &nbsp;//&nbsp; [MOUSE] LASER AIM &nbsp;//&nbsp; [SPACE / R-CLICK] DIVE &nbsp;//&nbsp; [E] ABILITY &nbsp;//&nbsp; [ESC] PAUSE';
      this.mobileDashBtn.style.opacity = '1';
    }
  }

  public update(
    runState: RunState,
    activeBoss: { name: string; hp: number; maxHp: number } | null,
    fps?: number
  ): void {

    if (this.fpsCounterEl.style.display !== 'none' && typeof fps === 'number') {
      const ms = fps > 0 ? (1000 / fps).toFixed(1) : '0.0';
      this.fpsCounterEl.textContent = `FPS: ${fps} // ${ms}ms`;
    }

    // XP bar & pickup pulse
    if (runState.xp > this.lastXp || runState.level > this.lastLevel) {
      this.xpBarContainer.classList.add('xp-pickup-pulse');
      if (this.xpPulseTimer !== null) {
        window.clearTimeout(this.xpPulseTimer);
      }
      this.xpPulseTimer = window.setTimeout(() => {
        this.xpBarContainer.classList.remove('xp-pickup-pulse');
        this.xpPulseTimer = null;
      }, 115);
    }
    this.lastXp = runState.xp;
    this.lastLevel = runState.level;

    const xpPercent = Math.min(100, (runState.xp / runState.xpToNext) * 100);
    this.xpFill.style.width = `${xpPercent}%`;

    // HP bar
    const hpPercent = Math.max(0, Math.min(100, (runState.hp / runState.maxHp) * 100));
    this.hpFill.style.width = `${hpPercent}%`;
    const isLowHp = runState.hp > 0 && (runState.hp / runState.maxHp) < 0.25;
    if (isLowHp) {
      this.hpFill.classList.add('hud-low-hp-pulse');
      this.hpFill.style.boxShadow = '0 0 12px #ff0000, 0 0 20px #ff0000';
    } else {
      this.hpFill.classList.remove('hud-low-hp-pulse');
      this.hpFill.style.boxShadow = '0 0 6px var(--color-red)';
    }

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
      slotEl.style.color = def?.iconColor ?? '#00ff88';
      slotEl.textContent = `${lv}`;
      this.passiveRack.appendChild(slotEl);
    }

    // Dash status & Mobile Dash Button visual cooldown
    if (runState.dashCooldownTimer > 0) {
      const cdSec = runState.dashCooldownTimer.toFixed(1);
      this.dashStatusEl.textContent = `DIVE: ${cdSec}s`;
      this.dashStatusEl.style.color = '#888';
      this.mobileDashBtn.classList.add('on-cooldown');
      this.mobileDashBtn.textContent = cdSec;
    } else {
      this.dashStatusEl.textContent = 'DIVE: READY';
      this.dashStatusEl.style.color = 'var(--color-cyan)';
      this.mobileDashBtn.classList.remove('on-cooldown');
      this.mobileDashBtn.textContent = 'DIVE';
    }

    // Ability status & visual cooldown
    const loadout = LOADOUTS[runState.loadoutId];
    const abilityName = loadout?.ability?.name ?? 'SPEC';
    if (runState.isAbilityActive) {
      const durSec = runState.abilityActiveDuration.toFixed(1);
      this.abilityStatusEl.textContent = `${abilityName}: ACTIVE (${durSec}s)`;
      this.abilityStatusEl.style.color = '#fff';
    } else if (runState.abilityCooldownTimer > 0) {
      const cdSec = runState.abilityCooldownTimer.toFixed(1);
      this.abilityStatusEl.textContent = `${abilityName}: ${cdSec}s`;
      this.abilityStatusEl.style.color = '#888';
    } else {
      this.abilityStatusEl.textContent = `${abilityName}: READY [E]`;
      this.abilityStatusEl.style.color = 'var(--color-amber)';
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

  public triggerBossWarning(bossName: string): void {
    this.bossWarningBanner.textContent = `SKYNET PRIORITY THREAT: ${bossName.toUpperCase()}`;
    this.bossWarningBanner.style.display = 'block';
    if (this.bossWarningTimer !== null) {
      window.clearTimeout(this.bossWarningTimer);
    }
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
}

