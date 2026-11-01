import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newProject,channel,note} from '../site/model.js';

test('real worklet probe acknowledges only after rendering live SoundFont audio',async t=>{
 const names=['AudioWorkletProcessor','registerProcessor','sampleRate','currentFrame'],previous=names.map(n=>Object.getOwnPropertyDescriptor(globalThis,n));
 t.after(()=>names.forEach((n,i)=>previous[i]?Object.defineProperty(globalThis,n,previous[i]):delete globalThis[n]));
 const messages=[];let Processor;
 globalThis.AudioWorkletProcessor=class{constructor(){this.port={postMessage:m=>messages.push(m)};}};
 globalThis.registerProcessor=(name,value)=>{Processor=value;};globalThis.sampleRate=48000;globalThis.currentFrame=0;
 await import('../site/audio-worklet.js');const processor=new Processor();
 const send=data=>processor.port.onmessage({data});
 const wasm=await WebAssembly.compile(await readFile(new URL('../site/lumafont.wasm',import.meta.url)));
 await send({type:'init',module:wasm,requestId:1});
 await send({type:'load',fontId:'factory',buffer:await readFile(new URL('./fixtures/starter.sf2',import.meta.url)),requestId:2});
 const p=newProject();p.channels=[channel()];p.channels[0].notes=[note(60,0,480)];
 await send({type:'project',project:p});await send({type:'start',tick:0});await send({type:'probe',requestId:3});
 assert.ok(!messages.some(m=>m.requestId===3));const l=new Float32Array(128),r=new Float32Array(128);
 assert.equal(processor.process([],[[l,r]]),true);assert.ok(messages.some(m=>m.requestId===3&&m.result===true));
 assert.ok(l.some(v=>v!==0)||r.some(v=>v!==0));assert.ok(!messages.some(m=>m.error));
});
