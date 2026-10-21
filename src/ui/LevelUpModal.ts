import type { UpgradeChoice } from '../core/types';
import { icon, passiveIcon, weaponIcon, iconLabel } from './icons';
import type { GamepadManager } from '../input/GamepadManager';
import { ModalA11y } from './A11yHelper';

export interface LevelUpActions {
  rerollsLeft: number;
  /** One-time explanation shown under the cards */
  tip?: string;
  onReroll?: () => void;
}

export class LevelUpModal {
  public readonly container: HTMLElement;
  private readonly cardContainer: HTMLElement;
  private readonly tickerEl: HTMLElement;
  private readonly rerollBtn: HTMLButtonElement;
  private onSelectCallback: ((choice: UpgradeChoice) => void) | null = null;
  private currentActions: LevelUpActions | null = null;
  private cards: HTMLElement[] = [];
  private selectables: HTMLElement[] = [];
  private selectedIndex = 0;
  private readonly a11y: ModalA11y;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'levelup-modal';
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'levelup-modal');
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Select Upgrade');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box">
        <div class="t800-header">SELECT UPGRADE</div>
        <div class="t800-ticker" id="levelup-ticker">LEVEL 2</div>
        <div class="upgrade-card-list" id="levelup-cards"></div>
        <div class="t-hint" id="levelup-tip" style="display:none;"></div>

        <div class="btn-row levelup-actions-row">
          <button class="btn-secondary btn-sm" id="btn-levelup-reroll" aria-label="Reroll Upgrade Choices">REROLL (0)</button>
        </div>

        <div class="t-hint" id="levelup-controller-hint" style="display:none;">
          [D-PAD / ARROWS] SELECT &nbsp; [A / ENTER] CONFIRM &nbsp; [R] REROLL
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.cardContainer = this.container.querySelector('#levelup-cards')!;
    this.tickerEl = this.container.querySelector('#levelup-ticker')!;
    this.rerollBtn = this.container.querySelector('#btn-levelup-reroll') as HTMLButtonElement;

    this.rerollBtn.onclick = () => {
      if ((this.currentActions?.rerollsLeft ?? 0) > 0) {
        this.currentActions?.onReroll?.();
      }
    };

    this.a11y = new ModalA11y(this.container, {
      onNavigate: (dir) => {
        const d = dir.y !== 0 ? dir.y : dir.x;
        this.selectedIndex = (this.selectedIndex + d + this.selectables.length) % this.selectables.length;
        this.updateCardHighlight();
        return true;
      },
      onConfirm: () => {
        const target = this.selectables[this.selectedIndex];
        if (target) {
          target.click();
          return true;
        }
        return false;
      }
    });

    // Keyboard shortcut for Reroll (R)
    this.container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.container.style.display === 'none') return;
      if (e.key === 'r' || e.key === 'R') {
        if (!this.rerollBtn.disabled) {
          e.preventDefault();
          this.rerollBtn.click();
        }
      }
    });
  }

  public show(
    level: number,
    choices: UpgradeChoice[],
    onSelect: (choice: UpgradeChoice) => void,
    actions?: LevelUpActions
  ): void {
    this.onSelectCallback = onSelect;
    this.currentActions = actions ?? null;
    this.container.style.display = 'flex';
    this.selectedIndex = 0;
    this.cards = [];
    this.selectables = [];

    this.tickerEl.textContent = `LEVEL ${level}`;
    const tipEl = this.container.querySelector('#levelup-tip') as HTMLElement;
    tipEl.textContent = actions?.tip ?? '';
    tipEl.style.display = actions?.tip ? 'block' : 'none';

    // Update Action Button states (disabled styling comes from CSS)
    const rerolls = actions?.rerollsLeft ?? 0;

    this.rerollBtn.innerHTML = iconLabel('reroll', `REROLL (${rerolls})`);
    this.rerollBtn.disabled = rerolls <= 0;


    this.cardContainer.innerHTML = '';
    choices.forEach((choice, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.setAttribute('data-testid', `upgrade-card-${idx}`);
      card.setAttribute(
        'aria-label',
        `${choice.title}: ${choice.subtitle}. ${choice.description}`
      );

      const isStatDiff = choice.description.includes(' · ');
      card.innerHTML = `
        <div class="upgrade-card-icon">${this.choiceIcon(choice)}</div>
        <div class="upgrade-card-info">
          <div class="upgrade-card-head">
            <div class="upgrade-card-title">${choice.title}</div>
            <div class="upgrade-card-sub">${choice.subtitle}</div>
          </div>
          <div class="upgrade-card-desc${isStatDiff ? ' upgrade-card-stats' : ''}">${choice.description}</div>
          ${choice.synergyHint ? `<div class="upgrade-card-desc">${choice.synergyHint}</div>` : ''}
        </div>
      `;

      card.onclick = () => {
        this.a11y.deactivate();
        this.container.style.display = 'none';
        this.onSelectCallback?.(choice);
      };

      this.cardContainer.appendChild(card);
      this.cards.push(card);
    });

    this.selectables = [...this.cards];
    if (rerolls > 0) this.selectables.push(this.rerollBtn);

    this.updateCardHighlight();
    this.a11y.activate(this.cards[0]);
  }

  private choiceIcon(choice: UpgradeChoice): string {
    const opts = { size: 34 };
    switch (choice.kind) {
      case 'weapon':
        return weaponIcon(choice.id as Parameters<typeof weaponIcon>[0], opts);
      case 'passive':
        return passiveIcon(choice.id as Parameters<typeof passiveIcon>[0], opts);
      case 'heal':
        return icon('health', opts);
      default:
        return icon('scrap', opts);
    }
  }

  public updateCardHighlight(): void {
    this.selectables.forEach((c, i) => {
      if (i === this.selectedIndex) {
        c.classList.add('controller-selected');
        c.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      } else {
        c.classList.remove('controller-selected');
      }
    });
  }

  public handleGamepad(gp: GamepadManager, dt: number): boolean {
    if (this.container.style.display === 'none' || this.selectables.length === 0) return false;

    // Show controller hint if connected
    const hintEl = this.container.querySelector('#levelup-controller-hint') as HTMLElement | null;
    if (hintEl) {
      hintEl.style.display = gp.hasActiveController ? 'block' : 'none';
    }

    const nav = gp.getMenuNavigation(dt);
    if (nav.y !== 0 || nav.x !== 0) {
      const dir = nav.y !== 0 ? nav.y : nav.x;
      this.selectedIndex = (this.selectedIndex + dir + this.selectables.length) % this.selectables.length;
      this.updateCardHighlight();
      gp.playRumble(30, 0.05, 0.22);
      return true;
    }

    if (gp.isMenuConfirmPressed()) {
      if (this.selectables[this.selectedIndex]) {
        gp.playRumble(90, 0.45, 0.55);
        this.selectables[this.selectedIndex].click();
        return true;
      }
    }

    return true;
  }

  public hide(): void {
    this.a11y.deactivate();
    this.container.style.display = 'none';
  }
}
