import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,sanitizeSettings,settingsJSON} from '../src/game/settings.ts';
import {detectCombo} from '../src/game/combos.ts';
import * as rules from '../src/game/rules.ts';
test('punch timing holds near full extension during the active window',()=>{
 const spec=rules.attackSpec?.('jab',DEFAULT_SETTINGS);assert.ok(spec?.active>=.15);
 const a=rules.attackClipProgress?.('jab',spec,spec.windup+.02),b=rules.attackClipProgress?.('jab',spec,spec.windup+spec.active-.02);
 assert.ok(a>=.25&&b<=.32);assert.ok(rules.totalDuration(spec)>=.65);
});
test('combo requires the correct ordered hits inside its window',()=>{
 const hits=[{id:'jab',time:0},{id:'jab',time:.6},{id:'cross',time:1.3}];assert.equal(detectCombo(hits,1.8)?.name,'HEARTBREAKER');assert.equal(detectCombo(hits,.7),null);assert.equal(detectCombo([hits[1],hits[2]],2),null);
});
test('exported tuning round trips and invalid settings cannot break gameplay',()=>{
 assert.deepEqual(sanitizeSettings(JSON.parse(settingsJSON(DEFAULT_SETTINGS))),DEFAULT_SETTINGS);
 const s=sanitizeSettings({jabDuration:-9,toonStrength:22,musicVolume:NaN,lighting:'bad',cpuEnabled:false});assert.equal(s.jabDuration,.35);assert.equal(s.toonStrength,1);assert.equal(s.musicVolume,DEFAULT_SETTINGS.musicVolume);assert.equal(s.lighting,'sunset');assert.equal(s.cpuEnabled,false);
});
