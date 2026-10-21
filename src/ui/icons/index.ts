import type { PassiveId, WeaponId } from '../../core/types';
import { ICON_BODIES, ICON_VIEWBOX } from './iconData';
import { PASSIVE_ICONS, UI_ICONS, WEAPON_ICONS, type UiIconName } from './iconMap';

export type { UiIconName };

export interface IconOptions {
  /** CSS size, e.g. 18 (px) or '1.2em'. Defaults to 1em so the icon follows the text size. */
  size?: number | string;
  /** CSS color. Defaults to currentColor so the icon follows the text color. */
  color?: string;
  className?: string;
  /** Accessible label. Icons are decorative (aria-hidden) unless a title is given. */
  title?: string;
}

function svg(id: string, opts: IconOptions = {}): string {
  const body = ICON_BODIES[id];
  if (!body) return '';
  const size = opts.size === undefined ? '' : typeof opts.size === 'number' ? `${opts.size}px` : opts.size;
  const style = [size ? `width:${size};height:${size}` : '', opts.color ? `color:${opts.color}` : '']
    .filter(Boolean)
    .join(';');
  const cls = opts.className ? `gi ${opts.className}` : 'gi';
  const a11y = opts.title ? `role="img" aria-label="${opts.title}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" viewBox="${ICON_VIEWBOX}" fill="currentColor" ${a11y}${style ? ` style="${style}"` : ''}>${body}</svg>`;
}

/** Inline SVG for a semantic UI icon, e.g. icon('health'). */
export function icon(name: UiIconName, opts?: IconOptions): string {
  return svg(UI_ICONS[name], opts);
}

/** Inline SVG for a weapon (base or evolved). */
export function weaponIcon(id: WeaponId, opts?: IconOptions): string {
  return svg(WEAPON_ICONS[id], opts);
}

/** Inline SVG for a passive item. */
export function passiveIcon(id: PassiveId, opts?: IconOptions): string {
  return svg(PASSIVE_ICONS[id], opts);
}

/** Icon followed by a text label, for buttons: iconLabel('settings', 'SETTINGS'). */
export function iconLabel(name: UiIconName, label: string, opts?: IconOptions): string {
  return `${icon(name, opts)}<span class="gi-label">${label}</span>`;
}
