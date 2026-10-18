import { LORE } from '../data/lore';
import { ALL_WEAPONS } from '../data/weapons';
import { ENEMY_CONFIGS } from '../data/enemies';
import { LOADOUTS } from '../data/upgrades';
import { STAGES } from '../data/stages';
import { THREAT_MODIFIERS } from '../data/threatModifiers';
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
  private onContinueCallback: (() => void) | null = null;
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
    this.container.setAttribute('aria-label', 'Mission Debrief and Combat Record');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="text-align:center; max-width:680px; width:92%; max-height:88vh; display:flex; flex-direction:column;">
        <div class="t800-header" id="end-title">TERMINATED</div>
        <div class="t800-ticker" id="end-ticker">WAR LOG // LOS ANGELES 2029</div>

        <div class="end-tabs" style="display:flex; justify-content:center; gap:6px; margin:12px 0 10px 0; flex-wrap:wrap;">
          <button class="btn-secondary end-tab-btn active" data-tab="debrief" aria-label="Debrief Tab" style="font-size:11px; padding:6px 12px;">[DEBRIEF]</button>
          <button class="btn-secondary end-tab-btn" data-tab="weapons" aria-label="Weapons Breakdown Tab" style="font-size:11px; padding:6px 12px;">[WEAPONS]</button>
          <button class="btn-secondary end-tab-btn" data-tab="casualties" aria-label="Casualties Breakdown Tab" style="font-size:11px; padding:6px 12px;">[CASUALTIES]</button>
          <button class="btn-secondary end-tab-btn" data-tab="timeline" aria-label="Timeline History Tab" style="font-size:11px; padding:6px 12px;">[TIMELINE]</button>
          <button class="btn-secondary end-tab-btn" data-tab="archives" aria-label="War Archives Tab" style="font-size:11px; padding:6px 12px;">[WAR ARCHIVES]</button>
        </div>

        <div class="end-tab-content-container" style="overflow-y:auto; flex:1; min-height:200px; max-height:48vh; padding:0 8px;">
          <!-- Tab 1: Debrief -->
          <div id="tab-debrief" class="end-tab-pane">
            <div id="end-stats" style="font-family:var(--font-telemetry); font-size:15px; color:#fff; margin:14px 0; line-height:1.8;"></div>
            <div id="end-lore" style="font-size:13px; color:var(--color-chrome); margin-bottom:16px; line-height:1.5;"></div>
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

        <div style="display:flex; flex-direction:column; gap:10px; align-items:center; margin-top:12px;">
          <button class="btn-primary" id="btn-continue-war" data-testid="btn-continue-war" aria-label="Continue the War" style="background:var(--color-amber); border-color:#ffbb00; display:none;">
            CONTINUE THE WAR (+100 ALLOY)
          </button>
          <button class="btn-primary" id="btn-return-bunker" aria-label="Return to Command">
            RETURN TO COMMAND
          </button>
        </div>
        <div id="end-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:8px; display:none;">
          [LB/RB / ARROWS] SWITCH TABS // [ENTER / ESC / A / B] RETURN TO COMMAND
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

    this.container.querySelector('#btn-continue-war')?.addEventListener('click', () => {
      this.container.style.display = 'none';
      this.onContinueCallback?.();
    });

    this.container.querySelector('#btn-return-bunker')?.addEventListener('click', () => {
      this.container.style.display = 'none';
      this.onReturnCallback?.();
    });
  }

  public switchTab(tab: EndRunTab): void {
    this.activeTab = tab;
    this.audioEngine?.playUiClick();
    this.tabButtons.forEach((b) => {
      if (b.dataset.tab === tab) {
        b.classList.add('active');
        b.style.borderColor = 'var(--color-cyan)';
        b.style.color = '#fff';
      } else {
        b.classList.remove('active');
        b.style.borderColor = '';
        b.style.color = '';
      }
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
    onContinueWar?: () => void,
    details?: RunHistoryRecord,
    defeatReason?: string
  ): void {
    this.onReturnCallback = onReturn;
    this.onContinueCallback = onContinueWar ?? null;
    this.container.style.display = 'flex';
    this.switchTab('debrief');

    const continueBtn = this.container.querySelector('#btn-continue-war') as HTMLElement | null;
    if (continueBtn) {
      continueBtn.style.display = onContinueWar ? 'block' : 'none';
    }

    const sec = Math.floor(timeSeconds);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    if (victory) {
      this.titleEl.textContent = 'MISSION ACCOMPLISHED';
      this.titleEl.style.color = 'var(--color-cyan)';
      this.loreEl.textContent = LORE.victoryText;
    } else {
      this.titleEl.textContent = defeatReason ?? 'TERMINATED';
      this.titleEl.style.color = 'var(--color-red)';
      this.loreEl.textContent = defeatReason ? `CRITICAL FAILURE // ${defeatReason}` : LORE.defeatText;
    }

    this.statsEl.innerHTML = `
      <div>TIME SURVIVED: <span style="color:var(--color-amber)">${timeFormatted}</span></div>
      <div>TERMINATIONS: <span style="color:var(--color-red)">${kills}</span></div>
      <div>FIELD LEVEL: <span style="color:var(--color-cyan)">LV ${level}</span></div>
      <div>ALLOY SCRAP RECOVERED: <span style="color:#ffd700">+${scrap}</span></div>
      ${seed !== undefined ? `<div>MISSION SEED: <span style="color:var(--color-chrome)">${seed}</span></div>` : ''}
      ${details?.threats && details.threats.length > 0 ? `<div style="margin-top:4px;">ACTIVE THREATS: <span style="color:var(--color-amber)">${details.threats.map((t) => THREAT_MODIFIERS[t]?.name ?? t).join(', ')}</span></div>` : ''}
    `;

    this.renderWeaponTelemetry(details?.weaponDamageBreakdown, timeSeconds);
    this.renderCasualties(details?.killsByType);
    this.renderTimeline(details?.levelUpTimeline);
    this.a11y.activate();
  }

  public showArchives(onReturn: () => void): void {
    this.onReturnCallback = onReturn;
    this.onContinueCallback = null;
    this.container.style.display = 'flex';

    this.titleEl.textContent = 'TECH-COM ARCHIVES';
    this.titleEl.style.color = 'var(--color-cyan)';
    this.loreEl.textContent = 'Historical combat mission telemetry retrieved from bunker sub-core.';

    const continueBtn = this.container.querySelector('#btn-continue-war') as HTMLElement | null;
    if (continueBtn) continueBtn.style.display = 'none';

    this.switchTab('archives');
    this.a11y.activate();
  }

  private renderWeaponTelemetry(damageMap?: Record<string, number>, timeSeconds = 1): void {
    const listEl = this.container.querySelector('#end-weapons-list');
    if (!listEl) return;

    if (!damageMap || Object.keys(damageMap).length === 0) {
      listEl.innerHTML = `<div style="color:var(--color-chrome); font-size:13px; text-align:center; padding:16px;">NO WEAPON TELEMETRY LOGGED</div>`;
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
          <div style="margin-bottom:10px; background:rgba(0,0,0,0.55); padding:8px 12px; border:1px solid #333; border-radius:4px;">
            <div style="display:flex; justify-content:space-between; font-family:var(--font-telemetry); font-size:13px; color:#fff;">
              <span style="font-weight:bold; color:var(--color-cyan);">${name}</span>
              <span>${dmg.toLocaleString()} DMG (${dps} DPS) &bull; <span style="color:var(--color-amber)">${pct}%</span></span>
            </div>
            <div style="height:6px; background:#1a1a1a; border-radius:3px; margin-top:6px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--color-cyan), var(--color-amber));"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderCasualties(killsMap?: Record<string, number>): void {
    const listEl = this.container.querySelector('#end-casualties-list');
    if (!listEl) return;

    if (!killsMap || Object.keys(killsMap).length === 0) {
      listEl.innerHTML = `<div style="color:var(--color-chrome); font-size:13px; text-align:center; padding:16px;">NO CASUALTIES LOGGED</div>`;
      return;
    }

    const sorted = Object.entries(killsMap).sort((a, b) => b[1] - a[1]);
    listEl.innerHTML = sorted
      .map(([archetype, count]) => {
        const cfg = ENEMY_CONFIGS[archetype as EnemyArchetypeId];
        const name = cfg?.name ?? archetype;
        return `
          <div style="display:flex; justify-content:space-between; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.08); font-family:var(--font-telemetry); font-size:13px;">
            <span style="color:var(--color-chrome);">${name}</span>
            <span style="color:var(--color-red); font-weight:bold;">${count.toLocaleString()}</span>
          </div>
        `;
      })
      .join('');
  }

  private renderTimeline(timeline?: Array<{ level: number; timeSeconds: number; choiceTitle: string }>): void {
    const listEl = this.container.querySelector('#end-timeline-list');
    if (!listEl) return;

    if (!timeline || timeline.length === 0) {
      listEl.innerHTML = `<div style="color:var(--color-chrome); font-size:13px; text-align:center; padding:16px;">NO PROGRESSION LOGGED</div>`;
      return;
    }

    listEl.innerHTML = timeline
      .map((t) => {
        const sec = Math.floor(t.timeSeconds);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `
          <div style="display:flex; gap:12px; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.08); font-family:var(--font-telemetry); font-size:12px;">
            <span style="color:var(--color-amber); width:46px;">${timeFormatted}</span>
            <span style="color:var(--color-cyan); width:50px;">LV ${t.level}</span>
            <span style="color:#fff;">${t.choiceTitle}</span>
          </div>
        `;
      })
      .join('');
  }

  private renderArchives(): void {
    const listEl = this.container.querySelector('#end-archives-list');
    if (!listEl) return;

    const endless = this.saveManager?.getData().endlessHighScores;
    const endlessSec = Math.floor(endless?.bestTimeSeconds ?? 0);
    const em = Math.floor(endlessSec / 60);
    const es = endlessSec % 60;
    const endlessTimeFormatted = `${em.toString().padStart(2, '0')}:${es.toString().padStart(2, '0')}`;

    const endlessBannerHtml = `
      <div id="endless-high-scores-panel" data-testid="endless-high-scores-panel" style="margin-bottom:14px; background:rgba(255,187,0,0.12); border:1px solid var(--color-amber); border-radius:4px; padding:10px 14px; font-family:var(--font-telemetry);">
        <div style="color:var(--color-amber); font-weight:bold; font-size:12px; margin-bottom:6px; letter-spacing:1px;">★ ENDLESS WAR RECORDS // COMMAND LEADERBOARD</div>
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:12px; color:#fff;">
          <div>LONGEST SURVIVAL: <span style="color:var(--color-amber); font-weight:bold;">${endlessTimeFormatted}</span></div>
          <div>MAX TERMINATIONS: <span style="color:var(--color-red); font-weight:bold;">${endless?.maxKills ?? 0}</span></div>
          <div>MAX SCRAP BANKED: <span style="color:var(--color-cyan); font-weight:bold;">+${endless?.maxScrap ?? 0}</span></div>
        </div>
      </div>
    `;

    const history = this.saveManager?.getRunHistory() ?? [];
    if (history.length === 0) {
      listEl.innerHTML = endlessBannerHtml + `<div style="color:var(--color-chrome); font-size:13px; text-align:center; padding:20px;">NO PRIOR MISSIONS IN TECH-COM LOGS</div>`;
      return;
    }

    listEl.innerHTML = endlessBannerHtml + history
      .map((r, i) => {
        const sec = Math.floor(r.durationSeconds);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const stageName = STAGES[r.stageId]?.name ?? r.stageId;
        const loadoutName = LOADOUTS[r.loadoutId]?.name ?? r.loadoutId;
        const topWeaponDef = r.topWeapon?.id ? ALL_WEAPONS[r.topWeapon.id] : undefined;
        const topWeaponName = topWeaponDef?.name ?? r.topWeapon?.id ?? 'N/A';
        const isVic = r.outcome === 'victory';

        return `
          <div style="margin-bottom:10px; background:rgba(0,0,0,0.55); border:1px solid ${isVic ? 'rgba(0,229,255,0.3)' : 'rgba(255,34,68,0.3)'}; border-radius:4px; padding:8px 12px; font-family:var(--font-telemetry); font-size:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:bold; color:${isVic ? 'var(--color-cyan)' : 'var(--color-red)'};">
                #${history.length - i} // ${isVic ? 'VICTORY' : 'TERMINATED'}
              </span>
              <span style="color:var(--color-amber);">${timeFormatted}</span>
            </div>
            <div style="color:var(--color-chrome); display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
              <span>${stageName} &bull; ${loadoutName}</span>
              <span>LV ${r.levelReached} &bull; ${r.kills} KILLS &bull; +${r.scrapEarned} ALLOY</span>
            </div>
            <div style="color:rgba(255,255,255,0.7); margin-top:4px; font-size:11px;">
              TOP WEAPON: <span style="color:var(--color-cyan)">${topWeaponName}</span> (${r.topWeapon?.damage.toLocaleString() ?? 0} DMG)
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
