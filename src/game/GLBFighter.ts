import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MoveState } from './rules';
import type { FighterVisual } from './ProceduralFighter';

// Sketchfab models must be downloaded by their licensee through Sketchfab's official flow.
// Files can be placed at public/models/cat-girl.glb and public/models/cute-anime-girl.glb.
const MATCH: Record<string, RegExp> = {
  leftUpperArm: /(?:left|_l|\.l).*(?:upperarm|upper_arm|arm)|(?:upperarm|upper_arm|arm).*(?:left|_l|\.l)/i,
  rightUpperArm: /(?:right|_r|\.r).*(?:upperarm|upper_arm|arm)|(?:upperarm|upper_arm|arm).*(?:right|_r|\.r)/i,
  leftForearm: /(?:left|_l|\.l).*(?:forearm|lowerarm|lower_arm)|(?:forearm|lowerarm|lower_arm).*(?:left|_l|\.l)/i,
  rightForearm: /(?:right|_r|\.r).*(?:forearm|lowerarm|lower_arm)|(?:forearm|lowerarm|lower_arm).*(?:right|_r|\.r)/i,
  leftThigh: /(?:left|_l|\.l).*(?:upleg|upperleg|thigh)|(?:upleg|upperleg|thigh).*(?:left|_l|\.l)/i,
  rightThigh: /(?:right|_r|\.r).*(?:upleg|upperleg|thigh)|(?:upleg|upperleg|thigh).*(?:right|_r|\.r)/i,
};

/** Load exported/retargeted GLB characters. No claim that arbitrary skeletons accept raw animation clips. */
export async function loadGLBFighter(filename: string): Promise<FighterVisual> {
  const data = await new GLTFLoader().loadAsync(`./models/${filename}`);
  const root = new THREE.Group();
  const body = data.scene;
  root.add(body);
  body.updateWorldMatrix(true,true);
  const bounds = new THREE.Box3().setFromObject(body);
  if (bounds.isEmpty()) throw new Error('Character has no geometry');
  const center = bounds.getCenter(new THREE.Vector3());
  const height = bounds.getSize(new THREE.Vector3()).y;
  if (!(height > 0)) throw new Error('Model height invalid');
  body.scale.setScalar(1.95/height);
  body.position.set(-center.x*1.95/height, -bounds.min.y*1.95/height, -center.z*1.95/height);
  body.traverse(o=>{ if(o instanceof THREE.Mesh) { o.castShadow=true; o.receiveShadow=true; } });
  const mixer = data.animations.length ? new THREE.AnimationMixer(body) : null;
  const actions: Partial<Record<MoveState, THREE.AnimationAction>> = {};
  for(const clip of data.animations) {
    const n = clip.name.toLowerCase();
    let state: MoveState | undefined;
    if(/idle|stance|breathe/.test(n))state='idle';
    else if(/walk|run|jog/.test(n))state='walk';
    else if(/jab|punch.?1/.test(n))state='jab';
    else if(/cross|punch.?2/.test(n))state='cross';
    else if(/heavy|uppercut|hook/.test(n))state='heavy';
    else if(/kick/.test(n))state='kick';
    else if(/hurt|hit|reaction/.test(n))state='hit';
    else if(/death|knock|die/.test(n))state='ko';
    if(state && mixer && !actions[state]) actions[state]=mixer.clipAction(clip);
  }
  const rig: Record<string,{bone:THREE.Bone; neutral:THREE.Euler}> = {};
  body.traverse(o=>{
    if(!(o instanceof THREE.Bone))return;
    for(const [key,pattern] of Object.entries(MATCH)) {
      if(rig[key])continue;
      if(pattern.test(o.name))rig[key]={bone:o,neutral:o.rotation.clone()};
    }
  });
  let active: MoveState | null = null, clock=0;
  const update=(dt:number,_elapsed:number,state:MoveState,phase:number)=>{
    clock+=dt;
    if(mixer && active!==state) {
      actions[active ?? 'idle']?.fadeOut(.1);
      const next=actions[state] ?? actions.idle;
      next?.reset().fadeIn(.1).play();
      active=state;
    }
    mixer?.update(dt);
    if(!actions[state]) {
      for(const slot of Object.values(rig))slot.bone.rotation.copy(slot.neutral);
      const wave=state==='walk'? Math.sin(clock*11)*.35 : 0;
      const impact=Math.sin(Math.PI*Math.max(0,Math.min(1,phase)));
      const apply=(key:string, amount:number)=>{if(rig[key])rig[key].bone.rotation.x=rig[key].neutral.x+amount;};
      apply('leftUpperArm', -.5-wave);
      apply('rightUpperArm', -.5+wave);
      apply('leftThigh', -wave);
      apply('rightThigh', wave);
      if(state==='jab'){ apply('leftUpperArm',-1.5*impact);apply('leftForearm',-.7*impact); }
      if(state==='cross'||state==='heavy'){ apply('rightUpperArm',-1.7*impact);apply('rightForearm',-.7*impact); }
      if(state==='kick'){ apply('rightThigh',-1.8*impact); }
      if(state==='hit'){apply('rightUpperArm',-.9);apply('leftUpperArm',-.9);}
    }
    root.rotation.z=THREE.MathUtils.damp(root.rotation.z, state==='ko'?-1.12:0,8,dt);
    root.position.y=state==='ko' ? -0.3 : state==='walk'?Math.abs(Math.sin(clock*11))*.025:0;
  };
  return { root, update, dispose:()=>{
    mixer?.stopAllAction();
    body.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry?.dispose();const m=o.material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m?.dispose();}});
  }};
}
