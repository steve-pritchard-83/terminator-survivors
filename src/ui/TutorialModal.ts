import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { GamepadManager } from '../input/GamepadManager';
import { ModalA11y } from './A11yHelper';

export interface TutorialPhase {
  tag: string;
  title: string;
  subtitle: string;
  details: string[];
  tip: string;
  icon: string;
}

export const TUTORIAL_PHASES: TutorialPhase[] = [
  {
    tag: 'PHASE 01 // 06',
    title: 'TACTICAL MOVEMENT',
    subtitle: 'SECTOR 44 NAVIGATION & EVASIVE FOOTWORK',
    details: [
      '<strong>DESKTOP:</strong> [W / A / S / D] or [ARROW KEYS] to traverse the battlefield ruins. Left-click anywhere for ground-target waypoint guidance.',
      '<strong>GAMEPAD:</strong> [LEFT ANALOG STICK] or [D-PAD] for precision 360° omnidirectional locomotion.',
      '<strong>TOUCH MOBILE:</strong> Drag the holographic thumbstick in the bottom-left screen quadrant.'
    ],
    tip: 'TACTICAL DOCTRINE: Maintain continuous mobility. Skynet Hunter-Killer ground forces actively attempt encirclement.',
    icon: '🏃'
  },
  {
    tag: 'PHASE 02 // 06',
    title: 'TARGET ACQUISITION & WEAPON SYSTEMS',
    subtitle: 'AUTOMATED FIRE CONTROL & MANUAL OVERRIDE',
    details: [
      '<strong>AUTO-ENGAGE:</strong> All active weapons automatically acquire and fire upon the nearest Skynet hostiles within weapon effective range.',
      '<strong>MANUAL OVERRIDE:</strong> Move the mouse crosshair or tilt the [RIGHT ANALOG STICK] to override auto-aim and concentrate fire.',
      '<strong>BALLISTIC ARC:</strong> Heavy munitions (grenades, rockets) arc over terrain obstacles.'
    ],
    tip: 'TACTICAL DOCTRINE: Line up straight-shot piercing beams (Plasma Rifle) with incoming enemy columns for massive multikills.',
    icon: '🎯'
  },
  {
    tag: 'PHASE 03 // 06',
    title: 'COMBAT DIVE // EVASION',
    subtitle: 'EMERGENCY EVASION WITH INVULNERABILITY FRAMES',
    details: [
      '<strong>TRIGGER:</strong> Press [SPACEBAR], [RIGHT CLICK], Gamepad [A / RT / RB], or the Mobile [DASH] button.',
      '<strong>INVULNERABILITY:</strong> Kyle gains a 0.5-second i-frame evasion window, ignoring all contact damage and laser fire.',
      '<strong>MOMENTUM:</strong> Breaks enemy body-blocks and glides cleanly through tight clusters of Crab Drones and Endoskeletons.'
    ],
    tip: 'TACTICAL DOCTRINE: When cornered, dive directly THROUGH the enemy line into open terrain rather than retreating into walls.',
    icon: '⚡'
  },
  {
    tag: 'PHASE 04 // 06',
    title: 'DATA CORES & ALLOY SALVAGE',
    subtitle: 'RECOVERING SKYNET TELEMETRY & SCRAP METAL',
    details: [
      '<strong>CYAN CORE:</strong> Standard tactical telemetry (+XP) dropped by light drones and T-600 units.',
      '<strong>VIOLET CORE:</strong> High-density military core (+5× XP) dropped by elite machines.',
      '<strong>GOLD CORE:</strong> Skynet Command Core (+25× XP) dropped by Boss Hunter-Killers.',
      '<strong>ALLOY SCRAP:</strong> Persistent salvage retrieved during missions. Used in Tech-Com Bunker for permanent field upgrades.'
    ],
    tip: 'TACTICAL DOCTRINE: Rapid core collection triggers DATA LINK COMBO multipliers, magnetically pulling distant salvage toward you.',
    icon: '💎'
  },
  {
    tag: 'PHASE 05 // 06',
    title: 'LEVEL-UP REQUISITION',
    subtitle: 'TECH-COM ARSENAL // 14 WEAPONS & 12 PASSIVES',
    details: [
      '<strong>REQUISITION DROP:</strong> Filling the XP bar temporarily halts combat and requests high-priority Resistance armaments.',
      '<strong>ARSENAL CAPACITY:</strong> Equip up to 6 simultaneous weapons and 6 auxiliary tactical passives.',
      '<strong>SYNERGISTIC BUILDS:</strong> Pair defensive modules (Armor Vest, Combat Stims) with high-spread suppression firearms.'
    ],
    tip: 'TACTICAL DOCTRINE: Reroll, Skip (+Scrap), and Banish options can be unlocked in the Bunker Requisition shop.',
    icon: '📦'
  },
  {
    tag: 'PHASE 06 // 06',
    title: 'MILITARY WEAPON EVOLUTION',
    subtitle: 'SUPERIOR ALLOY SYNTHESIS // EVOLVED WEAPONS',
    details: [
      '<strong>REQUIREMENTS:</strong> Upgrade any base weapon to maximum (Level 8) while carrying its paired tactical passive.',
      '<strong>DECRYPTION VAULTS:</strong> Defeat Hunter-Killer minibosses to spawn Skynet Security Crates. Decrypt them to synthesize the evolution.',
      '<strong>EXAMPLES:</strong><br/>• Phased Plasma Rifle (Lv 8) + Phase Capacitor = Plasma Beam Overloader<br/>• Grenade Launcher (Lv 8) + Blast Dampeners = Cluster Bomb Mortar<br/>• Minigun (Lv 8) + High Caliber = Vulcan Annihilator'
    ],
    tip: 'TACTICAL DOCTRINE: Evolved weapons possess screen-clearing devastation essential for surviving late-minute Skynet Swarms.',
    icon: '🔥'
  }
];

