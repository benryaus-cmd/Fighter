import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MoveState } from './rules.ts';
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
  const meshes:THREE.Mesh[]=[];
  body.traverse(o=>{
    const id=semantic.get(o.name);
    if(id){mapped.push(o);if(/^(foot|ball)_/.test(id))feet.push({bone:o,sole:o.getWorldPosition(new THREE.Vector3()).y});}
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
      s.dispose();return toon;
    });
    mesh.material=Array.isArray(mesh.material)?materials:materials[0];

  }
  let settings:Settings={...DEFAULT_SETTINGS};
  const configure=(value:Settings)=>{settings=value;const data=gradient.image.data as Uint8Array;for(let i=0;i<256;i++){const band=i<85?65:i<170?150:255;data[i]=Math.round(i*(1-settings.toonStrength)+band*settings.toonStrength);}gradient.needsUpdate=true;};
  configure(settings);
  const mixer=new THREE.AnimationMixer(body);
  const actions=new Map<MoveState,THREE.AnimationAction>();
  const burst=motion.animations.find(c=>c.name==='cross')!.clone();burst.name='special';
  for(const clip of [...motion.animations,burst]){
    const action=mixer.clipAction(clip);const state=clip.name as MoveState;
    action.setLoop(state==='idle'||state==='walk'?THREE.LoopRepeat:THREE.LoopOnce,Infinity);
    action.clampWhenFinished=true;actions.set(state,action);
  }
  let active:MoveState|null=null;let oldPhase=0;let reactionAge=0;
  const point=new THREE.Vector3();
  const update=(dt:number,_elapsed:number,state:MoveState,phase:number)=>{
    const next=state==='win'?'idle':state;
    const repeated=next===active&&phase<oldPhase&&next in ATTACKS;
    if(active!==next||repeated){
      const previous=active?actions.get(active):undefined;
      const action=actions.get(next)??actions.get('idle')!;
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if(next in ATTACKS)action.paused=true;
      if(previous&&previous!==action){previous.fadeOut(next==='hit'?.055:settings.transitionTime);action.fadeIn(next==='hit'?.055:settings.transitionTime);}
      active=next;reactionAge=0;
    }
    if(next in ATTACKS){const id=next as keyof typeof ATTACKS,spec=attackSpec(id,settings),action=actions.get(next)!;action.time=attackClipProgress(id,spec,phase*totalDuration(spec))*action.getClip().duration;}
    oldPhase=phase;reactionAge+=dt;
    // A short hit reaction is held until stun releases; KO clamps on its last pose.
    mixer.update(dt);body.position.y=baseY;root.updateWorldMatrix(true,true);
    let correction=Infinity;
    if(next==='ko'){
      for(const bone of mapped){bone.getWorldPosition(point);correction=Math.min(correction,point.y-.06);}
      if(correction<0)body.position.y-=correction;
    }else{
      for(const foot of feet){foot.bone.getWorldPosition(point);correction=Math.min(correction,point.y-foot.sole);}
      if(Number.isFinite(correction))body.position.y-=correction;
    }
    if(next==='idle')body.position.y+=Math.sin(reactionAge*3)*.003;
  };
  update(0,0,'idle',0);
  return {root,update,configure,dispose:()=>{
    mixer.stopAllAction();mixer.uncacheRoot(body);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    body.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());gradient.dispose();
  }};
}
