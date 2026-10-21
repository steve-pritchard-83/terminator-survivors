import type {
  ActiveWeaponSlot,
  BaseWeaponId,
  EnemyArchetypeId,
  EvolvedWeaponId,
  GameMode,
  LoadoutId,
  PassiveId,
  PlayerComputedStats,
  UpgradeChoice,
  WeaponId
} from '../core/types';
import { ALL_WEAPONS, BASE_WEAPONS, EVOLVED_WEAPONS, PASSIVES, canEvolveWeapon } from '../data/weapons';
import { LOADOUTS, META_UPGRADES } from '../data/upgrades';
import { globalRNG } from '../core/RNG';
import { StateMachine, GAME_MODE_TRANSITIONS } from '../core/StateMachine';
import { globalEvents } from '../core/EventBus';
import { threatMultipliers } from '../data/waves';
import { MAX_REVIVAL_CHANCE, REVIVE_INVULNERABILITY_SECONDS, UPGRADE_OFFERS } from '../data/balance';

export function getXpForNextLevel(level: number): number {
  if (level <= 2) {
    return Math.floor(10 + 8 * level + 2.5 * Math.pow(level, 1.65));
  }
  return Math.floor(14 + 6.5 * level + 1.55 * Math.pow(level, 1.48));
}

export function computeMitigatedDamage(rawDamage: number, armor: number): number {
  const safeArmor = Math.max(0, armor);
  return Math.max(1, Math.round(rawDamage * (100 / (100 + safeArmor * 8))));
}

export class RunState {
  public readonly stateMachine = new StateMachine<GameMode>('title', GAME_MODE_TRANSITIONS);

  public get mode(): GameMode {
    return this.stateMachine.getState();
  }

  public set mode(newMode: GameMode) {
    this.stateMachine.transition(newMode);
  }
  public timeSeconds = 0;
  public level = 1;
  public xp = 0;
  public xpToNext = getXpForNextLevel(1);
  public pendingLevelUps = 0;
  public seed = 0;
  /** Threat level of this run (0 = standard) */
  public threat = 0;
  public hp = 100;
  public maxHp = 100;
  public kills = 0;
  public bossesKilled = 0;
  public alloyScrapEarned = 0;
  public readonly killsByType = new Map<EnemyArchetypeId, number>();
  public levelUpTimeline: Array<{ level: number; timeSeconds: number; choiceTitle: string }> = [];

  public recordKill(archetype: EnemyArchetypeId): void {
    this.killsByType.set(archetype, (this.killsByType.get(archetype) ?? 0) + 1);
  }

  public recordLevelUp(choiceTitle: string): void {
    this.levelUpTimeline.push({
      level: this.level,
      timeSeconds: this.timeSeconds,
      choiceTitle
    });
  }

  public playerPos = { x: 0, z: 0 };
  public playerFacing = 0; // radians
  public playerMoveAngle = 0; // radians
  /** Direction to the auto-aim target (nearest enemy in range), or null when there is none. Set by WeaponSystem. */
  public autoAimAngle: number | null = null;
  public isMoving = false;
  public abilityCooldownTimer = 0;
  public abilityActiveDuration = 0;
  public isAbilityActive = false;
  public invulnerabilityTimer = 0;
  public invulnerabilityDuration = 0.5;
  public autoAimEnabled = true;

  public weapons = new Map<WeaponId, ActiveWeaponSlot>();
  public passives = new Map<PassiveId, number>();
  public computedStats: PlayerComputedStats = this.getDefaultStats();
  public revivalsLeft = 0;
  public rerollsLeft = 0;
  public loadoutId: LoadoutId = 'reese_2029';
  public unlockedWeapons: BaseWeaponId[] = [];
  private purchasedMetaUpgrades: Record<string, number> = {};

  public godMode = false;
  public isDead = false;