export class TutorialModal {
  public readonly container: HTMLElement;
  private currentStep = 0;
  private onFinishCallback: (() => void) | null = null;
  private readonly a11y: ModalA11y;

  private readonly tagEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly detailsEl: HTMLElement;
  private readonly tipEl: HTMLElement;
  private readonly iconEl: HTMLElement;
  private readonly dotsContainer: HTMLElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly skipBtn: HTMLButtonElement;

  constructor(
    root: HTMLElement,
    private readonly saveManager: SaveManager,
    private readonly audioEngine: AudioEngine
  ) {
    this.container = document.createElement('div');
    this.container.id = 'tutorial-modal';
    this.container.className = 'modal-backdrop';
    this.container.setAttribute('data-testid', 'tutorial-modal');
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Tech-Com Tactical Boot Camp');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="max-width: 680px; padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(77,210,255,0.3); padding-bottom:8px;">
          <div>
            <div class="t800-header" style="font-size:20px; letter-spacing:2px; margin:0;">TECH-COM BOOT CAMP</div>
            <div id="tutorial-phase-tag" style="font-family:var(--font-telemetry); font-size:11px; color:var(--color-cyan); margin-top:2px;">PHASE 01 // 06</div>
          </div>
          <div id="tutorial-icon" style="font-size:32px; filter:drop-shadow(0 0 10px rgba(77,210,255,0.6));">🏃</div>
        </div>

        <div style="margin-bottom:16px;">
          <div id="tutorial-title" style="font-family:var(--font-display); font-size:16px; color:#fff; letter-spacing:1px; margin-bottom:4px;">TACTICAL MOVEMENT</div>
          <div id="tutorial-subtitle" style="font-family:var(--font-telemetry); font-size:12px; color:var(--color-amber); margin-bottom:14px; text-transform:uppercase;">SECTOR 44 NAVIGATION</div>
          
          <div id="tutorial-details" style="font-family:var(--font-tactical); font-size:14px; line-height:1.6; color:var(--color-chrome); background:rgba(10,20,30,0.7); border:1px solid rgba(77,210,255,0.25); border-radius:4px; padding:12px 16px; margin-bottom:12px; min-height:110px;"></div>

          <div id="tutorial-tip-box" style="font-family:var(--font-telemetry); font-size:12px; line-height:1.4; color:var(--color-cyan); background:rgba(0,40,60,0.4); border-left:3px solid var(--color-cyan); padding:8px 12px; border-radius:2px;">
            <span id="tutorial-tip-text"></span>
          </div>
        </div>

        <!-- Progress step dots -->
        <div id="tutorial-dots" style="display:flex; justify-content:center; gap:8px; margin-bottom:18px;"></div>

        <!-- Actions -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <button class="btn-secondary" id="btn-tutorial-skip" aria-label="Skip Boot Camp" style="border-color:#ff8844; color:#ffaa66; padding:8px 16px; font-size:12px;">
            SKIP BOOT CAMP
          </button>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="btn-tutorial-prev" aria-label="Previous Phase" style="padding:8px 18px; font-size:12px;">
              ‹ PREVIOUS
            </button>
            <button class="btn-primary" id="btn-tutorial-next" aria-label="Next Phase" style="padding:8px 24px; font-size:12px; margin-bottom:0;">
              NEXT PHASE ›
            </button>
          </div>
        </div>

        <div id="tutorial-controller-hint" style="font-family:var(--font-telemetry); font-size:11px; color:var(--color-cyan); text-align:center; margin-top:10px;">
          [← / → / D-PAD] BROWSE &nbsp;//&nbsp; [ENTER / A] ADVANCE &nbsp;//&nbsp; [ESC / B] SKIP
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.tagEl = this.container.querySelector('#tutorial-phase-tag')!;
    this.titleEl = this.container.querySelector('#tutorial-title')!;
    this.subtitleEl = this.container.querySelector('#tutorial-subtitle')!;
    this.detailsEl = this.container.querySelector('#tutorial-details')!;
    this.tipEl = this.container.querySelector('#tutorial-tip-text')!;
    this.iconEl = this.container.querySelector('#tutorial-icon')!;
    this.dotsContainer = this.container.querySelector('#tutorial-dots')!;
    this.prevBtn = this.container.querySelector('#btn-tutorial-prev') as HTMLButtonElement;
    this.nextBtn = this.container.querySelector('#btn-tutorial-next') as HTMLButtonElement;
    this.skipBtn = this.container.querySelector('#btn-tutorial-skip') as HTMLButtonElement;

    this.prevBtn.addEventListener('click', () => this.prev());
    this.nextBtn.addEventListener('click', () => this.next());
    this.skipBtn.addEventListener('click', () => this.skip());

    this.a11y = new ModalA11y(this.container, {
      onClose: () => this.skip(),
      onNavigate: (dir) => {
        if (dir.x < 0) {
          this.prev();
          return true;
        } else if (dir.x > 0) {
          this.next();
          return true;
        }
        return false;
      },
      onConfirm: () => {
        this.next();
        return true;
      }
    });

    this.renderDots();
  }

