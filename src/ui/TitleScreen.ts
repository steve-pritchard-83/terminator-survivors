import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { LOADOUTS, META_UPGRADES } from '../data/upgrades';
import { LORE } from '../data/lore';
import type { LoadoutId, MetaUpgradeId } from '../core/types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export class TitleScreen {
  public readonly container: HTMLElement;
  private readonly bunkerModal: HTMLElement;
  private readonly pwaModal: HTMLElement;
  private readonly installBtn: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private readonly onStartRun: (loadoutId: LoadoutId) => void;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

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
        <div class="title-prologue">
          ${LORE.prologue}
        </div>
        <div class="title-actions-row">
          <button class="btn-primary" data-testid="btn-start-run" id="btn-start-run">
            DEPLOY TO SECTOR 44
          </button>
          <button class="btn-secondary" data-testid="btn-bunker-shop" id="btn-bunker-shop">
            TECH-COM BUNKER REQUISITION
          </button>
          <button class="btn-secondary" id="btn-install-pwa" style="display:none; border-color:var(--color-cyan); color:var(--color-cyan);">
            INSTALL APP (PWA)
          </button>
        </div>
      </div>

      <div class="modal-backdrop" id="pwa-install-modal" style="display:none;">
        <div class="t800-modal-box" style="max-width:480px; text-align:center; align-items:center;">
          <img src="./icons/icon-192.png" alt="Terminator Survivors Icon" style="width:76px; height:76px; border-radius:16px; border:2px solid var(--color-cyan); box-shadow:0 0 18px rgba(77,210,255,0.45); margin-bottom:10px;" />
          <div class="t800-header" style="font-size:20px; margin-bottom:6px;">INSTALL TACTICAL PWA</div>
          <div class="t800-ticker" style="width:100%;">FULLSCREEN LANDSCAPE // OFFLINE READY</div>
          <div id="pwa-install-instructions" style="font-size:13px; color:var(--color-chrome); line-height:1.5; margin-bottom:16px;">
            Install <strong>Terminator Survivors</strong> to your home screen for locked fullscreen landscape controls and offline play.
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
            <button class="btn-primary" id="btn-trigger-pwa-install" style="margin-bottom:0; padding:11px 24px; font-size:14px;">
              INSTALL APP NOW
            </button>
            <button class="btn-secondary" id="btn-dismiss-pwa-modal" style="padding:11px 20px;">
              CONTINUE IN BROWSER
            </button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="bunker-modal" style="display:none;">
        <div class="t800-modal-box" style="max-width:760px; max-height:88vh; overflow-y:auto;">
          <div class="t800-header">TECH-COM BUNKER REQUISITION</div>
          <div class="t800-ticker" id="bunker-scrap-header">AVAILABLE ALLOY SCRAP: 0</div>
          
          <div style="margin-bottom:12px;">
            <div style="font-family:var(--font-display); font-size:13px; color:var(--color-cyan); margin-bottom:6px;">
              ACTIVE RESISTANCE OPERATIVE:
            </div>
            <div id="loadout-selection-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;"></div>
          </div>

          <div style="font-family:var(--font-display); font-size:13px; color:var(--color-amber); margin-bottom:6px;">
            PERMANENT FIELD UPGRADES:
          </div>
          <div id="bunker-upgrades-list" class="upgrade-card-list"></div>

          <button class="btn-secondary" id="btn-close-bunker" style="margin-top:14px; align-self:center;">
            RETURN TO COMMAND
          </button>
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.bunkerModal = this.container.querySelector('#bunker-modal')!;
    this.pwaModal = this.container.querySelector('#pwa-install-modal')!;
    this.installBtn = this.container.querySelector('#btn-install-pwa')!;

    this.setupPwaInstallPrompt();

    // Button event listeners
    this.container.querySelector('#btn-start-run')?.addEventListener('click', () => {
      this.tryLockMobileLandscape();
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

  private tryLockMobileLandscape(): void {
    try {
      const scr = window.screen as Screen & {
        orientation?: { lock?: (orientation: string) => Promise<void> };
      };
      scr?.orientation?.lock?.('landscape')?.catch(() => {});
    } catch {
      // Orientation lock is best-effort on browsers that require fullscreen
    }
  }

  private isInstalledStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const standaloneMedia = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
    const standaloneFullscreen = window.matchMedia?.('(display-mode: fullscreen)')?.matches ?? false;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return standaloneMedia || standaloneFullscreen || iosStandalone;
  }

  private setupPwaInstallPrompt(): void {
    if (typeof window === 'undefined') return;
    const isAutomated = navigator.webdriver === true;
    if (isAutomated || this.isInstalledStandalone()) return;

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = isIos || /Android|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 960;
    const instructionsEl = this.pwaModal.querySelector('#pwa-install-instructions')!;
    const triggerInstallBtn = this.pwaModal.querySelector('#btn-trigger-pwa-install') as HTMLElement;
    const dismissModalBtn = this.pwaModal.querySelector('#btn-dismiss-pwa-modal') as HTMLElement;

    // Show Title Screen install button whenever not installed in standalone mode
    this.installBtn.style.display = 'inline-block';

    const updateModalInstructions = () => {
      if (this.deferredInstallPrompt) {
        triggerInstallBtn.style.display = 'inline-block';
        instructionsEl.innerHTML =
          'Install <strong>Terminator Survivors</strong> to your device for locked fullscreen landscape gameplay and 100% offline capability.';
      } else if (isIos) {
        triggerInstallBtn.style.display = 'none';
        instructionsEl.innerHTML =
          'To install on iPhone/iPad:<br/><span style="color:var(--color-cyan);">1.</span> Tap the Safari <strong>Share</strong> button <strong>[↑]</strong><br/><span style="color:var(--color-cyan);">2.</span> Select <strong>"Add to Home Screen"</strong> and launch from your home screen.';
      } else {
        triggerInstallBtn.style.display = 'none';
        instructionsEl.innerHTML =
          'To install the PWA:<br/>Open your browser menu <strong>(⋮)</strong> and tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> for fullscreen landscape play.';
      }
    };

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredInstallPrompt = e as BeforeInstallPromptEvent;
      this.installBtn.style.display = 'inline-block';
      updateModalInstructions();
      if (this.container.style.display !== 'none') {
        this.pwaModal.style.display = 'flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.installBtn.style.display = 'none';
      this.pwaModal.style.display = 'none';
    });

    this.installBtn.addEventListener('click', () => {
      if (this.deferredInstallPrompt) {
        void this.triggerNativeInstall();
      } else {
        updateModalInstructions();
        this.pwaModal.style.display = 'flex';
      }
    });

    triggerInstallBtn.addEventListener('click', () => {
      void this.triggerNativeInstall();
    });

    dismissModalBtn.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.pwaModal.style.display = 'none';
    });

    // Automatically prompt user to install PWA on production URL or mobile browser visit if not installed
    const isProdDomain =
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('github.io');
    if (isProdDomain || isMobile) {
      updateModalInstructions();
      this.pwaModal.style.display = 'flex';
    }
  }

  private async triggerNativeInstall(): Promise<void> {
    if (!this.deferredInstallPrompt) return;
    try {
      await this.deferredInstallPrompt.prompt();
      const choice = await this.deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.installBtn.style.display = 'none';
      }
    } catch {
      // Ignored
    } finally {
      this.deferredInstallPrompt = null;
      this.pwaModal.style.display = 'none';
    }
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
