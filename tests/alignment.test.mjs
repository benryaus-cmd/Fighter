import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ROSTER} from '../src/game/roster.ts';
const contacts={kick:['foot_r',.427],backKick:['foot_r',.44],capoeira:['foot_l',.37],flyingKnee:['calf_r',.48],backfistL:['middle_01_l',.36],backfistR:['middle_01_r',.40],uppercut:['middle_01_r',.39]};
for(const fighter of ROSTER)test(`${fighter.id}: new strikes point down the opponent lane on the actual baked rig`,async()=>{
 const b=readFileSync(new URL(`../public/animations/${fighter.file}`,import.meta.url));const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const bones=new Map();g.scene.traverse(o=>{if(o.userData.semantic)bones.set(o.userData.semantic,o)});
 const mixer=new T.AnimationMixer(g.scene);
 for(const [name,[limb,peak]]of Object.entries(contacts)){
  mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name);const action=mixer.clipAction(clip);action.reset().play();mixer.setTime(clip.duration*peak);g.scene.updateMatrixWorld(true);
  const p=bones.get(limb).getWorldPosition(new T.Vector3()).sub(bones.get('pelvis').getWorldPosition(new T.Vector3()));
  assert.ok(p.z>0,`${name} must extend toward the opponent`);assert.ok(Math.abs(Math.atan2(p.x,p.z))<.06,`${name} drifts sideways`);
 }
 mixer.stopAllAction();mixer.uncacheRoot(g.scene);
});
