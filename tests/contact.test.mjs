import test from 'node:test';import assert from 'node:assert/strict';import * as rules from '../src/game/rules.ts';
const p=(x,y,z=0)=>({x,y,z});
test('animated fist has to physically reach the posed body',()=>{
 const body=[{center:p(1,1.6),radius:.20}];
 assert.equal(rules.strikeTouches?.(p(.3,1.6),p(.5,1.6),body,.09),false);
 assert.equal(rules.strikeTouches?.(p(.55,1.6),p(.9,1.6),body,.09),true);
});
test('swept contact catches fast fists but rejects attacks over crouched heads',()=>{
 assert.equal(rules.strikeTouches?.(p(0,1.6),p(1.4,1.6),[{center:p(.8,1.6),radius:.2}],.09),true);
 assert.equal(rules.strikeTouches?.(p(0,1.6),p(1.4,1.6),[{center:p(.8,.9),radius:.2}],.09),false);
 assert.equal(rules.strikeTouches?.(p(.6,.3),p(1.1,.3),[{center:p(1,1.25),radius:.16}],.13),false);
});
test('jump physics lands cleanly and contextual kicks select the right variant',()=>{
 let y=0,vy=4.8;for(let i=0;i<90;i++){const next=rules.stepJump?.(y,vy,1/60,12);assert.ok(next);({y,vy}=next);}assert.equal(y,0);assert.equal(vy,0);
 assert.equal(rules.contextualAttack?.('kick',false,true),'sweep');assert.equal(rules.contextualAttack?.('heavy',true,false),'flyingKick');assert.equal(rules.contextualAttack?.('jab',true,false),'jab');
});
test('CPU retreats at close range and during reset instead of always walking in',()=>{
 assert.equal(rules.cpuDirection?.(.75,'pressure',false),-1);assert.equal(rules.cpuDirection?.(1.15,'reset',false),-1);assert.equal(rules.cpuDirection?.(2.2,'approach',false),1);assert.equal(rules.cpuDirection?.(1.2,'pressure',false),0);assert.equal(rules.cpuDirection?.(1.9,'reset',false),0);
});
