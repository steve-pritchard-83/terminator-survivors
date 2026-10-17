import type { DailyOperationConfig, LoadoutId, StageId } from './types';

export function hashDateStringToSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function formatDateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAILY_STAGES: StageId[] = [
  'la_2029_wasteland',
  'cyberdyne_factory',
  'tech_noir_1984',
  'skynet_central_tde',
  'century_city_bunker'
];

const DAILY_LOADOUTS: LoadoutId[] = [
  'reese_2029',
  'reese_1984',
  'techcom_sapper',
  'john_connor'
];

export function getDailyOperation(date: Date = new Date()): DailyOperationConfig {
  const dateKey = formatDateKey(date);
  const seed = hashDateStringToSeed(dateKey);

  const stageId = DAILY_STAGES[seed % DAILY_STAGES.length];
  const loadoutId = DAILY_LOADOUTS[Math.floor(seed / 17) % DAILY_LOADOUTS.length];

  return {
    dateKey,
    seed,
    stageId,
    loadoutId,
    modifiersDescription: `DAILY DIRECTIVE [${dateKey}]: SEED #${seed.toString(16).toUpperCase()}`
  };
}
