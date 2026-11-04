import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../src/game/rules.ts';
test('directional attacks are relative to opponent and preserve neutral attacks',()=>{
 assert.equal(rules.directionalAttack?.('jab',false,false,1),'backfistR');
 assert.equal(rules.directionalAttack?.('jab',false,false,-1),'backfistL');
 assert.equal(rules.directionalAttack?.('cross',false,true,0),'uppercut');
 assert.equal(rules.directionalAttack?.('heavy',true,false,0),'flyingKnee');
 assert.equal(rules.directionalAttack?.('kick',true,false,0),'flyingKick');
 assert.equal(rules.directionalAttack?.('heavy',false,false,-1),'backKick');
 assert.equal(rules.directionalAttack?.('heavy',false,false,1),'capoeira');
 assert.equal(rules.directionalAttack?.('kick',false,true,1),'sweep');
 assert.equal(rules.directionalAttack?.('kick',false,false,0),'kick');
});
test('isolated normal and random critical attacks do not launch; finishers do',()=>{
 assert.equal(rules.shouldLaunch?.('heavy',false,false,1),false);
 assert.equal(rules.shouldLaunch?.('flyingKick',false,false,1),false);
 assert.equal(rules.shouldLaunch?.('cross',true,false,3),true);
 assert.equal(rules.shouldLaunch?.('uppercut',false,true,1),true);
 assert.equal(rules.shouldLaunch?.('cross',false,false,3),true);
 assert.equal(rules.shouldLaunch?.('jab',false,false,3),false);
});
test('high guard reduces ordinary hits while sweeps break it',()=>{
 assert.equal(rules.guardMultiplier?.('jab',true),.22);
 assert.equal(rules.guardMultiplier?.('sweep',true),1);
 assert.equal(rules.guardMultiplier?.('cross',false),1);
});
