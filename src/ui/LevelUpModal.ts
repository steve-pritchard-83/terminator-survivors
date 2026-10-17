import type { UpgradeChoice } from '../core/types';
import { LORE } from '../data/lore';
import { globalRNG } from '../core/RNG';
import type { GamepadManager } from '../input/GamepadManager';

export class LevelUpModal {
  public readonly container: HTMLElement;
  private readonly cardContainer: HTMLElement;
  private readonly tickerEl: HTMLElement;
  private onSelectCallback: ((choice: UpgradeChoice) => void) | null = null;
  private cards: HTMLElement[] = [];
  private selectedIndex = 0;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'levelup-modal');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box">
        <div class="t800-header">TACTICAL UPGRADE // CSM-101</div>
        <div class="t800-ticker" id="levelup-ticker">03A0: A9 01 8D 20 D0 // SCANNING ARSENAL</div>
        <div class="upgrade-card-list" id="levelup-cards"></div>
        <div id="levelup-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:8px; text-align:center; display:none;">
          [D-PAD / LS] SELECT UPGRADE &nbsp;//&nbsp; [A / RT] CONFIRM REQUISITION
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.cardContainer = this.container.querySelector('#levelup-cards')!;
    this.tickerEl = this.container.querySelector('#levelup-ticker')!;
  }

  public show(
    level: number,
    choices: UpgradeChoice[],
    onSelect: (choice: UpgradeChoice) => void
  ): void {
    this.onSelectCallback = onSelect;
    this.container.style.display = 'flex';
    this.selectedIndex = 0;
    this.cards = [];

    // Pick random 6502 assembly line for flavor
    const tickerLine = globalRNG.pick(LORE.assembly6502);
    this.tickerEl.textContent = `${tickerLine} // LEVEL ${level}`;

    this.cardContainer.innerHTML = '';
    choices.forEach((choice, idx) => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.setAttribute('data-testid', `upgrade-card-${idx}`);

      card.innerHTML = `
        <div style="width:12px; height:48px; background:${choice.accentColor}; border-radius:2px;"></div>
        <div class="upgrade-card-info">
          <div class="upgrade-card-title">${choice.title}</div>
          <div class="upgrade-card-sub">${choice.subtitle}</div>
          <div class="upgrade-card-desc">${choice.description}</div>
          ${choice.synergyHint ? `<div style="font-size:11px; color:#00e5ff; margin-top:3px;">${choice.synergyHint}</div>` : ''}
        </div>
      `;

      card.onclick = () => {
        this.container.style.display = 'none';
        this.onSelectCallback?.(choice);
      };

      this.cardContainer.appendChild(card);
      this.cards.push(card);
    });

    this.updateCardHighlight();
  }

  public updateCardHighlight(): void {
    this.cards.forEach((c, i) => {
      if (i === this.selectedIndex) {
        c.classList.add('controller-selected');
        c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        c.classList.remove('controller-selected');
      }
    });
  }

  public handleGamepad(gp: GamepadManager, dt: number): boolean {
    if (this.container.style.display === 'none' || this.cards.length === 0) return false;

    // Show controller hint if connected
    const hintEl = this.container.querySelector('#levelup-controller-hint') as HTMLElement | null;
    if (hintEl) {
      hintEl.style.display = gp.hasActiveController ? 'block' : 'none';
    }

    const nav = gp.getMenuNavigation(dt);
    if (nav.y !== 0 || nav.x !== 0) {
      const dir = nav.y !== 0 ? nav.y : nav.x;
      this.selectedIndex = (this.selectedIndex + dir + this.cards.length) % this.cards.length;
      this.updateCardHighlight();
      gp.playRumble(30, 0.05, 0.22);
      return true;
    }

    if (gp.isMenuConfirmPressed()) {
      if (this.cards[this.selectedIndex]) {
        gp.playRumble(90, 0.45, 0.55);
        this.cards[this.selectedIndex].click();
        return true;
      }
    }

    return true;
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
