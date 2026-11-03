/** Canonical names shared by the offline animation baker and asset checks. */
export function semantic(name){
 const n=name.toLowerCase();
 if(/^armtwist\.[lr]\.001/.test(n))return n.includes('.l.')?'lowerarm_l':'lowerarm_r';
 if(/collider|twist|ctrl|helper|_ik_|j_sec|j_opt|j_adj|eye|bust|boob|booty/.test(n))return null;
 const s=/left|j_bip_l_|\.l(?:_|\.)/.test(n)?'l':/right|j_bip_r_|\.r(?:_|\.)/.test(n)?'r':null;
 if(s){
  const digit=n.match(/(index|middle|ring|pinky|little|thumb)(?:([123])|\.[lr]\.00([123]))/);
  if(digit)return `${digit[1]==='little'?'pinky':digit[1]}_0${digit[2]||digit[3]}_${s}`;
  if(/toe/.test(n))return `ball_${s}`;
  if(/foot/.test(n))return `foot_${s}`;
  if(/calf|lowerleg|(?:left|right)leg/.test(n))return `calf_${s}`;
  if(/thigh|upperleg|upleg/.test(n))return `thigh_${s}`;
  if(/hand/.test(n))return `hand_${s}`;
  if(/lowerarm|forearm/.test(n))return `lowerarm_${s}`;
  if(/upperarm|(?:left|right)arm|^arm\./.test(n))return `upperarm_${s}`;
  if(/shoulder|clavic/.test(n))return `clavicle_${s}`;
  return null;
 }
 if(/hips/.test(n))return 'pelvis';
 if(/upperchest|spine2/.test(n))return 'spine_03';
 if(/chest|spine1/.test(n))return 'spine_02';
 if(/spine/.test(n))return 'spine_01';
 if(/neck/.test(n))return 'neck_01';
 if(/head/.test(n))return 'Head';
 return null;
}

/** Some FBX exports carry a posed hierarchy that disagrees with their skin bind matrices.
 * Restore in world space, including non-bone export wrappers (Skeleton.pose ignores these).
 */
export function restoreBindPose(bones,inverses){
 const desired=new Map(bones.map((bone,i)=>[bone,inverses[i].clone().invert()]));
 const ordered=[...bones].sort((a,b)=>{const depth=o=>{let n=0;while(o.parent){n++;o=o.parent;}return n;};return depth(a)-depth(b);});
 for(const bone of ordered){
  bone.parent?.updateWorldMatrix(true,false);
  bone.matrix.copy(desired.get(bone));
  if(bone.parent)bone.matrix.premultiply(bone.parent.matrixWorld.clone().invert());
  bone.matrix.decompose(bone.position,bone.quaternion,bone.scale);bone.updateWorldMatrix(false,false);
 }
}
