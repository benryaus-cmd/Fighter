import {DEFAULT_SETTINGS} from './settings.ts';
import type {Settings} from './settings.ts';
export type AttackId = 'jab' | 'cross' | 'kick' | 'heavy' | 'special' | 'sweep' | 'flyingKick';
export type MoveState = 'idle' | 'walk' | AttackId | 'hit' | 'ko' | 'win' | 'crouch' | 'jump' | 'retreat' | 'flyback';
export type AttackSpec = {
  windup: number; active: number; recovery: number;
  damage: number; reach: number; knockback: number; sfx: number;
};
const BASE:Record<AttackId,AttackSpec>={
 jab:{windup:.216,active:.17,recovery:.334,damage:6,reach:1.02,knockback:.06,sfx:320},
 cross:{windup:.27,active:.17,recovery:.46,damage:10,reach:1.09,knockback:.10,sfx:260},
 kick:{windup:.29,active:.13,recovery:.36,damage:12,reach:1.30,knockback:.18,sfx:205},
 heavy:{windup:.38,active:.15,recovery:.47,damage:17,reach:1.48,knockback:.28,sfx:160},
 sweep:{windup:.24,active:.18,recovery:.35,damage:11,reach:1.15,knockback:.16,sfx:180},
 flyingKick:{windup:.18,active:.20,recovery:.34,damage:19,reach:1.5,knockback:.30,sfx:170},
 special:{windup:.55,active:.18,recovery:.52,damage:26,reach:7,knockback:.45,sfx:90},
};
export function attackSpec(id:AttackId,settings:Settings):AttackSpec{
 const base=BASE[id];if(id==='special'||id==='sweep'||id==='flyingKick')return {...base,damage:base.damage*settings.damageMultiplier};
 const duration=settings[`${id}Duration` as 'jabDuration'|'crossDuration'|'kickDuration'|'heavyDuration'];
 const punch=id==='jab'||id==='cross',windup=duration*(punch?.30:.38),active=punch?Math.min(settings.punchHold,duration*.32):duration*.18;
 return {...base,windup,active,recovery:duration-windup-active,damage:base.damage*settings.damageMultiplier};
}
export const ATTACKS=Object.fromEntries((Object.keys(BASE) as AttackId[]).map(id=>[id,attackSpec(id,DEFAULT_SETTINGS)])) as Record<AttackId,AttackSpec>;
/** Map combat phases onto each clip's contact pose; active frames briefly hold extension. */
export function attackClipProgress(id:AttackId,spec:AttackSpec,time:number){
 const peak=id==='jab'?.257:id==='cross'||id==='special'?.25:id==='kick'?.427:id==='sweep'?.45:.436;
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
export type ActiveAttack = { id: AttackId; elapsed: number; hit: boolean; spec?:AttackSpec; trailed?:boolean; previousContact?:Point3 };
export const totalDuration = (a: AttackSpec) => a.windup + a.active + a.recovery;
export const activeAt = (a: AttackSpec, time: number) => time >= a.windup && time < a.windup + a.active;
export const canReach = (ax: number, az: number, bx: number, bz: number, reach: number) =>
  Math.abs(az - bz) < .42 && Math.hypot(ax - bx, (az - bz) * 1.5) <= reach;
export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export type Point3={x:number;y:number;z:number};
export type HurtSphere={center:Point3;radius:number};
export function strikeContact(from:Point3,to:Point3,targets:HurtSphere[],radius:number):Point3|null{
 const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=dx*dx+dy*dy+dz*dz;
 for(const {center:c,radius:r}of targets){const t=clamp(((c.x-from.x)*dx+(c.y-from.y)*dy+(c.z-from.z)*dz)/(length||1),0,1);const point={x:from.x+dx*t,y:from.y+dy*t,z:from.z+dz*t};if(Math.hypot(c.x-point.x,c.y-point.y,c.z-point.z)<=r+radius)return point;}return null;
}
export const strikeTouches=(from:Point3,to:Point3,targets:HurtSphere[],radius:number)=>strikeContact(from,to,targets,radius)!==null;
export function stepJump(y:number,vy:number,dt:number,gravity:number){
 const nextY=y+vy*dt-.5*gravity*dt*dt,nextV=vy-gravity*dt;
 return nextY<=0&&nextV<=0?{y:0,vy:0}:{y:Math.max(0,nextY),vy:nextV};
}
export function contextualAttack(id:AttackId,airborne:boolean,crouched:boolean):AttackId{return id==='kick'||id==='heavy'?airborne?'flyingKick':crouched?'sweep':id:id;}
export function cpuDirection(distance:number,mode:'approach'|'pressure'|'reset',threat:boolean){
 if(distance<.9)return -1;
 if(mode==='reset')return distance<1.65?-1:0;
 if(threat&&distance<1.3)return -1;
 if(distance>1.45)return 1;return 0;
}
