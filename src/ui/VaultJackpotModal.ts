import type { WeaponId } from '../core/types';
import { ALL_WEAPONS } from '../data/weapons';
import type { GamepadManager } from '../input/GamepadManager';

export class VaultJackpotModal {
  public readonly container: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly descEl: HTMLElement;
  private readonly claimBtn: HTMLElement;
  private onClaimCallback: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'vault-modal');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="text-align:center;">
        <div class="t800-header" id="vault-title" style="color:var(--color-amber);">
          SKYNET DATA VAULT DECRYPTED
        </div>
        <div class="t800-ticker">SECURITY PROTOCOL BYPASSED // REQUISITION OVERRIDE</div>
        <div id="vault-desc" style="font-size:15px; color:#fff; margin:20px 0; line-height:1.6;"></div>
        <button class="btn-primary" data-testid="btn-claim-vault" id="btn-claim-vault" style="align-self:center;">
          SECURE SALVAGE
        </button>
        <div id="vault-controller-hint" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-cyan); margin-top:12px; display:none;">
          [A / START] SECURE SALVAGE
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.titleEl = this.container.querySelector('#vault-title')!;
    this.descEl = this.container.querySelector('#vault-desc')!;
    this.claimBtn = this.container.querySelector('#btn-claim-vault')!;

    this.claimBtn.addEventListener('click', () => {
      this.container.style.display = 'none';
      this.onClaimCallback?.();
    });
  }

  public show(
    upgradesAwarded: number,
    evolvedWeapon: WeaponId | undefined,
    alloyBonus: number,
    onClaim: () => void
  ): void {
    this.onClaimCallback = onClaim;
    this.container.style.display = 'flex';

    if (evolvedWeapon) {
      const def = ALL_WEAPONS[evolvedWeapon];
      this.titleEl.textContent = 'SUPERWEAPON EVOLUTION UNLOCKED!';
      this.titleEl.style.color = '#e600ff';
      this.descEl.innerHTML = `
        <div style="font-family:var(--font-display); font-size:20px; color:#e600ff; margin-bottom:8px;">
          ${def?.name ?? evolvedWeapon}
        </div>
        <div style="color:var(--color-chrome); margin-bottom:12px;">${def?.levels[0].description}</div>
        <div style="color:var(--color-amber);">+${alloyBonus} ALLOY SCRAP SECURED</div>
      `;
    } else {
      this.titleEl.textContent = 'SKYNET DATA VAULT UNLOCKED';
      this.titleEl.style.color = 'var(--color-amber)';
      this.descEl.innerHTML = `
        <div style="font-family:var(--font-display); font-size:18px; color:var(--color-cyan); margin-bottom:8px;">
          ${upgradesAwarded}x TACTICAL ADVANCEMENTS GRANTED
        </div>
        <div style="color:var(--color-amber);">+${alloyBonus} ALLOY SCRAP SECURED</div>
      `;
    }
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  public handleGamepad(gp: GamepadManager): boolean {
    if (!this.isVisible()) return false;

    const hintEl = this.container.querySelector('#vault-controller-hint') as HTMLElement | null;
    if (hintEl) {
      hintEl.style.display = gp.hasActiveController ? 'block' : 'none';
    }

    if (gp.isMenuConfirmPressed() || gp.isMenuCancelPressed()) {
      gp.playRumble(80, 0.35, 0.5);
      this.claimBtn.click();
      return true;
    }

    return true;
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
