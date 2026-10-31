import {subsetFont,requiredPresets} from './sf2-subset.js';
export class AudioHost extends EventTarget{
 constructor(fonts,getBlob){super();this.fonts=fonts;this.getBlob=getBlob;this.loading=new Map();this.pending=new Map();this.loaded=new Set();this.signatures=new Map();this.previewTokens=new Map();this.serial=0;this.ready=false;}
 unlock(){
   // Called synchronously from a gesture, before downloading or preparing an SF2.
   if(!this.context){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)throw Error('This browser does not support Web Audio.');try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}this.context=new AC({latencyHint:'interactive'});this.context.onstatechange=()=>this.dispatchEvent(new CustomEvent('state',{detail:this.context.state}));}
   return this.resume();
 }
 resume(){
   if(!this.context||this.context.state==='running')return Promise.resolve();
   return this.context.resume();
 }
 signature(id,presets){const font=this.fonts.get(id);return(font?.size??font?.buffer?.byteLength??0)>32*1024*1024?JSON.stringify(presets):'*';}
 hasLoaded(id,presets){return this.loaded.has(id)&&!this.loading.has(id)&&this.signatures.get(id)===this.signature(id,presets);}
 async ensure(project,previewChannel=null){
   const resume=this.unlock();if(!this.initializing)this.initializing=this.initialize().then(()=>{this.ready=true;}).catch(e=>{this.initializing=null;throw e;});await resume;await this.initializing;
   const required=new Set(project.channels.map(c=>c.fontId));for(const id of this.loaded)if(!required.has(id)){await this.request('unload',{fontId:id});this.loaded.delete(id);}
   const ids=previewChannel===null?required:new Set([project.channels[previewChannel]?.fontId].filter(Boolean));
   for(const id of ids)await this.load(id,requiredPresets(project,id));this.update(project,true);
 }
 async initialize(){if(!this.context.audioWorklet)throw Error('AudioWorklet is unavailable. Use a recent Safari version over HTTPS.');const response=await fetch('./lumafont.wasm');if(!response.ok)throw Error('Could not load the sound engine.');const module=await WebAssembly.compile(await response.arrayBuffer());await this.context.audioWorklet.addModule('./audio-worklet.js');this.node=new AudioWorkletNode(this.context,'lumafont',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});this.node.port.onmessage=({data})=>{if(data.requestId){const p=this.pending.get(data.requestId);if(p){this.pending.delete(data.requestId);data.error?p.reject(Error(data.error)):p.resolve(data.result);}}else this.dispatchEvent(new CustomEvent(data.error?'error':'position',{detail:data}));};this.node.onprocessorerror=()=>this.dispatchEvent(new CustomEvent('error',{detail:{error:'The audio engine stopped. Reload the page.'}}));await this.request('init',{module});this.node.connect(this.context.destination);}
 send(type,data={}){this.node?.port.postMessage({type,...data});}
 request(type,data={},transfer=[]){return new Promise((resolve,reject)=>{const requestId=++this.serial;this.pending.set(requestId,{resolve,reject});this.node.port.postMessage({type,requestId,...data},transfer);});}
 async load(id,presets){const signature=this.signature(id,presets);if(this.hasLoaded(id,presets))return;if(this.loading.has(id)){await this.loading.get(id);return this.load(id,presets);}this.loading.set(id,(async()=>{const blob=await this.getBlob(id),compact=await subsetFont(blob,presets),buffer=await compact.arrayBuffer();const result=await this.request('load',{fontId:id,buffer},[buffer]);this.loaded.add(id);this.signatures.set(id,signature);this.lastProject=null;return result;})().finally(()=>this.loading.delete(id)));return this.loading.get(id);}
 async start(project){await this.ensure(project);this.send('start');}
 stop(){this.previewTokens.clear();this.send('stop');}
 async preview(project,channel,pitch,id,velocity=100){
   const c=project.channels[channel];if(!c)return;
   const token={channelId:c.id,fontId:c.fontId,bank:c.bank,program:c.program};this.previewTokens.set(id,token);
   try{
    // A warm note reaches the processor in this same event, without resume/load awaits.
    if(!(this.ready&&this.context?.state==='running'&&this.hasLoaded(c.fontId,requiredPresets(project,c.fontId))))await this.ensure(project,channel);
    if(this.previewTokens.get(id)!==token)return;
    const now=project.channels[channel];
    if(!now||now.id!==token.channelId||now.fontId!==token.fontId||now.bank!==token.bank||now.program!==token.program){this.previewTokens.delete(id);return;}
    this.update(project,true);this.send('previewOn',{channel,pitch,id,velocity});
   }catch(e){this.previewTokens.delete(id);throw e;}
 }
 off(id){this.previewTokens.delete(id);this.send('previewOff',{id});}
 update(project,immediate=false){this.nextProject=project;if(immediate){this.flushProject();return;}if(!this.projectTimer)this.projectTimer=setTimeout(()=>this.flushProject(),32);}
 flushProject(){clearTimeout(this.projectTimer);this.projectTimer=null;const project=this.nextProject;if(!this.node||!project)return;const next=JSON.stringify(project);if(this.lastProject!==next){this.send('project',{project});this.lastProject=next;}}
}
