import {StereoDelay} from './delay.js';
import {PPQ,projectEvents,activeChannels} from './model.js';
const decodeName=bytes=>{try{return decodeURIComponent(Array.from(bytes,b=>'%'+b.toString(16).padStart(2,'0')).join(''));}catch{return String.fromCharCode(...bytes);}};
export class LumaEngine{
 static async create(module,rate){const {instance}=module instanceof WebAssembly.Module?{instance:await WebAssembly.instantiate(module,{wasi_snapshot_preview1:{proc_exit:code=>{throw Error(`WASM exit ${code}`);}}})}:await WebAssembly.instantiate(module,{wasi_snapshot_preview1:{proc_exit:code=>{throw Error(`WASM exit ${code}`);}}});const engine=new LumaEngine();engine.api=instance.exports;engine.api._initialize?.();engine.api.init(rate);engine.fonts=new Map();return engine;}
 load(id,buffer){let index=this.fonts.get(id);if(index===undefined){const used=new Set(this.fonts.values());index=Array.from({length:16},(_,i)=>i).find(i=>!used.has(i));if(index===undefined)throw Error('Up to 16 SoundFonts can play at once.');}const a=this.api,ptr=a.alloc(buffer.byteLength);if(!ptr)throw Error('Not enough audio memory.');let count;try{new Uint8Array(a.memory.buffer,ptr,buffer.byteLength).set(new Uint8Array(buffer));count=a.load_font(index,ptr,buffer.byteLength);}finally{a.dealloc(ptr);}if(count<0)throw Error('Could not decode SF2. Check for corruption, external ROM samples, or low memory.');this.fonts.set(id,index);const presets=[];for(let p=0;p<count;p++){if(!a.preset_playable(index,p))continue;const ptr=a.preset_name(index,p),bytes=new Uint8Array(a.memory.buffer);let end=ptr;while(bytes[end]&&end<ptr+20)end++;presets.push({name:decodeName(bytes.subarray(ptr,end)),bank:a.preset_bank(index,p),program:a.preset_program(index,p)});}return presets;}
 unload(id){const index=this.fonts.get(id);if(index!==undefined){this.api.unload_font(index);this.fonts.delete(id);}}
 noteOn(channel,pitch,velocity){return this.api.note_on(channel,pitch,velocity);}
 noteOff(handle){this.api.note_off(handle);}
 pitchOf(handle){return this.api.note_pitch(handle);}
 slide(handle,pitch,frames){this.api.slide_note(handle,pitch,frames);}
 panic(channel=-1){this.api.panic(channel);}
 configure(p){this.api.set_pitch((p.pitch?.note??0)+(p.pitch?.cents??0)/100);p.channels.forEach((c,i)=>{const e=c.adsr;this.api.tune_channel(i,c.cents??0);this.api.configure(i,this.fonts.get(c.fontId)??-1,c.bank,c.program,c.volume,c.pan,e.a,e.d,e.s,e.r,e.enabled?1:0,e.delay??0,e.hold??0,e.curveA??0,e.curveD??0,e.curveR??0,e.tempo?p.bpm/120:1);});}
 render(n){const ptr=this.api.render(n);const audio=new Float32Array(this.api.memory.buffer,ptr,n*2);return audio;}
}
export class Sequencer{
 constructor(engine,rate){this.engine=engine;this.rate=rate;this.position=0;this.cycle=0;this.playing=false;this.handles=new Map();this.clickLeft=0;this.clickPhase=0;this.clickFrequency=1000;this.eventIndex=0;this.master=.8;this.delay=new StereoDelay(rate);}
 setProject(p){const old=this.project;const tick=this.project?this.position/this.rate*this.project.bpm/60*PPQ:0;this.project=p;this.engine.configure(p);this.delay.configure(p.delay,p.bpm);this.events=projectEvents(p);this.scale=this.rate*60/p.bpm/PPQ;this.length=Math.round(p.bars*4*PPQ*this.scale);this.position=Math.min(Math.round(tick*this.scale),this.length);this.eventIndex=this.events.findIndex(e=>Math.round(e.tick*this.scale)>=this.position);if(this.eventIndex<0)this.eventIndex=this.events.length;
   // Preserve unaffected held notes while releasing removed, muted or edited ones.
   if(old){const active=new Set(activeChannels(p).map(c=>c.id));for(const [key,handle] of this.handles){const sep=key.indexOf(':'),i=Number(key.slice(0,sep)),id=key.slice(sep+1),before=old.channels[i],after=p.channels[i],a=before?.notes.find(n=>n.id===id),b=after?.notes.find(n=>n.id===id);if(!after||after.id!==before?.id||!active.has(after.id)||after.fontId!==before.fontId||after.bank!==before.bank||after.program!==before.program||!a||!b||a.slide!==b.slide||a.pitch!==b.pitch||a.start!==b.start||a.duration!==b.duration||b.start+b.duration<=tick||p.bars!==old.bars){this.engine.noteOff(handle);this.handles.delete(key);}}}
 }
 start(){this.delay.reset();this.engine.panic(-1);this.handles.clear();this.position=0;this.cycle=0;this.eventIndex=0;this.playing=true;}
 stop(){this.delay.reset();this.playing=false;this.position=0;this.eventIndex=0;this.engine.panic(-1);this.handles.clear();this.clickLeft=0;}
 event(e){const key=e.channel+':'+e.id;if(e.type==='on'){const h=this.engine.noteOn(e.channel,e.pitch,e.velocity/127,e);if(h)this.handles.set(key,h);}else if(e.type==='slide'){const voices=[...this.handles].filter(([key])=>key.startsWith(e.channel+':')).map(([,h])=>({h,pitch:this.engine.pitchOf(h)})).filter(v=>v.pitch>=0);if(voices.length){const delta=e.pitch-Math.max(...voices.map(v=>v.pitch));for(const v of voices)this.engine.slide(v.h,v.pitch+delta,Math.round(e.duration*this.scale));}}else if(e.type==='off'){const h=this.handles.get(key);if(h)this.engine.noteOff(h);this.handles.delete(key);}else {this.clickLeft=Math.round(this.rate*.035);this.clickPhase=0;this.clickFrequency=e.accent?1500:1000;}}
 render(left,right){let offset=0;while(offset<left.length){if(this.playing){while(this.eventIndex<this.events.length&&Math.round(this.events[this.eventIndex].tick*this.scale)<=this.position)this.event(this.events[this.eventIndex++]);if(this.position>=this.length){this.position=0;this.eventIndex=0;this.cycle++;continue;}}
   const boundary=this.playing?Math.min(this.length,this.eventIndex<this.events.length?Math.round(this.events[this.eventIndex].tick*this.scale):this.length):Infinity;
   const n=Math.min(128,left.length-offset,this.playing?boundary-this.position:128);if(n<=0)continue;const audio=this.engine.render(n);this.delay.process(audio,n);
   for(let i=0;i<n;i++){let click=0;if(this.clickLeft>0){click=Math.sin(this.clickPhase)*.12*(this.clickLeft/(this.rate*.035));this.clickPhase+=2*Math.PI*this.clickFrequency/this.rate;this.clickLeft--;}left[offset+i]=Math.max(-1,Math.min(1,audio[i*2]*this.master+click));right[offset+i]=Math.max(-1,Math.min(1,audio[i*2+1]*this.master+click));}
   if(this.playing)this.position+=n;offset+=n;
 }}
 get tick(){return this.project?this.position/this.scale:0;}
}
