export const DEFAULT_SETTINGS = {
  jabDuration:.72,crossDuration:.90,kickDuration:.78,heavyDuration:1.0,
  punchHold:.17,transitionTime:.12,hitPause:.065,inputBuffer:.48,comboWindow:1.8,
  damageMultiplier:1,moveSpeed:2.15,aiAggression:1,gameSpeed:1,
  specialCost:35,energyRegen:4,infiniteEnergy:false,cpuEnabled:true,
  effectsIntensity:1,trailStrength:.85,cameraShake:.7,toonStrength:.8,
  exposure:1.05,keyLight:2.4,fillLight:.85,rimLight:1.1,cameraZoom:1,
  lighting:'sunset',musicEnabled:true,musicVolume:.18,sfxVolume:.65,voiceVolume:.45,voicesEnabled:true,
};
export type Settings=typeof DEFAULT_SETTINGS;
export const RANGES:Partial<Record<keyof Settings,[number,number,number]>>={
 jabDuration:[.35,1.6,.01],crossDuration:[.4,1.8,.01],kickDuration:[.4,1.8,.01],heavyDuration:[.5,2,.01],
 punchHold:[.04,.35,.01],transitionTime:[.03,.3,.01],hitPause:[0,.15,.005],inputBuffer:[.1,.9,.01],comboWindow:[.7,3,.1],
 damageMultiplier:[.25,3,.05],moveSpeed:[.5,4,.05],aiAggression:[.25,2,.05],gameSpeed:[.35,1.5,.05],
 specialCost:[10,100,5],energyRegen:[0,15,.5],effectsIntensity:[0,2,.05],trailStrength:[0,2,.05],cameraShake:[0,2,.05],toonStrength:[0,1,.05],
 exposure:[.4,2,.05],keyLight:[0,5,.1],fillLight:[0,3,.05],rimLight:[0,4,.1],cameraZoom:[.75,1.3,.05],musicVolume:[0,1,.01],sfxVolume:[0,1,.01],voiceVolume:[0,1,.01],
};
export function sanitizeSettings(raw:unknown):Settings{
 const out={...DEFAULT_SETTINGS};if(!raw||typeof raw!=='object')return out;
 for(const key of Object.keys(out) as (keyof Settings)[]){const v=(raw as Record<string,unknown>)[key];
  if(typeof out[key]==='number'&&typeof v==='number'&&Number.isFinite(v)){const r=RANGES[key];(out as Record<string,unknown>)[key]=r?Math.min(r[1],Math.max(r[0],v)):v;}
  else if(typeof out[key]==='boolean'&&typeof v==='boolean')(out as Record<string,unknown>)[key]=v;
  else if(key==='lighting'&&['sunset','moonlight','studio'].includes(String(v)))out.lighting=String(v);
 }return out;
}
export function readSettings():Settings{try{return sanitizeSettings(JSON.parse(localStorage.getItem('ham-fighter-settings-v1')||'null'));}catch{return {...DEFAULT_SETTINGS};}}
export function saveSettings(settings:Settings){try{localStorage.setItem('ham-fighter-settings-v1',JSON.stringify(settings));}catch{/* Browser storage optional. */}}
export function settingsJSON(settings:Settings){return JSON.stringify({version:1,...settings},null,2);}
