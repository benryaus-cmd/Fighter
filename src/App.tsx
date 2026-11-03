import { useCallback, useEffect, useRef, useState } from 'react';
import { FightGame } from './game/FightGame';
import type { GameView } from './game/FightGame';
import { ATTACK_BUTTONS } from './game/rules';
import type { AttackId } from './game/rules';
import { Joystick } from './components/Joystick';

const INITIAL:GameView={player:100,enemy:100,timer:90,over:false,winner:null,status:'LOADING FIGHTERS',ready:false,failed:false,loaded:[false,false],names:['CAT GIRL','CUTE GIRL']};
export default function App(){
  const stageRef=useRef<HTMLDivElement>(null),gameRef=useRef<FightGame|null>(null);
  const [view,setView]=useState<GameView>(INITIAL);
  useEffect(()=>{
    const node=stageRef.current;if(!node)return;
    const game=new FightGame(node,setView);gameRef.current=game;
    return()=>{gameRef.current=null;game.destroy();};
  },[]);
  const setStick=useCallback((x:number,y:number)=>gameRef.current?.setStick(x,y),[]);
  const attack=useCallback((id:AttackId)=>gameRef.current?.attack(id),[]);
  return <main className="game-shell">
    <div className="stage" ref={stageRef}>
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
      <div className="fight-banner" key={view.status}>{view.status}</div>
      {!view.ready&&<div className="loading-overlay" role="status">
        <span className="loading-logo">HAM <b>FIGHTER</b></span>
        <span className="loading-spinner" />
        <p>{view.failed?'Could not load a fighter.':'GETTING INTO THE RING'}</p>
        <small>{view.loaded.filter(Boolean).length} / 2 fighters ready</small>
        {view.failed&&<button className="restart-button" onClick={()=>gameRef.current?.restart()}>RETRY</button>}
      </div>}
      {view.over&&<div className="result-overlay"><span className="result-kicker">MATCH COMPLETE</span>
        <h1>{view.winner==='player'?'YOU WIN':view.winner==='enemy'?'KNOCKOUT':'DRAW'}</h1>
        <p>{view.winner==='player'?`${view.names[0]} takes the round.`:view.winner==='enemy'?`${view.names[1]} takes the round.`:'Nobody takes the round.'}</p>
        <button className="restart-button" onClick={()=>gameRef.current?.restart()}>FIGHT AGAIN ↻</button>
      </div>}
      <div className="mobile-controls">
        <div className="left-controls"><Joystick onChange={setStick} disabled={view.over||!view.ready}/><div className="control-help">MOVE / DODGE</div></div>
        <div className="right-controls">{ATTACK_BUTTONS.map(a=><button key={a.id} disabled={view.over||!view.ready} className={`attack-button attack-${a.id}`}
          onPointerDown={e=>{e.preventDefault();attack(a.id);}}
          onContextMenu={e=>e.preventDefault()}
          aria-label={`${a.label} attack`}>
          <span className="attack-symbol">{a.symbol}</span>
          <span>{a.label}</span>
        </button>)}</div>
      </div>
      <div className="bottom-meta"><span>HAM FIGHTER <b>ALPHA</b></span><span>{view.ready?'TOON COMBAT':'LOADING'}</span></div>
    </div>
    <footer className="info-bar"><span>Keyboard: WASD / arrows to move · J/K/L/I to attack · R to restart</span><a href="https://github.com/benryaus-cmd/Fighter/blob/main/ASSET_CREDITS.md" target="_blank" rel="noreferrer">Character credits • CC BY ↗</a></footer>
  </main>;
}
