import * as T from 'three';
type Particle={mesh:T.Mesh;age:number;life:number;velocity:T.Vector3;grow:number;spin:number;opacity:number};
/** Small, bounded pool. Shared geometry; expired particles recycle without allocating textures. */
export class CombatEffects{
 private group=new T.Group();private particles:Particle[]=[];private pool:Particle[]=[];
 private shard=new T.PlaneGeometry(1,1);private ring=new T.RingGeometry(.78,1,32);private arc=new T.RingGeometry(.86,1,24,1,.12,Math.PI*1.25);
 constructor(scene:T.Scene){scene.add(this.group);}
 private spawn(geometry:T.BufferGeometry,x:number,y:number,z:number,color:number,size:number,life:number,velocity:T.Vector3,grow=0,spin=0,floor=false){
  if(this.particles.length>=100)return;
  let p=this.pool.pop();if(!p){const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color,transparent:true,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));p={mesh,age:0,life,velocity,grow,spin,opacity:1};this.group.add(mesh);}
  p.mesh.geometry=geometry;p.mesh.visible=true;p.mesh.position.set(x,y,z);p.mesh.scale.set(size,size,size);p.mesh.rotation.set(floor?-Math.PI/2:0,0,Math.random()*6.28);(p.mesh.material as T.MeshBasicMaterial).color.setHex(color);p.age=0;p.life=life;p.velocity.copy(velocity);p.grow=grow;p.spin=spin;this.particles.push(p);return p;
 }
 impact(x:number,y:number,z:number,power:number,color:number){
  if(power<=0)return;this.spawn(this.ring,x,y,z,color,.16*power,.32,new T.Vector3(),4*power,0);
  for(let i=0;i<Math.min(24,Math.ceil(12*power));i++){const a=Math.random()*Math.PI*2,speed=(1+Math.random()*2)*power;const p=this.spawn(this.shard,x,y,z,i%3?color:0xfff4d8,.035+Math.random()*.04,.22+Math.random()*.18,new T.Vector3(Math.cos(a)*speed,Math.sin(a)*speed,.1),0,8);if(p)p.mesh.scale.y*=3;}
  this.spawn(this.ring,x,.035,z,color,.2,.5,new T.Vector3(),4*power,0,true);
 }
 trail(x:number,y:number,z:number,strength:number,color:number,kick=false){if(strength<=0)return;this.spawn(this.arc,x,y,z,color,(kick?.55:.32)*strength,.22,new T.Vector3(0,.12,0),1.2,4);}
 charge(x:number,z:number,strength:number,color:number){if(strength<=0)return;this.spawn(this.ring,x,.04,z,color,.25,.35,new T.Vector3(),2*strength,2,true);for(let i=0;i<3;i++)this.spawn(this.shard,x+(Math.random()-.5)*.5,.3,z+(Math.random()-.5)*.3,color,.035,.45,new T.Vector3(0,2.6,0),.02,5);}
 update(dt:number){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.age+=dt;if(p.age>=p.life){p.mesh.visible=false;this.particles.splice(i,1);this.pool.push(p);continue;}p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.scale.addScalar(p.grow*dt);p.mesh.rotation.z+=p.spin*dt;(p.mesh.material as T.MeshBasicMaterial).opacity=(1-p.age/p.life)*p.opacity;}}
 clear(){for(const p of this.particles){p.mesh.visible=false;this.pool.push(p);}this.particles=[];}
 dispose(){this.group.removeFromParent();for(const p of [...this.particles,...this.pool])(p.mesh.material as T.Material).dispose();this.shard.dispose();this.ring.dispose();this.arc.dispose();}
}
