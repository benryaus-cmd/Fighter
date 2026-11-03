import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROSTER } from '../src/game/roster.ts';
const states=['idle','walk','jab','cross','kick','heavy','hit','ko','crouch','jump','retreat','flyback'];
for(const fighter of ROSTER)test(`${fighter.id}: all baked clips target its real rig with finite samples`,()=>{
 const b=readFileSync(new URL(`../public/animations/${fighter.file}`,import.meta.url));
 assert.equal(b.toString('ascii',0,4),'glTF');
 const len=b.readUInt32LE(12),gltf=JSON.parse(b.toString('utf8',20,20+len));
 assert.deepEqual(gltf.animations.map(c=>c.name),states);
 const semantics=gltf.nodes.map(n=>n.extras?.semantic).filter(Boolean);assert.equal(new Set(semantics).size,semantics.length,'helper controls must not masquerade as animated joints');
 for(const clip of gltf.animations){
  assert.ok(clip.channels.length>=50,`${clip.name} covers limbs, spine and fingers`);
  let changingRotations=0;
  for(const channel of clip.channels){
   assert.ok(gltf.nodes[channel.target.node]?.name);
   const a=gltf.accessors[clip.samplers[channel.sampler].output],v=gltf.bufferViews[a.bufferView];
   const offset=20+len+8+(v.byteOffset||0)+(a.byteOffset||0);
   if(a.type==='VEC4'){
    const first=Array.from({length:4},(_,k)=>b.readFloatLE(offset+k*4));let moved=false;
    for(let f=1;f<a.count;f++){let dot=0;for(let k=0;k<4;k++)dot+=first[k]*b.readFloatLE(offset+(f*4+k)*4);if(Math.abs(dot)<.9999){moved=true;break;}}
    if(moved)changingRotations++;
   }
   for(let i=0;i<a.count*(a.type==='VEC4'?4:3);i++)assert.ok(Number.isFinite(b.readFloatLE(offset+i*4)));
  }
  assert.ok(changingRotations>=3,`${clip.name} must animate at least three joints; frozen clips are not valid`);
 }
});
