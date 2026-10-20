import * as THREE from 'three';
import type { EnemyArchetypeId } from '../core/types';
import { ENEMY_CODEX, WEAPON_CODEX } from '../data/lore';
import { ENEMY_CONFIGS } from '../data/enemies';
import { BASE_WEAPONS, EVOLVED_WEAPONS, PASSIVES } from '../data/weapons';
import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { createEnemyPreviewObject } from '../graphics/meshes/EnemyTurntablePreview';
import { disposeObject3D } from '../graphics/dispose';
import { ModalA11y } from './A11yHelper';

export class CodexModal {
  public readonly container: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private readonly a11y: ModalA11y;

  private currentTab: 'bestiary' | 'armory' = 'bestiary';
  private selectedEnemyId: EnemyArchetypeId = 't800_endoskeleton';
  private selectedWeaponId = 'ithaca_37';

  // Turntable Three.js components
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private currentPreviewMesh: THREE.Object3D | null = null;
  private animFrameId: number | null = null;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    audioEngine: AudioEngine
  ) {
    this.saveManager = saveManager;
    this.audioEngine = audioEngine;

    this.container = document.createElement('div');
    this.container.className = 'modal-backdrop';
    this.container.id = 'codex-modal';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Codex Archive');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="max-width:860px; width:92%; max-height:90vh; display:flex; flex-direction:column; padding:18px 24px;">
        <div class="t800-header" style="font-size:20px; margin-bottom:4px;">TECH-COM INTEL // CODEX ARCHIVE</div>
        <div class="t800-ticker" id="codex-status-ticker">CLASSIFIED ARCHIVAL DATA // DN38416 SECURED</div>

        <div style="display:flex; gap:10px; margin:12px 0 14px 0; border-bottom:1px solid rgba(77,210,255,0.25); padding-bottom:8px;">
          <button class="btn-secondary codex-tab-btn active" id="tab-codex-bestiary" aria-label="Machine Bestiary Tab" style="padding:6px 16px; font-size:12px;">
            [1] MACHINE BESTIARY
          </button>
          <button class="btn-secondary codex-tab-btn" id="tab-codex-armory" aria-label="Resistance Armory Tab" style="padding:6px 16px; font-size:12px;">
            [2] RESISTANCE ARMORY
          </button>
        </div>

        <div id="codex-content-body" style="flex:1; display:flex; gap:18px; overflow-y:auto; min-height:360px;">
          <!-- Left item list -->
          <div id="codex-item-list" style="width:260px; min-width:240px; display:flex; flex-direction:column; gap:6px; overflow-y:auto; padding-right:6px; border-right:1px solid rgba(255,255,255,0.1);">
          </div>
          <!-- Right dossier & turntable -->
          <div id="codex-dossier" style="flex:1; display:flex; flex-direction:column; overflow-y:auto;">
          </div>
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:14px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
          <button class="btn-secondary" id="btn-close-codex" aria-label="Return to Command" style="padding:8px 28px;">
            RETURN TO COMMAND
          </button>
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 300;
    this.canvas.height = 200;
    this.canvas.style.cssText = 'width:100%; max-width:320px; height:200px; background:#080d14; border:1px solid var(--color-cyan); border-radius:4px; box-shadow:0 0 12px rgba(77,210,255,0.25);';

    this.a11y = new ModalA11y(this.container, {
      onClose: () => {
        this.hide();
      },
      onConfirm: () => {
        const active = document.activeElement;
        if (active instanceof HTMLButtonElement && this.container.contains(active)) {
          active.click();
          return true;
        }
        return false;
      }
    });

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#tab-codex-bestiary')?.addEventListener('click', () => {
      this.switchTab('bestiary');
    });
    this.container.querySelector('#tab-codex-armory')?.addEventListener('click', () => {
      this.switchTab('armory');
    });

    this.container.querySelector('#btn-close-codex')?.addEventListener('click', () => {
      this.hide();
    });
  }

  public show(): void {
    this.audioEngine.playHudScanOpen();
    this.container.style.display = 'flex';
    this.initTurntableThree();
    this.renderCurrentTab();
    this.startTurntableLoop();
    this.a11y.activate();
  }

  public hide(): void {
    this.audioEngine.playHudScanClose();
    this.a11y.deactivate();
    this.container.style.display = 'none';
    this.stopTurntableLoop();
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  private switchTab(tab: 'bestiary' | 'armory'): void {
    if (this.currentTab === tab) return;
    this.audioEngine.playUiBuy();
    this.currentTab = tab;

    const tabs = this.container.querySelectorAll('.codex-tab-btn');
    tabs.forEach((t) => t.classList.remove('active'));
    this.container.querySelector(`#tab-codex-${tab}`)?.classList.add('active');

    this.renderCurrentTab();
  }

  private initTurntableThree(): void {
    if (this.renderer) return;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true
      });
      this.renderer.setSize(300, 200, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 300 / 200, 0.1, 50);
      this.camera.position.set(0, 1.2, 3.8);
      this.camera.lookAt(0, 0.4, 0);

      const amb = new THREE.AmbientLight(0x405566, 1.2);
      const dirLight = new THREE.DirectionalLight(0x4dd2ff, 2.2);
      dirLight.position.set(3, 4, 3);
      const rimLight = new THREE.DirectionalLight(0xff0044, 1.5);
      rimLight.position.set(-3, -1, -2);
      this.scene.add(amb, dirLight, rimLight);
    } catch {
      // WebGL best-effort
    }
  }

  private setTurntableMesh(archetype: EnemyArchetypeId): void {
    if (!this.scene) return;
    if (this.currentPreviewMesh) {
      this.scene.remove(this.currentPreviewMesh);
      disposeObject3D(this.currentPreviewMesh);
      this.currentPreviewMesh = null;
    }

    try {
      this.currentPreviewMesh = createEnemyPreviewObject(archetype);
      this.scene.add(this.currentPreviewMesh);
    } catch {
      // fallback
    }
  }

  private startTurntableLoop(): void {
    if (this.animFrameId !== null) return;
    const animate = () => {
      if (this.currentPreviewMesh) {
        this.currentPreviewMesh.rotation.y += 0.015;
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animFrameId = requestAnimationFrame(animate);
    };
    this.animFrameId = requestAnimationFrame(animate);
  }

  private stopTurntableLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private renderCurrentTab(): void {
    if (this.currentTab === 'bestiary') {
      this.renderBestiary();
    } else {
      this.renderArmory();
    }
  }

  // --- 1. BESTIARY TAB ---
  private renderBestiary(): void {
    const listEl = this.container.querySelector('#codex-item-list')!;
    const dossierEl = this.container.querySelector('#codex-dossier')!;
    listEl.innerHTML = '';
    dossierEl.innerHTML = '';

    const allArchetypes = Object.keys(ENEMY_CODEX) as EnemyArchetypeId[];

    for (const arch of allArchetypes) {
      const codex = ENEMY_CODEX[arch];
      const kills = this.saveManager.getBestiaryKills(arch);
      const isSelected = this.selectedEnemyId === arch;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'upgrade-card';
      item.setAttribute('aria-label', `${codex.name}: Threat ${codex.threat}, ${kills} confirmed kills`);
      item.style.cssText = `
        padding: 6px 10px;
        background: ${isSelected ? 'rgba(77,210,255,0.2)' : 'rgba(15,25,35,0.7)'};
        border: 1px solid ${isSelected ? 'var(--color-cyan)' : 'rgba(77,210,255,0.2)'};
        border-radius: 3px;
        cursor: pointer;
      `;
      item.innerHTML = `
        <div style="font-family:var(--font-display); font-size:11px; color:#fff;">${codex.name}</div>
        <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
          <span style="color:var(--color-amber);">${codex.threat}</span>
          <span style="color:${kills > 0 ? '#00ff88' : '#888'};">KILLS: ${kills}</span>
        </div>
      `;

      item.onclick = () => {
        this.selectedEnemyId = arch;
        this.renderBestiary();
      };

      listEl.appendChild(item);
    }

    // Render Selected Enemy Dossier
    const activeCodex = ENEMY_CODEX[this.selectedEnemyId];
    const stats = ENEMY_CONFIGS[this.selectedEnemyId];
    const kills = this.saveManager.getBestiaryKills(this.selectedEnemyId);

    this.setTurntableMesh(this.selectedEnemyId);

    dossierEl.innerHTML = `
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:12px;">
        <div id="turntable-host" style="width:300px; height:200px;"></div>
        <div style="flex:1; min-width:220px;">
          <div style="font-family:var(--font-display); font-size:18px; color:#fff; font-weight:bold;">${activeCodex.name}</div>
          <div style="font-family:var(--font-telemetry); font-size:11px; color:var(--color-cyan); margin-bottom:6px;">${activeCodex.designation}</div>
          <div style="display:inline-block; font-size:11px; padding:2px 8px; border-radius:3px; background:${this.getThreatColor(activeCodex.threat)}; color:#000; font-weight:bold; margin-bottom:10px;">
            THREAT: ${activeCodex.threat}
          </div>
          <div style="font-size:12px; color:var(--color-amber); margin-bottom:4px;">
            MACHINES ELIMINATED: <strong style="color:#fff; font-size:14px;">${kills}</strong>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; color:#ccc; background:rgba(0,0,0,0.3); padding:8px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);">
            <div>BASE CHASSIS HP: <strong style="color:var(--color-cyan);">${stats?.maxHp ?? 'N/A'}</strong></div>
            <div>TACTICAL VELOCITY: <strong style="color:var(--color-cyan);">${stats?.speed ?? 'N/A'} m/s</strong></div>
            <div>STRIKE DAMAGE: <strong style="color:var(--color-red);">${stats?.damage ?? 'N/A'}</strong></div>
            <div>FLIGHT CAPABLE: <strong style="color:#fff;">${stats?.isFlying ? 'YES (VTOL)' : 'NO (GROUND)'}</strong></div>
          </div>
        </div>
      </div>
      <div style="font-family:var(--font-display); font-size:12px; color:var(--color-cyan); margin-bottom:4px;">TACTICAL RECONNAISSANCE DOSSIER:</div>
      <div style="font-size:12px; color:#ddd; line-height:1.5; background:rgba(10,20,30,0.6); padding:10px; border-radius:3px; border-left:3px solid var(--color-cyan);">
        ${activeCodex.codex}
      </div>
    `;

    const host = dossierEl.querySelector('#turntable-host');
    if (host) {
      host.appendChild(this.canvas);
    }
  }

  // --- 2. ARMORY TAB ---
  private renderArmory(): void {
    const listEl = this.container.querySelector('#codex-item-list')!;
    const dossierEl = this.container.querySelector('#codex-dossier')!;
    listEl.innerHTML = '';
    dossierEl.innerHTML = '';

    const allWeapons = [...Object.keys(BASE_WEAPONS), ...Object.keys(EVOLVED_WEAPONS)];

    for (const wId of allWeapons) {
      const isEvo = wId in EVOLVED_WEAPONS;
      const def = isEvo ? EVOLVED_WEAPONS[wId as keyof typeof EVOLVED_WEAPONS] : BASE_WEAPONS[wId as keyof typeof BASE_WEAPONS];
      const isSelected = this.selectedWeaponId === wId;
      const isDiscovered = isEvo ? this.saveManager.isEvolutionDiscovered(wId) : true;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'upgrade-card';
      item.setAttribute('aria-label', `${def?.name ?? wId}: ${isEvo ? 'Evolved Superweapon' : 'Standard Weapon'}`);
      item.style.cssText = `
        padding: 6px 10px;
        background: ${isSelected ? 'rgba(77,210,255,0.2)' : 'rgba(15,25,35,0.7)'};
        border: 1px solid ${isSelected ? 'var(--color-cyan)' : 'rgba(77,210,255,0.2)'};
        border-radius: 3px;
        cursor: pointer;
      `;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${def?.iconColor ?? '#fff'};"></span>
          <span style="font-family:var(--font-display); font-size:11px; color:#fff;">${def?.name ?? wId}</span>
        </div>
        <div style="font-size:10px; color:${isEvo ? 'var(--color-amber)' : 'var(--color-cyan)'}; margin-top:2px;">
          ${isEvo ? (isDiscovered ? 'EVOLVED WEAPON' : 'CLASSIFIED EVOLUTION') : 'STANDARD ORDNANCE'}
        </div>
      `;

      item.onclick = () => {
        this.selectedWeaponId = wId;
        this.renderArmory();
      };

      listEl.appendChild(item);
    }

    // Render Selected Weapon Dossier
    const isEvo = this.selectedWeaponId in EVOLVED_WEAPONS;
    const def = isEvo ? EVOLVED_WEAPONS[this.selectedWeaponId as keyof typeof EVOLVED_WEAPONS] : BASE_WEAPONS[this.selectedWeaponId as keyof typeof BASE_WEAPONS];
    const lore = WEAPON_CODEX[this.selectedWeaponId];
    const isDiscovered = isEvo ? this.saveManager.isEvolutionDiscovered(this.selectedWeaponId) : true;
    const stats = def?.levels[0];

    dossierEl.innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:var(--font-display); font-size:18px; color:#fff; font-weight:bold;">${def?.name ?? this.selectedWeaponId}</div>
            <div style="font-family:var(--font-telemetry); font-size:11px; color:var(--color-cyan);">${lore?.designation ?? def?.codeName ?? 'TECH-COM ARMAMENT'}</div>
          </div>
          <div style="font-size:11px; color:var(--color-amber);">MANUFACTURER: ${lore?.manufacturer ?? 'TECH-COM'}</div>
        </div>

        <div style="margin:12px 0; background:rgba(0,0,0,0.4); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
          <div style="font-family:var(--font-display); font-size:11px; color:var(--color-amber); margin-bottom:6px;">TACTICAL SPECIFICATIONS (LEVEL 1):</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:6px; font-size:11px; color:#ccc;">
            <div>DAMAGE: <strong style="color:#fff;">${stats?.damage ?? 0}</strong></div>
            <div>COOLDOWN: <strong style="color:#fff;">${stats?.cooldown ?? 0}s</strong></div>
            <div>PROJECTILES: <strong style="color:#fff;">${stats?.amount ?? 1}</strong></div>
            <div>AREA RADIUS: <strong style="color:#fff;">${stats?.area ?? 1.0}x</strong></div>
            <div>VELOCITY: <strong style="color:#fff;">${stats?.speed ?? 0}</strong></div>
            <div>PIERCE: <strong style="color:#fff;">${stats?.pierce ?? 1}</strong></div>
            <div>KNOCKBACK: <strong style="color:#fff;">${def?.knockback ?? 0}</strong></div>
            <div>EVOLVED: <strong style="color:${isEvo ? '#00ff88' : '#888'};">${isEvo ? 'YES' : 'NO'}</strong></div>
          </div>
        </div>

        ${
          !isEvo && def && 'pairedPassive' in def && def.pairedPassive && 'evolvesInto' in def && def.evolvesInto
            ? `
          <div style="background:rgba(10,25,35,0.7); border:1px solid var(--color-cyan); padding:8px 12px; border-radius:4px; margin-bottom:12px;">
            <div style="font-family:var(--font-display); font-size:11px; color:var(--color-cyan); margin-bottom:2px;">TECH-COM VAULT EVOLUTION RECIPE:</div>
            <div style="font-size:12px; color:#fff;">
              ${def.name} (LV 8) + <strong>${PASSIVES[def.pairedPassive]?.name ?? def.pairedPassive}</strong> ➔ 
              <span style="color:var(--color-amber); font-weight:bold;">${EVOLVED_WEAPONS[def.evolvesInto]?.name ?? def.evolvesInto}</span>
            </div>
          </div>
        `
            : ''
        }

        ${
          isEvo
            ? `
          <div style="background:rgba(30,20,10,0.7); border:1px solid var(--color-amber); padding:8px 12px; border-radius:4px; margin-bottom:12px;">
            <div style="font-family:var(--font-display); font-size:11px; color:var(--color-amber); margin-bottom:2px;">FIELD RECONNAISSANCE STATUS:</div>
            <div style="font-size:12px; color:${isDiscovered ? '#00ff88' : '#ff4444'}; font-weight:bold;">
              ${isDiscovered ? '★ EVOLUTION DECRYPTED & CONFIRMED' : '⚠ CLASSIFIED // EVOLVE AT BUNKER VAULT TO DECRYPT'}
            </div>
          </div>
        `
            : ''
        }

        <div style="font-family:var(--font-display); font-size:12px; color:var(--color-cyan); margin-bottom:4px;">ORDNANCE DOSSIER & COMBAT LOG:</div>
        <div style="font-size:12px; color:#ddd; line-height:1.5; background:rgba(10,20,30,0.6); padding:10px; border-radius:3px; border-left:3px solid var(--color-cyan);">
          ${lore?.lore ?? def?.levels[0].description ?? 'Standard Tech-Com combat weapon.'}
        </div>
      </div>
    `;
  }

  private getThreatColor(threat: string): string {
    switch (threat) {
      case 'LOW':
        return '#00ff88';
      case 'MEDIUM':
        return '#ffb700';
      case 'HIGH':
        return '#ff6600';
      case 'EXTREME':
        return '#ff0044';
      case 'LETHAL':
      default:
        return '#ff00ff';
    }
  }

  public dispose(): void {
    this.stopTurntableLoop();
    if (this.currentPreviewMesh && this.scene) {
      this.scene.remove(this.currentPreviewMesh);
      disposeObject3D(this.currentPreviewMesh);
      this.currentPreviewMesh = null;
    }
    this.renderer?.dispose();
    this.renderer = null;
  }
}
