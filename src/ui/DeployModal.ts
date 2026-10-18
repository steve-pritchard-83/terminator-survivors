import type { LoadoutId, StageId, ThreatModifierId, RunConfig } from '../core/types';
import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { STAGES, isStageUnlocked } from '../data/stages';
import { LOADOUTS } from '../data/upgrades';
import { THREAT_MODIFIERS } from '../data/threatModifiers';
import { ModalA11y } from './A11yHelper';

export class DeployModal {
  private readonly modal: HTMLElement;
  private readonly a11y: ModalA11y;
  private currentStep: 'stage' | 'loadout' | 'threats' = 'stage';
  private selectedStage: StageId = 'la_2029_wasteland';
  private selectedLoadout: LoadoutId = 'reese_2029';
  private selectedThreats: Set<ThreatModifierId> = new Set();
  private onDeployCallback?: (config: RunConfig) => void;
  private selectables: HTMLElement[] = [];
  private selectedIndex = 0;

  constructor(
    root: HTMLElement,
    private readonly saveManager: SaveManager,
    private readonly audioEngine: AudioEngine
  ) {
    this.modal = document.createElement('div');
    this.modal.className = 'modal-backdrop';
    this.modal.id = 'deploy-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-label', 'Mission Deployment Configuration');
    this.modal.style.display = 'none';

    this.modal.innerHTML = `
      <div class="t800-modal-box" style="max-width:820px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(77,210,255,0.25); padding-bottom:8px;">
          <div>
            <div class="t800-header" style="font-size:22px;">DEPLOYMENT CONFIGURATION</div>
            <div id="deploy-step-indicator" class="t800-ticker" style="font-size:12px; margin-top:2px;">STEP 1/3: THEATER OF OPERATIONS</div>
          </div>
          <button id="btn-deploy-close" class="btn-secondary" style="margin-bottom:0; padding:6px 14px; font-size:12px;" aria-label="Abort Deployment">CANCEL</button>
        </div>

        <div id="deploy-step-content" style="display:flex; flex-direction:column; gap:10px; min-height:300px;">
          <!-- Dynamically populated per step -->
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(77,210,255,0.25); padding-top:10px; margin-top:auto;">
          <button id="btn-deploy-back" class="btn-secondary" style="margin-bottom:0; padding:10px 20px;" aria-label="Previous Step">BACK</button>
          <button id="btn-deploy-next" class="btn-primary" style="margin-bottom:0; padding:10px 28px;" aria-label="Next Step">CONFIRM THEATER</button>
        </div>
      </div>
    `;

    root.appendChild(this.modal);

    this.a11y = new ModalA11y(this.modal, {
      onClose: () => this.hide(),
      onNavigate: (dir) => {
        if (this.selectables.length === 0) return false;
        const delta = dir.y !== 0 ? dir.y : dir.x;
        this.selectedIndex = (this.selectedIndex + delta + this.selectables.length) % this.selectables.length;
        this.selectables[this.selectedIndex]?.focus();
        return true;
      },
      onConfirm: () => {
        if (this.selectables[this.selectedIndex]) {
          this.selectables[this.selectedIndex].click();
          return true;
        }
        return false;
      }
    });

    this.modal.querySelector('#btn-deploy-close')?.addEventListener('click', () => {
      this.audioEngine.playHudScanClose();
      this.hide();
    });

    this.modal.querySelector('#btn-deploy-back')?.addEventListener('click', () => {
      this.audioEngine.playUiClick();
      this.handleBack();
    });

