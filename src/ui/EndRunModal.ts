import { LORE } from '../data/lore';

export class EndRunModal {
  public readonly container: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly statsEl: HTMLElement;
  private readonly loreEl: HTMLElement;
  private onReturnCallback: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="text-align:center;">
        <div class="t800-header" id="end-title">TERMINATED</div>
        <div class="t800-ticker" id="end-ticker">WAR LOG // LOS ANGELES 2029</div>
        <div id="end-stats" style="font-family:var(--font-telemetry); font-size:15px; color:#fff; margin:18px 0; line-height:1.8;"></div>
        <div id="end-lore" style="font-size:13px; color:var(--color-chrome); margin-bottom:20px; line-height:1.5;"></div>
        <button class="btn-primary" id="btn-return-bunker" style="align-self:center;">
          RETURN TO COMMAND
        </button>
      </div>
    `;

    root.appendChild(this.container);

    this.titleEl = this.container.querySelector('#end-title')!;
    this.statsEl = this.container.querySelector('#end-stats')!;
    this.loreEl = this.container.querySelector('#end-lore')!;

    this.container.querySelector('#btn-return-bunker')?.addEventListener('click', () => {
      this.container.style.display = 'none';
      this.onReturnCallback?.();
    });
  }

  public show(
    victory: boolean,
    timeSeconds: number,
    kills: number,
    level: number,
    scrap: number,
    onReturn: () => void
  ): void {
    this.onReturnCallback = onReturn;
    this.container.style.display = 'flex';

    const sec = Math.floor(timeSeconds);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    if (victory) {
      this.titleEl.textContent = 'MISSION ACCOMPLISHED';
      this.titleEl.style.color = 'var(--color-cyan)';
      this.loreEl.textContent = LORE.victoryText;
    } else {
      this.titleEl.textContent = 'TERMINATED';
      this.titleEl.style.color = 'var(--color-red)';
      this.loreEl.textContent = LORE.defeatText;
    }

    this.statsEl.innerHTML = `
      <div>TIME SURVIVED: <span style="color:var(--color-amber)">${timeFormatted}</span></div>
      <div>TERMINATIONS: <span style="color:var(--color-red)">${kills}</span></div>
      <div>FIELD LEVEL: <span style="color:var(--color-cyan)">LV ${level}</span></div>
      <div>ALLOY SCRAP RECOVERED: <span style="color:#ffd700">+${scrap}</span></div>
    `;
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
