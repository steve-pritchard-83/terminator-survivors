import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { LOADOUTS, META_UPGRADES } from '../data/upgrades';
import { LORE } from '../data/lore';
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS } from '../data/achievements';
import { CodexModal } from './CodexModal';
import type { LoadoutId, MetaUpgradeId } from '../core/types';
import type { GamepadManager } from '../input/GamepadManager';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export class TitleScreen {
  public readonly container: HTMLElement;
  private readonly bunkerModal: HTMLElement;
  private readonly achievementsModal: HTMLElement;
  public readonly codexModal: CodexModal;
  private readonly pwaModal: HTMLElement;
  private readonly installBtn: HTMLElement;
  private readonly startBtn: HTMLElement;
  private readonly bunkerBtn: HTMLElement;
  private readonly achievementsBtn: HTMLElement;
  private readonly codexBtn: HTMLElement;
  private readonly historyBtn: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private readonly onStartRun: (loadoutId: LoadoutId) => void;
  private readonly onOpenArchives?: () => void;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  private selectedBtnIndex = 0;
  private bunkerSelectables: HTMLElement[] = [];
  private selectedBunkerIndex = 0;
  private achievementsSelectables: HTMLElement[] = [];
  private selectedAchievementsIndex = 0;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    audioEngine: AudioEngine,
    onStartRun: (loadoutId: LoadoutId) => void,
    onOpenArchives?: () => void
  ) {
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;
    this.onStartRun = onStartRun;
    this.onOpenArchives = onOpenArchives;

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
          <button class="btn-secondary" data-testid="btn-achievements" id="btn-achievements">
            TECH-COM INTEL // ACHIEVEMENTS
          </button>
          <button class="btn-secondary" data-testid="btn-codex" id="btn-codex">
            TECH-COM CODEX // BESTIARY
          </button>
          <button class="btn-secondary" data-testid="btn-history" id="btn-history">
            TECH-COM WAR ARCHIVES
          </button>
          <button class="btn-secondary" id="btn-install-pwa" style="display:none; border-color:var(--color-cyan); color:var(--color-cyan);">
            INSTALL APP (PWA)
          </button>
          <div id="title-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:8px; text-align:center; display:none;">
            [A / START] DEPLOY TO SECTOR 44 &nbsp;//&nbsp; [D-PAD] SELECT
          </div>
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

          <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:14px;">
            <button class="btn-secondary" id="btn-refund-upgrades" style="border-color:#ff8844; color:#ffaa66;">
              REFUND ALL ALLOY
            </button>
            <button class="btn-secondary" id="btn-close-bunker" style="align-self:center;">
              RETURN TO COMMAND
            </button>
          </div>
          <div id="bunker-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:6px; text-align:center; display:none;">
            [D-PAD] BROWSE &nbsp;//&nbsp; [A] PURCHASE/SELECT &nbsp;//&nbsp; [B] RETURN
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="achievements-modal" style="display:none;">
        <div class="t800-modal-box" style="max-width:800px; max-height:88vh; overflow-y:auto;">
          <div class="t800-header">TECH-COM INTEL // ACHIEVEMENTS</div>
          <div class="t800-ticker" id="achievements-scrap-header">RECORDS SECURED: 0 / 40</div>
          <div id="achievements-list" class="upgrade-card-list" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;"></div>
          <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:14px;">
            <button class="btn-secondary" id="btn-close-achievements" style="align-self:center;">
              RETURN TO COMMAND
            </button>
          </div>
          <div id="achievements-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:6px; text-align:center; display:none;">
            [D-PAD] BROWSE &nbsp;//&nbsp; [B] RETURN
          </div>
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.bunkerModal = this.container.querySelector('#bunker-modal')!;
    this.achievementsModal = this.container.querySelector('#achievements-modal')!;
    this.pwaModal = this.container.querySelector('#pwa-install-modal')!;
    this.installBtn = this.container.querySelector('#btn-install-pwa')!;
    this.startBtn = this.container.querySelector('#btn-start-run')!;
    this.bunkerBtn = this.container.querySelector('#btn-bunker-shop')!;
    this.achievementsBtn = this.container.querySelector('#btn-achievements')!;
    this.codexBtn = this.container.querySelector('#btn-codex')!;
    this.historyBtn = this.container.querySelector('#btn-history')!;
    this.codexModal = new CodexModal(this.container, this.saveManager, this.audioEngine);

    this.setupPwaInstallPrompt();

    // Button event listeners
    this.startBtn.addEventListener('click', () => {
      this.tryLockMobileLandscape();
      this.hide();
      this.onStartRun(this.saveManager.getData().selectedLoadout);
    });

    this.bunkerBtn.addEventListener('click', () => {
      this.openBunkerShop();
    });

    this.achievementsBtn.addEventListener('click', () => {
      this.openAchievements();
    });

    this.codexBtn.addEventListener('click', () => {
      this.codexModal.show();
    });

    this.historyBtn.addEventListener('click', () => {
      this.audioEngine.playHudScanOpen();
      this.hide();
      this.onOpenArchives?.();
    });

    this.container.querySelector('#btn-close-bunker')?.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.bunkerModal.style.display = 'none';
      this.updateTitleButtonHighlight();
    });

    this.container.querySelector('#btn-close-achievements')?.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.achievementsModal.style.display = 'none';
      this.updateTitleButtonHighlight();
    });

    this.updateTitleButtonHighlight();
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
    const standaloneFullscreen =
      window.matchMedia?.('(display-mode: fullscreen)')?.matches ?? false;
    const iosStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return standaloneMedia || standaloneFullscreen || iosStandalone;
  }

  private setupPwaInstallPrompt(): void {
    if (typeof window === 'undefined') return;
    const isAutomated = navigator.webdriver === true;
    if (isAutomated || this.isInstalledStandalone()) return;

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile =
      isIos || /Android|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 960;
    const instructionsEl = this.pwaModal.querySelector('#pwa-install-instructions')!;
    const triggerInstallBtn = this.pwaModal.querySelector(
      '#btn-trigger-pwa-install'
    ) as HTMLElement;
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
    this.selectedBtnIndex = 0;
    this.updateTitleButtonHighlight();
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  public isBunkerVisible(): boolean {
    return this.bunkerModal.style.display !== 'none';
  }

  public isAchievementsVisible(): boolean {
    return this.achievementsModal.style.display !== 'none';
  }

  public isPwaModalVisible(): boolean {
    return this.pwaModal.style.display !== 'none';
  }

  private getActiveTitleButtons(): HTMLElement[] {
    const btns: HTMLElement[] = [
      this.startBtn,
      this.bunkerBtn,
      this.achievementsBtn,
      this.codexBtn,
      this.historyBtn
    ];
    if (this.installBtn.style.display !== 'none') {
      btns.push(this.installBtn);
    }
    return btns;
  }

  private updateTitleButtonHighlight(): void {
    const btns = this.getActiveTitleButtons();
    btns.forEach((btn, i) => {
      if (i === this.selectedBtnIndex) {
        btn.classList.add('controller-selected');
      } else {
        btn.classList.remove('controller-selected');
      }
    });
  }

  private updateBunkerHighlight(): void {
    this.bunkerSelectables.forEach((el, i) => {
      if (i === this.selectedBunkerIndex) {
        el.classList.add('controller-selected');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        el.classList.remove('controller-selected');
      }
    });
  }

  public handleGamepad(gp: GamepadManager, dt: number): boolean {
    if (!this.isVisible()) return false;

    // Show hints if controller connected
    const hintEl = this.container.querySelector('#title-controller-hint') as HTMLElement | null;
    if (hintEl) {
      hintEl.style.display =
        gp.hasActiveController &&
        !this.isBunkerVisible() &&
        !this.isAchievementsVisible() &&
        !this.codexModal.isVisible()
          ? 'block'
          : 'none';
    }
    const bunkerHintEl = this.container.querySelector(
      '#bunker-controller-hint'
    ) as HTMLElement | null;
    if (bunkerHintEl) {
      bunkerHintEl.style.display =
        gp.hasActiveController && this.isBunkerVisible() ? 'block' : 'none';
    }
    const achHintEl = this.container.querySelector(
      '#achievements-controller-hint'
    ) as HTMLElement | null;
    if (achHintEl) {
      achHintEl.style.display =
        gp.hasActiveController && this.isAchievementsVisible() ? 'block' : 'none';
    }

    // 1. PWA Modal Open
    if (this.isPwaModalVisible()) {
      if (gp.isMenuCancelPressed()) {
        const dismissBtn = this.pwaModal.querySelector(
          '#btn-dismiss-pwa-modal'
        ) as HTMLElement | null;
        dismissBtn?.click();
        gp.playRumble(40, 0.15, 0.3);
        return true;
      }
      if (gp.isMenuConfirmPressed()) {
        const triggerBtn = this.pwaModal.querySelector(
          '#btn-trigger-pwa-install'
        ) as HTMLElement | null;
        triggerBtn?.click();
        gp.playRumble(60, 0.25, 0.4);
        return true;
      }
      return true;
    }

    // 2. Bunker Modal Open
    if (this.isBunkerVisible()) {
      if (gp.isMenuCancelPressed()) {
        const closeBtn = this.bunkerModal.querySelector('#btn-close-bunker') as HTMLElement | null;
        closeBtn?.click();
        gp.playRumble(40, 0.15, 0.3);
        return true;
      }

      const nav = gp.getMenuNavigation(dt);
      if (nav.y !== 0 || nav.x !== 0) {
        const dir = nav.y !== 0 ? nav.y : nav.x;
        if (this.bunkerSelectables.length > 0) {
          this.selectedBunkerIndex =
            (this.selectedBunkerIndex + dir + this.bunkerSelectables.length) %
            this.bunkerSelectables.length;
          this.updateBunkerHighlight();
          gp.playRumble(25, 0.05, 0.2);
        }
        return true;
      }

      if (gp.isMenuConfirmPressed()) {
        if (this.bunkerSelectables[this.selectedBunkerIndex]) {
          gp.playRumble(60, 0.25, 0.4);
          this.bunkerSelectables[this.selectedBunkerIndex].click();
          return true;
        }
      }

      return true;
    }

    // 3. Achievements Modal Open
    if (this.isAchievementsVisible()) {
      if (gp.isMenuCancelPressed()) {
        const closeBtn = this.achievementsModal.querySelector(
          '#btn-close-achievements'
        ) as HTMLElement | null;
        closeBtn?.click();
        gp.playRumble(40, 0.15, 0.3);
        return true;
      }

      const nav = gp.getMenuNavigation(dt);
      if (nav.y !== 0) {
        if (this.achievementsSelectables.length > 0) {
          this.selectedAchievementsIndex =
            (this.selectedAchievementsIndex + nav.y + this.achievementsSelectables.length) %
            this.achievementsSelectables.length;
          this.updateAchievementsHighlight();
          gp.playRumble(25, 0.05, 0.2);
        }
        return true;
      }

      if (gp.isMenuConfirmPressed()) {
        if (this.achievementsSelectables[this.selectedAchievementsIndex]) {
          gp.playRumble(60, 0.25, 0.4);
          this.achievementsSelectables[this.selectedAchievementsIndex].click();
          return true;
        }
      }

      return true;
    }

    // 4. Codex Modal Open
    if (this.codexModal.isVisible()) {
      if (gp.isMenuCancelPressed()) {
        this.codexModal.hide();
        gp.playRumble(40, 0.15, 0.3);
        return true;
      }
      return true;
    }

    // 5. Main Title Screen
    const nav = gp.getMenuNavigation(dt);
    const btns = this.getActiveTitleButtons();
    if (nav.y !== 0) {
      this.selectedBtnIndex = (this.selectedBtnIndex + nav.y + btns.length) % btns.length;
      this.updateTitleButtonHighlight();
      gp.playRumble(25, 0.05, 0.2);
      return true;
    }

    if (gp.isMenuConfirmPressed()) {
      const activeBtn = btns[this.selectedBtnIndex] ?? this.startBtn;
      gp.playRumble(90, 0.4, 0.55);
      activeBtn.click();
      return true;
    }

    return true;
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

    this.bunkerSelectables = [];

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
        transition: all 0.15s ease;
      `;
      card.innerHTML = `
        <div style="font-family:var(--font-display); font-size:11px; color:#fff;">${cfg.name}</div>
        <div style="font-size:10px; color:var(--color-amber);">${cfg.callsign}</div>
        <div style="font-size:9px; color:var(--color-cyan); margin-top:2px;">SPEC: ${cfg.ability.name}</div>
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
      this.bunkerSelectables.push(card);
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
      this.bunkerSelectables.push(card);
    }

    const refundBtn = this.bunkerModal.querySelector('#btn-refund-upgrades') as HTMLButtonElement | null;
    if (refundBtn) {
      refundBtn.onclick = () => {
        const refunded = this.saveManager.refundAllUpgrades();
        if (refunded > 0) {
          this.audioEngine.playUiBuy();
        } else {
          this.audioEngine.playUiError();
        }
        this.renderBunkerContents();
      };
      this.bunkerSelectables.push(refundBtn);
    }

    const closeBtn = this.bunkerModal.querySelector('#btn-close-bunker') as HTMLElement | null;
    if (closeBtn) {
      this.bunkerSelectables.push(closeBtn);
    }

    this.updateBunkerHighlight();
  }

  private openAchievements(): void {
    this.audioEngine.playHudScanOpen();
    this.achievementsModal.style.display = 'flex';
    this.selectedAchievementsIndex = 0;
    this.renderAchievements();
  }

  private renderAchievements(): void {
    const unlockedIds = this.saveManager.getUnlockedAchievements();
    const count = unlockedIds.length;
    const pct = Math.round((count / TOTAL_ACHIEVEMENTS) * 100);

    const scrapHeader = this.achievementsModal.querySelector('#achievements-scrap-header')!;
    scrapHeader.textContent = `RECORDS SECURED: ${count} / ${TOTAL_ACHIEVEMENTS} (${pct}%) // ALLOY SCRAP: ${this.saveManager.getData().alloyScrap}`;

    this.achievementsSelectables = [];
    const listEl = this.achievementsModal.querySelector('#achievements-list')!;
    listEl.innerHTML = '';

    for (const ach of Object.values(ACHIEVEMENTS)) {
      const isUnlocked = unlockedIds.includes(ach.id);
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.style.cssText = `
        padding: 10px 14px;
        background: ${isUnlocked ? 'rgba(10, 30, 20, 0.6)' : 'rgba(15, 20, 25, 0.6)'};
        border: 1px solid ${isUnlocked ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 255, 255, 0.1)'};
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      `;

      card.innerHTML = `
        <div style="flex: 1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:var(--font-display); font-size:13px; color:${isUnlocked ? '#fff' : '#aaa'}; font-weight:bold;">
              ${isUnlocked ? '★ ' : '○ '}${ach.title}
            </span>
            <span style="font-size:10px; padding:2px 6px; border-radius:3px; background:rgba(77,210,255,0.15); color:var(--color-cyan); text-transform:uppercase;">
              ${ach.category}
            </span>
          </div>
          <div style="font-size:11px; color:#bbb; margin-top:3px;">
            ${ach.description}
          </div>
        </div>
        <div style="text-align:right; min-width:180px;">
          <div style="font-size:11px; font-weight:bold; color:${isUnlocked ? '#00ff88' : 'var(--color-amber)'};">
            ${isUnlocked ? 'SECURED' : ach.reward.description}
          </div>
          <div style="font-size:10px; color:${isUnlocked ? 'rgba(0,255,136,0.8)' : '#888'}; margin-top:2px;">
            ${isUnlocked ? 'INTEL ACQUIRED' : 'LOCKED'}
          </div>
        </div>
      `;

      listEl.appendChild(card);
    }

    const closeBtn = this.achievementsModal.querySelector('#btn-close-achievements') as HTMLElement | null;
    if (closeBtn) {
      this.achievementsSelectables.push(closeBtn);
    }
    this.updateAchievementsHighlight();
  }

  private updateAchievementsHighlight(): void {
    this.achievementsSelectables.forEach((el, i) => {
      if (i === this.selectedAchievementsIndex) {
        el.classList.add('controller-selected');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        el.classList.remove('controller-selected');
      }
    });
  }
}
