/** Offline, direction-corrected retargeting. No retargeting runs on the phone. */
import fs from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});} };
const definitions={
 idle:['male2_e8_bounce',1,3], walk:['male2_e3_advance',1.8,3.1],
 jab:['punch_jab',0,.65],cross:['punch_cross',0,.8],
 kick:['male2_g2_frontkick',.30,1.40],heavy:['male2_g3_sidekickleadingright',.25,1.35],
 hit:['hit_chest',0,.333],ko:['death01',0,2.4],
 crouch:['crouch_idle_loop',0,1.8],jump:['jump_loop',0,1.0],retreat:['male2_e5_retreat',1.3,2.8],flyback:['hit_knockback',0,.83],
};
import { semantic, restoreBindPose } from './rig-map.mjs';
const next={pelvis:'spine_01',spine_01:'spine_02',spine_02:'spine_03',spine_03:'neck_01',neck_01:'Head'};
for(const s of ['l','r']){
 for(const [a,b] of [['clavicle','upperarm'],['upperarm','lowerarm'],['lowerarm','hand'],['hand','middle_01'],['thigh','calf'],['calf','foot'],['foot','ball']])next[`${a}_${s}`]=`${b}_${s}`;
 for(const d of ['index','middle','ring','pinky','thumb'])for(let i=1;i<3;i++)next[`${d}_0${i}_${s}`]=`${d}_0${i+1}_${s}`;
}
async function load(file){const b=await fs.readFile(file);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
function readHierarchy(bytes,restore=false){
 const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const nodes=j.nodes.map(n=>{const o=new T.Bone();o.name=T.PropertyBinding.sanitizeNodeName(n.name||'');o.userData.semantic=semantic(n.name||'');if(n.matrix)o.applyMatrix4(new T.Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
 j.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
 const root=new T.Group();for(const i of j.scenes[j.scene||0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
 if(restore){const skin=j.skins[0],a=j.accessors[skin.inverseBindMatrices],v=j.bufferViews[a.bufferView];const bin=28+bytes.readUInt32LE(12)+(v.byteOffset||0)+(a.byteOffset||0);const inverses=skin.joints.map((_,i)=>new T.Matrix4().fromArray(Array.from({length:16},(_,k)=>bytes.readFloatLE(bin+i*64+k*4))));restoreBindPose(skin.joints.map(i=>nodes[i]),inverses);root.updateMatrixWorld(true);}
 return root;
}
await fs.mkdir('public/animations',{recursive:true});
const sources={};for(const [state,[file,start,end]]of Object.entries(definitions)){
 const gltf=await load(`assets/motion-source/${file}.glb`);const bones=new Map();gltf.scene.traverse(o=>bones.set(o.name,o));
 const rest=new Map();gltf.scene.updateMatrixWorld(true);for(const [n,o]of bones)rest.set(n,{q:o.getWorldQuaternion(new T.Quaternion()),p:o.getWorldPosition(new T.Vector3())});
 const mixer=new T.AnimationMixer(gltf.scene);const action=mixer.clipAction(gltf.animations[0]);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 sources[state]={...gltf,bones,rest,mixer,action,start,end};
}
for(const file of (await fs.readdir('public/models')).filter(f=>f.endsWith('.glb'))){
 const scene=readHierarchy(await fs.readFile('public/models/'+file),file==='anime-girl-base.glb');const ordered=[];const map=new Map();scene.traverse(o=>{const s=o.userData.semantic;if(s&&!map.has(s)){map.set(s,o);ordered.push([s,o]);}});
 if(!map.has('spine_03')){map.set('spine_03',map.get('spine_02'));}
 const saved=new Map();scene.traverse(o=>saved.set(o,{q:o.quaternion.clone(),p:o.position.clone(),worldQ:o.getWorldQuaternion(new T.Quaternion()),worldP:o.getWorldPosition(new T.Vector3())}));
 const clips=[];
 for(const [state,source]of Object.entries(sources)){
  // Never sample a negative time: LoopOnce clamps and pauses at the start.
  // Reset per rig so a previous end-frame sample cannot leave the source paused.
  source.action.reset().play();
  const corrections=new Map();
  for(const [s,o]of ordered){
   const srcRest=source.rest.get(s);if(!srcRest)continue;
   const neutral=saved.get(o).worldQ.clone();const child=map.get(next[s]);const sc=source.rest.get(next[s]);
   if(child&&sc&&child!==o){
    const a=saved.get(child).worldP.clone().sub(saved.get(o).worldP).normalize();
    const b=sc.p.clone().sub(srcRest.p).normalize();
    neutral.premultiply(new T.Quaternion().setFromUnitVectors(a,b));
   }
   corrections.set(o,srcRest.q.clone().invert().multiply(neutral));
  }
  const count=Math.ceil((source.end-source.start)*30)+1;const times=Float32Array.from({length:count},(_,i)=>i*(source.end-source.start)/(count-1));
  const values=new Map(ordered.map(([,o])=>[o,[]]));const hips=[];
  source.mixer.setTime(source.start);source.scene.updateMatrixWorld(true);const startHip=source.bones.get('pelvis').getWorldPosition(new T.Vector3());
  source.mixer.setTime(source.end-.00001);source.scene.updateMatrixWorld(true);const endHip=source.bones.get('pelvis').getWorldPosition(new T.Vector3());
  const hip=map.get('pelvis'),hipRest=saved.get(hip);const scale=hipRest.worldP.y/source.rest.get('pelvis').p.y;
  for(let i=0;i<count;i++){
   scene.traverse(o=>{o.quaternion.copy(saved.get(o).q);o.position.copy(saved.get(o).p);});scene.updateMatrixWorld(true);
   source.mixer.setTime(Math.max(0,Math.min(source.start+times[i],source.animations[0].duration-.000001)));source.scene.updateMatrixWorld(true);
   for(const [s,o]of ordered){
    const src=source.bones.get(s),correction=corrections.get(o);if(!src||!correction)continue;
    const world=src.getWorldQuaternion(new T.Quaternion()).multiply(correction);
    const parent=o.parent.getWorldQuaternion(new T.Quaternion());o.quaternion.copy(parent.invert().multiply(world)).normalize();o.updateWorldMatrix(false,true);
    values.get(o).push(...o.quaternion.toArray());
   }
   const p=source.bones.get('pelvis').getWorldPosition(new T.Vector3());
   const drift=startHip.clone().lerp(endHip,i/(count-1));
   const worldHip=hipRest.worldP.clone().add(new T.Vector3((p.x-drift.x)*scale,(p.y-source.rest.get('pelvis').p.y)*scale,(p.z-drift.z)*scale));
   // Retain the fall's vertical root motion; remove locomotion's net travel.
   hip.position.copy(hip.parent.worldToLocal(worldHip));hips.push(...hip.position.toArray());
  }
  const tracks=[];for(const [,o]of ordered){const v=values.get(o);if(v.length===count*4)tracks.push(new T.QuaternionKeyframeTrack(o.name+'.quaternion',times,v));}
  tracks.push(new T.VectorKeyframeTrack(hip.name+'.position',times,hips));clips.push(new T.AnimationClip(state,-1,tracks));
 }
 scene.traverse(o=>{o.quaternion.copy(saved.get(o).q);o.position.copy(saved.get(o).p);});
 const selectedNodes=new Set(ordered.map(([,o])=>o));
 scene.traverse(o=>{if(o.userData.semantic&&!selectedNodes.has(o))delete o.userData.semantic;});
 const result=await new GLTFExporter().parseAsync(scene,{binary:true,animations:clips,onlyVisible:false});
 const path=`public/animations/${file}`;await fs.writeFile(path,Buffer.from(result));console.log(`${file}: ${ordered.length} joints, ${clips.length} clips, ${(result.byteLength/1024).toFixed(0)} KiB`);
}
