import * as THREE from 'three';
import { ATTACKS, activeAt, canReach, clamp, totalDuration } from './rules';
import type { ActiveAttack, AttackId, MoveState } from './rules';
import { createProceduralFighter } from './ProceduralFighter';
import type { FighterVisual } from './ProceduralFighter';
import { loadGLBFighter } from './GLBFighter';
import { chooseFighters } from './roster';
import type { RosterFighter } from './roster';

export type GameView = {
  player: number; enemy: number; timer: number; over: boolean;
  winner: 'player' | 'enemy' | 'draw' | null; status: string; ready:boolean; failed:boolean; loaded: [boolean,boolean]; names: [string,string];
};
type Fighter = { x:number;z:number; health:number; stun:number; attack:ActiveAttack|null; move:boolean; visual:FighterVisual; state:MoveState };
type Flash = { sprite:THREE.Mesh; ttl:number;max:number };
const THREE_COLOR = [0xdd62ad,0x8d6be0];
export class FightGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  private renderer: THREE.WebGLRenderer;
  private fighters: [Fighter,Fighter];
  private ground: THREE.Mesh;
  private scenery: THREE.Object3D[]=[];
  private flashes:Flash[]=[];
  private frame=0; private last=0; private t=0; private time=90; private over=false;
  private winner:GameView['winner']=null;
  private horizontal=0; private vertical=0; private keys=new Set<string>();
  private aiNext=1; private shake=0;
  private loaded:[boolean,boolean]=[false,false];
  private selected:readonly [RosterFighter,RosterFighter]=chooseFighters();
  private modelGeneration=0;
  private alive=true;
  private audio: AudioContext | null=null;
  private resizeObserver:ResizeObserver;
  private status='LOADING FIGHTERS';
  private loadError=false;
  private queued:{id:AttackId;until:number}|null=null;
  private hitstop=0;
  private cameraDistance=7;
  constructor(private host:HTMLElement,private onView:(view:GameView)=>void){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.05;
    this.renderer.domElement.setAttribute('aria-label','3D fighting arena');
    this.renderer.domElement.className='webgl-canvas';
    host.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#12152b');
    this.scene.fog=new THREE.FogExp2('#16152e',.032);
    this.camera.position.set(0,2.65,7);
    this.camera.lookAt(0,1.05,0);
    this.scene.add(new THREE.HemisphereLight(0xe2e8ff,0x30223a,.85));
    const key=new THREE.DirectionalLight(0xffedd9,2.4);
    key.position.set(-4,8,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;
    this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x9baeff,.7);rim.position.set(4,5,-4);this.scene.add(rim);
    const floorMaterial=new THREE.MeshStandardMaterial({color:0x28243f,roughness:.76,metalness:.18});
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(28,22),floorMaterial);
    this.ground.rotation.x=-Math.PI/2;this.ground.receiveShadow=true;this.scene.add(this.ground);
    const circle=new THREE.Mesh(new THREE.CircleGeometry(3.95,70),new THREE.MeshBasicMaterial({color:0x752d91,transparent:true,opacity:.18,depthWrite:false}));
    circle.rotation.x=-Math.PI/2;circle.position.y=.006;this.scene.add(circle);this.scenery.push(circle);
    const ring=new THREE.Mesh(new THREE.RingGeometry(3.83,3.88,80),new THREE.MeshBasicMaterial({color:0xd9a4fa,side:THREE.DoubleSide,transparent:true,opacity:.65}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.025;this.scene.add(ring);this.scenery.push(ring);
    for(let i=-6;i<=6;i++) {
      const line=new THREE.Mesh(new THREE.BoxGeometry(.016,.014,9),new THREE.MeshBasicMaterial({color:0x6e668e}));
      line.position.set(i*.85,.018,0);this.scene.add(line);this.scenery.push(line);
    }
    for(let i=0;i<8;i++){
      const wall=new THREE.Mesh(new THREE.BoxGeometry(1,.7,.7),new THREE.MeshStandardMaterial({color:i%2?0x492b78:0x34275d,emissive:i%2?0x361c4c:0x14122c,emissiveIntensity:.6}));
      wall.position.set(-6.3+i*1.8,.3,-5);this.scene.add(wall);this.scenery.push(wall);
    }
    const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(28,11),new THREE.MeshBasicMaterial({color:0x241936}));
    backdrop.position.set(0,4,-5.7);this.scene.add(backdrop);this.scenery.push(backdrop);
    // A few glowing truss bars read well on mobile without large textures.
    for(let i=-3;i<=3;i++){
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,6.3,8),new THREE.MeshBasicMaterial({color:i%2?0xe976df:0x6c85f3}));
      beam.position.set(i*1.95,2.8,-5.2);beam.rotation.z=Math.PI/2;this.scene.add(beam);this.scenery.push(beam);
    }
    const a=createProceduralFighter(0),b=createProceduralFighter(1);
    this.fighters=[this.makeFighter(-.9,0,a),this.makeFighter(.9,0,b)];
    a.root.visible=false;b.root.visible=false;this.scene.add(a.root,b.root);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    window.addEventListener('keydown',this.keydown);
    window.addEventListener('keyup',this.keyup);
    window.addEventListener('blur',this.blur);
    document.addEventListener('visibilitychange',this.visibility);
    this.last=performance.now();this.frame=requestAnimationFrame(this.loop);
    this.loadSelectedModels();
    this.publish();
  }
  private loadSelectedModels(){
    const generation=++this.modelGeneration;
    this.loaded=[false,false];this.loadError=false;this.status='LOADING FIGHTERS';
    this.fighters.forEach(f=>{f.visual.root.visible=false;});
    void this.tryModel(0,this.selected[0].file,generation);
    void this.tryModel(1,this.selected[1].file,generation);
  }
  private makeFighter(x:number,z:number,visual:FighterVisual):Fighter { return {x,z,health:100,stun:0,attack:null,move:false,visual,state:'idle'}; }
  private async tryModel(index:0|1,filename:string,generation:number){
    try {
      // Avoid sending a Sketchfab download request: only local, user-licensed GLBs are loaded.
      const response=await fetch(`./models/${filename}`,{method:'HEAD'});
      if(!response.ok)throw Error('Model missing');
      const visual=await loadGLBFighter(filename);
      if(!this.alive || generation !== this.modelGeneration){visual.dispose();return;}
      const fighter=this.fighters[index];
      this.scene.remove(fighter.visual.root);fighter.visual.dispose();
      fighter.visual=visual;visual.root.position.set(fighter.x,0,fighter.z);const other=this.fighters[1-index];visual.root.rotation.y=Math.atan2(other.x-fighter.x,other.z-fighter.z);this.scene.add(visual.root);this.loaded[index]=true;
      if(this.loaded.every(Boolean)){this.fighters.forEach(f=>{f.visual.root.visible=true;});this.status='FIGHT!';this.aiNext=1.2;this.last=performance.now();}
      this.publish();
    }catch(error) {if(this.alive&&generation===this.modelGeneration){this.loadError=true;this.status='FIGHTER LOAD FAILED';console.error(error);this.publish();}}
  }
  private resize(){
    const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;
    this.camera.fov=40;
    this.camera.updateProjectionMatrix();
    this.cameraDistance=this.fittedCameraDistance();
    this.camera.position.z=this.cameraDistance;
  }
  private fittedCameraDistance(){
    const aspect=this.camera.aspect;
    // Fit the active duel, rather than the entire empty arena.
    const separation=Math.abs(this.fighters[0].x-this.fighters[1].x);
    const halfWidth=Math.max(1.12,separation*.5+.58);
    const horizontal=halfWidth/(Math.tan(THREE.MathUtils.degToRad(20))*aspect);
    return Math.max(aspect<1?5.6:4.7,horizontal);
  }
  private keydown=(e:KeyboardEvent)=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
    this.keys.add(e.key.toLowerCase());
    const keymap:Record<string,AttackId>={j:'jab',k:'cross',l:'kick',i:'heavy'};
    if(keymap[e.key.toLowerCase()]&&!e.repeat)this.attack(keymap[e.key.toLowerCase()]);
    if(e.key.toLowerCase()==='r'&&this.over)this.restart();
  };
  private keyup=(e:KeyboardEvent)=>{this.keys.delete(e.key.toLowerCase());};
  private blur=()=>{this.keys.clear();this.horizontal=0;this.vertical=0;this.queued=null;};
  private visibility=()=>{this.blur();this.last=performance.now();};
  setStick(x:number,y:number){this.horizontal=x;this.vertical=y;}
  private playTone(frequency:number){
    try {
      const Ctor=window.AudioContext;
      if(!Ctor)return;
      if(!this.audio)this.audio=new Ctor();
      if(this.audio.state==='suspended')void this.audio.resume();
      const osc=this.audio.createOscillator(),gain=this.audio.createGain();
      osc.type='triangle';osc.frequency.setValueAtTime(frequency,this.audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(50,frequency*.35),this.audio.currentTime+.13);
      gain.gain.setValueAtTime(.055,this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+.14);
      osc.connect(gain);gain.connect(this.audio.destination);osc.start();osc.stop(this.audio.currentTime+.15);
    }catch { /* Sound optional on muted/mobile browsers */ }
  }
  attack(id:AttackId){
    if(this.over||!this.loaded.every(Boolean))return;
    const p=this.fighters[0];
    if(p.attack||p.stun>0){this.queued={id,until:this.t+.22};return;}
    p.attack={id,elapsed:0,hit:false};this.playTone(ATTACKS[id].sfx);
  }
  private startAI(id:AttackId){
    const p=this.fighters[1];if(p.stun>0||p.attack||this.over)return;
    p.attack={id,elapsed:0,hit:false};
  }
  private hit(source:0|1,target:0|1,attack:ActiveAttack){
    const a=this.fighters[source],b=this.fighters[target],spec=ATTACKS[attack.id];
    if(!canReach(a.x,a.z,b.x,b.z,spec.reach))return;
    const yaw=a.visual.root.rotation.y;
    const facing=(b.x-a.x)*Math.sin(yaw)+(b.z-a.z)*Math.cos(yaw)>0;
    if(!facing)return;
    attack.hit=true;
    b.health=Math.max(0,b.health-spec.damage);
    b.stun= .18+(attack.id==='heavy'?.23:.03);
    b.attack=null;
    const direction=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
    b.x=clamp(b.x+direction.x*spec.knockback,-2.8,2.8);b.z=clamp(b.z+direction.y*spec.knockback,-.85,.85);
    this.shake=attack.id==='heavy'?.12:.055;this.hitstop=attack.id==='heavy'?.07:.035;
    this.status=attack.id==='heavy'?'POWER KICK':attack.id==='kick'?'FRONT KICK':attack.id.toUpperCase();
    this.playTone(110);
    try{navigator.vibrate?.(attack.id==='heavy'?40:15);}catch{/* optional */}
    this.flash(b.x-direction.x*.2,1.35,b.z-direction.y*.2,source);
    if(b.health<=0)this.finish(source===0?'player':'enemy');
    this.publish();
  }
  private flash(x:number,y:number,z:number,index:number){
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,0),new THREE.MeshBasicMaterial({color:THREE_COLOR[index],transparent:true,opacity:.9,depthWrite:false}));
    mesh.position.set(x,y,z);this.scene.add(mesh);this.flashes.push({sprite:mesh,ttl:.32,max:.32});
  }
  private finish(winner:GameView['winner']){this.over=true;this.winner=winner;this.status=winner==='player'?'YOU WIN!':winner==='enemy'?'K.O.':'DRAW!';this.publish();}
  restart(){
    this.selected=chooseFighters();
    this.loadSelectedModels();
    this.time=90;this.over=false;this.winner=null;this.t=0;this.aiNext=1.2;this.queued=null;this.hitstop=0;this.blur();
    this.fighters.forEach((f,i)=>{f.x=i===0?-.9:.9;f.z=0;f.health=100;f.attack=null;f.stun=0;f.move=false;f.state='idle';});
    this.publish();
  }
  private update(dt:number){
    if(!this.loaded.every(Boolean)||this.loadError)return;
    if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
    this.t+=dt;if(!this.over)this.time=Math.max(0,this.time-dt);
    if(this.time===0&&!this.over)this.finish(this.fighters[0].health===this.fighters[1].health?'draw':this.fighters[0].health>this.fighters[1].health?'player':'enemy');
    const [a,b]=this.fighters;
    if(!this.over){
      const dx=this.horizontal + Number(this.keys.has('d')||this.keys.has('arrowright')) - Number(this.keys.has('a')||this.keys.has('arrowleft'));
      const dz=this.vertical + Number(this.keys.has('w')||this.keys.has('arrowup')) - Number(this.keys.has('s')||this.keys.has('arrowdown'));
      const magnitude=Math.hypot(dx,dz), mx=magnitude>1?dx/magnitude:dx,mz=magnitude>1?dz/magnitude:dz;
      a.move=magnitude>.1&&a.stun<=0;
      if(a.move){const speed=(a.attack?.id==='kick'||a.attack?.id==='heavy') ? .18 : a.attack ? .35 : 1; a.x=clamp(a.x+mx*dt*2.15*speed,-2.8,2.8);a.z=clamp(a.z-mz*dt*1.3*speed,-.85,.85);}
      const dist=Math.hypot(a.x-b.x,a.z-b.z);
      b.move=b.stun<=0&&!b.attack&&(dist>1.02||Math.abs(a.z-b.z)>.18);
      if(b.move){if(Math.abs(a.x-b.x)>.85)b.x+=Math.sign(a.x-b.x)*1.55*dt;b.z+=(a.z-b.z)*Math.min(4*dt,1);}
      else if(b.stun<=0&&!b.attack&&dist<.76){b.x-=Math.sign(a.x-b.x)*dt*.9;}
      b.x=clamp(b.x,-2.8,2.8);b.z=clamp(b.z,-.85,.85);
      // Keep fighters from phasing through each other when standing in the same lane.
      const deltaX=b.x-a.x, deltaZ=b.z-a.z;
      const d=Math.hypot(deltaX,deltaZ);
      if(d<.74){const overlap=(.74-Math.max(.01,d))*.5; const nx=d>.01?deltaX/d:1; const nz=d>.01?deltaZ/d:0;
        a.x=clamp(a.x-overlap*nx,-2.8,2.8);b.x=clamp(b.x+overlap*nx,-2.8,2.8);
        a.z=clamp(a.z-overlap*nz,-.85,.85);b.z=clamp(b.z+overlap*nz,-.85,.85);
      }
      this.aiNext-=dt;
      if(this.aiNext<=0){
        if(dist<1.45&&Math.abs(a.z-b.z)<.32&&!b.attack&&b.stun<=0){
          const list:AttackId[]=dist>1.12?['kick','heavy']:['jab','jab','cross','kick'];this.startAI(list[Math.floor(Math.random()*list.length)]);
        }
        this.aiNext=.75+Math.random()*.65;
      }
    }
    if(this.queued&&this.queued.until<this.t)this.queued=null;
    if(this.queued&&!a.attack&&a.stun<=0){const id=this.queued.id;this.queued=null;this.attack(id);}
    this.fighters.forEach((f,i)=>{
      f.stun=Math.max(0,f.stun-dt);
      if(f.attack&&!this.over){
        const spec=ATTACKS[f.attack.id];f.attack.elapsed+=dt;
        if(!f.attack.hit&&activeAt(spec,f.attack.elapsed))this.hit(i as 0|1,(1-i) as 0|1,f.attack);
        if(f.attack&&f.attack.elapsed>=totalDuration(spec))f.attack=null;
      }
      f.state=f.health<=0?'ko':this.over?'win':f.stun>0?'hit':f.attack?.id??(f.move?'walk':'idle');
      const phase=f.attack?f.attack.elapsed/totalDuration(ATTACKS[f.attack.id]):0;
      f.visual.update(dt,this.t,f.state,phase);
      f.visual.root.position.set(f.x,f.visual.root.position.y,f.z);
      const other=this.fighters[1-i];
      const yaw=Math.atan2(other.x-f.x,other.z-f.z);
      const delta=Math.atan2(Math.sin(yaw-f.visual.root.rotation.y),Math.cos(yaw-f.visual.root.rotation.y));
      f.visual.root.rotation.y+=delta*(1-Math.exp(-18*dt));
    });
    for(let i=this.flashes.length-1;i>=0;i--){const p=this.flashes[i];p.ttl-=dt;p.sprite.scale.setScalar(1+(1-p.ttl/p.max)*3);
      (p.sprite.material as THREE.MeshBasicMaterial).opacity=Math.max(0,p.ttl/p.max);
      if(p.ttl<=0){this.scene.remove(p.sprite);p.sprite.geometry.dispose();(p.sprite.material as THREE.Material).dispose();this.flashes.splice(i,1);}
    }
    this.shake=Math.max(0,this.shake-dt);
  }
  private loop=(now:number)=>{
    if(!this.alive)return;
    const dt=clamp((now-this.last)/1000,0,.035);this.last=now;
    if(!document.hidden)this.update(dt);
    const middle=(this.fighters[0].x+this.fighters[1].x)*.5;
    this.cameraDistance=THREE.MathUtils.damp(this.cameraDistance,this.fittedCameraDistance(),3,dt);
    this.camera.position.x=THREE.MathUtils.damp(this.camera.position.x,middle,5,dt);
    this.camera.position.z=this.cameraDistance;
    const offset=this.shake>.01?(Math.random()-.5)*this.shake:0;
    this.camera.position.y=2.65+offset;
    this.camera.lookAt(this.camera.position.x,this.camera.aspect<1?1.0:1.08,(this.fighters[0].z+this.fighters[1].z)*.25);
    this.renderer.render(this.scene,this.camera);
    if(this.t>.24&&Math.floor(this.t*9)!==Math.floor((this.t-dt)*9))this.publish();
    this.frame=requestAnimationFrame(this.loop);
  };
  private publish(){if(this.alive)this.onView({player:this.fighters[0].health,enemy:this.fighters[1].health,timer:Math.ceil(this.time),over:this.over,winner:this.winner,status:this.status,ready:this.loaded.every(Boolean),failed:this.loadError,loaded:[...this.loaded] as [boolean,boolean],names:[this.selected[0].name,this.selected[1].name]});}
  destroy(){
    this.alive=false;this.modelGeneration++;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();
    window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);
    this.fighters.forEach(f=>f.visual.dispose());
    this.flashes.forEach(f=>{f.sprite.geometry.dispose();(f.sprite.material as THREE.Material).dispose();});
    this.scenery.forEach(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose();}});
    this.ground.geometry.dispose();(this.ground.material as THREE.Material).dispose();
    this.renderer.dispose();this.renderer.domElement.remove();
    if(this.audio)void this.audio.close();
  }
}
