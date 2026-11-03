import type { AttackId } from './rules.ts';
export type ComboStep={id:AttackId;time:number};
export const COMBOS=[{sequence:['jab','jab','cross'],name:'HEARTBREAKER',bonus:8},{sequence:['jab','cross','kick'],name:'CRIMSON RUSH',bonus:10}] as const;
export function detectCombo(history:ComboStep[],window:number){
 for(const combo of COMBOS){const tail=history.slice(-combo.sequence.length);if(tail.length===combo.sequence.length&&tail[tail.length-1].time-tail[0].time<=window&&tail.every((v,i)=>v.id===combo.sequence[i]))return combo;}
 return null;
}