  private renderDots(): void {
    this.dotsContainer.innerHTML = '';
    TUTORIAL_PHASES.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Navigate to Tutorial Phase ${idx + 1}`);
      dot.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid var(--color-cyan);
        background: ${idx === this.currentStep ? 'var(--color-cyan)' : 'transparent'};
        box-shadow: ${idx === this.currentStep ? '0 0 8px var(--color-cyan)' : 'none'};
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
      `;
      dot.addEventListener('click', () => {
        this.currentStep = idx;
        this.audioEngine.playUiBeep();
        this.renderStep();
      });
      this.dotsContainer.appendChild(dot);
    });
  }

  private renderStep(): void {
    const phase = TUTORIAL_PHASES[this.currentStep];
    if (!phase) return;

    this.tagEl.textContent = phase.tag;
    this.titleEl.textContent = phase.title;
    this.subtitleEl.textContent = phase.subtitle;
    this.iconEl.textContent = phase.icon;
    this.detailsEl.innerHTML = phase.details.map((d) => `<div style="margin-bottom:6px;">${d}</div>`).join('');
    this.tipEl.textContent = phase.tip;

    this.prevBtn.disabled = this.currentStep === 0;
    this.prevBtn.style.opacity = this.currentStep === 0 ? '0.4' : '1.0';

    const isLast = this.currentStep === TUTORIAL_PHASES.length - 1;
    this.nextBtn.textContent = isLast ? 'COMPLETE BOOT CAMP ✓' : 'NEXT PHASE ›';
    this.nextBtn.setAttribute('aria-label', isLast ? 'Complete Boot Camp' : 'Next Tutorial Phase');

    this.renderDots();
  }

  public show(onFinish?: () => void, isReplay = false): void {
    this.onFinishCallback = onFinish ?? null;
    this.currentStep = 0;
    this.audioEngine.playHudScanOpen();
    this.container.style.display = 'flex';
    this.skipBtn.textContent = isReplay ? 'EXIT TUTORIAL' : 'SKIP BOOT CAMP';
    this.renderStep();
    this.a11y.activate(this.nextBtn);
  }

  public hide(): void {
    this.audioEngine.playHudScanClose();
    this.container.style.display = 'none';
    this.a11y.deactivate();
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  public prev(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.audioEngine.playUiBeep();
      this.renderStep();
    }
  }

  public next(): void {
    if (this.currentStep < TUTORIAL_PHASES.length - 1) {
      this.currentStep++;
      this.audioEngine.playUiClick();
      this.renderStep();
    } else {
      this.complete();
    }
  }

  public skip(): void {
    this.saveManager.setTutorialCompleted(true);
    this.hide();
    const cb = this.onFinishCallback;
    this.onFinishCallback = null;
    cb?.();
  }

  public complete(): void {
    this.saveManager.setTutorialCompleted(true);
    this.audioEngine.playUpgradeApplied();
    this.hide();
    const cb = this.onFinishCallback;
    this.onFinishCallback = null;
    cb?.();
  }

  public handleGamepad(gp: GamepadManager): boolean {
    if (!this.isVisible()) return false;

    if (gp.isMenuCancelPressed()) {
      gp.playRumble(40, 0.15, 0.3);
      this.skip();
      return true;
    }

    if (gp.isMenuConfirmPressed()) {
      gp.playRumble(60, 0.25, 0.4);
      this.next();
      return true;
    }

    return true;
  }
}
