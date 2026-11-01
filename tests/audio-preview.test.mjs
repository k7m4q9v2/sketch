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
