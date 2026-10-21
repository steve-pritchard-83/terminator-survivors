import * as THREE from 'three';
import type { EnemyArchetypeId } from '../core/types';
import { ENEMY_CODEX, WEAPON_CODEX } from '../data/lore';
import { ENEMY_CONFIGS } from '../data/enemies';
import { iconLabel } from './icons';
import { ALL_WEAPONS, BASE_WEAPONS, EVOLVED_WEAPONS, PASSIVES } from '../data/weapons';
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS } from '../data/achievements';
import type { SaveManager } from '../state/SaveManager';
import type { AudioEngine } from '../audio/AudioEngine';
import { createEnemyPreviewObject } from '../graphics/meshes/EnemyTurntablePreview';
import { disposeObject3D } from '../graphics/dispose';
import { ModalA11y } from './A11yHelper';

type ArchivesTab = 'bestiary' | 'armory' | 'achievements' | 'log';

/** The Archives: machines, armory, achievements and the run log. */
export class CodexModal {
  public readonly container: HTMLElement;
  private readonly saveManager: SaveManager;
  private readonly audioEngine: AudioEngine;
  private readonly a11y: ModalA11y;

  private currentTab: ArchivesTab = 'bestiary';
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
    this.container.setAttribute('aria-label', 'Archives');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="t800-modal-box" style="max-width:860px; width:92%;">
        <div class="t800-header">ARCHIVES</div>

        <div style="display:flex; gap:8px; margin:6px 0 12px; padding-bottom:10px; border-bottom:1px solid var(--t-line);">
          <button class="btn-secondary btn-sm codex-tab-btn active" id="tab-codex-bestiary" aria-label="Machines Tab">
            ${iconLabel('boss', 'MACHINES')}
          </button>
          <button class="btn-secondary btn-sm codex-tab-btn" id="tab-codex-armory" aria-label="Armory Tab">
            ${iconLabel('armor', 'ARMORY')}
          </button>
          <button class="btn-secondary btn-sm codex-tab-btn" id="tab-codex-achievements" aria-label="Achievements Tab">
            ${iconLabel('trophy', 'ACHIEVEMENTS')}
          </button>
          <button class="btn-secondary btn-sm codex-tab-btn" id="tab-codex-log" aria-label="Run Log Tab">
            ${iconLabel('history', 'RUN LOG')}
          </button>
        </div>

        <div id="codex-content-body" class="codex-body">
          <div id="codex-item-list" class="codex-list"></div>
          <div id="codex-dossier" class="codex-dossier"></div>
        </div>

