import type { WeaponId } from '../core/types';
import { ALL_WEAPONS } from '../data/weapons';
import type { GamepadManager } from '../input/GamepadManager';
import { ModalA11y } from './A11yHelper';
import { icon } from './icons';

export class VaultJackpotModal {
  public readonly container: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly descEl: HTMLElement;
  private readonly claimBtn: HTMLElement;
  private onClaimCallback: (() => void) | null = null;
  private readonly a11y: ModalA11y;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'vault-modal');
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Data Vault Decrypted');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="max-width:480px; text-align:center;">
        <div class="t800-header" id="vault-title">DATA VAULT DECRYPTED</div>
        <div id="vault-desc" style="margin:18px 0; line-height:1.7;"></div>
        <button class="btn-primary" data-testid="btn-claim-vault" id="btn-claim-vault" aria-label="Claim" style="align-self:center;">
          CLAIM
        </button>
        <div class="t-hint" id="vault-controller-hint" style="display:none;">[A / ENTER] CLAIM</div>
      </div>
    `;

    root.appendChild(this.container);

    this.titleEl = this.container.querySelector('#vault-title')!;
    this.descEl = this.container.querySelector('#vault-desc')!;
    this.claimBtn = this.container.querySelector('#btn-claim-vault')!;

    this.a11y = new ModalA11y(this.container, {
      onClose: () => {
        this.claimBtn.click();
      },
      onConfirm: () => {
        this.claimBtn.click();
        return true;
      }
    });

    this.claimBtn.addEventListener('click', () => {
      this.a11y.deactivate();
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
      this.titleEl.innerHTML = `${icon('evolution')}<span class="gi-label">EVOLUTION UNLOCKED</span>`;
      this.descEl.innerHTML = `
        <div style="font-size:20px;">${def?.name ?? evolvedWeapon}</div>
        <div class="t-muted" style="font-size:12px; margin:6px 0 12px;">${def?.levels[0].description}</div>
        <div>+${alloyBonus} SCRAP</div>
      `;
    } else {
      this.titleEl.innerHTML = `${icon('vault')}<span class="gi-label">DATA VAULT DECRYPTED</span>`;
      this.descEl.innerHTML = `
        <div style="font-size:18px;">3 UPGRADES AUTHORISED</div>
        <div>+${alloyBonus} SCRAP</div>
      `;
    }

    this.a11y.activate(this.claimBtn);
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
    this.a11y.deactivate();
    this.container.style.display = 'none';
  }
}
