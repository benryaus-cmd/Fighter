import * as THREE from 'three';
import { activeAt, canReach, clamp, totalDuration, attackSpec } from './rules';
import type { ActiveAttack, AttackId, MoveState, AttackSpec } from './rules';
import { createProceduralFighter } from './ProceduralFighter';
import type { FighterVisual } from './ProceduralFighter';
import { loadGLBFighter } from './GLBFighter';
import { chooseFighters } from './roster';
import type { RosterFighter } from './roster';
import { Arena } from './Arena';
import { CombatEffects } from './Effects';
import { FightSound } from './Sound';
import { detectCombo } from './combos';
import type { ComboStep } from './combos';
import { readSettings, sanitizeSettings } from './settings';
import type { Settings } from './settings';

export type GameView = {
  energy:number;combo:string;
  player: number; enemy: number; timer: number; over: boolean;
  winner: 'player' | 'enemy' | 'draw' | null; status: string; ready:boolean; failed:boolean; loaded: [boolean,boolean]; names: [string,string];
};
type Fighter = { x:number;z:number; health:number; stun:number; attack:ActiveAttack|null; move:boolean; visual:FighterVisual; state:MoveState };
type Projectile={mesh:THREE.Mesh;source:0|1;vx:number;vz:number;ttl:number;spec:AttackSpec};
const THREE_COLOR = [0xff71cb,0x73dcff];
export class FightGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  private renderer: THREE.WebGLRenderer;
  private fighters: [Fighter,Fighter];
  private arena:Arena;
  private effects:CombatEffects;
  private sound:FightSound;
  private keyLight:THREE.DirectionalLight;
  private rim:THREE.DirectionalLight;
  private fill:THREE.HemisphereLight;
  private settings:Settings=readSettings();
  private paused=false;
  private energy=60;private history:ComboStep[]=[];private combo='';private comboUntil=0;
  private projectiles:Projectile[]=[];
  private projectileGeometry=new THREE.SphereGeometry(.18,12,8);
  private frame=0; private last=0; private t=0; private time=90; private over=false;
  private winner:GameView['winner']=null;
  private horizontal=0; private vertical=0; private keys=new Set<string>();
  private aiNext=1; private shake=0;
  private loaded:[boolean,boolean]=[false,false];
  private selected:readonly [RosterFighter,RosterFighter]=chooseFighters();
  private modelGeneration=0;
  private alive=true;
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
    this.scene.fog=new THREE.FogExp2('#514169',.018);
    this.camera.position.set(0,2.65,7);
    this.camera.lookAt(0,1.05,0);
    this.fill=new THREE.HemisphereLight(0xe2e8ff,0x30223a,.85);this.scene.add(this.fill);
    const key=this.keyLight=new THREE.DirectionalLight(0xffedd9,2.4);
    key.position.set(-4,8,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;
    this.scene.add(key);
    const rim=this.rim=new THREE.DirectionalLight(0x9baeff,.7);rim.position.set(4,5,-4);this.scene.add(rim);
    this.arena=new Arena(this.scene);this.effects=new CombatEffects(this.scene);this.sound=new FightSound(this.settings);
    window.addEventListener('pointerdown',this.sound.unlock);
    window.addEventListener('keydown',this.sound.unlock);
    const a=createProceduralFighter(0),b=createProceduralFighter(1);
    this.fighters=[this.makeFighter(-.9,0,a),this.makeFighter(.9,0,b)];
    a.root.visible=false;b.root.visible=false;this.scene.add(a.root,b.root);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    window.addEventListener('keydown',this.keydown);
    window.addEventListener('keyup',this.keyup);
    window.addEventListener('blur',this.blur);
    document.addEventListener('visibilitychange',this.visibility);
    this.last=performance.now();this.frame=requestAnimationFrame(this.loop);
    this.applySettings(this.settings);
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
      fighter.visual=visual;visual.configure?.(this.settings);visual.root.position.set(fighter.x,0,fighter.z);const other=this.fighters[1-index];visual.root.rotation.y=Math.atan2(other.x-fighter.x,other.z-fighter.z);this.scene.add(visual.root);this.loaded[index]=true;
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
    return Math.max(aspect<1?5.6:4.7,horizontal)/this.settings.cameraZoom;
  }
  private keydown=(e:KeyboardEvent)=>{
    if(this.paused)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
    this.keys.add(e.key.toLowerCase());
    const keymap:Record<string,AttackId>={j:'jab',k:'cross',l:'kick',i:'heavy',u:'special',' ':'special'};
    if(keymap[e.key.toLowerCase()]&&!e.repeat)this.attack(keymap[e.key.toLowerCase()]);
    if(e.key.toLowerCase()==='r'&&this.over)this.restart();
  };
  private keyup=(e:KeyboardEvent)=>{this.keys.delete(e.key.toLowerCase());};
  private blur=()=>{this.keys.clear();this.horizontal=0;this.vertical=0;this.queued=null;};
  private visibility=()=>{this.blur();if(document.hidden)this.sound.suspend();this.last=performance.now();};
  setStick(x:number,y:number){this.horizontal=x;this.vertical=y;}
  applySettings(value:Settings){
    const timingKeys=['jabDuration','crossDuration','kickDuration','heavyDuration','punchHold'] as const;
    const timingChanged=timingKeys.some(key=>this.settings[key]!==value[key]);
    this.settings=sanitizeSettings(value);this.sound.apply(this.settings);
    this.renderer.toneMappingExposure=this.settings.exposure;
    this.keyLight.intensity=this.settings.keyLight;this.fill.intensity=this.settings.fillLight;this.rim.intensity=this.settings.rimLight;
    const theme=this.settings.lighting;this.keyLight.color.set(theme==='moonlight'?'#c3d8ff':theme==='studio'?'#ffffff':'#ffe0bc');
    this.rim.color.set(theme==='sunset'?'#ff69cb':'#80bdff');this.arena.setLighting(theme);
    this.fighters.forEach((f,i)=>{f.visual.configure?.(this.settings);if(timingChanged||(i===1&&!this.settings.cpuEnabled))f.attack=null;});if(timingChanged)this.queued=null;
    this.publish();
  }
  setPaused(value:boolean){this.paused=value;this.blur();this.last=performance.now();}
  attack(id:AttackId){
    if(this.paused||this.over||!this.loaded.every(Boolean))return;
    const p=this.fighters[0];
    if(p.attack||p.stun>0){this.queued={id,until:this.t+this.settings.inputBuffer};return;}
    if(id==='special'&&!this.settings.infiniteEnergy&&this.energy<this.settings.specialCost){this.status='BUILD ENERGY WITH HITS';this.publish();return;}
    if(id==='special'){if(!this.settings.infiniteEnergy)this.energy-=this.settings.specialCost;this.status='CELESTIAL BURST';this.sound.play('uwu',true);}
    p.attack={id,elapsed:0,hit:false,spec:attackSpec(id,this.settings)};this.sound.whoosh(id==='heavy'||id==='special');this.publish();
  }
  private startAI(id:AttackId){
    const p=this.fighters[1];if(p.stun>0||p.attack||this.over)return;
    p.attack={id,elapsed:0,hit:false,spec:attackSpec(id,this.settings)};this.sound.whoosh(id==='heavy');
  }
  private hit(source:0|1,target:0|1,attack:ActiveAttack,projectile=false){
    if(this.over)return;
    const a=this.fighters[source],b=this.fighters[target],spec=attack.spec??attackSpec(attack.id,this.settings);
    if(!projectile&&!canReach(a.x,a.z,b.x,b.z,spec.reach))return;
    const yaw=a.visual.root.rotation.y;
    const facing=(b.x-a.x)*Math.sin(yaw)+(b.z-a.z)*Math.cos(yaw)>0;
    if(!projectile&&!facing)return;
    attack.hit=true;
    let bonus=0;
    if(source===0){
      this.history.push({id:attack.id,time:this.t});this.history=this.history.slice(-3);
      const combo=detectCombo(this.history,this.settings.comboWindow);
      if(combo){bonus=combo.bonus*this.settings.damageMultiplier;this.combo=combo.name;this.history=[];this.energy=Math.min(100,this.energy+18);}
      else this.combo=`${this.history.filter(h=>this.t-h.time<=this.settings.comboWindow).length} HIT CHAIN`;
      this.comboUntil=this.t+2;this.energy=Math.min(100,this.energy+9);
    }else{this.history=[];}
    b.health=Math.max(0,b.health-Math.round(spec.damage+bonus));
    b.stun= .20+(attack.id==='heavy'||attack.id==='special'||bonus>0?.22:0);
    b.attack=null;
    const direction=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
    b.x=clamp(b.x+direction.x*spec.knockback,-2.8,2.8);b.z=clamp(b.z+direction.y*spec.knockback,-.85,.85);
    const power=attack.id==='heavy'||attack.id==='special'||bonus>0;
    this.shake=(power?.16:.075)*this.settings.cameraShake;this.hitstop=this.settings.hitPause*(power?1.25:1);
    this.status=bonus>0?this.combo:attack.id==='special'?'BURST IMPACT':attack.id==='heavy'?'POWER KICK':attack.id==='kick'?'FRONT KICK':attack.id.toUpperCase();
    this.sound.play(power?'thud':'snap');this.sound.play(power?'grunt':source===0&&Math.random()<.22?'giggle':'gasp',true);
    try{navigator.vibrate?.(attack.id==='heavy'?40:15);}catch{/* optional */}
    this.effects.impact(b.x-direction.x*.2,1.4,b.z-direction.y*.2,this.settings.effectsIntensity*(power?1.3:.85),THREE_COLOR[source]);
    if(b.health<=0)this.finish(source===0?'player':'enemy');
    this.publish();
  }
  private launch(source:0|1,attack:ActiveAttack){
    if(this.projectiles.length>=6)return;
    const a=this.fighters[source],b=this.fighters[1-source];const direction=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
    const mesh=new THREE.Mesh(this.projectileGeometry,new THREE.MeshBasicMaterial({color:THREE_COLOR[source],transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
    mesh.position.set(a.x+direction.x*.35,1.4,a.z+direction.y*.35);this.scene.add(mesh);
    this.projectiles.push({mesh,source,vx:direction.x*5.5,vz:direction.y*5.5,ttl:1.6,spec:attack.spec??attackSpec('special',this.settings)});
    this.effects.impact(mesh.position.x,1.4,mesh.position.z,this.settings.effectsIntensity*.8,THREE_COLOR[source]);this.sound.whoosh(true);
  }
  private clearProjectiles(){for(const p of this.projectiles){p.mesh.removeFromParent();(p.mesh.material as THREE.Material).dispose();}this.projectiles=[];}
  private updateProjectiles(dt:number){
    for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i],b=this.fighters[1-p.source];p.ttl-=dt;
      const oldX=p.mesh.position.x,oldZ=p.mesh.position.z;p.mesh.position.x+=p.vx*dt;p.mesh.position.z+=p.vz*dt;p.mesh.rotation.z+=dt*8;
      const dx=p.mesh.position.x-oldX,dz=p.mesh.position.z-oldZ;const t=clamp(((b.x-oldX)*dx+(b.z-oldZ)*dz)/(dx*dx+dz*dz||1),0,1);
      const hit=Math.hypot(b.x-oldX-dx*t,b.z-oldZ-dz*t)<.35;
      if(hit&&!this.over)this.hit(p.source,(1-p.source) as 0|1,{id:'special',elapsed:0,hit:false,spec:p.spec},true);
      if(Math.random()<.4)this.effects.trail(p.mesh.position.x,1.4,p.mesh.position.z,this.settings.trailStrength*.35,THREE_COLOR[p.source]);
      if(hit||p.ttl<=0||this.over){p.mesh.removeFromParent();(p.mesh.material as THREE.Material).dispose();this.projectiles.splice(i,1);}
    }
  }
  private finish(winner:GameView['winner']){this.over=true;this.winner=winner;this.status=winner==='player'?'YOU WIN!':winner==='enemy'?'K.O.':'DRAW!';this.publish();}
  restart(){
    this.selected=chooseFighters();
    this.loadSelectedModels();
    this.clearProjectiles();this.effects.clear();this.energy=60;this.history=[];this.combo='';
    this.time=90;this.over=false;this.winner=null;this.t=0;this.aiNext=1.2;this.queued=null;this.hitstop=0;this.blur();
    this.fighters.forEach((f,i)=>{f.x=i===0?-.9:.9;f.z=0;f.health=100;f.attack=null;f.stun=0;f.move=false;f.state='idle';});
    this.publish();
  }
  private update(dt:number){
    if(this.paused||!this.loaded.every(Boolean)||this.loadError)return;
    dt*=this.settings.gameSpeed;this.effects.update(dt);
    if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
    this.t+=dt;if(!this.over)this.time=Math.max(0,this.time-dt);
    if(this.time===0&&!this.over)this.finish(this.fighters[0].health===this.fighters[1].health?'draw':this.fighters[0].health>this.fighters[1].health?'player':'enemy');
    this.arena.update(this.t);if(!this.over)this.energy=this.settings.infiniteEnergy?100:Math.min(100,this.energy+this.settings.energyRegen*dt);if(this.t>this.comboUntil)this.combo='';
    const [a,b]=this.fighters;
    if(!this.over){
      const dx=this.horizontal + Number(this.keys.has('d')||this.keys.has('arrowright')) - Number(this.keys.has('a')||this.keys.has('arrowleft'));
      const dz=this.vertical + Number(this.keys.has('w')||this.keys.has('arrowup')) - Number(this.keys.has('s')||this.keys.has('arrowdown'));
      const magnitude=Math.hypot(dx,dz), mx=magnitude>1?dx/magnitude:dx,mz=magnitude>1?dz/magnitude:dz;
      a.move=magnitude>.1&&a.stun<=0;
      if(a.move){const speed=(a.attack?.id==='kick'||a.attack?.id==='heavy'||a.attack?.id==='special') ? .18 : a.attack ? .35 : 1; a.x=clamp(a.x+mx*dt*this.settings.moveSpeed*speed,-2.8,2.8);a.z=clamp(a.z-mz*dt*this.settings.moveSpeed*.6*speed,-.85,.85);}
      const dist=Math.hypot(a.x-b.x,a.z-b.z);
      b.move=this.settings.cpuEnabled&&b.stun<=0&&!b.attack&&(dist>1.02||Math.abs(a.z-b.z)>.18);
      if(b.move){if(Math.abs(a.x-b.x)>.85)b.x+=Math.sign(a.x-b.x)*1.55*dt;b.z+=(a.z-b.z)*Math.min(4*dt,1);}
      else if(this.settings.cpuEnabled&&b.stun<=0&&!b.attack&&dist<.76){b.x-=Math.sign(a.x-b.x)*dt*.9;}
      b.x=clamp(b.x,-2.8,2.8);b.z=clamp(b.z,-.85,.85);
      // Keep fighters from phasing through each other when standing in the same lane.
      const deltaX=b.x-a.x, deltaZ=b.z-a.z;
      const d=Math.hypot(deltaX,deltaZ);
      if(d<.74){const overlap=(.74-Math.max(.01,d))*.5; const nx=d>.01?deltaX/d:1; const nz=d>.01?deltaZ/d:0;
        a.x=clamp(a.x-overlap*nx,-2.8,2.8);b.x=clamp(b.x+overlap*nx,-2.8,2.8);
        a.z=clamp(a.z-overlap*nz,-.85,.85);b.z=clamp(b.z+overlap*nz,-.85,.85);
      }
      this.aiNext-=dt;
      if(this.settings.cpuEnabled&&this.aiNext<=0){
        if(dist<1.45&&Math.abs(a.z-b.z)<.32&&!b.attack&&b.stun<=0){
          const list:AttackId[]=dist>1.12?['kick','heavy']:['jab','jab','cross','kick'];this.startAI(list[Math.floor(Math.random()*list.length)]);
        }
        this.aiNext=(.75+Math.random()*.65)/this.settings.aiAggression;
      }
    }
    if(this.queued&&this.queued.until<this.t)this.queued=null;
    if(this.queued&&!a.attack&&a.stun<=0){const id=this.queued.id;this.queued=null;this.attack(id);}
    this.fighters.forEach((f,i)=>{
      f.stun=Math.max(0,f.stun-dt);
      if(f.attack&&!this.over){
        const spec=f.attack.spec??attackSpec(f.attack.id,this.settings);f.attack.elapsed+=dt;
        if(f.attack.id==='special'&&f.attack.elapsed<spec.windup&&Math.floor(f.attack.elapsed*12)!==Math.floor((f.attack.elapsed-dt)*12))this.effects.charge(f.x,f.z,this.settings.effectsIntensity,THREE_COLOR[i]);
        if(!f.attack.trailed&&activeAt(spec,f.attack.elapsed)){
          f.attack.trailed=true;const yaw=f.visual.root.rotation.y;
          if(f.attack.id!=='special')this.effects.trail(f.x+Math.sin(yaw)*.45,f.attack.id==='jab'||f.attack.id==='cross'?1.6:1.1,f.z+Math.cos(yaw)*.45,this.settings.trailStrength,THREE_COLOR[i],f.attack.id==='kick'||f.attack.id==='heavy');
        }
        if(!f.attack.hit&&activeAt(spec,f.attack.elapsed)){
          if(f.attack.id==='special'){f.attack.hit=true;this.launch(i as 0|1,f.attack);}else this.hit(i as 0|1,(1-i) as 0|1,f.attack);
        }
        if(f.attack&&f.attack.elapsed>=totalDuration(spec))f.attack=null;
      }
      f.state=f.health<=0?'ko':this.over?'win':f.stun>0?'hit':f.attack?.id??(f.move?'walk':'idle');
      const phase=f.attack?f.attack.elapsed/totalDuration(f.attack.spec??attackSpec(f.attack.id,this.settings)):0;
      f.visual.update(dt,this.t,f.state,phase);
      f.visual.root.position.set(f.x,f.visual.root.position.y,f.z);
      const other=this.fighters[1-i];
      const yaw=Math.atan2(other.x-f.x,other.z-f.z);
      const delta=Math.atan2(Math.sin(yaw-f.visual.root.rotation.y),Math.cos(yaw-f.visual.root.rotation.y));
      f.visual.root.rotation.y+=delta*(1-Math.exp(-18*dt));
    });
    this.updateProjectiles(dt);
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
  private publish(){if(this.alive)this.onView({energy:Math.floor(this.energy),combo:this.combo,player:this.fighters[0].health,enemy:this.fighters[1].health,timer:Math.ceil(this.time),over:this.over,winner:this.winner,status:this.status,ready:this.loaded.every(Boolean),failed:this.loadError,loaded:[...this.loaded] as [boolean,boolean],names:[this.selected[0].name,this.selected[1].name]});}
  destroy(){
    this.alive=false;this.modelGeneration++;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();
    window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);
    this.fighters.forEach(f=>f.visual.dispose());
    this.clearProjectiles();this.projectileGeometry.dispose();this.effects.dispose();this.arena.dispose();
    window.removeEventListener('pointerdown',this.sound.unlock);window.removeEventListener('keydown',this.sound.unlock);this.sound.destroy();
    this.renderer.dispose();this.renderer.domElement.remove();
  }
}
