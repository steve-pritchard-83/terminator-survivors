import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { LOADOUTS, META_UPGRADES } from '../data/upgrades';
import { LORE } from '../data/lore';
import type { LoadoutId, MetaUpgradeId } from '../core/types';

export class TitleScreen {
  public readonly container: HTMLElement;
  private readonly bunkerModal: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private readonly onStartRun: (loadoutId: LoadoutId) => void;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    audioEngine: AudioEngine,
    onStartRun: (loadoutId: LoadoutId) => void
  ) {
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;
    this.onStartRun = onStartRun;

    this.container = document.createElement('div');
    this.container.className = 'screen-layer';
    this.container.style.display = 'flex';

    this.container.innerHTML = `
      <div class="title-container">
        <div class="title-logo">TERMINATOR SURVIVORS</div>
        <div class="title-sub">LOS ANGELES, 2029 A.D. // TECH-COM DN38416</div>
        <div style="max-width:560px; font-size:13px; color:var(--color-chrome); text-align:center; margin-bottom:28px; line-height:1.5;">
          ${LORE.prologue}
        </div>
        <button class="btn-primary" data-testid="btn-start-run" id="btn-start-run">
          DEPLOY TO SECTOR 44
        </button>
        <button class="btn-secondary" data-testid="btn-bunker-shop" id="btn-bunker-shop" style="margin-top:8px;">
          TECH-COM BUNKER REQUISITION
        </button>
      </div>

      <div class="modal-backdrop" id="bunker-modal" style="display:none;">
        <div class="t800-modal-box" style="max-width:760px; max-height:85vh; overflow-y:auto;">
          <div class="t800-header">TECH-COM BUNKER REQUISITION</div>
          <div class="t800-ticker" id="bunker-scrap-header">AVAILABLE ALLOY SCRAP: 0</div>
          
          <div style="margin-bottom:14px;">
            <div style="font-family:var(--font-display); font-size:14px; color:var(--color-cyan); margin-bottom:8px;">
              ACTIVE RESISTANCE OPERATIVE:
            </div>
            <div id="loadout-selection-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px;"></div>
          </div>

          <div style="font-family:var(--font-display); font-size:14px; color:var(--color-amber); margin-bottom:8px;">
            PERMANENT FIELD UPGRADES:
          </div>
          <div id="bunker-upgrades-list" class="upgrade-card-list"></div>

          <button class="btn-secondary" id="btn-close-bunker" style="margin-top:16px; align-self:center;">
            RETURN TO COMMAND
          </button>
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.bunkerModal = this.container.querySelector('#bunker-modal')!;

    // Button event listeners
    this.container.querySelector('#btn-start-run')?.addEventListener('click', () => {
      this.hide();
      this.onStartRun(this.saveManager.getData().selectedLoadout);
    });

    this.container.querySelector('#btn-bunker-shop')?.addEventListener('click', () => {
      this.openBunkerShop();
    });

    this.container.querySelector('#btn-close-bunker')?.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.bunkerModal.style.display = 'none';
    });
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  private openBunkerShop(): void {
    this.audioEngine.playHudScanOpen();
    this.bunkerModal.style.display = 'flex';
    this.renderBunkerContents();
  }

  private renderBunkerContents(): void {
    const data = this.saveManager.getData();
    const scrapHeader = this.bunkerModal.querySelector('#bunker-scrap-header')!;
    scrapHeader.textContent = `AVAILABLE ALLOY SCRAP: ${data.alloyScrap} // TOTAL KILLS: ${data.totalKills}`;

    // Render Loadouts
    const loadoutGrid = this.bunkerModal.querySelector('#loadout-selection-grid')!;
    loadoutGrid.innerHTML = '';
    for (const [lId, cfg] of Object.entries(LOADOUTS)) {
      const isUnlocked = data.unlockedLoadouts.includes(lId as LoadoutId);
      const isSelected = data.selectedLoadout === lId;

      const card = document.createElement('div');
      card.setAttribute('data-loadout-card', lId);
      card.style.cssText = `
        padding: 8px 10px;
        background: ${isSelected ? 'rgba(77,210,255,0.2)' : 'rgba(15,25,38,0.7)'};
        border: 1px solid ${isSelected ? 'var(--color-cyan)' : 'rgba(77,210,255,0.3)'};
        border-radius: 3px;
        cursor: pointer;
      `;
      card.innerHTML = `
        <div style="font-family:var(--font-display); font-size:11px; color:#fff;">${cfg.name}</div>
        <div style="font-size:10px; color:var(--color-amber);">${cfg.callsign}</div>
        <div style="font-size:10px; margin-top:4px; color:${isUnlocked ? '#00ff88' : '#ff4444'}">
          ${isSelected ? 'ACTIVE' : isUnlocked ? 'SELECT' : `UNLOCK: ${cfg.cost} SCRAP`}
        </div>
      `;

      card.onclick = () => {
        if (isUnlocked) {
          this.audioEngine.playUpgradeApplied();
          this.saveManager.selectLoadout(lId as LoadoutId);
          this.renderBunkerContents();
        } else if (data.alloyScrap >= cfg.cost) {
          this.audioEngine.playUiBuy();
          this.saveManager.unlockLoadout(lId as LoadoutId);
          this.renderBunkerContents();
        } else {
          this.audioEngine.playUiError();
        }
      };
      loadoutGrid.appendChild(card);
    }

    // Render Upgrades
    const upgradeList = this.bunkerModal.querySelector('#bunker-upgrades-list')!;
    upgradeList.innerHTML = '';
    for (const [upId, cfg] of Object.entries(META_UPGRADES)) {
      const curLv = data.upgrades[upId as MetaUpgradeId] ?? 0;
      const cost = this.saveManager.getUpgradeCost(upId as MetaUpgradeId);
      const isMax = curLv >= cfg.maxLevel;

      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-card-info">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="upgrade-card-title">${cfg.name} (LV ${curLv}/${cfg.maxLevel})</div>
            <div style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-amber);">
              ${isMax ? 'MAX LEVEL' : `COST: ${cost} SCRAP`}
            </div>
          </div>
          <div class="upgrade-card-desc">${cfg.description}</div>
        </div>
      `;

      if (!isMax && data.alloyScrap >= cost) {
        card.onclick = () => {
          this.audioEngine.playUiBuy();
          this.saveManager.purchaseUpgrade(upId as MetaUpgradeId);
          this.renderBunkerContents();
        };
      } else if (isMax) {
        card.style.opacity = '0.6';
        card.style.cursor = 'default';
      } else {
        card.onclick = () => {
          this.audioEngine.playUiError();
        };
      }

      upgradeList.appendChild(card);
    }
  }
}
