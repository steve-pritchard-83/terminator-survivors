import { LORE } from '../data/lore';
import { iconLabel } from './icons';
import { ALL_WEAPONS } from '../data/weapons';
import { ENEMY_CONFIGS } from '../data/enemies';
import { LOADOUTS } from '../data/upgrades';
import type { EnemyArchetypeId, RunHistoryRecord, WeaponId } from '../core/types';
import type { GamepadManager } from '../input/GamepadManager';
import { XBOX_BUTTON } from '../input/GamepadManager';
import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { ModalA11y } from './A11yHelper';

type EndRunTab = 'debrief' | 'weapons' | 'casualties' | 'timeline' | 'archives';

export class EndRunModal {
  public readonly container: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly statsEl: HTMLElement;
  private readonly loreEl: HTMLElement;
  private readonly tabButtons: NodeListOf<HTMLButtonElement>;
  private readonly tabPanes: Record<EndRunTab, HTMLElement>;
  private activeTab: EndRunTab = 'debrief';

  private onReturnCallback: (() => void) | null = null;
  private readonly saveManager?: SaveManager;
  private readonly audioEngine?: AudioEngine;
  private readonly a11y: ModalA11y;

  constructor(root: HTMLElement, saveManager?: SaveManager, audioEngine?: AudioEngine) {
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;

    this.container = document.createElement('div');
    this.container.id = 'end-run-modal';
    this.container.setAttribute('data-testid', 'end-run-modal');
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Mission Debrief');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="text-align:center; width:92%;">
        <div class="t800-header t800-header-big" id="end-title">TERMINATED</div>

        <div class="end-tabs" style="display:flex; justify-content:center; gap:6px; margin:10px 0; flex-wrap:wrap;">
          <button class="btn-secondary btn-sm end-tab-btn active" data-tab="debrief" aria-label="Debrief Tab">DEBRIEF</button>
          <button class="btn-secondary btn-sm end-tab-btn" data-tab="weapons" aria-label="Weapons Breakdown Tab">WEAPONS</button>
          <button class="btn-secondary btn-sm end-tab-btn" data-tab="casualties" aria-label="Kills Breakdown Tab">KILLS</button>
          <button class="btn-secondary btn-sm end-tab-btn" data-tab="timeline" aria-label="Timeline Tab">TIMELINE</button>
          <button class="btn-secondary btn-sm end-tab-btn" data-tab="archives" aria-label="Archives Tab">ARCHIVES</button>
        </div>

        <div class="end-tab-content-container" style="overflow-y:auto; flex:1; min-height:200px; max-height:48vh; padding:0 8px;">
          <!-- Tab 1: Debrief -->
          <div id="tab-debrief" class="end-tab-pane">
            <div id="end-stats" style="font-size:15px; margin:14px 0; line-height:1.8;"></div>
            <div id="end-lore" class="t-muted" style="font-size:12px; margin-bottom:16px; line-height:1.55;"></div>
          </div>

          <!-- Tab 2: Weapons -->
          <div id="tab-weapons" class="end-tab-pane" style="display:none; text-align:left;">
            <div id="end-weapons-list" style="margin-top:10px;"></div>
          </div>

          <!-- Tab 3: Casualties -->
          <div id="tab-casualties" class="end-tab-pane" style="display:none; text-align:left;">
            <div id="end-casualties-list" style="margin-top:10px;"></div>
          </div>

          <!-- Tab 4: Timeline -->
          <div id="tab-timeline" class="end-tab-pane" style="display:none; text-align:left;">
            <div id="end-timeline-list" style="margin-top:10px;"></div>
          </div>

          <!-- Tab 5: Archives -->
          <div id="tab-archives" class="end-tab-pane" style="display:none; text-align:left;">
            <div id="end-archives-list" style="margin-top:10px;"></div>
          </div>
        </div>

        <div class="btn-row" style="margin-top:12px;">
          <button class="btn-primary" id="btn-return-bunker" aria-label="Continue">
            ${iconLabel('back', 'CONTINUE')}
          </button>
        </div>
        <div class="t-hint" id="end-controller-hint" style="display:none;">
          [LB / RB] TABS &nbsp; [A / B] CONTINUE
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.titleEl = this.container.querySelector('#end-title')!;
    this.statsEl = this.container.querySelector('#end-stats')!;
    this.loreEl = this.container.querySelector('#end-lore')!;

    this.tabButtons = this.container.querySelectorAll('.end-tab-btn');
    this.tabPanes = {
      debrief: this.container.querySelector('#tab-debrief')!,
      weapons: this.container.querySelector('#tab-weapons')!,
      casualties: this.container.querySelector('#tab-casualties')!,
      timeline: this.container.querySelector('#tab-timeline')!,
      archives: this.container.querySelector('#tab-archives')!
    };

    const tabs: EndRunTab[] = ['debrief', 'weapons', 'casualties', 'timeline', 'archives'];

    this.a11y = new ModalA11y(this.container, {
      onClose: () => {
        const btn = this.container.querySelector('#btn-return-bunker') as HTMLElement | null;
        btn?.click();
      },
      onNavigate: (dir) => {
        if (dir.x !== 0) {
          const curIdx = tabs.indexOf(this.activeTab);
          const nextIdx = Math.max(0, Math.min(tabs.length - 1, curIdx + dir.x));
          if (nextIdx !== curIdx) {
            this.switchTab(tabs[nextIdx]);
            return true;
          }
        }
        return false;
      },
      onConfirm: () => {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLButtonElement && this.container.contains(activeEl)) {
          activeEl.click();
          return true;
        }
        const btn = this.container.querySelector('#btn-return-bunker') as HTMLElement | null;
        btn?.click();
        return true;
      }
    });

    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as EndRunTab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    this.container.querySelector('#btn-return-bunker')?.addEventListener('click', () => {
      this.hide();
      this.onReturnCallback?.();
    });
  }

  public switchTab(tab: EndRunTab): void {
    this.activeTab = tab;
    this.audioEngine?.playUiClick();
    this.tabButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    for (const [k, pane] of Object.entries(this.tabPanes)) {
      pane.style.display = k === tab ? 'block' : 'none';
    }

    if (tab === 'archives') {
      this.renderArchives();
    }
  }

  public show(
    victory: boolean,
    timeSeconds: number,
    kills: number,
    level: number,
    scrap: number,
    seed: number | undefined,
    onReturn: () => void,
    details?: RunHistoryRecord,
    defeatReason?: string
  ): void {
    this.onReturnCallback = onReturn;
    this.container.style.display = 'flex';
    this.switchTab('debrief');

    const sec = Math.floor(timeSeconds);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    this.titleEl.classList.add('t800-header-big');
    if (victory) {
      this.titleEl.textContent = 'MISSION ACCOMPLISHED';
      this.titleEl.style.color = 'var(--t-text)';
      this.loreEl.textContent = LORE.victoryText;
    } else {
      this.titleEl.textContent = defeatReason ?? 'TERMINATED';
      this.titleEl.style.color = '';
      this.loreEl.textContent = LORE.defeatText;
    }

    // The weapon that carried the run, so the next build has a starting point
    const damage = Object.entries(details?.weaponDamageBreakdown ?? {});
    const total = damage.reduce((sum, [, d]) => sum + d, 0);
    const [topId, topDamage] = damage.sort((a, b) => b[1] - a[1])[0] ?? [];
    const topLine = topId && total > 0
      ? `<div><span class="t-muted">TOP WEAPON:</span> ${ALL_WEAPONS[topId as WeaponId]?.name ?? topId} · ${Math.round((topDamage / total) * 100)}%</div>`
      : '';

    this.statsEl.innerHTML = `
      <div><span class="t-muted">TIME:</span> ${timeFormatted}</div>
      <div><span class="t-muted">KILLS:</span> ${kills}</div>
      <div><span class="t-muted">LEVEL:</span> ${level}</div>
      <div><span class="t-muted">SCRAP:</span> +${scrap}</div>
      ${topLine}
      ${seed !== undefined ? `<div class="t-muted" style="font-size:11px;">MISSION SEED: ${seed}</div>` : ''}
    `;

    this.renderWeaponTelemetry(details?.weaponDamageBreakdown, timeSeconds);
    this.renderCasualties(details?.killsByType);
    this.renderTimeline(details?.levelUpTimeline);
    this.a11y.activate();
  }

  private renderWeaponTelemetry(damageMap?: Record<string, number>, timeSeconds = 1): void {
    const listEl = this.container.querySelector('#end-weapons-list');
    if (!listEl) return;

    if (!damageMap || Object.keys(damageMap).length === 0) {
      listEl.innerHTML = `<div class="t-empty">NO WEAPON DATA</div>`;
      return;
    }

    const totalDamage = Object.values(damageMap).reduce((a, b) => a + b, 0);
    const safeTime = Math.max(1, timeSeconds);
    const sorted = Object.entries(damageMap).sort((a, b) => b[1] - a[1]);

    listEl.innerHTML = sorted
      .map(([wId, dmg]) => {
        const def = ALL_WEAPONS[wId as WeaponId];
        const name = def?.name ?? wId;
        const pct = totalDamage > 0 ? Math.round((dmg / totalDamage) * 100) : 0;
        const dps = (dmg / safeTime).toFixed(1);
        return `
          <div style="padding:6px 2px 8px; border-bottom:1px solid var(--t-line); font-size:12px;">
            <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <span>${name}</span>
              <span class="t-muted">${dmg.toLocaleString()} DMG · ${dps} DPS · ${pct}%</span>
            </div>
            <div class="t-bar"><div style="width:${pct}%;"></div></div>
          </div>
        `;
      })
      .join('');
  }

  private renderCasualties(killsMap?: Record<string, number>): void {
    const listEl = this.container.querySelector('#end-casualties-list');
    if (!listEl) return;

    if (!killsMap || Object.keys(killsMap).length === 0) {
      listEl.innerHTML = `<div class="t-empty">NO KILLS LOGGED</div>`;
      return;
    }

    const sorted = Object.entries(killsMap).sort((a, b) => b[1] - a[1]);
    listEl.innerHTML = sorted
      .map(([archetype, count]) => {
        const cfg = ENEMY_CONFIGS[archetype as EnemyArchetypeId];
        const name = cfg?.name ?? archetype;
        return `
          <div class="t-row">
            <span class="t-muted">${name}</span>
            <span>${count.toLocaleString()}</span>
          </div>
        `;
      })
      .join('');
  }

  private renderTimeline(timeline?: Array<{ level: number; timeSeconds: number; choiceTitle: string }>): void {
    const listEl = this.container.querySelector('#end-timeline-list');
    if (!listEl) return;

    if (!timeline || timeline.length === 0) {
      listEl.innerHTML = `<div class="t-empty">NO UPGRADES LOGGED</div>`;
      return;
    }

    listEl.innerHTML = timeline
      .map((t) => {
        const sec = Math.floor(t.timeSeconds);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `
          <div class="t-row" style="justify-content:flex-start;">
            <span class="t-muted" style="width:46px;">${timeFormatted}</span>
            <span class="t-accent" style="width:50px;">LV ${t.level}</span>
            <span>${t.choiceTitle}</span>
          </div>
        `;
      })
      .join('');
  }

  private renderArchives(): void {
    const listEl = this.container.querySelector('#end-archives-list');
    if (!listEl) return;

    const history = this.saveManager?.getRunHistory() ?? [];
    if (history.length === 0) {
      listEl.innerHTML = `<div class="t-empty">NO PRIOR MISSIONS</div>`;
      return;
    }

    listEl.innerHTML = history
      .map((r, i) => {
        const sec = Math.floor(r.durationSeconds);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const loadoutName = LOADOUTS[r.loadoutId]?.name ?? r.loadoutId;
        const topWeaponDef = r.topWeapon?.id ? ALL_WEAPONS[r.topWeapon.id] : undefined;
        const topWeaponName = topWeaponDef?.name ?? r.topWeapon?.id ?? 'N/A';
        const isVic = r.outcome === 'victory';

        return `
          <div class="t-panel" style="margin-bottom:8px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span class="${isVic ? '' : 't-red'}">#${history.length - i} ${isVic ? 'VICTORY' : 'TERMINATED'}</span>
              <span>${timeFormatted}</span>
            </div>
            <div class="t-muted" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
              <span>${loadoutName}</span>
              <span>LV ${r.levelReached} · ${r.kills} KILLS · +${r.scrapEarned} SCRAP</span>
            </div>
            <div class="t-muted" style="margin-top:4px; font-size:11px;">
              TOP WEAPON: <span style="color:var(--t-text);">${topWeaponName}</span> (${r.topWeapon?.damage.toLocaleString() ?? 0} DMG)
            </div>
          </div>
        `;
      })
      .join('');
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  public handleGamepad(gp: GamepadManager): boolean {
    if (!this.isVisible()) return false;

    const hintEl = this.container.querySelector('#end-controller-hint') as HTMLElement | null;
    if (hintEl) {
      hintEl.style.display = gp.hasActiveController ? 'block' : 'none';
    }

    const tabs: EndRunTab[] = ['debrief', 'weapons', 'casualties', 'timeline', 'archives'];
    const curIdx = tabs.indexOf(this.activeTab);

    const isPrev =
      gp.isButtonJustPressed(XBOX_BUTTON.LB) || gp.isButtonJustPressed(XBOX_BUTTON.DPAD_LEFT);
    const isNext =
      gp.isButtonJustPressed(XBOX_BUTTON.RB) || gp.isButtonJustPressed(XBOX_BUTTON.DPAD_RIGHT);

    if (isPrev && curIdx > 0) {
      gp.playRumble(40, 0.2, 0.2);
      this.switchTab(tabs[curIdx - 1]);
      return true;
    }
    if (isNext && curIdx < tabs.length - 1) {
      gp.playRumble(40, 0.2, 0.2);
      this.switchTab(tabs[curIdx + 1]);
      return true;
    }

    if (gp.isMenuConfirmPressed() || gp.isMenuCancelPressed()) {
      gp.playRumble(80, 0.35, 0.5);
      const btn = this.container.querySelector('#btn-return-bunker') as HTMLElement | null;
      btn?.click();
      return true;
    }

    return true;
  }

  public hide(): void {
    this.a11y.deactivate();
    this.container.style.display = 'none';
  }
}
