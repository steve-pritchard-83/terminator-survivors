/** The daily operation: everyone gets the same waves on the same (local) day. */

/** Today's date as YYYY-MM-DD in the player's own time zone. */
export function dailyKey(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The run seed for a day (FNV-1a hash of the date key). */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
