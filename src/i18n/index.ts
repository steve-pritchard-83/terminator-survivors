import { en } from './en';

export type Locale = 'en' | string;
export type TranslationParams = Record<string, string | number>;

let activeLocale: Locale = 'en';
const localeTables: Record<string, Record<string, string>> = {
  en: { ...en }
};

/**
 * Returns the currently active locale code.
 */
export function getLocale(): Locale {
  return activeLocale;
}

/**
 * Sets the active locale. Falls back gracefully to English if strings are missing.
 */
export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

/**
 * Register or extend a language table.
 */
export function registerTranslations(locale: string, table: Record<string, string>): void {
  if (!localeTables[locale]) {
    localeTables[locale] = {};
  }
  Object.assign(localeTables[locale], table);
}

/**
 * Check if a translation key exists in the current locale or fallback English table.
 */
export function hasTranslation(key: string): boolean {
  return (
    Boolean(localeTables[activeLocale]?.[key]) ||
    Boolean(localeTables['en']?.[key])
  );
}

/**
 * Look up a localized string by key and interpolate any {param} placeholders.
 * If the key is not found, returns the key itself.
 */
export function t(key: string, params?: TranslationParams): string {
  const currentTable = localeTables[activeLocale];
  let text = currentTable?.[key];

  if (text === undefined) {
    text = localeTables['en']?.[key] ?? key;
  }

  if (!params) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (fullMatch, paramKey: string) => {
    const val = params[paramKey];
    return val !== undefined ? String(val) : fullMatch;
  });
}
