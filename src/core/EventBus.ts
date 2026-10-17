import type { ActiveEnemy, UpgradeChoice, WeaponId } from './types';

export type GameEventMap = {
  'player:damaged': { currentHp: number; maxHp: number; damage: number };
  'player:healed': { currentHp: number; maxHp: number; amount: number };
  'player:died': void;
  'player:revived': { remaining: number };
  'player:dash': { x: number; z: number };
  'enemy:killed': { enemy: ActiveEnemy; x: number; z: number; xp: number };
  'enemy:damaged': { x: number; z: number; damage: number; isCrit: boolean };
  'crate:destroyed': { crateId: number; x: number; z: number };
  'pickup:reward': { x: number; z: number; text: string; color: string };
  'wave:minute': { minute: number };
  'boss:spawned': { archetype: string; name: string; maxHp: number };
  'boss:defeated': { archetype: string; x: number; z: number };
  'levelup:triggered': { level: number; choices: UpgradeChoice[] };
  'vault:opened': { upgradesAwarded: number; evolvedWeapon?: WeaponId; alloyBonus: number };
  'weapon:evolved': { from: WeaponId; to: WeaponId; name: string };
  'camera:shake': { trauma: number };
  'audio:sfx': { name: string; arg?: number };
};

type EventCallback<T> = (data: T) => void;

export class EventBus {
  private readonly listeners = new Map<keyof GameEventMap, Set<EventCallback<any>>>();

  public on<K extends keyof GameEventMap>(
    event: K,
    callback: EventCallback<GameEventMap[K]>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => {
      set?.delete(callback);
    };
  }

  public emit<K extends keyof GameEventMap>(event: K, data: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const globalEvents = new EventBus();
