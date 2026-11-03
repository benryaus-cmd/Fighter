import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, activeAt, canReach, clamp, totalDuration } from '../src/game/rules.ts';
test('all moves have valid damage and timing',()=>{
  assert.deepEqual(Object.keys(ATTACKS),['jab','cross','kick','heavy','special']);
  for(const spec of Object.values(ATTACKS)) {
    assert.ok(spec.damage>0);assert.ok(spec.reach>.3);
    assert.equal(activeAt(spec,spec.windup/2),false);
    assert.equal(activeAt(spec,spec.windup+.001),true);
    assert.equal(activeAt(spec,totalDuration(spec)),false);
  }
});
test('distance supports depth and not just horizontal plane',()=>{
  assert.equal(canReach(0,0,1,0,1.1),true);
  assert.equal(canReach(0,0,1,2,2),false);
});
test('health and arena helpers clamp',()=>{
  assert.equal(clamp(-1,0,100),0);assert.equal(clamp(250,0,100),100);
});
test('attacks cannot connect across separate depth lanes',()=>{
  assert.equal(canReach(0,0,.6,.6,ATTACKS.heavy.reach),false);
});
test('punches cannot land at the old invisible two-metre range',()=>{
  assert.equal(canReach(0,0,1.6,0,ATTACKS.jab.reach),false);
  assert.ok(ATTACKS.heavy.reach > ATTACKS.jab.reach);
});
