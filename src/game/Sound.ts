import type { Settings } from './settings';
type Clip='snap'|'thud'|'giggle'|'gasp'|'grunt'|'uwu';
/** Unlock synchronously on a real gesture; decode and reuse local buffers. */
export class FightSound{
 private context:AudioContext|null=null;private buffers=new Map<Clip,AudioBuffer>();private music:HTMLAudioElement;
 private settings:Settings;private voiceAt=-10;private sources=new Set<AudioBufferSourceNode>();private destroyed=false;
 constructor(settings:Settings){this.settings=settings;this.music=new Audio('./audio/fight1.mp3');this.music.loop=true;this.music.preload='auto';this.apply(settings);}
 unlock=()=>{if(this.destroyed)return;try{
  if(!this.context){this.context=new AudioContext();for(const name of ['snap','thud','giggle','gasp','grunt','uwu'] as Clip[])void this.load(name);}
  if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
  if(this.settings.musicEnabled&&this.music.paused)void this.music.play().catch(()=>{});
 }catch{/* Audio is optional until the browser permits it. */}};
 private async load(name:Clip){try{const r=await fetch(`./audio/${name}.mp3`);if(!r.ok)return;const b=await this.context!.decodeAudioData(await r.arrayBuffer());if(!this.destroyed)this.buffers.set(name,b);}catch{/* Allow the rest of the game to load. */}}
 apply(settings:Settings){this.settings=settings;this.music.volume=settings.musicVolume;if(!settings.musicEnabled||settings.musicVolume===0)this.music.pause();else if(this.context?.state==='running')void this.music.play().catch(()=>{});}
 play(name:Clip,voice=false){const context=this.context,buffer=this.buffers.get(name);if(!context||!buffer||context.state!=='running'||this.sources.size>=8)return;
  if(voice&&(!this.settings.voicesEnabled||context.currentTime-this.voiceAt<1.6))return;
  const volume=voice?this.settings.voiceVolume:this.settings.sfxVolume;if(volume<=0)return;
  if(voice)this.voiceAt=context.currentTime;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.playbackRate.value=voice?1: .95+Math.random()*.1;gain.gain.value=volume*.7;source.connect(gain);gain.connect(context.destination);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};source.start();
 }
 whoosh(power=false){const c=this.context;if(!c||c.state!=='running'||this.settings.sfxVolume<=0)return;const n=Math.floor(c.sampleRate*.18),b=c.createBuffer(1,n,c.sampleRate),data=b.getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);const s=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();s.buffer=b;filter.type='bandpass';filter.frequency.setValueAtTime(power?700:1400,c.currentTime);filter.frequency.exponentialRampToValueAtTime(200,c.currentTime+.18);gain.gain.value=this.settings.sfxVolume*.12;s.connect(filter);filter.connect(gain);gain.connect(c.destination);s.onended=()=>{s.disconnect();filter.disconnect();gain.disconnect();};s.start();}
 suspend(){this.music.pause();if(this.context?.state==='running')void this.context.suspend();}
 destroy(){this.destroyed=true;this.music.pause();this.music.removeAttribute('src');this.sources.forEach(s=>{try{s.stop();}catch{/* Already ended. */}});if(this.context)void this.context.close();}
}
