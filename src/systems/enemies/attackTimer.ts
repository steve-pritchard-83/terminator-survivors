/**
 * Counts an attack cooldown down by `dt`.
 *
 * While the target is out of range the cooldown never drops below the telegraph window,
 * so when the target re-enters range the attack always shows its full warning first
 * instead of firing instantly from an expired timer.
 */
export function tickCooldown(cooldown: number, dt: number, inRange: boolean, telegraphSeconds: number): number {
  const next = cooldown - dt;
  return inRange ? next : Math.max(next, telegraphSeconds + 0.01);
}
