import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { META_UPGRADES } from '../data/upgrades';
import { LORE } from '../data/lore';
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS } from '../data/achievements';
import type { CodexModal } from './CodexModal';
import type { MetaUpgradeId, RunConfig } from '../core/types';
import type { GamepadManager } from '../input/GamepadManager';
import { ModalA11y } from './A11yHelper';
import { iconLabel } from './icons';
import { APP_VERSION, BUILD_HASH } from '../core/version';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export class TitleScreen {
  public readonly container: HTMLElement;
  private readonly bunkerModal: HTMLElement;
  private readonly achievementsModal: HTMLElement;
  public codexModal: CodexModal | null = null;
  private readonly pwaModal: HTMLElement;
  private readonly installBtn: HTMLElement;
  private readonly startBtn: HTMLElement;
  private readonly bunkerBtn: HTMLElement;
  private readonly achievementsBtn: HTMLElement;
  private readonly codexBtn: HTMLElement;
  private readonly historyBtn: HTMLElement;
  private readonly settingsBtn: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private readonly onStartRun: (config: RunConfig) => void;
  private readonly onOpenArchives?: () => void;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  private selectedBtnIndex = 0;
  private bunkerSelectables: HTMLElement[] = [];
  private selectedBunkerIndex = 0;
  private achievementsSelectables: HTMLElement[] = [];
  private selectedAchievementsIndex = 0;
  private readonly onOpenSettings?: () => void;

  private readonly bunkerA11y: ModalA11y;
  private readonly achievementsA11y: ModalA11y;
  private readonly pwaA11y: ModalA11y;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    audioEngine: AudioEngine,
    onStartRun: (config: RunConfig) => void,
    onOpenArchives?: () => void,
    onOpenSettings?: () => void
  ) {
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;
    this.onStartRun = onStartRun;
    this.onOpenArchives = onOpenArchives;
    this.onOpenSettings = onOpenSettings;

    this.container = document.createElement('div');
    this.container.className = 'screen-layer';
    this.container.style.display = 'flex';

    this.container.innerHTML = `
      <div class="title-container">
        <div class="title-logo" aria-label="Terminator Survivors">TERMIN<span class="logo-kern">A</span>TOR SURVIVORS</div>
        <div class="title-sub">LOS ANGELES 2029 A.D.</div>
        <div class="title-prologue">
          ${LORE.prologue}
        </div>
        <div class="title-actions-row">
          <button class="btn-primary" data-testid="btn-start-run" id="btn-start-run" aria-label="Deploy">
            ${iconLabel('play', 'DEPLOY')}
          </button>
          <button class="btn-secondary" data-testid="btn-bunker-shop" id="btn-bunker-shop" aria-label="Requisition">
            ${iconLabel('shop', 'REQUISITION')}
          </button>
          <button class="btn-secondary" data-testid="btn-achievements" id="btn-achievements" aria-label="Achievements">
            ${iconLabel('trophy', 'ACHIEVEMENTS')}
          </button>
          <button class="btn-secondary" data-testid="btn-codex" id="btn-codex" aria-label="Codex">
            ${iconLabel('codex', 'CODEX')}
          </button>
          <button class="btn-secondary" data-testid="btn-history" id="btn-history" aria-label="Archives">
            ${iconLabel('history', 'ARCHIVES')}
          </button>
          <button class="btn-secondary" data-testid="btn-settings" id="btn-settings" aria-label="Settings">
            ${iconLabel('settings', 'SETTINGS')}
          </button>
          <button class="btn-secondary" id="btn-install-pwa" aria-label="Install App" style="display:none;">
            INSTALL APP
          </button>
          <div class="t-hint" id="title-controller-hint" style="display:none;">
            [D-PAD / ARROWS] SELECT &nbsp; [A / ENTER] CONFIRM
          </div>
          <div class="title-version-watermark" data-testid="title-version-watermark" id="title-version-watermark">
            v${APP_VERSION} [${BUILD_HASH}]
          </div>
          <div class="title-disclaimer" data-testid="title-disclaimer">
            NON-COMMERCIAL FAN PROJECT. NOT ENDORSED BY OR AFFILIATED WITH THE RIGHTS HOLDERS OF THE TERMINATOR FRANCHISE.
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="pwa-install-modal" role="dialog" aria-modal="true" aria-label="Install App" style="display:none;">
        <div class="t800-modal-box" style="max-width:480px; text-align:center; align-items:center;">
          <img class="pwa-icon" src="./icons/icon-192.png" alt="Terminator Survivors Icon" />
          <div class="t800-header">INSTALL APP</div>
          <div id="pwa-install-instructions" class="t-muted" style="font-size:12px; line-height:1.6; margin:8px 0 16px;">
            Install <strong>Terminator Survivors</strong> to your home screen for locked fullscreen landscape controls and offline play.
          </div>
          <div class="btn-row" style="margin-top:0;">
            <button class="btn-primary" id="btn-trigger-pwa-install" aria-label="Install App Now">INSTALL</button>
            <button class="btn-secondary" id="btn-dismiss-pwa-modal" aria-label="Continue in Browser">CONTINUE IN BROWSER</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="bunker-modal" role="dialog" aria-modal="true" aria-label="Requisition" style="display:none;">
        <div class="t800-modal-box" style="max-width:760px;">
          <div class="t800-header">REQUISITION</div>
          <div class="t800-ticker" id="bunker-scrap-header">SCRAP 0</div>

          <div class="t-section-label" style="margin-top:0;">PERMANENT UPGRADES</div>
          <div id="bunker-upgrades-list" class="upgrade-card-list"></div>

          <div class="btn-row">
            <button class="btn-secondary" id="btn-refund-upgrades" aria-label="Refund All Scrap">REFUND ALL</button>
            <button class="btn-secondary" id="btn-close-bunker" aria-label="Back">BACK</button>
          </div>
          <div class="t-hint" id="bunker-controller-hint" style="display:none;">
            [D-PAD / ARROWS] BROWSE &nbsp; [A / ENTER] SELECT &nbsp; [B / ESC] BACK
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="achievements-modal" role="dialog" aria-modal="true" aria-label="Achievements" style="display:none;">
        <div class="t800-modal-box" style="max-width:800px;">
          <div class="t800-header">ACHIEVEMENTS</div>
          <div class="t800-ticker" id="achievements-scrap-header">SECURED 0 / 40</div>
          <div id="achievements-list" class="upgrade-card-list"></div>
          <div class="btn-row">
            <button class="btn-secondary" id="btn-close-achievements" aria-label="Back">BACK</button>
          </div>
          <div class="t-hint" id="achievements-controller-hint" style="display:none;">
            [D-PAD / ARROWS] BROWSE &nbsp; [B / ESC] BACK
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
    this.settingsBtn = this.container.querySelector('#btn-settings')!;

    this.bunkerA11y = new ModalA11y(this.bunkerModal, {
      onClose: () => {
        this.audioEngine.playHudScanClose();
        this.bunkerModal.style.display = 'none';
        this.bunkerA11y.deactivate();
        this.updateTitleButtonHighlight();
      },
      onNavigate: (dir) => {
        if (this.bunkerSelectables.length === 0) return false;
        const delta = dir.y !== 0 ? dir.y : dir.x;
        this.selectedBunkerIndex =
          (this.selectedBunkerIndex + delta + this.bunkerSelectables.length) %
          this.bunkerSelectables.length;
        this.updateBunkerHighlight();
        this.bunkerSelectables[this.selectedBunkerIndex]?.focus();
        return true;
      },
      onConfirm: () => {
        if (this.bunkerSelectables[this.selectedBunkerIndex]) {
          this.bunkerSelectables[this.selectedBunkerIndex].click();
          return true;
        }
        return false;
      }
    });

    this.achievementsA11y = new ModalA11y(this.achievementsModal, {
      onClose: () => {
        this.audioEngine.playHudScanClose();
        this.achievementsModal.style.display = 'none';
        this.achievementsA11y.deactivate();
        this.updateTitleButtonHighlight();
      },
      onNavigate: (dir) => {
        if (this.achievementsSelectables.length === 0) return false;
        const delta = dir.y !== 0 ? dir.y : dir.x;
        this.selectedAchievementsIndex =
          (this.selectedAchievementsIndex + delta + this.achievementsSelectables.length) %
          this.achievementsSelectables.length;
        this.updateAchievementsHighlight();
        this.achievementsSelectables[this.selectedAchievementsIndex]?.focus();
        return true;
      },
      onConfirm: () => {
        if (this.achievementsSelectables[this.selectedAchievementsIndex]) {
          this.achievementsSelectables[this.selectedAchievementsIndex].click();
          return true;
        }
        return false;
      }
    });

    this.pwaA11y = new ModalA11y(this.pwaModal, {
      onClose: () => {
        this.audioEngine.playHudScanClose();
        this.pwaModal.style.display = 'none';
        this.pwaA11y.deactivate();
      }
    });

    this.setupPwaInstallPrompt();

    // Button event listeners
    this.startBtn.addEventListener('click', () => {
      this.tryLockMobileLandscape();
      this.hide();
      this.onStartRun({});
    });

    this.bunkerBtn.addEventListener('click', () => {
      this.openBunkerShop();
    });

    this.achievementsBtn.addEventListener('click', () => {
      this.openAchievements();
    });

    this.codexBtn.addEventListener('click', async () => {
      const modal = await this.getOrLoadCodexModal();
      modal.show();
    });

    this.historyBtn.addEventListener('click', () => {
      this.audioEngine.playHudScanOpen();
      this.hide();
      this.onOpenArchives?.();
    });

    this.settingsBtn.addEventListener('click', () => {
      this.audioEngine.playHudScanOpen();
      this.hide();
      this.onOpenSettings?.();
    });

    this.container.querySelector('#btn-close-bunker')?.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.bunkerModal.style.display = 'none';
      this.bunkerA11y.deactivate();
      this.updateTitleButtonHighlight();
    });

    this.container.querySelector('#btn-close-achievements')?.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.achievementsModal.style.display = 'none';
      this.achievementsA11y.deactivate();
      this.updateTitleButtonHighlight();
    });

    // Keyboard navigation for main Title Screen
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isVisible()) return;
      if (
        this.isBunkerVisible() ||
        this.isAchievementsVisible() ||
        this.isPwaModalVisible() ||
        Boolean(this.codexModal?.isVisible())
      ) {
        return;
      }

      const btns = this.getActiveTitleButtons();
      if (btns.length === 0) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.selectedBtnIndex = (this.selectedBtnIndex - 1 + btns.length) % btns.length;
        this.updateTitleButtonHighlight();
        btns[this.selectedBtnIndex]?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.selectedBtnIndex = (this.selectedBtnIndex + 1) % btns.length;
        this.updateTitleButtonHighlight();
        btns[this.selectedBtnIndex]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const activeBtn = btns[this.selectedBtnIndex];
        activeBtn?.click();
      }
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
          'To install on iPhone/iPad:<br/><span class="t-red">1.</span> Tap the Safari <strong>Share</strong> button <strong>[↑]</strong><br/><span class="t-red">2.</span> Select <strong>"Add to Home Screen"</strong> and launch from your home screen.';
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
        this.pwaA11y.activate();
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.installBtn.style.display = 'none';
      this.pwaModal.style.display = 'none';
      this.pwaA11y.deactivate();
    });

    this.installBtn.addEventListener('click', () => {
      if (this.deferredInstallPrompt) {
        void this.triggerNativeInstall();
      } else {
        updateModalInstructions();
        this.pwaModal.style.display = 'flex';
        this.pwaA11y.activate();
      }
    });

    triggerInstallBtn.addEventListener('click', () => {
      void this.triggerNativeInstall();
    });

    dismissModalBtn.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.pwaModal.style.display = 'none';
      this.pwaA11y.deactivate();
    });

    // Automatically prompt user to install PWA on production URL or mobile browser visit if not installed
    const isProdDomain =
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('github.io');
    if (isProdDomain || isMobile) {
      updateModalInstructions();
      this.pwaModal.style.display = 'flex';
      this.pwaA11y.activate();
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
      this.historyBtn,
      this.settingsBtn
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

  public async getOrLoadCodexModal(): Promise<CodexModal> {
    if (!this.codexModal) {
      const { CodexModal } = await import('./CodexModal');
      this.codexModal = new CodexModal(this.container, this.saveManager, this.audioEngine);
    }
    return this.codexModal;
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
        !this.codexModal?.isVisible()
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
    if (this.codexModal?.isVisible()) {
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
    this.bunkerA11y.activate(this.bunkerSelectables[0]);
  }

  private renderBunkerContents(): void {
    const data = this.saveManager.getData();
    const scrapHeader = this.bunkerModal.querySelector('#bunker-scrap-header')!;
    scrapHeader.textContent = `SCRAP ${data.alloyScrap} · KILLS ${data.totalKills}`;

    this.bunkerSelectables = [];

    // Render Upgrades
    const upgradeList = this.bunkerModal.querySelector('#bunker-upgrades-list')!;
    upgradeList.innerHTML = '';
    for (const [upId, cfg] of Object.entries(META_UPGRADES)) {
      const curLv = data.upgrades[upId as MetaUpgradeId] ?? 0;
      const cost = this.saveManager.getUpgradeCost(upId as MetaUpgradeId);
      const isMax = curLv >= cfg.maxLevel;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.setAttribute(
        'aria-label',
        `${cfg.name}, Level ${curLv} of ${cfg.maxLevel}. ${cfg.description}. ${isMax ? 'Max Level' : `Cost: ${cost} Scrap`}`
      );
      card.innerHTML = `
        <div class="upgrade-card-info">
          <div class="upgrade-card-head">
            <div class="upgrade-card-title">${cfg.name} <span class="t-muted">LV ${curLv}/${cfg.maxLevel}</span></div>
            <div class="upgrade-card-sub">${isMax ? 'MAX' : `${cost} SCRAP`}</div>
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
        card.classList.add('is-maxed');
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
    this.achievementsA11y.activate(this.achievementsSelectables[0]);
  }

  private renderAchievements(): void {
    const unlockedIds = this.saveManager.getUnlockedAchievements();
    const count = unlockedIds.length;
    const pct = Math.round((count / TOTAL_ACHIEVEMENTS) * 100);

    const scrapHeader = this.achievementsModal.querySelector('#achievements-scrap-header')!;
    scrapHeader.textContent = `SECURED ${count} / ${TOTAL_ACHIEVEMENTS} (${pct}%)`;

    this.achievementsSelectables = [];
    const listEl = this.achievementsModal.querySelector('#achievements-list')!;
    listEl.innerHTML = '';

    for (const ach of Object.values(ACHIEVEMENTS)) {
      const isUnlocked = unlockedIds.includes(ach.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.setAttribute(
        'aria-label',
        `${ach.title}, ${ach.category}. ${ach.description}. ${isUnlocked ? 'Secured' : 'Locked'}`
      );
      if (!isUnlocked) card.classList.add('is-locked');

      card.innerHTML = `
        <div class="upgrade-card-info">
          <div class="upgrade-card-head">
            <div class="upgrade-card-title">${ach.title} <span class="t-tag">${ach.category}</span></div>
            ${isUnlocked ? '<span class="t-tag t-tag-on">SECURED</span>' : `<span class="upgrade-card-sub">${ach.reward.description}</span>`}
          </div>
          <div class="upgrade-card-desc">${ach.description}</div>
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
