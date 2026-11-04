import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MoveState } from './rules.ts';
import {GhostTrail} from './GhostTrail';
import { ATTACKS, totalDuration, attackSpec, attackClipProgress } from './rules.ts';
import { DEFAULT_SETTINGS } from './settings';
import type { Settings } from './settings';
import { restoreBindPose } from '../../scripts/rig-map.mjs';
import type { FighterVisual } from './ProceduralFighter';
/** Real motion clips are retargeted once by scripts/bake-combat.mjs. */
export async function loadGLBFighter(filename: string): Promise<FighterVisual> {
  const loader=new GLTFLoader();
  const [gltf,motion]=await Promise.all([
    loader.loadAsync(`./models/${filename}`),loader.loadAsync(`./animations/${filename}`),
  ]);
  const root=new THREE.Group(),body=gltf.scene;root.add(body);
  body.updateWorldMatrix(true,true);
  if(filename==='anime-girl-base.glb'){
    const seen=new Set<THREE.Bone>();body.traverse(o=>{if(o instanceof THREE.SkinnedMesh&&!seen.has(o.skeleton.bones[0])){restoreBindPose(o.skeleton.bones,o.skeleton.boneInverses);seen.add(o.skeleton.bones[0]);}});
    // The two body meshes use inverted units relative to the head/skin rig.
    // Repair their vertex space without changing the preserved source GLB.
    body.traverse(o=>{if(o instanceof THREE.SkinnedMesh){
      o.geometry.computeBoundingBox();if((o.geometry.boundingBox?.max.y??0)>=0)return;
      o.geometry.scale(-.32,-.32,-.32);
      const index=o.geometry.index;if(index){for(let i=0;i<index.count;i+=3){const v=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,v);}index.needsUpdate=true;}
      o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
    }});
    body.updateWorldMatrix(true,true);
  }
  const bounds=new THREE.Box3().setFromObject(body),size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.01)throw Error(`Invalid model: ${filename}`);
  const scale=2.15/size.y,center=bounds.getCenter(new THREE.Vector3());
  body.scale.setScalar(scale);body.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  body.updateWorldMatrix(true,true);
  const baseY=body.position.y;
  const gradient=new THREE.DataTexture(new Uint8Array(256),256,1,THREE.RedFormat);
  gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
  const feet:{bone:THREE.Object3D;sole:number}[]=[];
  const mapped:THREE.Object3D[]=[];
  const semantic=new Map<string,string>();motion.scene.traverse(o=>{if(o.userData.semantic)semantic.set(o.name,o.userData.semantic);});
  const bones=new Map<string,THREE.Object3D>();
  const meshes:THREE.Mesh[]=[];
  body.traverse(o=>{
    const id=semantic.get(o.name);
    if(id&&!bones.has(id)){bones.set(id,o);mapped.push(o);if(/^(foot|ball)_/.test(id))feet.push({bone:o,sole:o.getWorldPosition(new THREE.Vector3()).y});}
    if(o instanceof THREE.Mesh)meshes.push(o);
  });
  for(const mesh of meshes){
    mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;
    const original=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const materials=original.map(m=>{
      const s=m as THREE.MeshStandardMaterial;
      const toon=new THREE.MeshToonMaterial({color:s.color?.clone()??new THREE.Color('white'),map:s.map,gradientMap:gradient,
        alphaMap:s.alphaMap,alphaTest:Math.max(s.alphaTest||0,.35),side:s.side,transparent:false,
        emissive:s.emissive,emissiveMap:s.emissiveMap,emissiveIntensity:.25});
      toon.userData.fighterMaterial=true;toon.userData.outlineAllowed=!/eye|mouth|teeth|tongue|highlight/i.test(s.name);
      s.dispose();return toon;
    });
    mesh.material=Array.isArray(mesh.material)?materials:materials[0];

  }
  let settings:Settings={...DEFAULT_SETTINGS};
  const configure=(value:Settings)=>{
    settings=value;const data=gradient.image.data as Uint8Array;
    for(let i=0;i<256;i++){const smooth=i/255;const quantized=Math.round(smooth*(settings.toonBands-1))/(settings.toonBands-1);const band=settings.shadowLift+(1-settings.shadowLift)*quantized;const mixed=smooth*(1-settings.toonStrength)+band*settings.toonStrength;data[i]=THREE.MathUtils.clamp(((mixed-.5)*settings.shadeContrast+.5)*255,0,255);}gradient.needsUpdate=true;
    const color=new THREE.Color(settings.outlineColor).toArray();
    for(const mesh of meshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.userData.outlineParameters={visible:settings.outlineEnabled&&m.userData.outlineAllowed,thickness:settings.outlineWidth*.001,color,alpha:settings.outlineOpacity};
  };
  configure(settings);
  const mixer=new THREE.AnimationMixer(body);
  const actions=new Map<MoveState,THREE.AnimationAction>();
  const variants=[['special','cross'],['sweep','crouch'],['flyingKick','heavy']].map(([name,source])=>{const clip=motion.animations.find(c=>c.name===source)!.clone();clip.name=name;return clip;});
  for(const clip of [...motion.animations,...variants]){
    const action=mixer.clipAction(clip);const state=clip.name as MoveState;
    action.setLoop(['idle','walk','crouch','jump','retreat'].includes(state)?THREE.LoopRepeat:THREE.LoopOnce,Infinity);
    action.clampWhenFinished=true;actions.set(state,action);
  }
  let active:MoveState|null=null;let oldPhase=0;let reactionAge=0;
  const ghosts=new GhostTrail(root);
  const point=new THREE.Vector3();
  const aim=(name:string,childName:string,direction:THREE.Vector3,weight:number)=>{
    const bone=bones.get(name),child=bones.get(childName);if(!bone||!child||!bone.parent)return;
    root.updateWorldMatrix(true,true);const start=bone.getWorldPosition(new THREE.Vector3()),end=child.getWorldPosition(new THREE.Vector3());
    const current=end.sub(start).normalize(),desired=direction.normalize().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(current,desired));
    const local=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);bone.quaternion.slerp(local,weight);bone.updateWorldMatrix(false,true);
  };
  const contact=(id:import('./rules').AttackId)=>{
    const key=id==='flyingKnee'?'calf_r':id==='capoeira'?'foot_l':['jab','backfistL'].includes(id)?'middle_01_l':['cross','special','backfistR','uppercut'].includes(id)?'middle_01_r':'foot_r';
    const bone=bones.get(key)??bones.get(id==='jab'?'hand_l':id==='cross'?'hand_r':'foot_r');return bone?bone.getWorldPosition(new THREE.Vector3()):null;
  };
  const contactBase=(id:import('./rules').AttackId)=>['kick','heavy','sweep','flyingKick','backKick','capoeira','flyingKnee'].includes(id)?bones.get(id==='capoeira'?'calf_l':id==='flyingKnee'?'thigh_r':'calf_r')?.getWorldPosition(new THREE.Vector3())??null:null;
  const targets=()=>{
    root.updateWorldMatrix(true,true);const result:import('./rules').HurtSphere[]=[];
    for(const [key,r,raise]of [['Head',.18,.10],['spine_03',.22,.02],['spine_02',.21,0],['pelvis',.21,0],['calf_l',.15,0],['calf_r',.15,0],['foot_l',.13,0],['foot_r',.13,0]] as const){const bone=bones.get(key);if(!bone)continue;const center=bone.getWorldPosition(new THREE.Vector3());center.y+=raise;result.push({center,radius:r*settings.hitboxScale});}
    for(const side of ['l','r'])for(const [a,b,r]of [[`thigh_${side}`,`calf_${side}`,.16],[`calf_${side}`,`foot_${side}`,.14]] as const){const first=bones.get(a),second=bones.get(b);if(first&&second){const center=first.getWorldPosition(new THREE.Vector3()).lerp(second.getWorldPosition(new THREE.Vector3()),.5);result.push({center,radius:r*settings.hitboxScale});}}
    return result;
  };
  const update=(dt:number,_elapsed:number,state:MoveState,phase:number)=>{
    const next=state==='win'?'victory1':state;
    const repeated=next===active&&phase<oldPhase&&next in ATTACKS;
    if(active!==next||repeated){
      const previous=active?actions.get(active):undefined;
      const action=actions.get(next)??actions.get('idle')!;
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if(next in ATTACKS||['guard','intro1','intro2','victory1','victory2','dodgeBack','dodgeIn'].includes(next))action.paused=true;
      if(previous&&previous!==action){previous.fadeOut(next==='hit'?.055:settings.transitionTime);action.fadeIn(next==='hit'?.055:settings.transitionTime);}
      active=next;reactionAge=0;
    }
    if(next in ATTACKS){const id=next as keyof typeof ATTACKS,spec=attackSpec(id,settings),action=actions.get(next)!;action.time=attackClipProgress(id,spec,phase*totalDuration(spec))*action.getClip().duration;}
    if(['intro1','intro2','victory1','victory2','dodgeBack','dodgeIn'].includes(next)){const action=actions.get(next);if(action)action.time=Math.min(.999,phase)*action.getClip().duration;}
    if(next==='guard'){const action=actions.get(next);if(action)action.time=action.getClip().duration*.43;}
    oldPhase=phase;reactionAge+=dt;
    // A short hit reaction is held until stun releases; KO clamps on its last pose.
    mixer.update(dt);body.position.y=baseY;
    if(next==='sweep'||next==='flyingKick'){
      const spec=attackSpec(next,settings),elapsed=phase*totalDuration(spec);
      const weight=elapsed<spec.windup?elapsed/spec.windup:elapsed<spec.windup+spec.active?1:1-(elapsed-spec.windup-spec.active)/spec.recovery;
      const swing=next==='sweep'?THREE.MathUtils.clamp((elapsed-spec.windup)/spec.active,0,1)*1.3-.65:0;
      if(next==='sweep'){aim('spine_01','spine_02',new THREE.Vector3(0,1,.1),.65*weight);aim('spine_02','spine_03',new THREE.Vector3(0,1,.1),.4*weight);}
      aim('thigh_r','calf_r',new THREE.Vector3(Math.sin(swing)*.7,next==='sweep'?-.10:-.35,Math.cos(swing)),weight);
      aim('calf_r','foot_r',new THREE.Vector3(Math.sin(swing)*.7,next==='sweep'?-.12:-.12,Math.cos(swing)),weight);
      aim('foot_r','ball_r',new THREE.Vector3(Math.sin(swing),.02,Math.cos(swing)),weight);
    }
    root.updateWorldMatrix(true,true);
    let correction=Infinity;
    if(next==='ko'){
      for(const bone of mapped){bone.getWorldPosition(point);root.worldToLocal(point);correction=Math.min(correction,point.y-.06);}
      if(correction<0)body.position.y-=correction;
    }else if(!['jump','flyingKick','flyingKnee','flyback'].includes(next)){
      if(next==='capoeira'){for(const side of ['l','r']){const hand=bones.get(`hand_${side}`);if(hand){hand.getWorldPosition(point);root.worldToLocal(point);correction=Math.min(correction,point.y-.04);}}}
      for(const foot of feet){foot.bone.getWorldPosition(point);root.worldToLocal(point);correction=Math.min(correction,point.y-foot.sole);}
      if(Number.isFinite(correction))body.position.y-=correction;
    }
    if(next==='idle')body.position.y+=Math.sin(reactionAge*3)*.003;
  };
  update(0,0,'idle',0);
  return {root,update,configure,contact,contactBase,targets,ghost:(scene,color)=>ghosts.capture(scene,color,settings.ghostOpacity,settings.ghostDuration),tickGhosts:(dt)=>ghosts.update(dt),dispose:()=>{
    ghosts.dispose();mixer.stopAllAction();mixer.uncacheRoot(body);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    body.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());gradient.dispose();
  }};
}
