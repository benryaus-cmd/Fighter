import {DEFAULT_SETTINGS} from './settings.ts';
import type {Settings} from './settings.ts';
export type AttackId = 'jab' | 'cross' | 'kick' | 'heavy' | 'special' | 'sweep' | 'flyingKick' | 'flyingKnee' | 'backfistL' | 'backfistR' | 'uppercut' | 'backKick' | 'capoeira';
export type MoveState = 'idle' | 'walk' | AttackId | 'hit' | 'ko' | 'win' | 'crouch' | 'jump' | 'retreat' | 'flyback' | 'guard' | 'dodgeBack' | 'dodgeIn' | 'intro1' | 'intro2' | 'victory1' | 'victory2';
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
 backfistL:{windup:.14,active:.13,recovery:.24,damage:5,reach:1.05,knockback:.06,sfx:320},
 backfistR:{windup:.16,active:.13,recovery:.25,damage:6,reach:1.05,knockback:.07,sfx:300},
 uppercut:{windup:.23,active:.16,recovery:.36,damage:15,reach:1.08,knockback:.22,sfx:220},
 flyingKnee:{windup:.17,active:.22,recovery:.35,damage:20,reach:1.2,knockback:.30,sfx:165},
 backKick:{windup:.31,active:.17,recovery:.38,damage:18,reach:1.5,knockback:.28,sfx:160},
 capoeira:{windup:.35,active:.18,recovery:.46,damage:20,reach:1.55,knockback:.32,sfx:150},
 special:{windup:.55,active:.18,recovery:.52,damage:26,reach:7,knockback:.45,sfx:90},
};
export function attackSpec(id:AttackId,settings:Settings):AttackSpec{
 const base=BASE[id];if(!['jab','cross','kick','heavy'].includes(id))return {...base,damage:base.damage*settings.damageMultiplier};
 const duration=settings[`${id}Duration` as 'jabDuration'|'crossDuration'|'kickDuration'|'heavyDuration'];
 const punch=id==='jab'||id==='cross',windup=duration*(punch?.30:.38),active=punch?Math.min(settings.punchHold,duration*.32):duration*.18;
 return {...base,windup,active,recovery:duration-windup-active,damage:base.damage*settings.damageMultiplier};
}
export const ATTACKS=Object.fromEntries((Object.keys(BASE) as AttackId[]).map(id=>[id,attackSpec(id,DEFAULT_SETTINGS)])) as Record<AttackId,AttackSpec>;
/** Map combat phases onto each clip's contact pose; active frames briefly hold extension. */
export function attackClipProgress(id:AttackId,spec:AttackSpec,time:number){
 const peaks:Partial<Record<AttackId,number>>={jab:.257,cross:.25,special:.25,kick:.427,sweep:.45,heavy:.436,flyingKick:.436,flyingKnee:.48,backfistL:.36,backfistR:.40,uppercut:.39,backKick:.44,capoeira:.37};
 const peak=peaks[id]??.4;
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

/** Direction is relative to the opponent, independent of screen side. */
export function directionalAttack(id:AttackId,airborne:boolean,crouched:boolean,direction:number):AttackId{
 if(airborne)return id==='heavy'?'flyingKnee':id==='kick'?'flyingKick':id;
 if(crouched)return id==='cross'?'uppercut':id==='kick'||id==='heavy'?'sweep':id;
 if(id==='jab')return direction>.4?'backfistR':direction<-.4?'backfistL':id;
 if(id==='heavy')return direction>.4?'capoeira':direction<-.4?'backKick':id;
 return id;
}
export function shouldLaunch(id:AttackId,combo:boolean,counter:boolean,chain:number){
 return combo||id==='special'||counter&&['heavy','flyingKnee','uppercut','backKick','capoeira'].includes(id)||chain>=3&&['cross','kick','heavy','flyingKick','flyingKnee','uppercut','backKick','capoeira'].includes(id);
}
export const guardMultiplier=(id:AttackId,guarding:boolean)=>guarding&&!['sweep','special'].includes(id)?.22:1;
export const ATTACK_LABELS:Record<AttackId,string>={jab:'JAB',cross:'CROSS',kick:'FRONT KICK',heavy:'POWER KICK',special:'CELESTIAL BURST',sweep:'LOW SWEEP',flyingKick:'FLYING KICK',flyingKnee:'FLYING KNEE',backfistL:'LEFT BACKFIST',backfistR:'RIGHT BACKFIST',uppercut:'RISING UPPERCUT',backKick:'BACK KICK',capoeira:'CAPOEIRA'};
export function comboAttack(id:AttackId):AttackId{return id==='backfistL'||id==='backfistR'?'jab':id==='uppercut'?'cross':id==='sweep'?'kick':['flyingKick','flyingKnee','backKick','capoeira'].includes(id)?'heavy':id;}
