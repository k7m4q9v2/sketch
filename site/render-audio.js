import {subsetFont,requiredPresets} from './sf2-subset.js';
import {LumaEngine,Sequencer} from './synth-core.js';
import {activeChannels,PPQ} from './model.js';
import {wavHeader} from './export.js';

// Render to the last audible sample, retaining initial rests and release/echo tails.
export async function renderAudio({project,fonts=[],tail=true},wasm,progress=()=>{}){
 const rate=44100,engine=await LumaEngine.create(wasm,rate);
 for(const f of fonts)engine.load(f.id,f.buffer??await(await subsetFont(f.blob,requiredPresets(project,f.id))).arrayBuffer());
 const p=structuredClone(project);p.metronome=false;
 const seq=new Sequencer(engine,rate);seq.setProject(p);seq.start();
 const loopEnd=p.bars*4*PPQ;
 let lastTick=0;for(const c of activeChannels(p))for(const n of c.notes)if(!n.slide&&n.start<loopEnd)lastTick=Math.max(lastTick,Math.min(loopEnd,n.start+n.duration));
 if(!lastTick)return {buffer:wavHeader(1,rate),peak:0,clipped:0,tailLimited:false};
 const end=Math.round(lastTick*seq.scale),limit=end+(tail?120*rate:0);
 const quietWindow=Math.ceil(rate*Math.max(.25,p.delay?.enabled?p.delay.time*15/p.bpm+Math.abs(p.delay.offset)*.05+.1:0));
 const chunks=[],block=16384;let chunk=new Int16Array(block*2),used=0,at=0,lastSound=0,quiet=0,peak=0,clipped=0,tailLimited=false;
 const l=new Float32Array(128),r=new Float32Array(128);
 while(at<limit){
  if(at===end){for(const h of seq.handles.values())engine.noteOff(h);seq.handles.clear();seq.playing=false;}
  const n=Math.min(128,limit-at,at<end?end-at:128);seq.render(l.subarray(0,n),r.subarray(0,n));
  for(let i=0;i<n;i++){
   const loud=Math.max(Math.abs(l[i]),Math.abs(r[i]));quiet=loud>1/32768?0:quiet+1;
   if(loud>1/32768)lastSound=at+i+1;
   for(const v of [l[i],r[i]]){if(!Number.isFinite(v))throw Error('Audio rendering produced an invalid sample.');peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=1)clipped++;chunk[used++]=Math.round(Math.max(-1,Math.min(1,v))*(v<0?32768:32767));}
   if(used===chunk.length){chunks.push(chunk);chunk=new Int16Array(block*2);used=0;}
  }
  at+=n;if(at%16384===0)progress(Math.min(.99,at/Math.max(1,end)));
  if(at>=end&&quiet>=quietWindow&&!engine.api.active_voices())break;
 }
 if(at>=limit&&tail&&quiet<quietWindow)tailLimited=true;
 if(used)chunks.push(chunk.subarray(0,used));
 const frames=Math.max(1,Math.min(at,lastSound+Math.round(rate*.005))),buffer=wavHeader(frames,rate),out=new DataView(buffer);
 let sample=0;for(const part of chunks){for(let i=0;i<part.length&&sample<frames*2;i++,sample++)out.setInt16(44+sample*2,part[i],true);if(sample>=frames*2)break;}
 if(tailLimited){const fade=Math.min(frames,rate*.02);for(let i=0;i<fade;i++)for(let c=0;c<2;c++){const offset=44+((frames-fade+i)*2+c)*2;out.setInt16(offset,Math.round(out.getInt16(offset,true)*(1-i/fade)),true);}}
 return {buffer,peak,clipped,tailLimited};
}
