import {useEffect,useState} from 'react';
import {DEFAULT_SETTINGS,RANGES,settingsJSON} from '../game/settings';
import type {Settings} from '../game/settings';
type Props={value:Settings;onChange:(settings:Settings)=>void;onClose:()=>void};
const GROUPS:{name:string;fields:[keyof Settings,string][]}[]=[
 {name:'Fight',fields:[['jabDuration','Jab duration (seconds)'],['crossDuration','Cross duration (seconds)'],['kickDuration','Front kick duration'],['heavyDuration','Power kick duration'],['punchHold','Punch extension hold'],['transitionTime','Pose blend time'],['hitPause','Impact pause'],['inputBuffer','Input buffer'],['comboWindow','Combo window'],['damageMultiplier','Damage multiplier'],['moveSpeed','Movement speed'],['gameSpeed','Game speed'],['aiAggression','CPU aggression'],['cpuEnabled','CPU enabled'],['specialCost','Burst energy cost'],['energyRegen','Energy per second'],['infiniteEnergy','Infinite energy']]},
 {name:'Look',fields:[['lighting','Lighting preset'],['toonStrength','Toon shader strength'],['effectsIntensity','Impact effects'],['trailStrength','Attack trails'],['cameraShake','Camera shake'],['cameraZoom','Camera zoom'],['exposure','Exposure'],['keyLight','Key light'],['fillLight','Fill light'],['rimLight','Rim light']]},
 {name:'Sound',fields:[['musicEnabled','Music enabled'],['musicVolume','Music volume'],['sfxVolume','Combat sound volume'],['voicesEnabled','Voices enabled'],['voiceVolume','Voice volume']]},
];
export function SettingsPanel({value,onChange,onClose}:Props){
 const [tab,setTab]=useState(0),[showJSON,setShowJSON]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[onClose]);
 const json=settingsJSON(value);
 const update=(key:keyof Settings,v:unknown)=>{onChange({...value,[key]:v});setMessage('');};
 const copy=async()=>{
  setShowJSON(true);let copied=false;
  if(window.isSecureContext&&navigator.clipboard)try{await navigator.clipboard.writeText(json);copied=true;}catch{/* Fall back on local Wi-Fi HTTP. */}
  if(!copied){const text=document.createElement('textarea');text.value=json;text.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(text);text.select();try{copied=document.execCommand('copy');}catch{/* Manual selection below. */}text.remove();}
  setMessage(copied?'JSON copied to clipboard.':'Select the JSON below and copy it.');
 };
 return <div className="settings-backdrop"><section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
  <header className="settings-heading"><div><small>LIVE TUNING · SAVED ON THIS DEVICE</small><h2 id="settings-title">Fight lab</h2></div><button className="lab-close" onClick={onClose} aria-label="Close settings">✕</button></header>
  <div className="settings-tabs" role="tablist">{GROUPS.map((g,i)=><button key={g.name} role="tab" aria-selected={tab===i} onClick={()=>setTab(i)}>{g.name}</button>)}</div>
  <div className="settings-scroll" role="tabpanel">
   {tab===0&&<p className="lab-tip">Land <b>A → A → B</b> for Heartbreaker, or <b>A → B → X</b> for Crimson Rush. Finishers deal bonus damage and refill energy. Tap BURST (U / Space) for a ranged special. Changes apply immediately; the fight is paused here.</p>}
   {tab===2&&<p className="lab-tip">Music starts after your first tap. Voices are spaced out so hit sounds stay clear.</p>}
   {GROUPS[tab].fields.map(([key,label])=>{const v=value[key],range=RANGES[key];return <label className="lab-control" key={key}>
    <span>{label}{typeof v==='number'&&<output>{v.toFixed(2)}</output>}</span>
    {typeof v==='boolean'?<input type="checkbox" checked={v} onChange={e=>update(key,e.target.checked)} />:range?<input aria-label={label} type="range" min={range[0]} max={range[1]} step={range[2]} value={v as number} onChange={e=>update(key,Number(e.target.value))}/>:<select aria-label={label} value={String(v)} onChange={e=>update(key,e.target.value)}><option value="sunset">Rose sunset</option><option value="moonlight">Moonlight</option><option value="studio">Cool studio</option></select>}
   </label>;})}
   {showJSON&&<textarea aria-label="Settings JSON" className="settings-json" value={json} readOnly onFocus={e=>e.currentTarget.select()} />}
  </div>
  <footer className="settings-footer"><div className="lab-message" role="status">{message||'Tip: lower Game speed to inspect a strike.'}</div><div><button onClick={()=>{onChange({...DEFAULT_SETTINGS});setMessage('Defaults restored.');}}>Restore defaults</button><button className="lab-primary" onClick={()=>void copy()}>Copy JSON</button></div></footer>
 </section></div>;
}