  private getDefaultStats(): PlayerComputedStats {
    return {
      maxHp: 100,
      regenPerSec: 0,
      moveSpeed: 7.8,
      armor: 0,
      mightMultiplier: 1.0,
      areaMultiplier: 1.0,
      cooldownMultiplier: 1.0,
      speedMultiplier: 1.0,
      durationMultiplier: 1.0,
      bonusAmount: 0,
      magnetRadius: 3.5,
      critChance: 0.05,
      critMultiplier: 1.75,
      luckMultiplier: 1.0,
      xpGainMultiplier: 1.0,
      revivals: 0,
      revivalChance: 0,
      rerolls: 0,
      lowHpDamageReduction: 0
    };
  }

  public initRun(
    loadoutId: LoadoutId,
    purchasedMetaUpgrades: Record<string, number>,
    seed = 0,
    unlockedWeapons?: BaseWeaponId[]
  ): void {
    if (this.mode !== 'title') {
      this.stateMachine.reset('title');
    }
    this.mode = 'playing';
    this.seed = seed;
    this.isDead = false;
    this.unlockedWeapons = unlockedWeapons ? [...unlockedWeapons] : [];
    this.timeSeconds = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = getXpForNextLevel(1);
    this.pendingLevelUps = 0;
    this.kills = 0;
    this.bossesKilled = 0;
    this.alloyScrapEarned = 0;
    this.killsByType.clear();
    this.levelUpTimeline = [];
    this.playerPos = { x: 0, z: 0 };
    this.playerFacing = 0;
    this.autoAimAngle = null;
    this.playerMoveAngle = 0;
    this.isMoving = false;
    this.abilityCooldownTimer = 0;
    this.abilityActiveDuration = 0;
    this.isAbilityActive = false;
    this.weapons.clear();
    this.passives.clear();
    this.loadoutId = loadoutId;
    this.purchasedMetaUpgrades = { ...purchasedMetaUpgrades };

    // Grant starting weapon
    const loadout = LOADOUTS[loadoutId];
    const startingWeaponId = loadout ? loadout.startingWeapon : 'ithaca_37';
    this.weapons.set(startingWeaponId, {
      id: startingWeaponId,
      level: 1,
      evolved: false,
      cooldownTimer: 0
    });

    this.revivalsLeft = 0;
    this.invulnerabilityTimer = 0;
    this.invulnerabilityDuration = loadout?.invulnerabilityDuration ?? 0.5;
    this.computedStats = this.getDefaultStats();
    this.recalculateStats();
    this.hp = this.maxHp;
    this.rerollsLeft = Math.max(0, this.computedStats.rerolls ?? 0);
  }

  public recalculateStats(): void {
    const base = this.getDefaultStats();
    const loadout = LOADOUTS[this.loadoutId];

    // 1. Apply Meta Upgrades
    for (const [upId, lv] of Object.entries(this.purchasedMetaUpgrades)) {
      const cfg = META_UPGRADES[upId as keyof typeof META_UPGRADES];
      if (cfg && lv > 0) {
        for (const [stat, val] of Object.entries(cfg.statPerLevel)) {
          const k = stat as keyof PlayerComputedStats;
          base[k] = (base[k] as number) + (val as number) * lv;
        }
      }
    }

    // 2. Apply Loadout bonus
    if (loadout) {
      for (const [stat, val] of Object.entries(loadout.bonusStats)) {
        const k = stat as keyof PlayerComputedStats;
        base[k] = (base[k] as number) + (val as number);
      }
    }

    // 3. Apply In-Run Passives
    for (const [pId, lv] of this.passives.entries()) {
      const pDef = PASSIVES[pId];
      if (pDef && lv > 0) {
        for (const [stat, val] of Object.entries(pDef.statPerLevel)) {
          const k = stat as keyof PlayerComputedStats;
          base[k] = (base[k] as number) + (val as number) * lv;
        }
      }
    }

    // Clamp cooldownMultiplier to a safe floor of 0.35
    base.cooldownMultiplier = Math.max(0.35, base.cooldownMultiplier);
    base.revivalChance = Math.min(MAX_REVIVAL_CHANCE, Math.max(0, base.revivalChance ?? 0));

    const hpPercent = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    const prevRevivals = this.computedStats ? this.computedStats.revivals : 0;
    this.computedStats = base;
    this.maxHp = base.maxHp;
    if (this.hp > 0 && !this.isDead) {
      this.hp = Math.max(1, Math.min(this.maxHp, Math.round(this.maxHp * hpPercent)));
    } else {
      this.hp = 0;
    }
    if (base.revivals > prevRevivals) {
      this.revivalsLeft += base.revivals - prevRevivals;
    }
  }

