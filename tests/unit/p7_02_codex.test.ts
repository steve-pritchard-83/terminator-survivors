import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { ENEMY_CODEX, WEAPON_CODEX, STAGE_CODEX } from '../../src/data/lore';
import { ENEMY_CONFIGS } from '../../src/data/enemies';
import { BASE_WEAPONS, EVOLVED_WEAPONS } from '../../src/data/weapons';
import { STAGES } from '../../src/data/stages';
import { SaveManager } from '../../src/state/SaveManager';
import { createEnemyPreviewObject } from '../../src/graphics/meshes/EnemyTurntablePreview';
import { CodexModal } from '../../src/ui/CodexModal';
import { AudioEngine } from '../../src/audio/AudioEngine';
import type { EnemyArchetypeId } from '../../src/core/types';

describe('P7-02: Codex / Bestiary / Armory', () => {
  let saveManager: SaveManager;
  let audioEngine: AudioEngine;
  let root: HTMLElement;
  let codexModal: CodexModal;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager();
    audioEngine = new AudioEngine();
    root = document.createElement('div');
    document.body.appendChild(root);
    codexModal = new CodexModal(root, saveManager, audioEngine);
  });

  afterEach(() => {
    codexModal.dispose();
    root.remove();
    localStorage.clear();
  });

  it('contains complete lore entries for every registered enemy archetype (16 total)', () => {
    const registryKeys = Object.keys(ENEMY_CONFIGS) as EnemyArchetypeId[];
    expect(registryKeys).toHaveLength(16);

    for (const key of registryKeys) {
      const entry = ENEMY_CODEX[key];
      expect(entry, `Missing ENEMY_CODEX for ${key}`).toBeDefined();
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.designation.length).toBeGreaterThan(0);
      expect(entry.codex.length).toBeGreaterThan(15);
      expect(['LOW', 'MEDIUM', 'HIGH', 'EXTREME', 'LETHAL']).toContain(entry.threat);
    }
  });

  it('contains lore and manufacturer dossier for all base and evolved weapons (28 total)', () => {
    const baseKeys = Object.keys(BASE_WEAPONS);
    const evolvedKeys = Object.keys(EVOLVED_WEAPONS);
    expect(baseKeys).toHaveLength(14);
    expect(evolvedKeys).toHaveLength(14);

    for (const key of [...baseKeys, ...evolvedKeys]) {
      const entry = WEAPON_CODEX[key];
      expect(entry, `Missing WEAPON_CODEX for ${key}`).toBeDefined();
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.designation.length).toBeGreaterThan(0);
      expect(entry.lore.length).toBeGreaterThan(15);
      expect(entry.manufacturer.length).toBeGreaterThan(0);
    }
  });

  it('contains theater of war entries for all 5 stages with hazards and era', () => {
    const stageKeys = Object.keys(STAGES) as Array<keyof typeof STAGES>;
    expect(stageKeys).toHaveLength(5);

    for (const sId of stageKeys) {
      const entry = STAGE_CODEX[sId];
      expect(entry, `Missing STAGE_CODEX for ${sId}`).toBeDefined();
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.era.length).toBeGreaterThan(0);
      expect(entry.sector.length).toBeGreaterThan(0);
      expect(entry.hazards.length).toBeGreaterThan(0);
      expect(entry.lore.length).toBeGreaterThan(15);
    }
  });

  it('tracks bestiary kill counts and weapon discoveries in SaveManager', () => {
    expect(saveManager.getBestiaryKills('t800_endoskeleton')).toBe(0);
    saveManager.recordEnemyKill('t800_endoskeleton');
    saveManager.recordEnemyKill('t800_endoskeleton');
    expect(saveManager.getBestiaryKills('t800_endoskeleton')).toBe(2);

    expect(saveManager.isEvolutionDiscovered('trench_sweeper')).toBe(false);
    saveManager.recordEvolutionDiscovered('trench_sweeper');
    expect(saveManager.isEvolutionDiscovered('trench_sweeper')).toBe(true);

    expect(saveManager.isWeaponDiscovered('ithaca_37')).toBe(true);
  });

  it('creates valid 3D turntable preview meshes for all 16 enemy archetypes', () => {
    const allArchetypes = Object.keys(ENEMY_CODEX) as EnemyArchetypeId[];
    for (const arch of allArchetypes) {
      const mesh = createEnemyPreviewObject(arch);
      expect(mesh).toBeInstanceOf(THREE.Object3D);
      expect(mesh.children.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('opens and switches between Bestiary, Armory, and Theater tabs in CodexModal', () => {
    expect(codexModal.isVisible()).toBe(false);
    codexModal.show();
    expect(codexModal.isVisible()).toBe(true);

    // Initial tab is bestiary
    const itemList = codexModal.container.querySelector('#codex-item-list')!;
    expect(itemList.children.length).toBe(16);

    // Switch to Armory
    const armoryTabBtn = codexModal.container.querySelector('#tab-codex-armory') as HTMLButtonElement;
    armoryTabBtn.click();
    expect(itemList.children.length).toBe(28);

    // Switch to Theater
    const theaterTabBtn = codexModal.container.querySelector('#tab-codex-theater') as HTMLButtonElement;
    theaterTabBtn.click();
    expect(itemList.children.length).toBe(5);

    codexModal.hide();
    expect(codexModal.isVisible()).toBe(false);
  });
});