        <div class="btn-row">
          <button class="btn-secondary" id="btn-close-codex" aria-label="Back">BACK</button>
        </div>
      </div>
    `;

    root.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 300;
    this.canvas.height = 200;
    this.canvas.className = 'codex-canvas';

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
    this.container.querySelector('#tab-codex-achievements')?.addEventListener('click', () => {
      this.switchTab('achievements');
    });
    this.container.querySelector('#tab-codex-log')?.addEventListener('click', () => {
      this.switchTab('log');
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

  private switchTab(tab: ArchivesTab): void {
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

      const amb = new THREE.AmbientLight(0x554444, 1.2);
      const dirLight = new THREE.DirectionalLight(0xf2e9e4, 2.2);
      dirLight.position.set(3, 4, 3);
      const rimLight = new THREE.DirectionalLight(0xff2a1a, 1.5);
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
    } else if (this.currentTab === 'armory') {
      this.renderArmory();
    } else if (this.currentTab === 'achievements') {
      this.renderAchievements();
    } else {
      this.renderRunLog();
    }
  }

  // --- ACHIEVEMENTS TAB ---
  private renderAchievements(): void {
    const listEl = this.container.querySelector('#codex-item-list')!;
    const dossierEl = this.container.querySelector('#codex-dossier')!;
    const unlockedIds = this.saveManager.getUnlockedAchievements();
    const count = Object.keys(ACHIEVEMENTS).filter((id) => unlockedIds.includes(id)).length;
    const pct = Math.round((count / TOTAL_ACHIEVEMENTS) * 100);

    listEl.innerHTML = Object.values(ACHIEVEMENTS)
      .map((ach) => {
        const isUnlocked = unlockedIds.includes(ach.id);
        return `
          <div class="upgrade-card${isUnlocked ? '' : ' is-locked'}" aria-label="${ach.title}. ${ach.description}. ${isUnlocked ? 'Secured' : 'Locked'}">
            <div class="upgrade-card-info">
              <div class="upgrade-card-head">
                <div class="upgrade-card-title" style="font-size:12px;">${ach.title}</div>
                ${isUnlocked ? '<span class="t-tag t-tag-on">SECURED</span>' : ''}
              </div>
              <div class="upgrade-card-desc">${ach.description}</div>
              <div class="t-muted" style="font-size:10px; margin-top:2px;">${ach.reward.description}</div>
            </div>
          </div>
        `;
      })
      .join('');

    dossierEl.innerHTML = `
      <div class="t-section-label" style="margin-top:0;">SECURED</div>
      <div style="font-size:28px;">${count} / ${TOTAL_ACHIEVEMENTS}</div>
      <div class="t-bar"><div style="width:${pct}%;"></div></div>
      <div class="t-hint" style="text-align:left;">Boss kills and level 20 unlock new weapons for the field upgrade pool.</div>
    `;
  }

  // --- RUN LOG TAB ---
  private renderRunLog(): void {
    const listEl = this.container.querySelector('#codex-item-list')!;
    const dossierEl = this.container.querySelector('#codex-dossier')!;
    const data = this.saveManager.getData();
    const history = this.saveManager.getRunHistory();
    const clock = (seconds: number) => {
      const sec = Math.floor(seconds);
      return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
    };

    listEl.innerHTML =
      history.length === 0
        ? '<div class="t-empty">NO PRIOR MISSIONS</div>'
        : history
            .map((r, i) => {
              const isVic = r.outcome === 'victory';
              const top = r.topWeapon?.id ? (ALL_WEAPONS[r.topWeapon.id]?.name ?? r.topWeapon.id) : 'N/A';
              return `
                <div class="t-panel" style="margin-bottom:8px; font-size:12px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span class="${isVic ? '' : 't-red'}">#${history.length - i} ${isVic ? 'VICTORY' : 'TERMINATED'}</span>
                    <span>${clock(r.durationSeconds)}</span>
                  </div>
                  <div class="t-muted">LV ${r.levelReached} · ${r.kills} KILLS · +${r.scrapEarned} SCRAP</div>
                  <div class="t-muted" style="margin-top:4px; font-size:11px;">TOP WEAPON: <span style="color:var(--t-text);">${top}</span></div>
                </div>
              `;
            })
            .join('');

    dossierEl.innerHTML = `
      <div class="t-section-label" style="margin-top:0;">SERVICE RECORD</div>
      <div class="t-row"><span class="t-muted">BEST TIME</span><span>${clock(data.bestTimeSeconds)}</span></div>
      <div class="t-row"><span class="t-muted">VICTORIES</span><span>${data.victories}</span></div>
      <div class="t-row"><span class="t-muted">MACHINES DESTROYED</span><span>${data.totalKills.toLocaleString()}</span></div>
      <div class="t-row"><span class="t-muted">ALLOY SCRAP</span><span>${data.alloyScrap.toLocaleString()}</span></div>
    `;
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
      item.classList.toggle('is-selected', isSelected);
      item.innerHTML = `
        <div class="upgrade-card-title" style="font-size:12px;">${codex.name}</div>
        <div class="t-muted" style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
          <span>${codex.threat}</span>
          <span>KILLS ${kills}</span>
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
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:8px;">
        <div id="turntable-host" style="width:300px; max-width:100%; height:200px;"></div>
        <div style="flex:1; min-width:200px;">
          <div class="codex-name">${activeCodex.name}</div>
          <div class="t-muted" style="font-size:11px; margin-bottom:8px;">${activeCodex.designation}</div>
          <span class="t-tag">THREAT: ${activeCodex.threat}</span>
          <div class="codex-stats">
            <div>KILLS: <strong>${kills}</strong></div>
            <div>HP: <strong>${stats?.maxHp ?? 'N/A'}</strong></div>
            <div>SPEED: <strong>${stats?.speed ?? 'N/A'} M/S</strong></div>
            <div>DAMAGE: <strong>${stats?.damage ?? 'N/A'}</strong></div>
            <div>FLIGHT: <strong>${stats?.isFlying ? 'YES' : 'NO'}</strong></div>
          </div>
        </div>
      </div>
      <div class="t-section-label">DOSSIER</div>
      <div class="codex-lore">${activeCodex.codex}</div>
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
      item.classList.toggle('is-selected', isSelected);
      item.innerHTML = `
        <div class="upgrade-card-title" style="font-size:12px;">${def?.name ?? wId}</div>
        <div class="${isEvo ? 't-red' : 't-muted'}" style="font-size:10px; margin-top:2px;">
          ${isEvo ? (isDiscovered ? 'EVOLVED' : 'CLASSIFIED') : 'STANDARD'}
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
        <div class="codex-name">${def?.name ?? this.selectedWeaponId}</div>
        <div class="t-muted" style="font-size:11px;">
          ${lore?.designation ?? def?.codeName ?? 'TECH-COM ARMAMENT'} · ${lore?.manufacturer ?? 'TECH-COM'}
        </div>

        <div class="t-section-label">LEVEL 1</div>
        <div class="codex-stats" style="margin-top:0;">
          <div>DAMAGE: <strong>${stats?.damage ?? 0}</strong></div>
          <div>COOLDOWN: <strong>${stats?.cooldown ?? 0}S</strong></div>
          <div>PROJECTILES: <strong>${stats?.amount ?? 1}</strong></div>
          <div>AREA: <strong>${stats?.area ?? 1.0}X</strong></div>
          <div>VELOCITY: <strong>${stats?.speed ?? 0}</strong></div>
          <div>PIERCE: <strong>${stats?.pierce ?? 1}</strong></div>
          <div>KNOCKBACK: <strong>${def?.knockback ?? 0}</strong></div>
        </div>

        ${
          !isEvo && def && 'pairedPassive' in def && def.pairedPassive && 'evolvesInto' in def && def.evolvesInto
            ? `
          <div class="t-section-label">EVOLUTION</div>
          <div style="font-size:12px;">
            ${def.name} LV 8 + ${PASSIVES[def.pairedPassive]?.name ?? def.pairedPassive}
            <span class="t-muted">→</span>
            <span class="t-red">${EVOLVED_WEAPONS[def.evolvesInto]?.name ?? def.evolvesInto}</span>
          </div>
        `
            : ''
        }

        ${
          isEvo
            ? `
          <div class="t-section-label">STATUS</div>
          <div style="font-size:12px;" class="${isDiscovered ? '' : 't-muted'}">
            ${isDiscovered ? 'DECRYPTED' : 'CLASSIFIED. EVOLVE THIS WEAPON IN A RUN TO DECRYPT.'}
          </div>
        `
            : ''
        }

        <div class="t-section-label">DOSSIER</div>
        <div class="codex-lore">
          ${lore?.lore ?? def?.levels[0].description ?? 'Standard Tech-Com combat weapon.'}
        </div>
      </div>
    `;
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
