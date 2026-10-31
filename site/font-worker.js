import {LumaEngine} from './synth-core.js';
import {validateSf2} from './model.js';
self.onmessage=async({data:buffer})=>{try{validateSf2(buffer);const engine=await LumaEngine.create(await(await fetch('./lumafont.wasm')).arrayBuffer(),44100);const presets=engine.load('validate',buffer);self.postMessage({presets});}catch(e){self.postMessage({error:e.message});}};
