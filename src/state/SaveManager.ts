import type { LoadoutId, MetaSaveData, MetaUpgradeId } from '../core/types';
import { LOADOUTS, META_UPGRADES } from '../data/upgrades';

const STORAGE_KEY = 'TERMINATOR_SURVIVORS_SAVE_V1';

export class SaveManager {
  private data: MetaSaveData;

  constructor() {
    this.data = this.load();
  }

  public getData(): MetaSaveData {
    return this.data;
  }

  private getDefaultData(): MetaSaveData {
    return {
      version: 1,
      alloyScrap: 0,
      totalKills: 0,
      bestTimeSeconds: 0,
      victories: 0,
      unlockedLoadouts: ['reese_2029'],
      selectedLoadout: 'reese_2029',
      upgrades: {
        armor_vest: 0,
        combat_stims: 0,
        plasma_overclock: 0,
        servo_greaves: 0,
        salvage_magnet: 0,
        phase_capacitor: 0,
        scavenger_protocol: 0,
        defibrillator: 0
      },
      settings: {
        masterVolume: 0.8,
        musicVolume: 0.7,
        sfxVolume: 0.85,
        crtScanlines: true,
        autoAim: true
      }
    };
  }

  public load(): MetaSaveData {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.getDefaultData();
      }
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.getDefaultData();
      const parsed = JSON.parse(raw) as Partial<MetaSaveData>;
      const def = this.getDefaultData();

      return {
        version: 1,
        alloyScrap: typeof parsed.alloyScrap === 'number' ? parsed.alloyScrap : def.alloyScrap,
        totalKills: typeof parsed.totalKills === 'number' ? parsed.totalKills : def.totalKills,
        bestTimeSeconds: typeof parsed.bestTimeSeconds === 'number' ? parsed.bestTimeSeconds : def.bestTimeSeconds,
        victories: typeof parsed.victories === 'number' ? parsed.victories : def.victories,
        unlockedLoadouts: Array.isArray(parsed.unlockedLoadouts) ? parsed.unlockedLoadouts : def.unlockedLoadouts,
        selectedLoadout: parsed.selectedLoadout ?? def.selectedLoadout,
        upgrades: {
          ...def.upgrades,
          ...(parsed.upgrades || {})
        },
        settings: {
          ...def.settings,
          ...(parsed.settings || {})
        }
      };
    } catch {
      return this.getDefaultData();
    }
  }

  public save(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch {
      // Ignored if local storage disabled/quota exceeded
    }
  }

  public getUpgradeCost(id: MetaUpgradeId): number {
    const cfg = META_UPGRADES[id];
    if (!cfg) return 999999;
    const curLevel = this.data.upgrades[id] ?? 0;
    if (curLevel >= cfg.maxLevel) return 0;
    return Math.round(cfg.baseCost * Math.pow(cfg.costMultiplier, curLevel));
  }

  public purchaseUpgrade(id: MetaUpgradeId): boolean {
    const cfg = META_UPGRADES[id];
    if (!cfg) return false;
    const curLevel = this.data.upgrades[id] ?? 0;
    if (curLevel >= cfg.maxLevel) return false;
    const cost = this.getUpgradeCost(id);
    if (this.data.alloyScrap < cost) return false;

    this.data.alloyScrap -= cost;
    this.data.upgrades[id] = curLevel + 1;
    this.save();
    return true;
  }

  public unlockLoadout(id: LoadoutId): boolean {
    if (this.data.unlockedLoadouts.includes(id)) return true;
    const cfg = LOADOUTS[id];
    if (!cfg) return false;
    if (this.data.alloyScrap < cfg.cost) return false;

    this.data.alloyScrap -= cfg.cost;
    this.data.unlockedLoadouts.push(id);
    this.save();
    return true;
  }

  public selectLoadout(id: LoadoutId): boolean {
    if (!this.data.unlockedLoadouts.includes(id)) return false;
    this.data.selectedLoadout = id;
    this.save();
    return true;
  }

  public addRunResults(
    kills: number,
    timeSec: number,
    scrapEarned: number,
    victory: boolean,
    bossesKilled = 0
  ): void {
    this.data.totalKills += kills;
    this.data.alloyScrap += scrapEarned;
    if (timeSec > this.data.bestTimeSeconds) {
      this.data.bestTimeSeconds = timeSec;
    }
    if (victory) {
      this.data.victories++;
    }

    // Milestone Auto-Unlocks
    if (timeSec >= 240 && !this.data.unlockedLoadouts.includes('reese_1984')) {
      this.data.unlockedLoadouts.push('reese_1984');
    }
    if (bossesKilled >= 1 && !this.data.unlockedLoadouts.includes('techcom_sapper')) {
      this.data.unlockedLoadouts.push('techcom_sapper');
    }
    if (victory && !this.data.unlockedLoadouts.includes('john_connor')) {
      this.data.unlockedLoadouts.push('john_connor');
    }

    this.save();
  }

  public updateSettings(settings: Partial<MetaSaveData['settings']>): void {
    this.data.settings = {
      ...this.data.settings,
      ...settings
    };
    this.save();
  }

  public resetProgress(): void {
    this.data = this.getDefaultData();
    this.save();
  }
}
