import * as THREE from 'three';
import type { MoveState } from './rules';

export type FighterVisual = { root: THREE.Group; update: (dt: number, elapsed: number, state: MoveState, phase: number) => void; dispose: () => void };
const mat = (hex: number, roughness = .75) => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: .04 });
const sphere = (parent: THREE.Object3D, material: THREE.Material, pos: [number, number, number], scale: [number,number,number], seg = 18) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * .65))), material);
  o.position.set(...pos); o.scale.set(...scale); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
};
const cylinder = (parent: THREE.Object3D, material: THREE.Material, from: [number,number,number], to: [number,number,number], r1: number, r2: number) => {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,a.distanceTo(b),12,1),material);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
  m.castShadow = true; parent.add(m); return m;
};
const group = (parent: THREE.Object3D, xyz: [number,number,number]) => { const o = new THREE.Group(); o.position.set(...xyz); parent.add(o); return o; };
const lerp = THREE.MathUtils.lerp;
export function createProceduralFighter(variant: 0 | 1): FighterVisual {
  const root = new THREE.Group();
  const skin = mat(variant === 0 ? 0xf2b49c : 0xf5bfa7);
  const shadowSkin = mat(variant === 0 ? 0xd98d81 : 0xe89b91);
  const hair = mat(variant === 0 ? 0x222039 : 0xff75a9, .86);
  const hairLight = mat(variant === 0 ? 0x575071 : 0xffb5d0);
  const top = mat(variant === 0 ? 0x29223d : 0xe7e9ff);
  const accent = mat(variant === 0 ? 0xdb60b1 : 0xa463e8);
  const pants = mat(variant === 0 ? 0x212235 : 0x6863af);
  const shoe = mat(variant === 0 ? 0xb6b0cf : 0xf8f6ff);
  const white = mat(0xfff8f5), iris = mat(variant === 0 ? 0xd174cb : 0x6c7ed7), pupil = mat(0x26203a);
  const hip = group(root,[0, .93, 0]);
  sphere(hip, pants,[0,.015,0],[.235,.20,.14]);
  const torso = group(hip,[0,.17,0]);
  sphere(torso, top,[0,.25,0],[.245,.35,.155]);
  sphere(torso, skin,[0,.52,0],[.102,.085,.09]);
  // Crop jacket / bright piping makes the fighters easy to distinguish on mobile.
  sphere(torso, accent,[0,.15,.145],[.205,.035,.033]);
  const head = group(torso,[0,.70,0]);
  sphere(head, skin,[0,.12,0],[.215,.25,.19],22);
  sphere(head, hair,[0,.32,-.022],[.233,.145,.207],22);
  sphere(head, hair,[0,.1,-.152],[.20,.23,.095],16);
  sphere(head, hair,[.18,.18,-.025],[.055,.21,.16]);
  sphere(head, hair,[-.18,.18,-.025],[.055,.21,.16]);
  sphere(head, hairLight,[0,.29,.105],[.19,.055,.12]);
  // Eyes face character-local +Z, while world heading is handled by root.rotation.
  for (const s of [-1,1]) {
    sphere(head,white,[s*.087,.14,.177],[.067,.072,.018]);
    sphere(head,iris,[s*.087,.14,.195],[.036,.052,.012]);
    sphere(head,pupil,[s*.087,.141,.206],[.018,.039,.009]);
    sphere(head,shadowSkin,[s*.21,.08,0],[.032,.058,.05]);
  }
  sphere(head,mat(0xb85c78),[0,.017,.18],[.048,.013,.012]);
  if (variant === 0) {
    // Cat ears / darker goth silhouette.
    for (const s of [-1,1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.105,.20,4),hair);
      ear.position.set(s*.153,.445,.025); ear.rotation.y=Math.PI/4; ear.rotation.z=-s*.16; head.add(ear);
      const inside = new THREE.Mesh(new THREE.ConeGeometry(.047,.105,4),accent);
      inside.position.set(s*.153,.46,.090); inside.rotation.y=Math.PI/4; head.add(inside);
    }
  } else {
    const pigtailL=group(head,[-.225,.32,-.055]), pigtailR=group(head,[.225,.32,-.055]);
    sphere(pigtailL,hair,[0,-.15,-.01],[.105,.27,.095]);
    sphere(pigtailR,hair,[0,-.15,-.01],[.105,.27,.095]);
    sphere(head,accent,[-.24,.28,0],[.105,.055,.09]);
    sphere(head,accent,[.24,.28,0],[.105,.055,.09]);
  }
  const arms: THREE.Group[] = [], elbows: THREE.Group[] = [], legs: THREE.Group[] = [], knees: THREE.Group[] = [];
  for(const s of [-1,1]) {
    const arm = group(torso,[s*.25,.47,0]); arms.push(arm);
    sphere(arm,skin,[s*.015,-.16,0],[.085,.20,.087]);
    const elbow=group(arm,[0,-.33,0]); elbows.push(elbow);
    cylinder(elbow,skin,[0,-.02,0],[0,-.28,.02],.074,.09);
    sphere(elbow,accent,[0,-.31,.045],[.092,.095,.088]);
    const leg=group(hip,[s*.13,-.115,0]); legs.push(leg);
    sphere(leg,pants,[0,-.23,0],[.12,.31,.122]);
    const knee=group(leg,[0,-.48,0]); knees.push(knee);
    cylinder(knee,skin,[0,-.04,0],[0,-.34,0],.072,.083);
    sphere(knee,shoe,[0,-.40,.075],[.109,.09,.19]);
  }
  const arms0 = arms[0], arms1 = arms[1], elbow0=elbows[0], elbow1=elbows[1];
  const leg0=legs[0],leg1=legs[1];
  let age=0;
  const update = (dt:number, elapsed:number, state:MoveState, phase:number) => {
    age += dt;
    const waving=state === 'walk' ? Math.sin(age*12)*.48 : 0;
    const attackEase = Math.sin(Math.PI * Math.max(0,Math.min(1,phase)));
    const wobble=Math.sin(age*3.8)*.025;
    hip.position.y=.93 + (state==='walk'?Math.abs(Math.sin(age*12))*.045 : wobble);
    torso.rotation.set(state === 'hit' ? -.14 : 0, 0, state === 'hit' ? .2 : 0);
    head.rotation.set(state === 'ko' ? -.28 : 0,Math.sin(age*1.9)*.025,0);
    arms0.rotation.set(-.30-waving,0,-.19);
    arms1.rotation.set(-.30+waving,0,.19);
    elbow0.rotation.set(-1.35,0,0); elbow1.rotation.set(-1.35,0,0);
    leg0.rotation.set(-waving,0,0);leg1.rotation.set(waving,0,0);
    knees[0].rotation.x=.09; knees[1].rotation.x=.09;
    if(state === 'jab' || state === 'cross' || state === 'heavy') {
      const arm= state === 'jab' ? arms0 : arms1;
      const elbow=state === 'jab' ? elbow0 : elbow1;
      arm.rotation.x=lerp(-.3,-1.62,attackEase);
      elbow.rotation.x=lerp(-1.35,-.07,attackEase);
      torso.rotation.y=(state==='heavy'?-.25:-.12)*attackEase;
    }
    if(state === 'kick') {
      leg1.rotation.x=-1.65*attackEase;
      knees[1].rotation.x=.45*attackEase;
      torso.rotation.x=-.18*attackEase;
    }
    if(state === 'hit') { arms0.rotation.x=-.7; arms1.rotation.x=-.7; torso.rotation.x=-.18; }
    if(state === 'ko') { root.rotation.z=lerp(root.rotation.z, -1.12, Math.min(1,dt*7)); }
    else root.rotation.z=lerp(root.rotation.z,0,Math.min(1,dt*8));
    if(state==='win') { arms0.rotation.x=-2.5; arms1.rotation.x=-2.5; elbow0.rotation.x=-.8; elbow1.rotation.x=-.8; }
    if(elapsed<0) hip.position.y=.93;
  };
  const dispose = () => { root.traverse(o => { if(o instanceof THREE.Mesh) {o.geometry.dispose(); const m=o.material; if(Array.isArray(m))m.forEach(v=>v.dispose()); else m.dispose(); } }); };
  return { root, update, dispose };
}