  public addScrap(baseAmount: number): number {
    const gained = Math.max(1, Math.round(baseAmount * this.computedStats.xpGainMultiplier * threatMultipliers(this.threat).scrap));
    this.alloyScrapEarned += gained;
    return gained;
  }

  public addXp(amount: number): number {
    const gained = Math.round(amount * this.computedStats.xpGainMultiplier);
    this.xp += gained;
    let levelsGained = 0;
    while (this.xp >= this.xpToNext) {
      this.level++;
      this.xp -= this.xpToNext;
      this.xpToNext = getXpForNextLevel(this.level);
      levelsGained++;
    }
    return levelsGained;
  }

  public takeDamage(rawDamage: number): number {
    if (this.isDead || this.hp <= 0 || this.mode !== 'playing') return 0;
    if (this.godMode || this.invulnerabilityTimer > 0) return 0;
    const mitigated = computeMitigatedDamage(rawDamage, this.computedStats.armor);
    if (mitigated > 0) {
      this.hp = Math.max(0, this.hp - mitigated);
      this.invulnerabilityTimer = this.hp > 0 ? this.invulnerabilityDuration : 0;
      if (this.hp === 0) {
        if (
          this.revivalsLeft <= 0 &&
          (!this.computedStats.revivalChance || this.computedStats.revivalChance <= 0)
        ) {
          this.isDead = true;
        }
      }
    }
    return mitigated;
  }

  public resolveLethalDamage(): 'revived' | 'dead' | 'alive' {
    if (this.hp > 0 && !this.isDead) return 'alive';
    if (this.revivalsLeft > 0) {
      this.revivalsLeft--;
      this.hp = Math.round(this.maxHp * 0.5);
      this.invulnerabilityTimer = REVIVE_INVULNERABILITY_SECONDS;
      this.isDead = false;
      return 'revived';
    }
    if (
      (this.computedStats.revivalChance ?? 0) > 0 &&
      globalRNG.chance(this.computedStats.revivalChance ?? 0)
    ) {
      this.hp = Math.round(this.maxHp * 0.5);
      this.invulnerabilityTimer = REVIVE_INVULNERABILITY_SECONDS;
      this.isDead = false;
      return 'revived';
    }
    this.isDead = true;
    this.hp = 0;
    return 'dead';
  }

