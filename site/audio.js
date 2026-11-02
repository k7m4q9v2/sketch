import {subsetFont,requiredPresets} from './sf2-subset.js';
import {audiblePosition} from './audio-timing.js';
const deadline=(promise,ms,message)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(message)),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
export class AudioHost extends EventTarget{
 constructor(fonts,getBlob){super();Object.assign(this,{fonts,getBlob});this.loading=new Map();this.pending=new Map();this.loaded=new Set();this.signatures=new Map();this.previewTokens=new Map();this.serial=0;this.generation=0;this.ready=false;}
 reset(){
  this.generation++;const ctx=this.context;this.context=null;this.node?.disconnect();if(this.node)this.node.port.onmessage=null;this.node=null;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Audio session changed. Tap Play again.'));}this.pending.clear();
  clearTimeout(this.projectTimer);this.projectTimer=null;this.ready=false;this.broken=false;this.initializing=null;this.loaded.clear();this.signatures.clear();this.loading.clear();this.previewTokens.clear();this.lastProject=null;
  // Export preview must wait until the live output graph is actually closed.
  if(ctx&&ctx.state!=='closed')return ctx.close().catch(()=>{});
  return Promise.resolve();
 }
 unlock(){
  if(this.context?.state==='closed'||this.broken)this.reset();
  if(!this.context){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)throw Error('This browser does not support Web Audio.');try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}const ctx=this.context=new AC({latencyHint:'interactive'});ctx.onstatechange=()=>{if(this.context===ctx)this.dispatchEvent(new CustomEvent('state',{detail:ctx.state}));};}
  return this.resume();
 }
 resume(){if(!this.context||this.context.state==='running')return Promise.resolve();const generation=this.generation;return deadline(this.context.resume(),4000,'Audio was interrupted. Tap Play to reconnect.').catch(error=>{if(generation===this.generation)this.broken=true;throw error;});}
 signature(id,presets){const font=this.fonts.get(id);return(font?.size??font?.buffer?.byteLength??0)>32*1024*1024?JSON.stringify(presets):'*';}
 hasLoaded(id,presets){return this.loaded.has(id)&&!this.loading.has(id)&&this.signatures.get(id)===this.signature(id,presets);}
 async ensure(project,previewChannel=null){
  const resume=this.unlock(),generation=this.generation;
  if(!this.initializing)this.initializing=this.initialize().then(()=>{if(generation===this.generation)this.ready=true;}).catch(error=>{if(generation===this.generation){this.initializing=null;this.broken=true;}throw error;});
  await Promise.all([resume,this.initializing]);if(generation!==this.generation)throw Error('Audio session changed. Tap Play again.');
  const required=new Set(project.channels.map(c=>c.fontId));for(const id of this.loaded)if(!required.has(id)){await this.request('unload',{fontId:id});this.loaded.delete(id);}
  const channels=previewChannel===null?project.channels:[project.channels[previewChannel]].filter(Boolean);
  for(const c of channels){await this.load(c.fontId,requiredPresets(project,c.fontId));}
  if(generation!==this.generation)throw Error('Audio session changed. Tap Play again.');this.update(project,previewChannel===null);
 }
 async initialize(){
  const ctx=this.context,generation=this.generation;if(!ctx.audioWorklet)throw Error('AudioWorklet is unavailable. Use Safari over HTTPS.');
  const response=await fetch('./lumafont.wasm');if(!response.ok)throw Error('Could not load the sound engine.');const module=await WebAssembly.compile(await response.arrayBuffer());await ctx.audioWorklet.addModule('./audio-worklet.js');
  if(generation!==this.generation)throw Error('Audio session changed.');
  const node=this.node=new AudioWorkletNode(ctx,'lumafont',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
  node.port.onmessage=({data})=>{if(data.requestId){const p=this.pending.get(data.requestId);if(p){clearTimeout(p.timer);this.pending.delete(data.requestId);data.error?p.reject(Error(data.error)):p.resolve(data.result);}}else this.dispatchEvent(new CustomEvent(data.error?'error':'position',{detail:data.error?data:audiblePosition(ctx,data)}));};
  node.onprocessorerror=()=>{if(this.node!==node)return;this.broken=true;this.ready=false;this.dispatchEvent(new CustomEvent('error',{detail:{error:'Audio stopped. Tap Play to reconnect.'}}));};
  await this.request('init',{module});if(generation!==this.generation)throw Error('Audio session changed.');node.connect(ctx.destination);
 }
 send(type,data={}){if(type==='start')this.previewTokens.clear();this.node?.port.postMessage({type,...data});}
 request(type,data={},transfer=[],timeout=15000){return new Promise((resolve,reject)=>{if(!this.node){reject(Error('Audio is not ready.'));return;}const requestId=++this.serial,timer=setTimeout(()=>{this.pending.delete(requestId);this.broken=true;reject(Error('Audio stopped responding. Tap Play to reconnect.'));},timeout);this.pending.set(requestId,{resolve,reject,timer});this.node.port.postMessage({type,requestId,...data},transfer);});}
 async load(id,presets){const signature=this.signature(id,presets);if(this.hasLoaded(id,presets))return;if(this.loading.has(id)){await this.loading.get(id);return this.load(id,presets);}const generation=this.generation;const pending=(async()=>{const blob=await this.getBlob(id),compact=await subsetFont(blob,presets),buffer=await compact.arrayBuffer();if(generation!==this.generation)throw Error('Audio session changed.');const result=await this.request('load',{fontId:id,buffer},[buffer]);this.loaded.add(id);this.signatures.set(id,signature);this.lastProject=null;return result;})().finally(()=>{if(this.loading.get(id)===pending)this.loading.delete(id);});this.loading.set(id,pending);return pending;}
 async prepare(project){
  try{await this.ensure(project);await this.request('probe',{},[],1000);}
  catch{this.reset();await this.ensure(project);await this.request('probe',{},[],1000);}
 }
 async recover(project,tick,shouldPlay){
  if(this.recovering)return this.recovering;
  const task=(async()=>{try{await this.resume();await this.request('probe',{},[],1000);}catch{this.reset();await this.prepare(project);if(shouldPlay())this.send('start',{tick});}})();
  this.recovering=task;try{await task;}finally{if(this.recovering===task)this.recovering=null;}
 }
 async start(project,tick=0){await this.prepare(project);this.send('start',{tick});}
 stop(){this.previewTokens.clear();this.send('stop');}
 async preview(project,channel,pitch,id,velocity=100){const c=project.channels[channel];if(!c)return;if(this.context?.state==='closed'||this.broken)this.reset();const token={channelId:c.id,fontId:c.fontId,bank:c.bank,program:c.program};this.previewTokens.set(id,token);
  try{if(!(this.ready&&!this.broken&&this.context?.state==='running'&&this.hasLoaded(c.fontId,requiredPresets(project,c.fontId))))await this.ensure(project,channel);
   if(this.previewTokens.get(id)!==token)return;const now=project.channels[channel];if(!now||now.id!==token.channelId||now.fontId!==token.fontId||now.bank!==token.bank||now.program!==token.program){this.previewTokens.delete(id);return;}
   // A touch needs only this channel's sound, not a rebuild of the MIDI timeline.
   const {notes,...sound}=now;
   this.send('previewOn',{channel,pitch,id,velocity,sound,masterPitch:project.pitch,bpm:project.bpm,delay:project.delay});this.update(project);
  }catch(error){this.previewTokens.delete(id);throw error;}
 }
 async audition(project,channel,sound,pitch,id){
  const token={};this.previewTokens.set(id,token);
  await this.ensure(project,channel);
  const presets=requiredPresets(project,sound.fontId);if(!presets.some(p=>p.bank===sound.bank&&p.program===sound.program))presets.push({bank:sound.bank,program:sound.program});presets.sort((a,b)=>a.bank-b.bank||a.program-b.program);
  await this.load(sound.fontId,presets);if(this.previewTokens.get(id)!==token)return;
  this.send('previewOn',{channel,pitch,id,velocity:100,sound,restoreSound:project.channels[channel],masterPitch:project.pitch,bpm:project.bpm,delay:project.delay});
 }
 off(id){this.previewTokens.delete(id);this.send('previewOff',{id});}
 update(project,immediate=false){this.nextProject=project;if(immediate){this.flushProject();return;}if(!this.projectTimer)this.projectTimer=setTimeout(()=>this.flushProject(),32);}
 flushProject(){clearTimeout(this.projectTimer);this.projectTimer=null;const project=this.nextProject;if(!this.node||!project)return;const next=JSON.stringify(project);if(this.lastProject!==next){this.send('project',{project});this.lastProject=next;}}
}
