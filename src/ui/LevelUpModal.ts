import type { UpgradeChoice } from '../core/types';
import { LORE } from '../data/lore';
import { globalRNG } from '../core/RNG';

export class LevelUpModal {
  public readonly container: HTMLElement;
  private readonly cardContainer: HTMLElement;
  private readonly tickerEl: HTMLElement;
  private onSelectCallback: ((choice: UpgradeChoice) => void) | null = null;

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
      </div>
    `;

    root.appendChild(this.container);

    this.cardContainer = this.container.querySelector('#levelup-cards')!;
    this.tickerEl = this.container.querySelector('#levelup-ticker')!;
  }

  public show(level: number, choices: UpgradeChoice[], onSelect: (choice: UpgradeChoice) => void): void {
    this.onSelectCallback = onSelect;
    this.container.style.display = 'flex';

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
    });
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
