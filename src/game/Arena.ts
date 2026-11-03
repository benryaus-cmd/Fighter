import * as T from 'three';
/** Original stylised floating shrine, inspired by anime tournament skies. */
export class Arena{
 readonly root=new T.Group();private sky:T.Mesh;private motes:T.Points;
 constructor(scene:T.Scene){scene.add(this.root);
  const mat=(color:number)=>new T.MeshStandardMaterial({color,roughness:1,flatShading:true});
  const add=(geo:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);this.root.add(o);return o;};
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{zenith:{value:new T.Color('#292854')},horizon:{value:new T.Color('#e39abc')}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform vec3 zenith;uniform vec3 horizon;void main(){float h=smoothstep(-.08,.40,normalize(p).y);gl_FragColor=vec4(mix(horizon,zenith,h),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  this.sky=add(new T.SphereGeometry(45,24,16),skyMat,0,0,0);this.sky.renderOrder=-10;
  const platform=add(new T.CylinderGeometry(4.3,3.9,.4,8),mat(0x58556f),0,-.21,0);platform.receiveShadow=true;
  add(new T.CylinderGeometry(3.9,2.2,1.8,7),mat(0x282941),0,-1.3,0);
  const floor=add(new T.CircleGeometry(4.28,64),mat(0x625d78),0,.003,0);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
  for(const [r,c]of [[3.85,0xe5b6ff],[3.6,0x8bdfff],[1.7,0xb7a5d5]]){const ring=add(new T.RingGeometry(r-.015,r+.015,64),new T.MeshBasicMaterial({color:c,transparent:true,opacity:.65,side:T.DoubleSide}),0,.012,0);ring.rotation.x=-Math.PI/2;}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const rune=add(new T.PlaneGeometry(.08,.25),new T.MeshBasicMaterial({color:0xffd9f7,side:T.DoubleSide}),Math.sin(a)*3.72,.019,Math.cos(a)*3.72);rune.rotation.set(-Math.PI/2,0,-a);}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const line=add(new T.BoxGeometry(.009,.008,3.8),mat(0x39364f),Math.sin(a)*1.9,.016,Math.cos(a)*1.9);line.rotation.y=a;}
  // Silhouettes, floating islands and a temple gate stay behind the fighters.
  for(let i=0;i<7;i++){const x=(i-3)*4;const rock=add(new T.IcosahedronGeometry(1,0),mat(i%2?0x665578:0x3d3d61),x,-.5+(i%3)*.4,-9-(i%2)*3);rock.scale.set(2.5,.7,1.5);const top=add(new T.CylinderGeometry(1.5,2,.22,6),mat(0x796b8e),x,.05+(i%3)*.4,-9-(i%2)*3);top.scale.z=.6;}
  const post=mat(0x622d59),gold=new T.MeshBasicMaterial({color:0xffbdad});
  for(const x of [-2.7,2.7]){add(new T.BoxGeometry(.25,4,.3),post,x,1.8,-5.6);add(new T.BoxGeometry(.3,.1,.35),gold,x,3.2,-5.6);}
  add(new T.BoxGeometry(6.8,.22,.48),post,0,3.6,-5.6);add(new T.BoxGeometry(6,.13,.36),gold,0,3.78,-5.6);add(new T.BoxGeometry(5.6,.18,.3),post,0,2.9,-5.6);
  const moon=add(new T.CircleGeometry(1.65,48),new T.MeshBasicMaterial({color:0xffe4bf,fog:false}),4.7,6,-16);moon.rotation.y=-.12;
  const positions=new Float32Array(72*3);for(let i=0;i<positions.length;i+=3){positions[i]=(Math.random()-.5)*12;positions[i+1]=Math.random()*6;positions[i+2]=-1-Math.random()*8;}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));this.motes=new T.Points(geo,new T.PointsMaterial({color:0xffd4f2,size:.035,transparent:true,opacity:.7,depthWrite:false}));this.root.add(this.motes);
 }
 setLighting(theme:string){const m=this.sky.material as T.ShaderMaterial;const colors=theme==='moonlight'?['#080e33','#584c87']:theme==='studio'?['#142038','#628fa6']:['#292854','#e39abc'];m.uniforms.zenith.value.set(colors[0]);m.uniforms.horizon.value.set(colors[1]);}
 update(time:number){this.motes.rotation.y=time*.015;this.motes.position.y=Math.sin(time*.3)*.12;}
 dispose(){const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());this.root.removeFromParent();}
}
