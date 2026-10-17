import type { UpgradeChoice } from '../core/types';
import { LORE } from '../data/lore';
import { globalRNG } from '../core/RNG';
import type { GamepadManager } from '../input/GamepadManager';
import { ModalA11y } from './A11yHelper';

export interface LevelUpActions {
  rerollsLeft: number;
  skipsLeft: number;
  banishesLeft: number;
  onReroll?: () => void;
  onSkip?: () => void;
  onBanish?: (choice: UpgradeChoice) => void;
}

export class LevelUpModal {
  public readonly container: HTMLElement;
  private readonly cardContainer: HTMLElement;
  private readonly tickerEl: HTMLElement;
  private readonly rerollBtn: HTMLButtonElement;
  private readonly skipBtn: HTMLButtonElement;
  private readonly banishBtn: HTMLButtonElement;
  private onSelectCallback: ((choice: UpgradeChoice) => void) | null = null;
  private currentActions: LevelUpActions | null = null;
  private currentChoices: UpgradeChoice[] = [];
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
    this.container.setAttribute('aria-label', 'Tactical Upgrade Selection');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box">
        <div class="t800-header">TACTICAL UPGRADE // CSM-101</div>
        <div class="t800-ticker" id="levelup-ticker">03A0: A9 01 8D 20 D0 // SCANNING ARSENAL</div>
        <div class="upgrade-card-list" id="levelup-cards"></div>
        
        <div class="levelup-actions-row" style="display:flex; justify-content:center; gap:10px; margin-top:14px; flex-wrap:wrap;">
          <button class="btn-secondary" id="btn-levelup-reroll" aria-label="Reroll Upgrade Choices" style="padding:6px 14px; font-size:12px; border-color:var(--color-cyan); color:var(--color-cyan);">
            REROLL (0)
          </button>
          <button class="btn-secondary" id="btn-levelup-skip" aria-label="Skip Upgrade and Gain Scrap" style="padding:6px 14px; font-size:12px; border-color:var(--color-amber); color:var(--color-amber);">
            SKIP (+25 SCRAP) (0)
          </button>
          <button class="btn-secondary" id="btn-levelup-banish" aria-label="Banish Selected Upgrade" style="padding:6px 14px; font-size:12px; border-color:var(--color-red); color:var(--color-red);">
            BANISH SELECTED (0)
          </button>
        </div>

        <div id="levelup-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:10px; text-align:center; display:none;">
          [D-PAD / LS / ARROWS] SELECT &nbsp;//&nbsp; [ENTER / A] CONFIRM &nbsp;//&nbsp; [R] REROLL &nbsp;//&nbsp; [S] SKIP &nbsp;//&nbsp; [B] BANISH
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.cardContainer = this.container.querySelector('#levelup-cards')!;
    this.tickerEl = this.container.querySelector('#levelup-ticker')!;
    this.rerollBtn = this.container.querySelector('#btn-levelup-reroll') as HTMLButtonElement;
    this.skipBtn = this.container.querySelector('#btn-levelup-skip') as HTMLButtonElement;
    this.banishBtn = this.container.querySelector('#btn-levelup-banish') as HTMLButtonElement;

    this.rerollBtn.onclick = () => {
      if ((this.currentActions?.rerollsLeft ?? 0) > 0) {
        this.currentActions?.onReroll?.();
      }
    };

    this.skipBtn.onclick = () => {
      if ((this.currentActions?.skipsLeft ?? 0) > 0) {
        this.hide();
        this.currentActions?.onSkip?.();
      }
    };

    this.banishBtn.onclick = () => {
      if ((this.currentActions?.banishesLeft ?? 0) > 0) {
        const choice = this.currentChoices[this.selectedIndex] ?? this.currentChoices[0];
        if (choice) {
          this.currentActions?.onBanish?.(choice);
        }
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

    // Keyboard shortcuts for Reroll (R), Skip (S), Banish (B)
    this.container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.container.style.display === 'none') return;
      if (e.key === 'r' || e.key === 'R') {
        if (!this.rerollBtn.disabled) {
          e.preventDefault();
          this.rerollBtn.click();
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (!this.skipBtn.disabled) {
          e.preventDefault();
          this.skipBtn.click();
        }
      } else if (e.key === 'b' || e.key === 'B') {
        if (!this.banishBtn.disabled) {
          e.preventDefault();
          this.banishBtn.click();
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
    this.currentChoices = choices;
    this.container.style.display = 'flex';
    this.selectedIndex = 0;
    this.cards = [];
    this.selectables = [];

    // Pick random 6502 assembly line for flavor
    const tickerLine = globalRNG.pick(LORE.assembly6502);
    this.tickerEl.textContent = `${tickerLine} // LEVEL ${level}`;

    // Update Action Button states
    const rerolls = actions?.rerollsLeft ?? 0;
    const skips = actions?.skipsLeft ?? 0;
    const banishes = actions?.banishesLeft ?? 0;

    this.rerollBtn.textContent = `REROLL (${rerolls})`;
    this.rerollBtn.disabled = rerolls <= 0;
    this.rerollBtn.style.opacity = rerolls > 0 ? '1.0' : '0.4';
    this.rerollBtn.style.cursor = rerolls > 0 ? 'pointer' : 'default';

    this.skipBtn.textContent = `SKIP (+25 SCRAP) (${skips})`;
    this.skipBtn.disabled = skips <= 0;
    this.skipBtn.style.opacity = skips > 0 ? '1.0' : '0.4';
    this.skipBtn.style.cursor = skips > 0 ? 'pointer' : 'default';

    this.banishBtn.textContent = `BANISH SELECTED (${banishes})`;
    this.banishBtn.disabled = banishes <= 0;
    this.banishBtn.style.opacity = banishes > 0 ? '1.0' : '0.4';
    this.banishBtn.style.cursor = banishes > 0 ? 'pointer' : 'default';

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

      card.innerHTML = `
        <div style="width:12px; height:48px; background:${choice.accentColor}; border-radius:2px; flex-shrink:0;"></div>
        <div class="upgrade-card-info">
          <div class="upgrade-card-title">${choice.title}</div>
          <div class="upgrade-card-sub">${choice.subtitle}</div>
          <div class="upgrade-card-desc" style="${choice.description.includes(' · ') ? 'font-family:var(--font-telemetry); color:var(--color-amber); letter-spacing:0.5px;' : ''}">${choice.description}</div>
          ${choice.synergyHint ? `<div style="font-size:11px; color:#00e5ff; margin-top:3px;">${choice.synergyHint}</div>` : ''}
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
    if (skips > 0) this.selectables.push(this.skipBtn);
    if (banishes > 0) this.selectables.push(this.banishBtn);

    this.updateCardHighlight();
    this.a11y.activate(this.cards[0]);
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
