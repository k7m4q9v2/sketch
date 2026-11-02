import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LumaEngine} from '../site/synth-core.js';
import {newProject,channel,note} from '../site/model.js';
test('direct preview configuration sounds with correct tuning and envelope before any MIDI timeline exists',async()=>{
 const wasm=await readFile(new URL('../site/lumafont.wasm',import.meta.url)),font=await readFile(new URL('./fixtures/starter.sf2',import.meta.url));
 const p=newProject();p.channels=[channel()];p.channels[0].cents=-25;p.channels[0].pan=-.6;p.pitch={note:3,cents:12};p.channels[0].notes=[note(67,0,480)];
 const a=await LumaEngine.create(wasm,44100),b=await LumaEngine.create(wasm,44100);a.load('factory',font);b.load('factory',font);
 const {notes,...sound}=p.channels[0];a.configurePreview(0,sound,p.pitch,p.bpm);b.configure(p);a.noteOn(0,67,.8);b.noteOn(0,67,.8);
 let energy=0;for(let i=0;i<100;i++){const x=a.render(128),y=b.render(128);for(let j=0;j<x.length;j++){assert.equal(x[j],y[j]);energy+=x[j]*x[j];}}assert.ok(energy>1e-6);
});

test('audition keeps the project unchanged and restores the active sound after starting its voice',async()=>{
 const {AudioHost}=await import('../site/audio.js');const p=newProject();p.channels=[channel()];const before=JSON.stringify(p),sent=[],loads=[];const a=new AudioHost(new Map(),()=>{});a.ensure=async project=>assert.equal(project,p);a.load=async(id,presets)=>loads.push({id,presets});a.send=(type,data)=>sent.push({type,...data});
 const candidate={...p.channels[0],bank:2,program:15};await a.audition(p,0,candidate,60,'test');assert.equal(JSON.stringify(p),before);assert.equal(sent[0].sound.program,15);assert.equal(sent[0].restoreSound,p.channels[0]);assert.ok(loads[0].presets.some(x=>x.bank===2&&x.program===15));assert.ok(loads[0].presets.some(x=>x.bank===p.channels[0].bank&&x.program===p.channels[0].program));
 a.ensure=async()=>a.off('cancel');sent.length=0;await a.audition(p,0,candidate,60,'cancel');assert.equal(sent.some(x=>x.type==='previewOn'),false);
});

test('loaded audition superset plays immediately without reloading the active bank',async()=>{
 const {AudioHost}=await import('../site/audio.js');const p=newProject();p.channels=[channel()];const c=p.channels[0],a=new AudioHost(new Map([[c.fontId,{size:64*1024*1024}]]),()=>{});
 const candidate={...c,program:15};a.loaded.add(c.fontId);a.signatures.set(c.fontId,JSON.stringify([{bank:c.bank,program:c.program},{bank:c.bank,program:15}]));a.ready=true;a.context={state:'running'};
 a.ensure=()=>{throw Error('unnecessary preparation');};a.load=()=>{throw Error('unnecessary bank reload');};let sent=0;a.send=type=>{if(type==='previewOn')sent++;};a.update=()=>{};
 const result=a.preview(p,0,60,'note');assert.equal(sent,1);await result;
 const audition=a.audition(p,0,candidate,60,'instrument');assert.equal(sent,2);await audition;
 assert.equal(a.hasLoaded(c.fontId,[{bank:c.bank,program:99}]),false);
});
