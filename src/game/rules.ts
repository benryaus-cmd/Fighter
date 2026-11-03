import {DEFAULT_SETTINGS} from './settings.ts';
import type {Settings} from './settings.ts';
export type AttackId = 'jab' | 'cross' | 'kick' | 'heavy' | 'special';
export type MoveState = 'idle' | 'walk' | AttackId | 'hit' | 'ko' | 'win';
export type AttackSpec = {
  windup: number; active: number; recovery: number;
  damage: number; reach: number; knockback: number; sfx: number;
};
const BASE:Record<AttackId,AttackSpec>={
 jab:{windup:.216,active:.17,recovery:.334,damage:6,reach:1.02,knockback:.06,sfx:320},
 cross:{windup:.27,active:.17,recovery:.46,damage:10,reach:1.09,knockback:.10,sfx:260},
 kick:{windup:.29,active:.13,recovery:.36,damage:12,reach:1.30,knockback:.18,sfx:205},
 heavy:{windup:.38,active:.15,recovery:.47,damage:17,reach:1.48,knockback:.28,sfx:160},
 special:{windup:.55,active:.18,recovery:.52,damage:26,reach:7,knockback:.45,sfx:90},
};
export function attackSpec(id:AttackId,settings:Settings):AttackSpec{
 const base=BASE[id];if(id==='special')return {...base,damage:base.damage*settings.damageMultiplier};
 const duration=settings[`${id}Duration` as 'jabDuration'|'crossDuration'|'kickDuration'|'heavyDuration'];
 const punch=id==='jab'||id==='cross',windup=duration*(punch?.30:.38),active=punch?Math.min(settings.punchHold,duration*.32):duration*.18;
 return {...base,windup,active,recovery:duration-windup-active,damage:base.damage*settings.damageMultiplier};
}
export const ATTACKS=Object.fromEntries((Object.keys(BASE) as AttackId[]).map(id=>[id,attackSpec(id,DEFAULT_SETTINGS)])) as Record<AttackId,AttackSpec>;
/** Map combat phases onto each clip's contact pose; active frames briefly hold extension. */
export function attackClipProgress(id:AttackId,spec:AttackSpec,time:number){
 const peak=id==='jab'?.257:id==='cross'||id==='special'?.25:id==='kick'?.427:.436;
 if(time<spec.windup)return Math.max(0,time/spec.windup)*peak;
 if(time<spec.windup+spec.active)return peak+(time-spec.windup)/spec.active*.035;
 return Math.min(1,peak+.035+(1-peak-.035)*(time-spec.windup-spec.active)/spec.recovery);
}
export const ATTACK_BUTTONS: { id: AttackId; label: string; shortcut: string; symbol: string }[] = [
  { id: 'jab', label: 'JAB', shortcut: 'J', symbol: 'A' },
  { id: 'cross', label: 'CROSS', shortcut: 'K', symbol: 'B' },
  { id: 'kick', label: 'FRONT KICK', shortcut: 'L', symbol: 'X' },
  { id: 'heavy', label: 'POWER KICK', shortcut: 'I', symbol: 'Y' },
];
export type ActiveAttack = { id: AttackId; elapsed: number; hit: boolean; spec?:AttackSpec; trailed?:boolean };
export const totalDuration = (a: AttackSpec) => a.windup + a.active + a.recovery;
export const activeAt = (a: AttackSpec, time: number) => time >= a.windup && time < a.windup + a.active;
export const canReach = (ax: number, az: number, bx: number, bz: number, reach: number) =>
  Math.abs(az - bz) < .42 && Math.hypot(ax - bx, (az - bz) * 1.5) <= reach;
export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
