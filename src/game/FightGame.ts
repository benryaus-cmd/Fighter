import * as THREE from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import { activeAt, clamp, totalDuration, attackSpec, contextualAttack, directionalAttack, shouldLaunch, guardMultiplier, comboAttack, ATTACK_LABELS, stepJump, cpuDirection, strikeTouches, strikeContact } from './rules';
import type { ActiveAttack, AttackId, MoveState, AttackSpec, Point3 } from './rules';
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
  countdown:number;resultReady:boolean;attackLabels:string[];energy:number;combo:string;stance:'air'|'crouch'|'stand';critical:boolean;
  player: number; enemy: number; timer: number; over: boolean;
  winner: 'player' | 'enemy' | 'draw' | null; status: string; ready:boolean; failed:boolean; loaded: [boolean,boolean]; names: [string,string];
};
type Fighter = { guard:boolean;evade:number;evadeDirection:number;evadeState:'dodgeBack'|'dodgeIn';hitChain:number;lastHit:number;x:number;z:number;y:number;vy:number;crouch:boolean;retreat:boolean;recoil:number;reaction:'hit'|'flyback'; health:number; stun:number; attack:ActiveAttack|null; move:boolean; visual:FighterVisual; state:MoveState };
type Projectile={mesh:THREE.Mesh;source:0|1;vx:number;vz:number;ttl:number;spec:AttackSpec};
const THREE_COLOR = [0xff71cb,0x73dcff];
export class FightGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  private renderer: THREE.WebGLRenderer;
  private outline:OutlineEffect;
  private jumpHeld=false;private slowRemaining=0;private cinematic=0;private introRemaining=3;private introVariant=1;private resultAge=0;private lastFlick=-1;private flickDirection=0;private stickFlickArmed=true;
  private aiMode:'approach'|'pressure'|'reset'='approach';private aiModeTime=0;private aiEvade=false;private aiGap=1.08;private aiDuck=0;
  private hitboxRoot=new THREE.Group();private hitboxGeometry=new THREE.SphereGeometry(1,10,6);private hitboxMaterial=new THREE.MeshBasicMaterial({color:0x5dffcc,wireframe:true,depthTest:false,transparent:true,opacity:.65});
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
    this.outline=new OutlineEffect(this.renderer);
    this.hitboxMaterial.userData.outlineParameters={visible:false};
    for(let i=0;i<28;i++){const box=new THREE.Mesh(this.hitboxGeometry,this.hitboxMaterial);box.visible=false;this.hitboxRoot.add(box);}this.scene.add(this.hitboxRoot);
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
  private makeFighter(x:number,z:number,visual:FighterVisual):Fighter { return {guard:false,evade:0,evadeDirection:0,evadeState:'dodgeBack',hitChain:0,lastHit:-99,x,z,y:0,vy:0,crouch:false,retreat:false,recoil:0,reaction:'hit',health:100,stun:0,attack:null,move:false,visual,state:'idle'}; }
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
      if(this.loaded.every(Boolean)){this.fighters.forEach(f=>{f.visual.root.visible=true;});this.status='READY';this.introRemaining=3;this.introVariant=Math.random()<.5?1:2;this.aiNext=1.2;this.last=performance.now();}
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
    const halfWidth=Math.max(1.12,separation*.5+(this.cinematic>0?1.0:.58));
    const horizontal=halfWidth/(Math.tan(THREE.MathUtils.degToRad(20))*aspect);
    return Math.max(aspect<1?5.6:4.7,horizontal)/this.settings.cameraZoom*(this.cinematic>0?this.settings.launchCamera:1);
  }
  private keydown=(e:KeyboardEvent)=>{
    if(this.paused)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
    const moveKey=e.key.toLowerCase();if(!e.repeat&&!this.keys.has(moveKey)&&['a','d','arrowleft','arrowright'].includes(moveKey))this.flick(moveKey==='a'||moveKey==='arrowleft'?-1:1);
    this.keys.add(moveKey);
    const keymap:Record<string,AttackId>={j:'jab',k:'cross',l:'kick',i:'heavy',u:'special',' ':'special'};
    if(keymap[e.key.toLowerCase()]&&!e.repeat)this.attack(keymap[e.key.toLowerCase()]);
    if(e.key.toLowerCase()==='r'&&this.over)this.restart();
  };
  private keyup=(e:KeyboardEvent)=>{this.keys.delete(e.key.toLowerCase());};
  private blur=()=>{this.keys.clear();this.horizontal=0;this.vertical=0;this.jumpHeld=false;this.queued=null;};
  private visibility=()=>{this.blur();if(document.hidden)this.sound.suspend();this.last=performance.now();};
  setStick(x:number,y:number){if(Math.abs(x)<.25)this.stickFlickArmed=true;if(Math.abs(x)>.65&&this.stickFlickArmed){this.flick(Math.sign(x));this.stickFlickArmed=false;}this.horizontal=x;this.vertical=y;}
  private flick(direction:number){
    const now=performance.now()/1000;
    if(this.flickDirection===direction&&now-this.lastFlick<.30){this.evade(this.fighters[0],direction);this.lastFlick=-1;}
    else{this.lastFlick=now;this.flickDirection=direction;}
  }
  private evade(f:Fighter,direction:number){
    if(this.paused||this.introRemaining>0||this.over||f.attack||f.stun>0||f.evade>0||f.y>.01)return;
    const opponent=this.fighters[f===this.fighters[0]?1:0];f.evade=.48;f.evadeDirection=direction;f.evadeState=direction*Math.sign(opponent.x-f.x)<0?'dodgeBack':'dodgeIn';f.guard=false;
  }
  private inputDirection(){return clamp(this.horizontal+Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')),-1,1);}

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
  private jump(f:Fighter){if(f.y<=.001&&f.vy<=0&&f.stun<=0&&!f.attack&&!this.over){f.vy=this.settings.jumpStrength;f.crouch=false;}}
  attack(id:AttackId){
    if(this.paused||this.over||this.introRemaining>0||!this.loaded.every(Boolean))return;
    const p=this.fighters[0];
    if((this.vertical>.5||this.keys.has('w')||this.keys.has('arrowup'))&&!this.jumpHeld){this.jump(p);this.jumpHeld=true;}
    id=directionalAttack(id,p.y>.04||p.vy>0,p.crouch||this.vertical<-.4||this.keys.has('s')||this.keys.has('arrowdown'),this.inputDirection()*Math.sign(this.fighters[1].x-p.x));
    if(p.attack||p.stun>0||p.evade>0){this.queued={id,until:this.t+this.settings.inputBuffer};return;}
    if(id==='special'&&!this.settings.infiniteEnergy&&this.energy<this.settings.specialCost){this.status='BUILD ENERGY WITH HITS';this.publish();return;}
    if(id==='special'){if(!this.settings.infiniteEnergy)this.energy-=this.settings.specialCost;this.status='CELESTIAL BURST';this.sound.play('uwu',true);}
    if(id==='flyingKnee')p.vy=Math.min(p.vy,.6);
    p.guard=false;p.crouch=id==='uppercut'?false:p.crouch;p.attack={id,elapsed:0,hit:false,spec:attackSpec(id,this.settings)};this.sound.whoosh(!['jab','cross','backfistL','backfistR'].includes(id));this.publish();
  }
  private startAI(id:AttackId){
    const p=this.fighters[1];if(p.stun>0||p.attack||p.evade>0||this.over)return;
    id=contextualAttack(id,p.y>.04||p.vy>0,p.crouch);
    p.guard=false;p.attack={id,elapsed:0,hit:false,spec:attackSpec(id,this.settings)};this.sound.whoosh(id==='heavy');
    this.aiMode='reset';this.aiModeTime=.55+Math.random()*.45;
  }
  private hit(source:0|1,target:0|1,attack:ActiveAttack,projectile=false,impactAt?:Point3){
    if(this.over)return;
    const a=this.fighters[source],b=this.fighters[target],spec=attack.spec??attackSpec(attack.id,this.settings);
    const yaw=a.visual.root.rotation.y;
    const facing=(b.x-a.x)*Math.sin(yaw)+(b.z-a.z)*Math.cos(yaw)>0;
    if(!projectile&&!facing)return;
    if(b.evade>.18)return;
    attack.hit=true;
    const guarded=guardMultiplier(attack.id,b.guard&&!b.attack&&b.y===0)<1;
    if(guarded){
      b.health=Math.max(0,b.health-Math.max(1,Math.round(spec.damage*.22)));b.hitChain=0;
      this.status='HIGH GUARD';this.hitstop=this.settings.hitPause*.5;this.sound.play('snap');
      this.effects.impact(impactAt?.x??b.x,impactAt?.y??1.6,impactAt?.z??0,this.settings.effectsIntensity*.35,0x83ddff);
      if(b.health<=0)this.finish(source===0?'player':'enemy');this.publish();return;
    }
    b.hitChain=this.t-b.lastHit<=this.settings.comboWindow?b.hitChain+1:1;b.lastHit=this.t;
    let bonus=0;
    if(source===0){
      this.history.push({id:comboAttack(attack.id),time:this.t});this.history=this.history.slice(-3);
      const combo=detectCombo(this.history,this.settings.comboWindow);
      if(combo){bonus=combo.bonus*this.settings.damageMultiplier;this.combo=combo.name;this.history=[];this.energy=Math.min(100,this.energy+18);}
      else this.combo=`${this.history.filter(h=>this.t-h.time<=this.settings.comboWindow).length} HIT CHAIN`;
      this.comboUntil=this.t+2;this.energy=Math.min(100,this.energy+9);
    }else{this.history=[];}
    const counter=Boolean(b.attack&&b.attack.elapsed<(b.attack.spec??attackSpec(b.attack.id,this.settings)).windup);
    const launch=shouldLaunch(attack.id,bonus>0,counter,b.hitChain);
    const critical=launch||Math.random()<this.settings.criticalChance;
    b.health=Math.max(0,b.health-Math.round((spec.damage+bonus)*(critical?this.settings.criticalDamage:1)));
    if(launch){this.slowRemaining=this.settings.launchDuration;this.cinematic=this.settings.launchDuration+.45;}else if(critical)this.slowRemaining=Math.max(this.slowRemaining,this.settings.criticalDuration);
    const power=['heavy','special','flyingKick','flyingKnee','uppercut','backKick','capoeira'].includes(attack.id)||bonus>0;
    b.reaction=launch?'flyback':'hit';b.stun=launch?1.1:power?.34:.23;b.crouch=false;b.guard=false;b.evade=0;
    b.attack=null;
    const direction=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
    b.recoil=direction.x*(launch?6.2:spec.knockback*2.3);
    if(launch){b.vy=Math.max(b.vy,3.4);b.hitChain=0;}
    if(target===1){this.aiMode='reset';this.aiModeTime=.8;}
    this.shake=(power?.16:.075)*this.settings.cameraShake;this.hitstop=this.settings.hitPause*(power?1.25:1);
    this.status=(launch?'LAUNCH · ':critical?'CRITICAL · ':'')+(bonus>0?this.combo:ATTACK_LABELS[attack.id]);
    this.sound.play(power?'thud':'snap');this.sound.play(power?'grunt':source===0&&Math.random()<.22?'giggle':'gasp',true);
    try{navigator.vibrate?.(attack.id==='heavy'?40:15);}catch{/* optional */}
    this.effects.impact(impactAt?.x??b.x-direction.x*.2,impactAt?.y??1.4,impactAt?.z??b.z,this.settings.effectsIntensity*(power?1.3:.85),THREE_COLOR[source]);
    if(b.health<=0)this.finish(source===0?'player':'enemy');
    this.publish();
  }
  private launch(source:0|1,attack:ActiveAttack){
    if(this.projectiles.length>=6)return;
    const a=this.fighters[source],b=this.fighters[1-source];const direction=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
    const mesh=new THREE.Mesh(this.projectileGeometry,new THREE.MeshBasicMaterial({color:THREE_COLOR[source],transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
    const origin=a.visual.contact?.('special');mesh.position.set(origin?.x??a.x+direction.x*.35,origin?.y??1.4+a.y,origin?.z??0);this.scene.add(mesh);
    this.projectiles.push({mesh,source,vx:direction.x*5.5,vz:direction.y*5.5,ttl:1.6,spec:attack.spec??attackSpec('special',this.settings)});
    this.effects.impact(mesh.position.x,mesh.position.y,mesh.position.z,this.settings.effectsIntensity*.8,THREE_COLOR[source]);this.sound.whoosh(true);
  }
  private clearProjectiles(){for(const p of this.projectiles){p.mesh.removeFromParent();(p.mesh.material as THREE.Material).dispose();}this.projectiles=[];}
  private updateProjectiles(dt:number){
    for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i],b=this.fighters[1-p.source];p.ttl-=dt;
      const previous=p.mesh.position.clone();p.mesh.position.x+=p.vx*dt;p.mesh.position.z+=p.vz*dt;p.mesh.rotation.z+=dt*8;
      const targets=b.visual.targets?.()??[{center:{x:b.x,y:1.4+b.y,z:0},radius:.24}];
      const hit=strikeTouches(previous,p.mesh.position,targets,.18);
      if(hit&&!this.over)this.hit(p.source,(1-p.source) as 0|1,{id:'special',elapsed:0,hit:false,spec:p.spec},true,p.mesh.position);
      if(Math.random()<.4)this.effects.trail(p.mesh.position.x,1.4,p.mesh.position.z,this.settings.trailStrength*.35,THREE_COLOR[p.source]);
      if(hit||p.ttl<=0||this.over){p.mesh.removeFromParent();(p.mesh.material as THREE.Material).dispose();this.projectiles.splice(i,1);}
    }
  }
  private finish(winner:GameView['winner']){this.fighters.forEach(f=>{f.attack=null;});this.queued=null;this.over=true;this.resultAge=0;this.winner=winner;this.status=winner==='player'?'YOU WIN!':winner==='enemy'?'K.O.':'DRAW!';this.publish();}
  restart(){
    this.selected=chooseFighters();
    this.loadSelectedModels();
    this.clearProjectiles();this.effects.clear();this.energy=60;this.history=[];this.combo='';this.slowRemaining=0;this.cinematic=0;this.introRemaining=3;this.resultAge=0;this.lastFlick=-1;this.aiMode='approach';this.aiModeTime=0;
    this.time=90;this.over=false;this.winner=null;this.t=0;this.aiNext=1.2;this.queued=null;this.hitstop=0;this.blur();
    this.fighters.forEach((f,i)=>{f.x=i===0?-.9:.9;f.z=0;f.y=0;f.vy=0;f.crouch=false;f.recoil=0;f.retreat=false;f.reaction='hit';f.guard=false;f.evade=0;f.hitChain=0;f.lastHit=-99;f.health=100;f.attack=null;f.stun=0;f.move=false;f.state='idle';});
    this.publish();
  }
  private update(dt:number){
    if(this.paused||!this.loaded.every(Boolean)||this.loadError)return;
    if(this.introRemaining>0){
      const before=Math.ceil(this.introRemaining);this.introRemaining=Math.max(0,this.introRemaining-dt);
      this.fighters.forEach((f,i)=>{const other=this.fighters[1-i];f.visual.root.position.set(f.x,0,0);f.visual.root.rotation.y=Math.atan2(other.x-f.x,0);f.visual.update(dt,0,((i+this.introVariant)%2?'intro1':'intro2'),1-this.introRemaining/3);});
      this.arena.update(3-this.introRemaining);this.status=this.introRemaining>0?'READY':'FIGHT!';
      if(before!==Math.ceil(this.introRemaining)||this.introRemaining===0)this.publish();return;
    }
    const realDt=dt;this.cinematic=Math.max(0,this.cinematic-realDt);if(this.over)this.resultAge+=realDt;
    this.fighters.forEach(f=>f.visual.tickGhosts?.(realDt));
    dt*=this.settings.gameSpeed*(this.slowRemaining>0?this.settings.criticalSpeed:1);this.slowRemaining=Math.max(0,this.slowRemaining-realDt);
    this.effects.update(dt);
    if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-realDt);return;}
    this.t+=dt;if(!this.over)this.time=Math.max(0,this.time-dt);
    if(this.time===0&&!this.over)this.finish(this.fighters[0].health===this.fighters[1].health?'draw':this.fighters[0].health>this.fighters[1].health?'player':'enemy');
    this.arena.update(this.t);if(!this.over)this.energy=this.settings.infiniteEnergy?100:Math.min(100,this.energy+this.settings.energyRegen*dt);if(this.t>this.comboUntil)this.combo='';
    const [a,b]=this.fighters;
    if(!this.over){
      const dx=this.inputDirection();
      const up=this.vertical>.5||this.keys.has('w')||this.keys.has('arrowup');
      const down=this.vertical<-.4||this.keys.has('s')||this.keys.has('arrowdown');
      if(up&&!this.jumpHeld)this.jump(a);this.jumpHeld=up;
      a.crouch=Boolean(down&&a.y<=.001&&a.vy<=0&&a.stun<=0);
      a.move=Math.abs(dx)>.1&&a.stun<=0&&!a.crouch&&a.evade<=0;
      a.guard=dx*Math.sign(b.x-a.x)<-.4&&!a.attack&&a.y===0&&a.stun<=0&&a.evade<=0;
      a.retreat=a.move&&dx*Math.sign(b.x-a.x)<0;
      if(a.move){const speed=a.attack?.id==='special'?.10:a.attack?.25:1;a.x=clamp(a.x+dx*dt*this.settings.moveSpeed*speed,-2.8,2.8);}
      const dist=Math.abs(a.x-b.x);this.aiNext-=dt;this.aiModeTime-=dt;this.aiDuck=Math.max(0,this.aiDuck-dt);
      b.crouch=this.settings.cpuEnabled&&this.aiDuck>0&&b.y===0&&b.stun<=0;
      if(this.settings.cpuEnabled&&this.aiModeTime<=0&&!b.attack){
        this.aiMode=dist<.95?'reset':dist>1.45?'approach':'pressure';this.aiModeTime=.5+Math.random()*.7;this.aiEvade=Math.random()<.38;this.aiGap=.95+Math.random()*.28;
        if(a.attack&&dist<1.25&&Math.random()<.22)this.aiDuck=.45;
        if(a.attack?.id==='sweep'&&Math.random()<.5)this.jump(b);
      }
      const threat=Boolean(a.attack&&a.attack.elapsed>.10&&this.aiEvade);
      if(threat&&b.evade<=0&&this.aiModeTime<.5&&Math.random()<dt*.8)this.evade(b,-Math.sign(a.x-b.x));
      b.guard=this.settings.cpuEnabled&&threat&&!b.attack&&b.stun<=0&&!b.crouch&&b.y===0&&b.evade<=0;
      let movement=cpuDirection(dist,this.aiMode,threat);
      if(movement===0&&this.aiMode==='pressure'&&dist>this.aiGap+.07)movement=1;
      b.move=this.settings.cpuEnabled&&b.stun<=0&&!b.attack&&!b.crouch&&b.evade<=0&&movement!==0;
      b.retreat=b.move&&movement<0;
      if(b.move)b.x=clamp(b.x+Math.sign(a.x-b.x)*movement*dt*(movement<0?1.8:1.45),-2.8,2.8);
      if(this.settings.cpuEnabled&&this.aiNext<=0&&!b.attack&&b.stun<=0&&dist<1.5&&!(this.aiMode==='reset'&&this.aiModeTime>.2)){
        const list:AttackId[]=b.crouch?['kick']:b.y>.1?['flyingKnee']:dist>1.06?['kick','heavy','backKick']:['jab','cross','backfistL','backfistR','uppercut','kick'];
        this.startAI(list[Math.floor(Math.random()*list.length)]);this.aiNext=(.85+Math.random()*.7)/this.settings.aiAggression;
      }
      // A single fighting lane: vertical input is posture, never camera-depth movement.
      const gap=b.x-a.x;if(Math.abs(gap)<.70&&Math.abs(a.y-b.y)<.9){const push=(.70-Math.abs(gap))*.5,sign=Math.sign(gap)||1;a.x=clamp(a.x-push*sign,-2.8,2.8);b.x=clamp(b.x+push*sign,-2.8,2.8);}
    }
    if(this.queued&&this.queued.until<this.t)this.queued=null;
    if(this.queued&&!a.attack&&a.stun<=0&&a.evade<=0){const id=this.queued.id;this.queued=null;this.attack(id);}
    // First advance both poses, then evaluate contact against those same rendered poses.
    this.fighters.forEach((f,i)=>{
      if(f.stun>0&&f.reaction==='flyback'&&this.cinematic>0)f.visual.ghost?.(this.scene,THREE_COLOR[i]);
      if(f.evade>0){f.evade=Math.max(0,f.evade-dt);f.x=clamp(f.x+f.evadeDirection*3.8*dt,-2.8,2.8);}
      if(f.attack&&['backfistL','backfistR','uppercut'].includes(f.attack.id)&&f.attack.elapsed<(f.attack.spec??attackSpec(f.attack.id,this.settings)).windup)f.x=clamp(f.x+Math.sign(this.fighters[1-i].x-f.x)*.9*dt,-2.8,2.8);
      if(f.attack?.id==='flyingKnee'&&f.attack.elapsed<.4)f.x=clamp(f.x+Math.sign(this.fighters[1-i].x-f.x)*1.45*dt,-2.8,2.8);
      const airborne=stepJump(f.y,f.vy,dt,this.settings.gravity);f.y=airborne.y;f.vy=airborne.vy;f.z=0;
      f.x=clamp(f.x+f.recoil*dt,-2.8,2.8);f.recoil=THREE.MathUtils.damp(f.recoil,0,f.reaction==='flyback'?2.2:9,dt);f.stun=Math.max(0,f.stun-dt);
      if(f.attack&&!this.over){const spec=f.attack.spec??attackSpec(f.attack.id,this.settings);f.attack.elapsed+=dt;if(f.attack.elapsed>=totalDuration(spec)){f.attack=null;if(i===1){this.aiMode='reset';this.aiModeTime=.6+Math.random()*.4;this.aiNext=Math.max(this.aiNext,.4);}}}
      f.state=f.stun>0&&f.reaction==='flyback'?'flyback':f.health<=0?'ko':this.over?(this.winner===(i===0?'player':'enemy')?(this.introVariant===1?'victory1':'victory2'):'idle'):f.stun>0?f.reaction:f.evade>0?f.evadeState:f.attack?.id??(f.y>.04||f.vy>0?'jump':f.crouch?'crouch':f.guard?'guard':f.move?(f.retreat?'retreat':'walk'):'idle');
      const other=this.fighters[1-i],yaw=Math.atan2(other.x-f.x,0),root=f.visual.root;
      const delta=Math.atan2(Math.sin(yaw-root.rotation.y),Math.cos(yaw-root.rotation.y));root.rotation.y+=delta*(1-Math.exp(-18*dt));root.position.set(f.x,f.y,0);
      const phase=f.attack?f.attack.elapsed/totalDuration(f.attack.spec??attackSpec(f.attack.id,this.settings)):f.evade>0?1-f.evade/.48:this.over?Math.min(.999,this.resultAge/5.5):0;
      f.visual.update(dt,this.t,f.state,phase);root.updateWorldMatrix(true,true);
    });
    this.fighters.forEach((f,i)=>{
      const attack=f.attack;if(!attack||this.over)return;const spec=attack.spec??attackSpec(attack.id,this.settings),point=f.visual.contact?.(attack.id);
      if(attack.id==='special'&&attack.elapsed<spec.windup&&Math.floor(attack.elapsed*12)!==Math.floor((attack.elapsed-dt)*12))this.effects.charge(f.x,0,this.settings.effectsIntensity,THREE_COLOR[i]);
      if(activeAt(spec,attack.elapsed)){
        if(!attack.trailed){attack.trailed=true;if(attack.id!=='special'&&point)this.effects.trail(point.x,point.y,point.z,this.settings.trailStrength,THREE_COLOR[i],!['jab','cross'].includes(attack.id));}
        if(!attack.hit){
          if(attack.id==='special'){attack.hit=true;this.launch(i as 0|1,attack);}
          else if(point){const target=this.fighters[1-i],targets=target.visual.targets?.()??[];
            const base=f.visual.contactBase?.(attack.id);
            const contact=strikeContact(attack.previousContact??point,point,targets,this.settings.strikeRadius)??(base?strikeContact(base,point,targets,this.settings.strikeRadius):null);
            if(contact)this.hit(i as 0|1,(1-i) as 0|1,attack,false,contact);
          }
        }
      }
      if(point)attack.previousContact=point.clone();
    });
    this.updateProjectiles(dt);this.updateHitboxes();this.shake=Math.max(0,this.shake-dt);
  }
  private updateHitboxes(){
    this.hitboxRoot.visible=this.settings.showHitboxes;if(!this.settings.showHitboxes)return;
    let index=0;for(const f of this.fighters){for(const sphere of f.visual.targets?.()??[]){const mesh=this.hitboxRoot.children[index++] as THREE.Mesh;if(!mesh)break;mesh.position.copy(sphere.center as THREE.Vector3);mesh.scale.setScalar(sphere.radius);mesh.visible=true;}
      const point=f.attack&&f.visual.contact?.(f.attack.id);if(point){const mesh=this.hitboxRoot.children[index++] as THREE.Mesh;if(mesh){mesh.position.copy(point);mesh.scale.setScalar(this.settings.strikeRadius);mesh.visible=true;}}
    }for(;index<this.hitboxRoot.children.length;index++)this.hitboxRoot.children[index].visible=false;
  }
  private loop=(now:number)=>{
    if(!this.alive)return;
    const dt=clamp((now-this.last)/1000,0,.035);this.last=now;
    if(!document.hidden)this.update(dt);
    const middle=(this.fighters[0].x+this.fighters[1].x)*.5;
    this.cameraDistance=THREE.MathUtils.damp(this.cameraDistance,this.fittedCameraDistance(),this.cinematic>0?9:3,dt);
    this.camera.position.x=THREE.MathUtils.damp(this.camera.position.x,middle,5,dt);
    this.camera.position.z=this.cameraDistance;
    const offset=this.shake>.01?(Math.random()-.5)*this.shake:0;
    const jumpHeight=Math.max(this.fighters[0].y,this.fighters[1].y);
    this.camera.position.y=2.65+offset+jumpHeight*.35;
    this.camera.lookAt(this.camera.position.x,(this.camera.aspect<1?1.0:1.08)+jumpHeight*.4,(this.fighters[0].z+this.fighters[1].z)*.25);
    this.outline.enabled=this.settings.outlineEnabled&&this.settings.outlineWidth>0;
    if(this.outline.enabled)this.scene.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.fighterMaterial)m.userData.outlineParameters={visible:false};}});
    this.outline.render(this.scene,this.camera);
    if(this.t>.24&&Math.floor(this.t*9)!==Math.floor((this.t-dt)*9))this.publish();
    this.frame=requestAnimationFrame(this.loop);
  };
  private publish(){if(this.alive)this.onView({countdown:Math.ceil(this.introRemaining),resultReady:this.over&&this.resultAge>1.5&&!this.fighters.some(f=>f.reaction==='flyback'&&(f.stun>0||f.y>.02)),attackLabels:(['jab','cross','kick','heavy'] as AttackId[]).map(id=>ATTACK_LABELS[directionalAttack(id,this.fighters[0].y>.04||this.fighters[0].vy>0,this.fighters[0].crouch||this.vertical<-.4,this.inputDirection()*Math.sign(this.fighters[1].x-this.fighters[0].x))]),stance:this.fighters[0].y>.04||this.fighters[0].vy>0?'air':this.fighters[0].crouch?'crouch':'stand',critical:this.slowRemaining>0,energy:Math.floor(this.energy),combo:this.combo,player:this.fighters[0].health,enemy:this.fighters[1].health,timer:Math.ceil(this.time),over:this.over,winner:this.winner,status:this.status,ready:this.loaded.every(Boolean),failed:this.loadError,loaded:[...this.loaded] as [boolean,boolean],names:[this.selected[0].name,this.selected[1].name]});}
  destroy(){
    this.alive=false;this.modelGeneration++;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();
    window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);
    this.fighters.forEach(f=>f.visual.dispose());
    this.hitboxGeometry.dispose();this.hitboxMaterial.dispose();this.clearProjectiles();this.projectileGeometry.dispose();this.effects.dispose();this.arena.dispose();
    window.removeEventListener('pointerdown',this.sound.unlock);window.removeEventListener('keydown',this.sound.unlock);this.sound.destroy();
    this.renderer.dispose();this.renderer.domElement.remove();
  }
}
