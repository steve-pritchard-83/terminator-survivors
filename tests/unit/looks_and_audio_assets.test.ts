import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LOADOUTS } from '../../src/data/upgrades';
import { PLAYER_LOOKS } from '../../src/data/playerLooks';
import { SFX_WAV_MANIFEST } from '../../src/audio/AudioEngine';

describe('playable character looks', () => {
  it('has a look for every loadout', () => {
    for (const id of Object.keys(LOADOUTS)) {
      expect(PLAYER_LOOKS[id as keyof typeof PLAYER_LOOKS], id).toBeDefined();
    }
  });

  it('gives every character a visibly different look', () => {
    const seen = new Set<string>();
    for (const look of Object.values(PLAYER_LOOKS)) {
      const key = JSON.stringify(look);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('audio manifest', () => {
  it('only references audio files that exist', () => {
    const missing: string[] = [];
    for (const files of Object.values(SFX_WAV_MANIFEST)) {
      for (const f of files) {
        if (!fs.existsSync(path.resolve('public', f.replace(/^\.\//, '')))) missing.push(f);
      }
    }
    expect(missing).toEqual([]);
  });

  it('only references files directly in audio/effects (subfolders are not shipped)', () => {
    for (const files of Object.values(SFX_WAV_MANIFEST)) {
      for (const f of files) expect(f, f).toMatch(/^\.\/audio\/effects\/[^/]+$/);
    }
  });
});
