export type AttackId = 'jab' | 'cross' | 'kick' | 'heavy';
export type MoveState = 'idle' | 'walk' | AttackId | 'hit' | 'ko' | 'win';
export type AttackSpec = {
  windup: number; active: number; recovery: number;
  damage: number; reach: number; knockback: number; sfx: number;
};
export const ATTACKS: Record<AttackId, AttackSpec> = {
  jab:   { windup: .095, active: .09, recovery: .185, damage: 6, reach: 1.02, knockback: .07, sfx: 320 },
  cross: { windup: .13, active: .11, recovery: .28, damage: 10, reach: 1.09, knockback: .13, sfx: 260 },
  kick:  { windup: .25, active: .13, recovery: .30, damage: 12, reach: 1.30, knockback: .20, sfx: 205 },
  heavy: { windup: .33, active: .15, recovery: .38, damage: 17, reach: 1.48, knockback: .30, sfx: 160 },
};
export const ATTACK_BUTTONS: { id: AttackId; label: string; shortcut: string; symbol: string }[] = [
  { id: 'jab', label: 'JAB', shortcut: 'J', symbol: 'A' },
  { id: 'cross', label: 'CROSS', shortcut: 'K', symbol: 'B' },
  { id: 'kick', label: 'FRONT KICK', shortcut: 'L', symbol: 'X' },
  { id: 'heavy', label: 'POWER KICK', shortcut: 'I', symbol: 'Y' },
];
export type ActiveAttack = { id: AttackId; elapsed: number; hit: boolean };
export const totalDuration = (a: AttackSpec) => a.windup + a.active + a.recovery;
export const activeAt = (a: AttackSpec, time: number) => time >= a.windup && time < a.windup + a.active;
export const canReach = (ax: number, az: number, bx: number, bz: number, reach: number) =>
  Math.abs(az - bz) < .42 && Math.hypot(ax - bx, (az - bz) * 1.5) <= reach;
export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
