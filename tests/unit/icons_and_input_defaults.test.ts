import { describe, it, expect } from 'vitest';
import { ICON_BODIES } from '../../src/ui/icons/iconData';
import { PASSIVE_ICONS, UI_ICONS, WEAPON_ICONS } from '../../src/ui/icons/iconMap';
import { icon } from '../../src/ui/icons';
import { DEFAULT_GAMEPAD_BINDINGS, DEFAULT_KEY_BINDINGS } from '../../src/data/inputDefaults';

describe('icon library', () => {
  const allIds = [
    ...Object.values(UI_ICONS),
    ...Object.values(WEAPON_ICONS),
    ...Object.values(PASSIVE_ICONS)
  ];

  it('has generated data for every icon in iconMap (run `npm run build:icons` if this fails)', () => {
    const missing = allIds.filter((id) => !ICON_BODIES[id]);
    expect(missing).toEqual([]);
  });

  it('renders decorative inline SVG that follows the text color', () => {
    const html = icon('health');
    expect(html).toContain('<svg');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('labels the icon for screen readers only when a title is given', () => {
    expect(icon('health', { title: 'Health' })).toContain('aria-label="Health"');
  });
});

describe('input defaults', () => {
  it('has no dash binding', () => {
    expect('dash' in DEFAULT_KEY_BINDINGS).toBe(false);
    expect('dash' in DEFAULT_GAMEPAD_BINDINGS).toBe(false);
  });

  it('keeps pause off the remappable gamepad bindings (it is fixed to Start)', () => {
    expect('pause' in DEFAULT_GAMEPAD_BINDINGS).toBe(false);
  });
});