  public heal(amount: number): number {
    if (this.isDead || this.hp <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  public triggerAbility(): boolean {
    const loadout = LOADOUTS[this.loadoutId];
    if (!loadout || !loadout.ability) return false;
    if (this.abilityCooldownTimer > 0) return false;

    this.abilityCooldownTimer = loadout.ability.cooldown;
    if (loadout.ability.duration && loadout.ability.duration > 0) {
      this.abilityActiveDuration = loadout.ability.duration;
      this.isAbilityActive = true;
      this.recalculateStats();
    }

    globalEvents.emit('ability:triggered', {
      loadoutId: this.loadoutId,
      abilityId: loadout.ability.id,
      x: this.playerPos.x,
      z: this.playerPos.z
    });
    return true;
  }

  public updateTimers(dt: number): void {
    if (this.abilityCooldownTimer > 0) {
      this.abilityCooldownTimer = Math.max(0, this.abilityCooldownTimer - dt);
    }
    if (this.abilityActiveDuration > 0) {
      this.abilityActiveDuration = Math.max(0, this.abilityActiveDuration - dt);
      if (this.abilityActiveDuration <= 0) {
        this.isAbilityActive = false;
        this.recalculateStats();
      }
    }
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }
    // Passive HP regen
    if (this.computedStats.regenPerSec > 0 && this.hp > 0 && this.hp < this.maxHp) {
      this.heal(this.computedStats.regenPerSec * dt);
    }
  }

  public generateUpgradeChoices(): UpgradeChoice[] {
    const choices: UpgradeChoice[] = [];
    const allBaseWeapons = Object.keys(BASE_WEAPONS) as BaseWeaponId[];
    const eligibleWeapons =
      this.unlockedWeapons.length > 0
        ? allBaseWeapons.filter((w) => this.unlockedWeapons.includes(w))
        : allBaseWeapons;
    const eligiblePassives = Object.keys(PASSIVES) as PassiveId[];

    // 1. Existing upgradable weapons (Level < 8)
    for (const [wId, slot] of this.weapons.entries()) {
      if (!slot.evolved && slot.level < 8) {
        const def = BASE_WEAPONS[wId as BaseWeaponId];
        if (def) {
          const nextLv = slot.level + 1;
          const nextStats = def.levels[nextLv - 1];
          choices.push({
            kind: 'weapon',
            id: wId,
            title: def.name,
            subtitle: `LV ${nextLv}`,
            currentLevel: slot.level,
            nextLevel: nextLv,
            description: nextStats?.description ?? `Upgrade to Level ${nextLv}`,
            synergyHint: def.pairedPassive
              ? `Synergy: ${PASSIVES[def.pairedPassive].name}`
              : undefined,
            accentColor: def.iconColor
          });
        }
      }
    }

    // 2. Existing upgradable passives (Level < maxLevel)
    for (const [pId, lv] of this.passives.entries()) {
      const def = PASSIVES[pId];
      if (def && lv < def.maxLevel) {
        const nextLv = lv + 1;
        choices.push({
          kind: 'passive',
          id: pId,
          title: def.name,
          subtitle: `LV ${nextLv}`,
          currentLevel: lv,
          nextLevel: nextLv,
          description: def.descriptionPerLevel,
          synergyHint: `Evolves: ${BASE_WEAPONS[def.evolvesWeapon]?.name ?? ''}`,
          accentColor: def.iconColor
        });
      }
    }

    // 3. New weapons (if slot count < 6)
    if (this.weapons.size < 6) {
      for (const wId of eligibleWeapons) {
        if (!this.weapons.has(wId)) {
          const def = BASE_WEAPONS[wId];
          choices.push({
            kind: 'weapon',
            id: wId,
            title: def.name,
            subtitle: 'NEW',
            currentLevel: 0,
            nextLevel: 1,
            description: def.levels[0].description,
            synergyHint: def.pairedPassive
              ? `Synergy: ${PASSIVES[def.pairedPassive].name}`
              : undefined,
            accentColor: def.iconColor
          });
        }
      }
    }

    // 4. New passives (if slot count < 6)
    if (this.passives.size < 6) {
      for (const pId of eligiblePassives) {
        if (!this.passives.has(pId)) {
          const def = PASSIVES[pId];
          choices.push({
            kind: 'passive',
            id: pId,
            title: def.name,
            subtitle: 'NEW',
            currentLevel: 0,
            nextLevel: 1,
            description: def.descriptionPerLevel,
            synergyHint: `Evolves: ${BASE_WEAPONS[def.evolvesWeapon]?.name ?? ''}`,
            accentColor: def.iconColor
          });
        }
      }
    }

    // Passives that would complete an evolution for a weapon the player is levelling
    const evolutionPassives = new Map<string, BaseWeaponId>();
    for (const [wId, slot] of this.weapons.entries()) {
      const def = BASE_WEAPONS[wId as BaseWeaponId];
      if (!def || slot.evolved || !def.pairedPassive || this.passives.has(def.pairedPassive)) continue;
      evolutionPassives.set(def.pairedPassive, wId as BaseWeaponId);
    }
    for (const c of choices) {
      const forWeapon = c.kind === 'passive' ? evolutionPassives.get(c.id) : undefined;
      if (forWeapon) {
        c.synergyHint = `COMPLETES EVOLUTION: ${EVOLVED_WEAPONS[BASE_WEAPONS[forWeapon].evolvesInto!]?.name ?? ''}`;
      } else if (c.kind === 'weapon' && c.nextLevel === 8) {
        const def = BASE_WEAPONS[c.id as BaseWeaponId];
        if (def?.pairedPassive && this.passives.has(def.pairedPassive)) c.synergyHint = 'EVOLUTION READY AT THE NEXT DATA VAULT';
      }
    }

    // Pick 3 (or 4 with high luck). A weapon close to evolving always gets its missing passive offered;
    // otherwise owned items are favoured so builds can focus.
    const count = this.computedStats.luckMultiplier >= 1.3 ? 4 : 3;
    const shuffled: UpgradeChoice[] = [];
    const pool = [...choices];
    for (let i = pool.length - 1; i >= 0 && shuffled.length < count; i--) {
      const c = pool[i];
      const forWeapon = c.kind === 'passive' ? evolutionPassives.get(c.id) : undefined;
      if (forWeapon && (this.weapons.get(forWeapon)?.level ?? 0) >= UPGRADE_OFFERS.guaranteePassiveAtLevel) {
        shuffled.push(pool.splice(i, 1)[0]);
      }
    }
    const weightOf = (c: UpgradeChoice) => (c.subtitle === 'NEW' ? 1 : UPGRADE_OFFERS.ownedWeight);
    while (pool.length > 0 && shuffled.length < count) {
      const total = pool.reduce((sum, c) => sum + weightOf(c), 0);
      let roll = globalRNG.range(0, total);
      let idx = 0;
      while (idx < pool.length - 1 && roll >= weightOf(pool[idx])) {
        roll -= weightOf(pool[idx]);
        idx++;
      }
      shuffled.push(pool.splice(idx, 1)[0]);
    }

    // If pool exhausted (all items maxed), offer Medkit or Scrap
    while (shuffled.length < 3) {
      if (shuffled.length === 0) {
        shuffled.push({
          kind: 'heal',
          id: 'medkit',
          title: 'Tech-Com Field Medkit',
          subtitle: 'FIELD AID',
          currentLevel: 0,
          nextLevel: 1,
          description: 'Restores 40 HP immediately.',
          accentColor: '#00ff88'
        });
      } else {
        shuffled.push({
          kind: 'scrap',
          id: 'scrap_cache',
          title: 'Skynet Alloy Scrap Cache',
          subtitle: 'SALVAGE',
          currentLevel: 0,
          nextLevel: 1,
          description: 'Awards +50 Alloy Scrap for Bunker upgrades.',
          accentColor: '#ffd700'
        });
      }
    }

    return shuffled;
  }

  public useReroll(): boolean {
    if (this.rerollsLeft <= 0) return false;
    this.rerollsLeft--;
    return true;
  }

  public applyUpgrade(choice: UpgradeChoice): void {
    if (choice.kind === 'weapon') {
      const wId = choice.id as BaseWeaponId;
      const current = this.weapons.get(wId);
      if (current) {
        current.level = Math.min(8, current.level + 1);
      } else {
        this.weapons.set(wId, {
          id: wId,
          level: 1,
          evolved: false,
          cooldownTimer: 0
        });
      }
    } else if (choice.kind === 'passive') {
      const pId = choice.id as PassiveId;
      const curLv = this.passives.get(pId) ?? 0;
      this.passives.set(pId, curLv + 1);
      this.recalculateStats();
    } else if (choice.kind === 'heal') {
      this.heal(40);
    } else if (choice.kind === 'scrap') {
      this.addScrap(50);
    }
  }

  public checkAndEvolveWeapon(): EvolvedWeaponId | null {
    for (const [wId, slot] of this.weapons.entries()) {
      if (!slot.evolved && slot.level >= 8) {
        const evoId = canEvolveWeapon(wId, slot.level, this.passives);
        if (evoId) {
          this.weapons.delete(wId);
          this.weapons.set(evoId, {
            id: evoId,
            level: 1,
            evolved: true,
            cooldownTimer: 0
          });
          const evoName = ALL_WEAPONS[evoId]?.name ?? evoId;
          globalEvents.emit('weapon:evolved', { from: wId, to: evoId, name: evoName });
          return evoId;
        }
      }
    }
    return null;
  }
}
