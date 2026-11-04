import { useCallback, useEffect, useRef, useState } from 'react';
import { FightGame } from './game/FightGame';
import type { GameView } from './game/FightGame';
import { ATTACK_BUTTONS } from './game/rules';
import type { AttackId } from './game/rules';
import { Joystick } from './components/Joystick';
import {SettingsPanel} from './components/SettingsPanel';
import {enterGameFullscreen,isGameFullscreen,toggleGameFullscreen} from './game/fullscreen';
import {readSettings,saveSettings} from './game/settings';

const INITIAL:GameView={countdown:3,resultReady:false,attackLabels:['JAB','CROSS','FRONT KICK','POWER KICK'],stance:'stand',critical:false,energy:60,combo:'',player:100,enemy:100,timer:90,over:false,winner:null,status:'LOADING FIGHTERS',ready:false,failed:false,loaded:[false,false],names:['CAT GIRL','CUTE GIRL']};
export default function App(){
  const stageRef=useRef<HTMLDivElement>(null),gameRef=useRef<FightGame|null>(null);
  const [view,setView]=useState<GameView>(INITIAL);
  const [started,setStarted]=useState(false),[fullscreen,setFullscreen]=useState(false);
  const [settings,setSettings]=useState(readSettings),[settingsOpen,setSettingsOpen]=useState(false);
  useEffect(()=>{
    const node=stageRef.current;if(!node)return;
    const game=new FightGame(node,setView);gameRef.current=game;
    return()=>{gameRef.current=null;game.destroy();};
  },[]);
  useEffect(()=>{gameRef.current?.applySettings(settings);saveSettings(settings);},[settings]);
  useEffect(()=>{gameRef.current?.setPaused(settingsOpen||!started);},[settingsOpen,started]);
  useEffect(()=>{const update=()=>setFullscreen(isGameFullscreen());document.addEventListener('fullscreenchange',update);document.addEventListener('webkitfullscreenchange',update);return()=>{document.removeEventListener('fullscreenchange',update);document.removeEventListener('webkitfullscreenchange',update);};},[]);
  const startFight=()=>{void enterGameFullscreen();setStarted(true);};
  const setStick=useCallback((x:number,y:number)=>gameRef.current?.setStick(x,y),[]);
  const attack=useCallback((id:AttackId)=>gameRef.current?.attack(id),[]);
  return <main className={`game-shell${view.critical?' critical-mode':''}`}>
    <div className="stage" ref={stageRef}>
      <div className="critical-flash" aria-hidden="true"/>
      <div className="stage-glow" aria-hidden="true" />
      <header className="hud">
        <div className="fighter-hud left">
          <div className="fighter-name"><span className="mini-avatar cat">✦</span> {view.names[0]} <span className="you-label">YOU</span></div>
          <div className="health-track" role="progressbar" aria-label="Your health" aria-valuenow={view.player} aria-valuemin={0} aria-valuemax={100}><div className="health-fill player" style={{width:`${view.player}%`}} /></div>
        </div>
        <div className="round-info"><div className="round-caption">ROUND 01</div><div className="timer">{view.timer}</div></div>
        <div className="fighter-hud right">
          <div className="fighter-name">{view.names[1]} <span className="mini-avatar cute">✿</span></div>
          <div className="health-track" role="progressbar" aria-label="Opponent health" aria-valuenow={view.enemy} aria-valuemin={0} aria-valuemax={100}><div className="health-fill enemy" style={{width:`${view.enemy}%`}} /></div>
        </div>
      </header>
      <div className="arena-toolbar"><span>CELESTIAL SHRINE</span><div><button aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} title="Fullscreen" onClick={()=>void toggleGameFullscreen()}>⛶</button><button aria-label={settings.musicEnabled?'Mute music':'Enable music'} onClick={()=>setSettings(s=>({...s,musicEnabled:!s.musicEnabled}))}>{settings.musicEnabled?'♫':'♫ OFF'}</button><button aria-label="Open settings" onClick={()=>setSettingsOpen(true)}>⚙ SETTINGS</button></div></div>
      {started&&view.countdown>0&&<div className="round-countdown" role="status"><small>GET READY</small><b key={view.countdown}>{view.countdown}</b></div>}
      {view.combo&&<div className="combo-readout">{view.combo}</div>}
      <div className="fight-banner" key={`${view.status}-${started}`}>{view.status}</div>
      {!view.ready&&<div className="loading-overlay" role="status">
        <span className="loading-logo">HAM <b>FIGHTER</b></span>
        <span className="loading-spinner" />
        <p>{view.failed?'Could not load a fighter.':'GETTING INTO THE RING'}</p>
        <small>{view.loaded.filter(Boolean).length} / 2 fighters ready</small>
        {view.failed&&<button className="restart-button" onClick={()=>gameRef.current?.restart()}>RETRY</button>}
      </div>}
      {view.ready&&!started&&<div className="launch-overlay">
        <span className="launch-kicker">CELESTIAL SHRINE</span>
        <h1>HAM <b>FIGHTER</b></h1>
        <p>Jump. Sweep. Send them flying.</p>
        <button className="restart-button" onClick={startFight}>TAP TO FIGHT</button>
        <small>Fullscreen · Sound on</small>
      </div>}
      {view.resultReady&&<div className="result-overlay"><span className="result-kicker">MATCH COMPLETE</span>
        <h1>{view.winner==='player'?'YOU WIN':view.winner==='enemy'?'KNOCKOUT':'DRAW'}</h1>
        <p>{view.winner==='player'?`${view.names[0]} takes the round.`:view.winner==='enemy'?`${view.names[1]} takes the round.`:'Nobody takes the round.'}</p>
        <button className="restart-button" onClick={()=>gameRef.current?.restart()}>FIGHT AGAIN ↻</button>
      </div>}
      <div className="mobile-controls">
        <div className="left-controls"><Joystick onChange={setStick} disabled={!started||settingsOpen||view.over||view.countdown>0||!view.ready}/><div className="control-help">↑ JUMP · ↓ CROUCH · HOLD AWAY GUARD</div></div>
        <div className="right-controls">{ATTACK_BUTTONS.map((a,index)=><button key={a.id} disabled={!started||settingsOpen||view.over||view.countdown>0||!view.ready} className={`attack-button attack-${a.id}`}
          onPointerDown={e=>{e.preventDefault();attack(a.id);}}
          onContextMenu={e=>e.preventDefault()}
          aria-label={`${a.label} attack`}>
          <span className="attack-symbol">{a.symbol}</span>
          <span>{view.attackLabels[index]}</span>
        </button>)}</div>
      </div>
      <div className="special-control">
        <button className="burst-button" disabled={!started||settingsOpen||view.over||view.countdown>0||!view.ready||(!settings.infiniteEnergy&&view.energy<settings.specialCost)} onPointerDown={e=>{e.preventDefault();attack('special');}} aria-label="Celestial burst special attack"><span>✧</span><b>BURST</b><small>{settings.specialCost} KI</small></button>
        <div className="energy-track" role="progressbar" aria-label="Energy" aria-valuenow={view.energy} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${view.energy}%`}}/></div><small>{view.energy} / 100 KI</small>
      </div>
      {settingsOpen&&<SettingsPanel value={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)}/>}
      <div className="bottom-meta"><span>HAM FIGHTER <b>ALPHA</b></span><span>{view.ready?'A A B · A B X':'LOADING'}</span></div>
    </div>
    <footer className="info-bar"><span>Keyboard: A/D move · W jump · S crouch · J/K/L/I to attack · U / Space burst · R restart</span><a href="https://github.com/benryaus-cmd/Fighter/blob/main/ASSET_CREDITS.md" target="_blank" rel="noreferrer">Character credits • CC BY ↗</a></footer>
  </main>;
}
