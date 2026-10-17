import { describe, it, expect, beforeEach } from 'vitest';
import { t, getLocale, setLocale, registerTranslations, hasTranslation } from '../../src/i18n';
import { en } from '../../src/i18n/en';

describe('P8-06: Localisation scaffold (i18n)', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('defaults to English locale', () => {
    expect(getLocale()).toBe('en');
  });

  it('translates standard English keys correctly', () => {
    expect(t('pause.title')).toBe('MISSION PAUSED');
    expect(t('settings.title')).toBe('TACTICAL SETTINGS');
    expect(t('levelup.title')).toBe('SYSTEM UPGRADE');
    expect(t('common.confirm')).toBe('CONFIRM');
  });

  it('interpolates single and multiple parameters correctly', () => {
    const levelStr = t('common.level', { level: 7 });
    expect(levelStr).toBe('LVL 7');

    const scrapStr = t('common.scrap', { amount: 150 });
    expect(scrapStr).toBe('150 SCRAP');

    const conflictStr = t('settings.conflict_warning', { key: 'ENTER', action: 'DASH' });
    expect(conflictStr).toBe('INPUT CONFLICT DETECTED: ENTER ALREADY ASSIGNED TO DASH');
  });

  it('handles missing parameters gracefully by preserving placeholder token', () => {
    const unreplaced = t('common.level');
    expect(unreplaced).toBe('LVL {level}');
  });

  it('falls back to key if translation key does not exist', () => {
    expect(t('unknown.nonexistent.key')).toBe('unknown.nonexistent.key');
    expect(hasTranslation('unknown.nonexistent.key')).toBe(false);
  });

  it('supports locale switching and fallback to en for missing keys', () => {
    registerTranslations('fr', {
      'pause.title': 'MISSION EN PAUSE',
      'common.confirm': 'CONFIRMER'
    });

    setLocale('fr');
    expect(getLocale()).toBe('fr');
    expect(t('pause.title')).toBe('MISSION EN PAUSE');
    expect(t('common.confirm')).toBe('CONFIRMER');

    // Missing in fr, fallback to en
    expect(t('settings.title')).toBe('TACTICAL SETTINGS');
  });

  it('has comprehensive coverage for all major UI modules in en dictionary', () => {
    const expectedPrefixes = [
      'common.',
      'menu.',
      'pause.',
      'settings.',
      'levelup.',
      'endrun.',
      'hud.',
      'bunker.',
      'codex.',
      'achievements.',
      'tutorial.'
    ];

    const keys = Object.keys(en);
    expect(keys.length).toBeGreaterThan(60);

    for (const prefix of expectedPrefixes) {
      const match = keys.some((k) => k.startsWith(prefix));
      expect(match).toBe(true);
    }
  });
});