    this.modal.querySelector('#btn-deploy-next')?.addEventListener('click', () => {
      this.audioEngine.playUiClick();
      this.handleNext();
    });
  }

  public show(onDeploy: (config: RunConfig) => void): void {
    this.onDeployCallback = onDeploy;
    this.currentStep = 'stage';
    this.selectedStage = 'la_2029_wasteland';
    this.selectedLoadout = this.saveManager.getData().selectedLoadout ?? 'reese_2029';
    this.selectedThreats.clear();

    this.audioEngine.playHudScanOpen();
    this.modal.style.display = 'flex';
    this.renderStep();
    this.a11y.activate(this.selectables[0]);
  }

  public hide(): void {
    this.modal.style.display = 'none';
    this.a11y.deactivate();
  }

  public isVisible(): boolean {
    return this.modal.style.display === 'flex';
  }

  private handleBack(): void {
    if (this.currentStep === 'threats') {
      this.currentStep = 'loadout';
    } else if (this.currentStep === 'loadout') {
      this.currentStep = 'stage';
    } else {
      this.hide();
      return;
    }
    this.renderStep();
  }

  private handleNext(): void {
    const saveData = this.saveManager.getData();
    const hasVictories = (saveData.victories ?? 0) > 0;

    if (this.currentStep === 'stage') {
      this.currentStep = 'loadout';
      this.renderStep();
    } else if (this.currentStep === 'loadout') {
      if (hasVictories) {
        this.currentStep = 'threats';
        this.renderStep();
      } else {
        this.executeDeploy();
      }
    } else if (this.currentStep === 'threats') {
      this.executeDeploy();
    }
  }

  private executeDeploy(): void {
    this.hide();
    this.saveManager.selectLoadout(this.selectedLoadout);
    const config: RunConfig = {
      stageId: this.selectedStage,
      loadoutId: this.selectedLoadout,
      threats: Array.from(this.selectedThreats)
    };
    this.onDeployCallback?.(config);
  }

  private renderStep(): void {
    const saveData = this.saveManager.getData();
    const hasVictories = (saveData.victories ?? 0) > 0;
    const stepIndicator = this.modal.querySelector('#deploy-step-indicator')!;
    const content = this.modal.querySelector('#deploy-step-content')!;
    const nextBtn = this.modal.querySelector('#btn-deploy-next') as HTMLButtonElement;
    const backBtn = this.modal.querySelector('#btn-deploy-back') as HTMLButtonElement;

    this.selectables = [];
    content.innerHTML = '';

    if (this.currentStep === 'stage') {
      stepIndicator.textContent = hasVictories ? 'STEP 1/3: THEATER OF OPERATIONS' : 'STEP 1/2: THEATER OF OPERATIONS';
      nextBtn.textContent = 'PROCEED TO OPERATIVE';
      backBtn.textContent = 'CANCEL';

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px;';

      for (const stage of Object.values(STAGES)) {
        const isUnlocked = isStageUnlocked(stage.id, saveData);
        const isSelected = this.selectedStage === stage.id;
        const bestTime = this.saveManager.getStageBestTime(stage.id);
        const bestTimeStr = bestTime > 0
          ? `${Math.floor(bestTime / 60)}:${(bestTime % 60).toString().padStart(2, '0')}`
          : '--:--';
        const reqDesc = 'description' in stage.unlockCondition ? stage.unlockCondition.description : '';

        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('data-testid', `stage-card-${stage.id}`);
        card.setAttribute('data-stage-id', stage.id);
        card.setAttribute('aria-label', `${stage.name}. ${stage.subtitle}. ${isUnlocked ? `Best Time: ${bestTimeStr}` : `Locked: ${reqDesc}`}`);
        card.disabled = !isUnlocked;
        card.style.cssText = `
          padding: 12px;
          text-align: left;
          background: ${isSelected ? 'rgba(77,210,255,0.18)' : isUnlocked ? 'rgba(15,25,38,0.75)' : 'rgba(15,25,38,0.35)'};
          border: 1px solid ${isSelected ? 'var(--color-cyan)' : isUnlocked ? 'rgba(77,210,255,0.3)' : 'rgba(255,68,68,0.3)'};
          border-radius: 4px;
          cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
          opacity: ${isUnlocked ? '1' : '0.6'};
          display: flex;
          flex-direction: column;
          gap: 4px;
        `;

        card.innerHTML = `
          <div style="font-family:var(--font-display); font-size:13px; color:${isSelected ? 'var(--color-cyan)' : '#fff'}; font-weight:bold;">
            ${stage.name}
          </div>
          <div style="font-family:var(--font-telemetry); font-size:10px; color:var(--color-amber);">
            ${stage.subtitle}
          </div>
          <div style="font-size:11px; color:var(--color-chrome); line-height:1.3; margin:4px 0;">
            ${stage.description}
          </div>
          <div style="margin-top:auto; font-family:var(--font-telemetry); font-size:11px; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;">
            <span style="color:var(--color-cyan);">RECORD: ${bestTimeStr}</span>
            <span style="color:${isUnlocked ? '#00ff88' : '#ff4444'}; font-weight:bold;">
              ${isSelected ? 'ACTIVE' : isUnlocked ? 'DEPLOY' : 'LOCKED'}
            </span>
          </div>
          ${!isUnlocked && reqDesc ? `<div style="font-size:10px; color:#ff6666; margin-top:2px;">REQ: ${reqDesc}</div>` : ''}
        `;

        if (isUnlocked) {
          card.onclick = () => {
            this.audioEngine.playUiClick();
            this.selectedStage = stage.id;
            this.renderStep();
          };
          this.selectables.push(card);
        }

        grid.appendChild(card);
      }

      content.appendChild(grid);
    } else if (this.currentStep === 'loadout') {
      stepIndicator.textContent = hasVictories ? 'STEP 2/3: ACTIVE RESISTANCE OPERATIVE' : 'STEP 2/2: ACTIVE RESISTANCE OPERATIVE';
      nextBtn.textContent = hasVictories ? 'PROCEED TO THREATS' : 'INITIATE DEPLOYMENT';
      backBtn.textContent = 'BACK TO THEATERS';

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px;';

      for (const [lId, cfg] of Object.entries(LOADOUTS)) {
        const isUnlocked = saveData.unlockedLoadouts.includes(lId as LoadoutId);
        const isSelected = this.selectedLoadout === lId;

        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('data-testid', `loadout-card-${lId}`);
        card.setAttribute('data-loadout-id', lId);
        card.setAttribute('aria-label', `${cfg.name}, ${cfg.callsign}. Spec: ${cfg.ability.name}. ${isUnlocked ? 'Unlocked' : `Requires requisition in Bunker`}`);
        card.disabled = !isUnlocked;
        card.style.cssText = `
          padding: 12px;
          text-align: left;
          background: ${isSelected ? 'rgba(77,210,255,0.18)' : isUnlocked ? 'rgba(15,25,38,0.75)' : 'rgba(15,25,38,0.35)'};
          border: 1px solid ${isSelected ? 'var(--color-cyan)' : isUnlocked ? 'rgba(77,210,255,0.3)' : 'rgba(255,68,68,0.3)'};
          border-radius: 4px;
          cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
          opacity: ${isUnlocked ? '1' : '0.6'};
          display: flex;
          flex-direction: column;
          gap: 4px;
        `;

        card.innerHTML = `
          <div style="font-family:var(--font-display); font-size:13px; color:${isSelected ? 'var(--color-cyan)' : '#fff'}; font-weight:bold;">
            ${cfg.name}
          </div>
          <div style="font-family:var(--font-telemetry); font-size:10px; color:var(--color-amber);">
            ${cfg.callsign}
          </div>
          <div style="font-size:11px; color:var(--color-cyan); margin:2px 0;">
            SPECIAL: <strong>${cfg.ability.name}</strong>
          </div>
          <div style="font-size:10px; color:var(--color-chrome); line-height:1.2;">
            ${cfg.ability.description}
          </div>
          <div style="margin-top:auto; font-family:var(--font-telemetry); font-size:11px; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px; color:${isUnlocked ? '#00ff88' : '#ff4444'}; font-weight:bold;">
            ${isSelected ? 'SELECTED' : isUnlocked ? 'SELECT' : 'REQUISITION LOCKED'}
          </div>
        `;

        if (isUnlocked) {
          card.onclick = () => {
            this.audioEngine.playUiClick();
            this.selectedLoadout = lId as LoadoutId;
            this.renderStep();
          };
          this.selectables.push(card);
        }

        grid.appendChild(card);
      }

      content.appendChild(grid);
    } else if (this.currentStep === 'threats') {
      stepIndicator.textContent = 'STEP 3/3: TACTICAL THREAT LEVEL MODIFIERS';
      nextBtn.textContent = 'INITIATE DEPLOYMENT';
      backBtn.textContent = 'BACK TO OPERATIVE';

      const intro = document.createElement('div');
      intro.style.cssText = 'font-size:12px; color:var(--color-chrome); margin-bottom:4px;';
      intro.textContent = 'Optional Skynet threat escalations. Each active modifier yields +15% bonus Alloy Scrap extracted.';
      content.appendChild(intro);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:8px;';

      for (const threat of Object.values(THREAT_MODIFIERS)) {
        const isChecked = this.selectedThreats.has(threat.id);

        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('data-testid', `threat-card-${threat.id}`);
        card.setAttribute('data-threat-id', threat.id);
        card.setAttribute('aria-label', `${threat.name}. ${threat.description}. +15% Scrap. ${isChecked ? 'Active' : 'Inactive'}`);
        card.style.cssText = `
          padding: 10px;
          text-align: left;
          background: ${isChecked ? 'rgba(255,68,68,0.2)' : 'rgba(15,25,38,0.75)'};
          border: 1px solid ${isChecked ? 'var(--color-red)' : 'rgba(77,210,255,0.3)'};
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
        `;

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-family:var(--font-display); font-size:11px; color:${isChecked ? '#ff4444' : '#fff'}; font-weight:bold;">
              ${threat.name}
            </div>
            <div style="font-family:var(--font-telemetry); font-size:10px; color:var(--color-amber);">+15% SCRAP</div>
          </div>
          <div style="font-size:10px; color:var(--color-chrome); line-height:1.2;">
            ${threat.description}
          </div>
          <div style="font-family:var(--font-telemetry); font-size:10px; color:${isChecked ? '#ff4444' : 'var(--color-cyan)'}; margin-top:4px;">
            STATUS: ${isChecked ? 'ENGAGED [X]' : 'OFFLINE [ ]'}
          </div>
        `;

        card.onclick = () => {
          this.audioEngine.playUiClick();
          if (this.selectedThreats.has(threat.id)) {
            this.selectedThreats.delete(threat.id);
          } else {
            this.selectedThreats.add(threat.id);
          }
          this.renderStep();
        };

        grid.appendChild(card);
        this.selectables.push(card);
      }

      content.appendChild(grid);
    }

    if (this.selectables.length > 0) {
      this.selectedIndex = 0;
      this.selectables[0].focus();
    }
  }
}
