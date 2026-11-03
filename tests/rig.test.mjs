import test from 'node:test';
import assert from 'node:assert/strict';
import { semantic } from '../scripts/rig-map.mjs';
test('recognises the actual Mixamo knees and Blender forearms and calves',()=>{
  for(const [name,limb] of Object.entries({
    'mixamorig:LeftLeg_0201':'calf_l', 'mixamorig:RightLeg_0219':'calf_r',
    'Forearm.L_08':'lowerarm_l','Calf.R_085':'calf_r',
    'Arm.L_05':'upperarm_l','J_Bip_L_UpperArm_077':'upperarm_l',
  })) assert.equal(semantic(name),limb,name);
});
test('ignores collider and twist helper joints',()=>{
  for(const name of ['J_Bip_L_UpperArm_collider_0_08','ArmTwist.L.002_07','Ctrl_Leg_FK_Left_0229'])
    assert.equal(semantic(name),null,name);
});

test('base model elbow is its first ArmTwist bone',()=>{assert.equal(semantic('ArmTwist.L.001_06'),'lowerarm_l');});
test('bind restoration respects scaled non-bone FBX wrappers',async()=>{
 const T=await import('three');const {restoreBindPose}=await import('../scripts/rig-map.mjs');
 const wrapper=new T.Group();wrapper.scale.setScalar(100);wrapper.rotation.x=-Math.PI/2;
 const hip=new T.Bone(),head=new T.Bone();wrapper.add(hip);hip.add(head);hip.position.set(5,8,2);head.position.set(1,2,0);wrapper.updateMatrixWorld(true);
 const h=new T.Matrix4().makeTranslation(0,1,0),n=new T.Matrix4().makeTranslation(0,1.8,0);
 restoreBindPose([hip,head],[h.clone().invert(),n.clone().invert()]);wrapper.updateMatrixWorld(true);
 assert.ok(hip.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(0,1,0))<1e-6);
 assert.ok(head.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(0,1.8,0))<1e-6);
});
