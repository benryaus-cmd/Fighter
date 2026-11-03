import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MoveState } from './rules';
import type { FighterVisual } from './ProceduralFighter';

/** Bone names in the supplied VR Avatars, Mixamo, and Blender GLB exports. */
type Limb = 'leftArm'|'rightArm'|'leftForearm'|'rightForearm'|'leftThigh'|'rightThigh'|'leftCalf'|'rightCalf'|'spine';
type Joint = { bone: THREE.Bone; rest: THREE.Quaternion; child: THREE.Bone };
function classifyBone(name: string): Limb | null {
  const n = name.toLowerCase();
  if (/collider|_ik_|ctrl_|helper|twist|end_|hair|finger|thumb/.test(n)) return null;
  const left = /(?:left|j_bip_l_|\.l(?:_|$|\.)|_l_)/.test(n);
  const right = /(?:right|j_bip_r_|\.r(?:_|$|\.)|_r_)/.test(n);
  if (/spine|chest/.test(n) && !left && !right) return 'spine';
  if (!left && !right) return null;
  const side = left ? 'left' : 'right';
  if (/lowerarm|forearm|calf|lowerleg/.test(n)) return /calf|lowerleg/.test(n) ? `${side}Calf` as Limb : `${side}Forearm` as Limb;
  if (/upperarm|(?:^|[:_])(?:left|right)arm|^arm\./.test(n)) return `${side}Arm` as Limb;
  if (/upperleg|upleg|thigh/.test(n)) return `${side}Thigh` as Limb;
  if (/^forearm\./.test(n)) return `${side}Forearm` as Limb;
  return null;
}
/** Attach neutral-direction targets to any skinned humanoid with arm/leg bones. */
export async function loadGLBFighter(filename: string): Promise<FighterVisual> {
  const gltf = await new GLTFLoader().loadAsync(`./models/${filename}`);
  const root = new THREE.Group(), body = gltf.scene;
  root.add(body);
  body.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(body);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y < .01) throw new Error(`Invalid fighter ${filename}`);
  const center = bounds.getCenter(new THREE.Vector3()), scale = 1.95 / size.y;
  body.scale.setScalar(scale);
  body.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  const joints: Partial<Record<Limb, Joint>> = {};
  body.traverse(o => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
    if (!(o instanceof THREE.Bone)) return;
    const key = classifyBone(o.name);
    const child = o.children.find(c => c instanceof THREE.Bone) as THREE.Bone | undefined;
    if (key && child && !joints[key]) joints[key] = { bone:o, rest:o.quaternion.clone(), child };
  });
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(body) : null;
  const clips: Partial<Record<MoveState, THREE.AnimationAction>> = {};
  for (const clip of gltf.animations) {
    const name = clip.name.toLowerCase();
    const id: MoveState | null = /idle|stance/.test(name) ? 'idle' : /walk|run/.test(name) ? 'walk'
      : /jab/.test(name) ? 'jab' : /cross/.test(name) ? 'cross' : /uppercut|hook|heavy/.test(name) ? 'heavy'
      : /kick/.test(name) ? 'kick' : /hurt|hit/.test(name) ? 'hit' : /death|knock|die/.test(name) ? 'ko' : null;
    if (id && mixer && !clips[id]) clips[id] = mixer.clipAction(clip);
  }
  const qBody = new THREE.Quaternion(), qParent = new THREE.Quaternion(), delta = new THREE.Quaternion();
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const pose = (slot: Limb, x: number, y: number, z: number, weight = 1) => {
    const j = joints[slot]; if (!j) return;
    const parent = j.bone.parent; if (!parent) return;
    // Local-to-parent mapping means this works on Mixamo, VRM-ish and Blender rigs.
    body.updateWorldMatrix(true, true);
    body.getWorldQuaternion(qBody);
    parent.getWorldQuaternion(qParent);
    from.copy(j.child.position).applyQuaternion(j.rest).normalize();
    to.set(x,y,z).normalize().applyQuaternion(qBody).applyQuaternion(qParent.invert()).normalize();
    if (from.lengthSq() < 0.01 || to.lengthSq() < 0.01) return;
    delta.setFromUnitVectors(from,to);
    delta.multiply(j.rest);
    j.bone.quaternion.copy(j.rest).slerp(delta, weight);
  };
  let active: MoveState | null = null, age = 0;
  const update = (dt: number, _elapsed: number, state: MoveState, phase: number) => {
    age += dt;
    if (mixer && active !== state) {
      if (active) clips[active]?.fadeOut(.09);
      (clips[state] ?? clips.idle)?.reset().fadeIn(.09).play();
      active = state;
    }
    mixer?.update(dt);
    if (!clips[state]) {
      // Restore bind poses before computing the target pose (no accumulating rotations).
      Object.values(joints).forEach(j => j.bone.quaternion.copy(j.rest));
      const wave = state === 'walk' ? Math.sin(age*10)*.34 : 0;
      const strike = Math.sin(Math.PI*Math.max(0,Math.min(1,phase)));
      pose('leftArm',-.46,-.45,.85);
      pose('rightArm',.46,-.45,.85);
      pose('leftForearm',.12,.65,.8);
      pose('rightForearm',-.12,.65,.8);
      pose('leftThigh',0,-1,wave);
      pose('rightThigh',0,-1,-wave);
      if (state === 'jab') {
        pose('leftArm', -.18, -.18, 1.2, strike);
        pose('leftForearm',0,.05,1, strike);
      } else if (state === 'cross' || state === 'heavy') {
        pose('rightArm', .18,-.11, 1.3, strike);
        pose('rightForearm',0,.05,1,strike);
        pose('leftArm',-.25,-.1,1);
      } else if (state === 'kick') {
        pose('rightThigh',0,.16,1,strike);
        pose('rightCalf',0,-.12,1,strike);
      } else if (state === 'hit') {
        pose('leftArm',-.4,.65,.35);pose('rightArm',.4,.65,.35);
      } else if (state === 'win') {
        pose('leftArm',-.4,1,.1);pose('rightArm',.4,1,.1);
      }
    }
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z,state==='ko'?-1.2:0,8,dt);
    root.position.y = state==='ko' ? -.35 : state==='walk' ? Math.abs(Math.sin(age*10))*.025 : 0;
  };
  return { root, update, dispose: () => {
    mixer?.stopAllAction();
    body.traverse(o => { if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m=o.material;if (Array.isArray(m)) m.forEach(v=>v.dispose());else m?.dispose();
    }});
  }};
}