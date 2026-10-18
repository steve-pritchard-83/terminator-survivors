/* eslint-disable no-restricted-syntax */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Static check for P11-13: Verify that every event listened to by AchievementTracker
 * (which drives all achievements) has at least one real emitter in src/.
 *
 * NOTE: As per roadmap P11-13 specification, this test is an explicit exception
 * permitted to scan source text to verify emitter coverage across the codebase.
 */
describe('P11-13 Static check: Achievement event emitters exist in src/', () => {
  function getAllSrcFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllSrcFiles(fullPath));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('has at least one emitter in src/ for all achievement-triggering events', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const files = getAllSrcFiles(srcDir);
    const srcContents = files.map((f) => ({
      path: f,
      content: fs.readFileSync(f, 'utf-8')
    }));

    // All events listened to by AchievementTracker
    const trackedEvents = [
      'enemy:killed',
      'wave:minute',
      'boss:spawned',
      'boss:defeated',
      'weapon:evolved',
      'levelup:triggered',
      'run:completed',
      'player:damaged'
    ];

    for (const eventName of trackedEvents) {
      const regex = new RegExp(`globalEvents\\.emit\\(\\s*['"]${eventName}['"]`);
      const matchingFiles = srcContents
        .filter((file) => regex.test(file.content))
        .map((file) => path.relative(srcDir, file.path));

      expect(
        matchingFiles.length,
        `Expected at least one real emitter in src/ for event "${eventName}", but found none.`
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
