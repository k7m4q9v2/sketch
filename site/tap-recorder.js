import {snapTicks,snapPosition} from './snap.js';
import {PPQ} from './model.js';
import {quantizeTaps} from './melody.js';
export function tapClock(ctx,now=performance.now()){
 if(!ctx)return 0;
 try{const stamp=ctx.getOutputTimestamp?.();if(stamp?.contextTime>0&&stamp.performanceTime>0&&Math.abs(now-stamp.performanceTime)<1000)return Math.min(ctx.currentTime,stamp.contextTime+(now-stamp.performanceTime)/1000);}catch{}
 return Math.max(0,ctx.currentTime-(ctx.baseLatency||0)-(ctx.outputLatency||0));
}
export class TapRecorder{
 constructor(ctx,{bpm,bars,metronome=true,status,done,snapMode,beatWidth=72}){Object.assign(this,{ctx,bpm,bars,metronome,status,done,snapMode,beatWidth});this.taps=[];this.lengths=[];this.active=null;this.nodes=[];}
 start(){
  this.beat=60/this.bpm;this.first=this.ctx.currentTime+.15;this.origin=this.first+4*this.beat;this.end=this.origin+this.bars*4*this.beat;this.next=0;this.running=true;
  const schedule=()=>{if(!this.running)return;if(this.ctx.state!=='running'){this.cancel();this.done(null);return;}
   while(this.next<4+this.bars*4&&this.first+this.next*this.beat<this.ctx.currentTime+.12){
    const at=this.first+this.next*this.beat;if(this.next<4||this.metronome){const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.frequency.value=this.next%4===0?1200:900;gain.gain.setValueAtTime(.15,at);gain.gain.exponentialRampToValueAtTime(.001,at+.035);osc.connect(gain);gain.connect(this.ctx.destination);osc.start(at);osc.stop(at+.04);const pair={osc,gain};this.nodes.push(pair);osc.onended=()=>{osc.disconnect();gain.disconnect();this.nodes=this.nodes.filter(n=>n!==pair);};}this.next++;
   }
   const now=tapClock(this.ctx);this.status(now<this.origin?String(Math.min(4,Math.max(1,4-Math.floor((now-this.first)/this.beat)))):'Tap');
   if(now>=this.end){this.finish();return;}this.timer=setTimeout(schedule,25);
  };schedule();
 }
 tap(){if(!this.running)return null;const time=tapClock(this.ctx)-this.origin;if(time>=-.045&&time<this.end-this.origin){this.release();this.active=this.taps.length;this.taps.push(Math.max(0,time));return Math.max(0,time);}return null;}
 release(){if(this.active===null)return;this.lengths[this.active]=Math.max(0,Math.min(tapClock(this.ctx),this.end)-this.origin-this.taps[this.active]);this.active=null;}
 finish(){this.release();let result;if(this.snapMode===undefined)result=quantizeTaps(this.taps,this.bpm,this.bars);else{const grid=snapTicks(this.snapMode,this.beatWidth),end=this.bars*4*PPQ,events=new Map();this.taps.forEach((time,i)=>{const start=snapPosition(time*this.bpm/60*PPQ,this.snapMode,this.beatWidth);if(start>=end)return;const duration=Math.max(grid,Math.round((this.lengths[i]??0)*this.bpm/60*PPQ/grid)*grid);events.set(start,Math.min(end-start,duration));});const ticks=[...events.keys()].sort((a,b)=>a-b);result={grid,ticks,durations:ticks.map(t=>events.get(t))};}this.cancel();this.done(result);}
 cancel(){this.running=false;clearTimeout(this.timer);for(const {osc,gain} of this.nodes){try{osc.stop();}catch{}osc.disconnect();gain.disconnect();}this.nodes=[];}
}
