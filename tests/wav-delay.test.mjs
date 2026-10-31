import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {newProject,channel,note} from '../site/model.js';
test('offline WAV renders the same real SF2 with delay repeats and a release tail',async()=>{
 const wasm=await fs.readFile(new URL('../site/lumafont.wasm',import.meta.url));const sf=await fs.readFile(new URL('./fixtures/starter.sf2',import.meta.url));const exact=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 const oldFetch=globalThis.fetch,oldSelf=globalThis.self;let result;
 globalThis.fetch=async()=>({arrayBuffer:async()=>exact(wasm)});globalThis.self={postMessage:v=>{if(v.buffer||v.error)result=v;}};
 try{await import('../site/export-worker.js');const project=newProject();project.channels.push(channel());project.bpm=120;project.bars=1;project.channels[0].adsr.r=.02;project.channels[0].notes=[note(60,0,60)];const run=async()=>{result=null;await self.onmessage({data:{project,fonts:[{id:'factory',buffer:exact(sf)}],tail:true}});assert.ok(!result.error,result.error);return result.buffer;};const dry=await run();project.delay.enabled=true;project.delay.input=.8;project.delay.feedback=.65;project.delay.mode='pingpong';const wet=await run();assert.ok(wet.byteLength>dry.byteLength);const view=new DataView(wet);assert.equal(view.getUint32(24,true),44100);let energy=0;for(let frame=110250;frame<132300;frame++){const l=view.getInt16(44+frame*4,true)/32768;energy+=l*l;}assert.ok(energy>1e-5,'echo remains after the dry loop ends');}
 finally{globalThis.fetch=oldFetch;globalThis.self=oldSelf;}
});
