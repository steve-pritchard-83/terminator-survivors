import type { BaseWeaponId, ColorBlindMode, DamageNumberSetting, DailyAttemptRecord, GameSettings, InputMappingConfig, LoadoutId, MetaSaveData, MetaUpgradeId, RunHistoryRecord } from '../core/types';
import { LOADOUTS, META_UPGRADES } from '../data/upgrades';
import { ACHIEVEMENTS, DEFAULT_UNLOCKED_WEAPONS } from '../data/achievements';
import { DEFAULT_INPUT_MAPPINGS } from '../data/inputDefaults';

const STORAGE_KEY = 'TERMINATOR_SURVIVORS_SAVE_V1';

export class SaveManager {
  public static readonly CURRENT_VERSION = 2;

  public static readonly migrations: Record<number, (old: Record<string, any>) => Record<string, any>> = {
    1: (old: Record<string, any>) => {
      return {
        ...old,
        version: 2
      };
    }
  };

  private data: MetaSaveData;

  constructor() {
    this.data = this.load();
  }

  public getData(): MetaSaveData {
    return this.data;
  }

  private getDefaultData(): MetaSaveData {
    return {
      version: SaveManager.CURRENT_VERSION,
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
        defibrillator: 0,
        crit_core: 0,
        high_caliber: 0,
        blast_dampeners: 0,
        extended_capacitors: 0,
        plasma_accelerator: 0,
        tactical_relay: 0,
        reroll_protocol: 0,
        veteran_resilience: 0
      },
      settings: {
        masterVolume: 0.8,
        musicVolume: 0.7,
        sfxVolume: 0.85,
        screenShake: 100,
        flashIntensity: 100,
        reducedMotion: typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
        damageNumbers: 'all',
        crtScanlines: true,
        autoAim: true,
        showFps: false,
        colorBlindMode: 'none',
        uiScale: 100
      },
      inputBindings: JSON.parse(JSON.stringify(DEFAULT_INPUT_MAPPINGS)),
      endlessHighScores: {
        bestTimeSeconds: 0,
        maxKills: 0,
        maxScrap: 0
      },
      dailyAttempts: {},
      achievements: [],
      unlockedWeapons: [...DEFAULT_UNLOCKED_WEAPONS],
      unlockedCosmetics: [],
      bestiaryKills: {},
      discoveredWeapons: [...DEFAULT_UNLOCKED_WEAPONS],
      discoveredEvolutions: [],
      runHistory: []
    };
  }

  public sanitizeAndMigrate(parsed: any): MetaSaveData {
    const def = this.getDefaultData();
    if (!parsed || typeof parsed !== 'object') {
      return def;
    }

    let current = { ...parsed };
    let version = typeof current.version === 'number' ? current.version : 1;

    while (version < SaveManager.CURRENT_VERSION) {
      const migration = SaveManager.migrations[version];
      if (migration) {
        current = migration(current);
        version = typeof current.version === 'number' ? current.version : version + 1;
      } else {
        version = SaveManager.CURRENT_VERSION;
      }
    }

    // 1. Validate unlockedLoadouts
    const unlocked: LoadoutId[] = ['reese_2029'];
    if (Array.isArray(current.unlockedLoadouts)) {
      for (const id of current.unlockedLoadouts) {
        if (id in LOADOUTS && !unlocked.includes(id as LoadoutId)) {
          unlocked.push(id as LoadoutId);
        }
      }
    }

    // 2. Validate and clamp selectedLoadout (must be unlocked)
    let selected: LoadoutId = 'reese_2029';
    if (typeof current.selectedLoadout === 'string' && unlocked.includes(current.selectedLoadout as LoadoutId)) {
      selected = current.selectedLoadout as LoadoutId;
    } else {
      selected = unlocked[0];
    }

    // 3. Validate and clamp upgrades to [0, maxLevel]
    const upgrades = { ...def.upgrades };
    if (current.upgrades && typeof current.upgrades === 'object') {
      for (const key of Object.keys(META_UPGRADES) as MetaUpgradeId[]) {
        const cfg = META_UPGRADES[key];
        const val = current.upgrades[key];
        if (typeof val === 'number' && !isNaN(val)) {
          upgrades[key] = Math.max(0, Math.min(cfg.maxLevel, Math.floor(val)));
        } else {
          upgrades[key] = 0;
        }
      }
    }

    // 4. Validate settings
    const validColorBlind: ColorBlindMode[] = ['none', 'deuteranopia', 'protanopia', 'tritanopia'];
    const validDamageNumbers: DamageNumberSetting[] = ['all', 'crits', 'off'];

    const settings: GameSettings = {
      masterVolume: typeof current.settings?.masterVolume === 'number' ? Math.max(0, Math.min(1, current.settings.masterVolume)) : def.settings.masterVolume,
      musicVolume: typeof current.settings?.musicVolume === 'number' ? Math.max(0, Math.min(1, current.settings.musicVolume)) : def.settings.musicVolume,
      sfxVolume: typeof current.settings?.sfxVolume === 'number' ? Math.max(0, Math.min(1, current.settings.sfxVolume)) : def.settings.sfxVolume,
      screenShake: typeof current.settings?.screenShake === 'number' ? Math.max(0, Math.min(100, Math.round(current.settings.screenShake))) : def.settings.screenShake,
      flashIntensity: typeof current.settings?.flashIntensity === 'number' ? Math.max(0, Math.min(100, Math.round(current.settings.flashIntensity))) : def.settings.flashIntensity,
      reducedMotion: typeof current.settings?.reducedMotion === 'boolean' ? current.settings.reducedMotion : def.settings.reducedMotion,
      damageNumbers: validDamageNumbers.includes(current.settings?.damageNumbers) ? current.settings.damageNumbers : def.settings.damageNumbers,
      crtScanlines: typeof current.settings?.crtScanlines === 'boolean' ? current.settings.crtScanlines : def.settings.crtScanlines,
      autoAim: typeof current.settings?.autoAim === 'boolean' ? current.settings.autoAim : def.settings.autoAim,
      showFps: typeof current.settings?.showFps === 'boolean' ? current.settings.showFps : def.settings.showFps,
      colorBlindMode: validColorBlind.includes(current.settings?.colorBlindMode) ? current.settings.colorBlindMode : def.settings.colorBlindMode,
      uiScale: typeof current.settings?.uiScale === 'number' ? Math.max(80, Math.min(150, Math.round(current.settings.uiScale))) : def.settings.uiScale
    };

    // 5. Validate endless high scores
    const endlessHighScores = {
      bestTimeSeconds: typeof current.endlessHighScores?.bestTimeSeconds === 'number' && current.endlessHighScores.bestTimeSeconds >= 0 ? current.endlessHighScores.bestTimeSeconds : 0,
      maxKills: typeof current.endlessHighScores?.maxKills === 'number' && current.endlessHighScores.maxKills >= 0 ? Math.floor(current.endlessHighScores.maxKills) : 0,
      maxScrap: typeof current.endlessHighScores?.maxScrap === 'number' && current.endlessHighScores.maxScrap >= 0 ? Math.floor(current.endlessHighScores.maxScrap) : 0
    };

    // 6. Validate daily attempts
    const dailyAttempts: Record<string, DailyAttemptRecord> = {};
    if (current.dailyAttempts && typeof current.dailyAttempts === 'object') {
      for (const [k, v] of Object.entries(current.dailyAttempts)) {
        if (v && typeof v === 'object') {
          dailyAttempts[k] = v as DailyAttemptRecord;
        }
      }
    }

    // 7. Validate achievements
    const achievements: string[] = [];
    if (Array.isArray(current.achievements)) {
      for (const a of current.achievements) {
        if (typeof a === 'string' && a in ACHIEVEMENTS && !achievements.includes(a)) {
          achievements.push(a);
        }
      }
    }

    // 8. Validate unlocked weapons
    const unlockedWeapons: BaseWeaponId[] = [...DEFAULT_UNLOCKED_WEAPONS];
    if (Array.isArray(current.unlockedWeapons)) {
      for (const w of current.unlockedWeapons) {
        if (typeof w === 'string' && !unlockedWeapons.includes(w as BaseWeaponId)) {
          unlockedWeapons.push(w as BaseWeaponId);
        }
      }
    }

    // 9. Validate cosmetics
    const unlockedCosmetics: string[] = [];
    if (Array.isArray(current.unlockedCosmetics)) {
      for (const c of current.unlockedCosmetics) {
        if (typeof c === 'string' && !unlockedCosmetics.includes(c)) {
          unlockedCosmetics.push(c);
        }
      }
    }

    // 10. Validate bestiary kills
    const bestiaryKills: Record<string, number> = {};
    if (current.bestiaryKills && typeof current.bestiaryKills === 'object') {
      for (const [k, v] of Object.entries(current.bestiaryKills)) {
        if (typeof v === 'number' && v >= 0) {
          bestiaryKills[k] = Math.floor(v);
        }
      }
    }

    // 11. Validate discovered weapons
    const discoveredWeapons: string[] = [...DEFAULT_UNLOCKED_WEAPONS];
    if (Array.isArray(current.discoveredWeapons)) {
      for (const w of current.discoveredWeapons) {
        if (typeof w === 'string' && !discoveredWeapons.includes(w)) {
          discoveredWeapons.push(w);
        }
      }
    }

    // 12. Validate discovered evolutions
    const discoveredEvolutions: string[] = [];
    if (Array.isArray(current.discoveredEvolutions)) {
      for (const e of current.discoveredEvolutions) {
        if (typeof e === 'string' && !discoveredEvolutions.includes(e)) {
          discoveredEvolutions.push(e);
        }
      }
    }

    // 13. Validate run history (keep up to 20)
    const runHistory: RunHistoryRecord[] = [];
    if (Array.isArray(current.runHistory)) {
      for (const r of current.runHistory) {
        if (r && typeof r === 'object' && typeof r.id === 'string') {
          runHistory.push(r as RunHistoryRecord);
        }
      }
    }

    // 14. Validate input bindings
    const inputBindings: InputMappingConfig = {
      keyboard: {
        moveUp: Array.isArray(current.inputBindings?.keyboard?.moveUp) ? current.inputBindings.keyboard.moveUp : [...DEFAULT_INPUT_MAPPINGS.keyboard.moveUp],
        moveDown: Array.isArray(current.inputBindings?.keyboard?.moveDown) ? current.inputBindings.keyboard.moveDown : [...DEFAULT_INPUT_MAPPINGS.keyboard.moveDown],
        moveLeft: Array.isArray(current.inputBindings?.keyboard?.moveLeft) ? current.inputBindings.keyboard.moveLeft : [...DEFAULT_INPUT_MAPPINGS.keyboard.moveLeft],
        moveRight: Array.isArray(current.inputBindings?.keyboard?.moveRight) ? current.inputBindings.keyboard.moveRight : [...DEFAULT_INPUT_MAPPINGS.keyboard.moveRight],
        dash: Array.isArray(current.inputBindings?.keyboard?.dash) ? current.inputBindings.keyboard.dash : [...DEFAULT_INPUT_MAPPINGS.keyboard.dash],
        ability: Array.isArray(current.inputBindings?.keyboard?.ability) ? current.inputBindings.keyboard.ability : [...DEFAULT_INPUT_MAPPINGS.keyboard.ability],
        pause: Array.isArray(current.inputBindings?.keyboard?.pause) ? current.inputBindings.keyboard.pause : [...DEFAULT_INPUT_MAPPINGS.keyboard.pause]
      },
      gamepad: {
        dash: Array.isArray(current.inputBindings?.gamepad?.dash) ? current.inputBindings.gamepad.dash : [...DEFAULT_INPUT_MAPPINGS.gamepad.dash],
        ability: Array.isArray(current.inputBindings?.gamepad?.ability) ? current.inputBindings.gamepad.ability : [...DEFAULT_INPUT_MAPPINGS.gamepad.ability],
        pause: Array.isArray(current.inputBindings?.gamepad?.pause) ? current.inputBindings.gamepad.pause : [...DEFAULT_INPUT_MAPPINGS.gamepad.pause]
      }
    };

    return {
      version: SaveManager.CURRENT_VERSION,
      alloyScrap: typeof current.alloyScrap === 'number' && current.alloyScrap >= 0 ? Math.floor(current.alloyScrap) : 0,
      totalKills: typeof current.totalKills === 'number' && current.totalKills >= 0 ? Math.floor(current.totalKills) : 0,
      bestTimeSeconds: typeof current.bestTimeSeconds === 'number' && current.bestTimeSeconds >= 0 ? current.bestTimeSeconds : 0,
      victories: typeof current.victories === 'number' && current.victories >= 0 ? Math.floor(current.victories) : 0,
      unlockedLoadouts: unlocked,
      selectedLoadout: selected,
      upgrades,
      settings,
      inputBindings,
      endlessHighScores,
      dailyAttempts,
      achievements,
      unlockedWeapons,
      unlockedCosmetics,
      bestiaryKills,
      discoveredWeapons,
      discoveredEvolutions,
      runHistory: runHistory.slice(0, 20)
    };
  }

  public load(): MetaSaveData {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.getDefaultData();
      }
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.getDefaultData();
      const parsed = JSON.parse(raw);
      return this.sanitizeAndMigrate(parsed);
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

  public exportSave(): string {
    const json = JSON.stringify(this.data);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(json, 'utf-8').toString('base64');
    }
    return btoa(unescape(encodeURIComponent(json)));
  }

  public importSave(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    try {
      let json: string;
      if (typeof Buffer !== 'undefined') {
        json = Buffer.from(str.trim(), 'base64').toString('utf-8');
      } else {
        json = decodeURIComponent(escape(atob(str.trim())));
      }
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') return false;
      this.data = this.sanitizeAndMigrate(parsed);
      this.save();
      return true;
    } catch {
      return false;
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

  public refundAllUpgrades(): number {
    let totalRefunded = 0;
    for (const key of Object.keys(META_UPGRADES) as MetaUpgradeId[]) {
      const cfg = META_UPGRADES[key];
      const curLevel = this.data.upgrades[key] ?? 0;
      if (cfg && curLevel > 0) {
        for (let i = 0; i < curLevel; i++) {
          totalRefunded += Math.round(cfg.baseCost * Math.pow(cfg.costMultiplier, i));
        }
        this.data.upgrades[key] = 0;
      }
    }
    if (totalRefunded > 0) {
      this.data.alloyScrap += totalRefunded;
      this.save();
    }
    return totalRefunded;
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
    bossesKilled = 0,
    isEndless = false
  ): void {
    this.data.totalKills += kills;
    this.data.alloyScrap += scrapEarned;
    if (timeSec > this.data.bestTimeSeconds) {
      this.data.bestTimeSeconds = timeSec;
    }
    if (victory) {
      this.data.victories++;
    }

    if (isEndless) {
      if (!this.data.endlessHighScores) {
        this.data.endlessHighScores = { bestTimeSeconds: 0, maxKills: 0, maxScrap: 0 };
      }
      this.data.endlessHighScores.bestTimeSeconds = Math.max(this.data.endlessHighScores.bestTimeSeconds, timeSec);
      this.data.endlessHighScores.maxKills = Math.max(this.data.endlessHighScores.maxKills, kills);
      this.data.endlessHighScores.maxScrap = Math.max(this.data.endlessHighScores.maxScrap, scrapEarned);
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

  public getInputBindings(): InputMappingConfig {
    return this.data.inputBindings ?? DEFAULT_INPUT_MAPPINGS;
  }

  public updateInputBindings(bindings: Partial<InputMappingConfig>): void {
    const cur = this.getInputBindings();
    this.data.inputBindings = {
      keyboard: {
        ...cur.keyboard,
        ...(bindings.keyboard ?? {})
      },
      gamepad: {
        ...cur.gamepad,
        ...(bindings.gamepad ?? {})
      }
    };
    this.save();
  }

  public hasAttemptedDaily(dateKey: string): boolean {
    return Boolean(this.data.dailyAttempts && this.data.dailyAttempts[dateKey]);
  }

  public recordDailyAttempt(attempt: DailyAttemptRecord): void {
    if (!this.data.dailyAttempts) {
      this.data.dailyAttempts = {};
    }
    this.data.dailyAttempts[attempt.dateKey] = attempt;
    this.save();
  }

  public getDailyAttempt(dateKey: string): DailyAttemptRecord | null {
    return this.data.dailyAttempts?.[dateKey] ?? null;
  }

  public isAchievementUnlocked(id: string): boolean {
    return Boolean(this.data.achievements?.includes(id));
  }

  public getUnlockedAchievements(): string[] {
    return this.data.achievements ? [...this.data.achievements] : [];
  }

  public unlockAchievement(id: string): boolean {
    const def = ACHIEVEMENTS[id];
    if (!def) return false;
    if (!this.data.achievements) {
      this.data.achievements = [];
    }
    if (this.data.achievements.includes(id)) {
      return false;
    }

    this.data.achievements.push(id);

    // Apply Reward
    if (def.reward.type === 'scrap' && typeof def.reward.amount === 'number') {
      this.data.alloyScrap += def.reward.amount;
    } else if (def.reward.type === 'loadout' && def.reward.id) {
      if (!this.data.unlockedLoadouts.includes(def.reward.id as LoadoutId)) {
        this.data.unlockedLoadouts.push(def.reward.id as LoadoutId);
      }
    } else if (def.reward.type === 'weapon' && def.reward.id) {
      if (!this.data.unlockedWeapons) this.data.unlockedWeapons = [...DEFAULT_UNLOCKED_WEAPONS];
      if (!this.data.unlockedWeapons.includes(def.reward.id as BaseWeaponId)) {
        this.data.unlockedWeapons.push(def.reward.id as BaseWeaponId);
      }
    } else if (def.reward.type === 'cosmetic' && def.reward.id) {
      if (!this.data.unlockedCosmetics) this.data.unlockedCosmetics = [];
      if (!this.data.unlockedCosmetics.includes(def.reward.id)) {
        this.data.unlockedCosmetics.push(def.reward.id);
      }
    }

    this.save();
    return true;
  }

  public getUnlockedWeapons(): BaseWeaponId[] {
    return this.data.unlockedWeapons ? [...this.data.unlockedWeapons] : [...DEFAULT_UNLOCKED_WEAPONS];
  }

  public unlockWeapon(id: BaseWeaponId): boolean {
    if (!this.data.unlockedWeapons) this.data.unlockedWeapons = [...DEFAULT_UNLOCKED_WEAPONS];
    if (this.data.unlockedWeapons.includes(id)) return false;
    this.data.unlockedWeapons.push(id);
    this.save();
    return true;
  }

  public isWeaponUnlocked(id: BaseWeaponId): boolean {
    const list = this.getUnlockedWeapons();
    return list.includes(id);
  }

  public recordEnemyKill(archetype: string): void {
    if (!this.data.bestiaryKills) this.data.bestiaryKills = {};
    this.data.bestiaryKills[archetype] = (this.data.bestiaryKills[archetype] ?? 0) + 1;
    this.save();
  }

  public getBestiaryKills(archetype: string): number {
    return this.data.bestiaryKills?.[archetype] ?? 0;
  }

  public recordWeaponDiscovered(weaponId: string): void {
    if (!this.data.discoveredWeapons) this.data.discoveredWeapons = [...DEFAULT_UNLOCKED_WEAPONS];
    if (!this.data.discoveredWeapons.includes(weaponId)) {
      this.data.discoveredWeapons.push(weaponId);
      this.save();
    }
  }

  public isWeaponDiscovered(weaponId: string): boolean {
    return Boolean(this.data.discoveredWeapons?.includes(weaponId));
  }

  public recordEvolutionDiscovered(evolutionId: string): void {
    if (!this.data.discoveredEvolutions) this.data.discoveredEvolutions = [];
    if (!this.data.discoveredEvolutions.includes(evolutionId)) {
      this.data.discoveredEvolutions.push(evolutionId);
      this.save();
    }
  }

  public isEvolutionDiscovered(evolutionId: string): boolean {
    return Boolean(this.data.discoveredEvolutions?.includes(evolutionId));
  }

  public recordRunHistory(record: RunHistoryRecord): void {
    if (!this.data.runHistory) {
      this.data.runHistory = [];
    }
    this.data.runHistory.unshift(record);
    if (this.data.runHistory.length > 20) {
      this.data.runHistory.length = 20;
    }
    this.save();
  }

  public getRunHistory(): RunHistoryRecord[] {
    return this.data.runHistory ? [...this.data.runHistory] : [];
  }

  public resetProgress(): void {
    this.data = this.getDefaultData();
    this.save();
  }
}
