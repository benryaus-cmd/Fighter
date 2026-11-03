export type AttackId = 'jab' | 'cross' | 'kick' | 'heavy';
export type MoveState = 'idle' | 'walk' | AttackId | 'hit' | 'ko' | 'win';
export type AttackSpec = {
  windup: number; active: number; recovery: number;
  damage: number; reach: number; knockback: number; sfx: number;
};
export const ATTACKS: Record<AttackId, AttackSpec> = {
  jab:   { windup: .09, active: .12, recovery: .15, damage: 6,  reach: 1.70, knockback: .12, sfx: 320 },
  cross: { windup: .16, active: .13, recovery: .29, damage: 10, reach: 1.78, knockback: .25, sfx: 260 },
  kick:  { windup: .22, active: .18, recovery: .36, damage: 13, reach: 2.23, knockback: .34, sfx: 205 },
  heavy: { windup: .35, active: .18, recovery: .55, damage: 19, reach: 1.83, knockback: .5, sfx: 160 },
};
export const ATTACK_BUTTONS: { id: AttackId; label: string; shortcut: string }[] = [
  { id: 'jab', label: 'JAB', shortcut: 'J' },
  { id: 'cross', label: 'CROSS', shortcut: 'K' },
  { id: 'kick', label: 'KICK', shortcut: 'L' },
  { id: 'heavy', label: 'HEAVY', shortcut: 'I' },
];
export type ActiveAttack = { id: AttackId; elapsed: number; hit: boolean };
export const totalDuration = (a: AttackSpec) => a.windup + a.active + a.recovery;
export const activeAt = (a: AttackSpec, time: number) => time >= a.windup && time < a.windup + a.active;
export const canReach = (ax: number, az: number, bx: number, bz: number, reach: number) =>
  Math.hypot(ax - bx, (az - bz) * 1.35) <= reach;
export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
