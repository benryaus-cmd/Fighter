import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
/** Two cached skeletal snapshots per fighter; geometry and textures stay shared. */
export class GhostTrail{
 private snapshots:{root:T.Object3D;pairs:[T.Object3D,T.Object3D][];material:T.MeshBasicMaterial;age:number;life:number;alpha:number}[]=[];
 private previous=new T.Vector3(Infinity,0,0);
 private clock=0;private last=-1;private index=0;
 constructor(private source:T.Group){
  const originals:T.Object3D[]=[];source.traverse(o=>originals.push(o));
  for(let i=0;i<2;i++){
   const root=clone(source),copies:T.Object3D[]=[];root.traverse(o=>copies.push(o));
   const material=new T.MeshBasicMaterial({color:0xff8cde,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});material.userData.outlineParameters={visible:false};
   root.traverse(o=>{if(o instanceof T.Mesh){o.material=material;o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;}});root.visible=false;
   this.snapshots.push({root,pairs:originals.map((o,n)=>[o,copies[n]]),material,age:10,life:.3,alpha:.2});
  }
 }
 capture(scene:T.Scene,color:number,alpha:number,life:number){
  if(alpha<=0||this.clock-this.last<.085||this.previous.distanceTo(this.source.position)<.035)return;this.last=this.clock;this.previous.copy(this.source.position);
  const g=this.snapshots[this.index++%this.snapshots.length];
  for(const [live,copy]of g.pairs){copy.position.copy(live.position);copy.quaternion.copy(live.quaternion);copy.scale.copy(live.scale);}
  g.root.renderOrder=-1;g.root.position.copy(this.source.position);g.root.quaternion.copy(this.source.quaternion);g.root.scale.copy(this.source.scale);
  g.material.color.setHex(color);g.alpha=alpha;g.material.opacity=alpha;g.age=0;g.life=life;g.root.visible=true;scene.add(g.root);g.root.updateWorldMatrix(true,true);
 }
 update(dt:number){this.clock+=dt;for(const g of this.snapshots){g.age+=dt;g.root.visible=g.age<g.life;g.material.opacity=Math.max(0,1-g.age/g.life)*g.alpha;}}
 dispose(){for(const g of this.snapshots){g.root.removeFromParent();g.material.dispose();}}
}
