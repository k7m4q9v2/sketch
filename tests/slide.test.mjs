import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {newProject,channel,note,validateProject} from '../site/model.js';
import {LumaEngine,Sequencer} from '../site/synth-core.js';
const wasm=await fs.readFile(new URL('../site/lumafont.wasm',import.meta.url)),font=await fs.readFile(new URL('./fixtures/starter.sf2',import.meta.url));
const energy=a=>a.reduce((n,v)=>n+v*v,0)/a.length;
const sine=(rate=44100,length=rate)=>{const left=Float32Array.from({length},(_,i)=>Math.sin(i/rate*261.63*2*Math.PI));return{left,right:left.slice(),rate};};
const render=(engine,frames)=>{const out=new Float32Array(frames*2);for(let at=0;at<frames;at+=128){const n=Math.min(128,frames-at);out.set(engine.render(n),at*2);}return out;};
const frequency=a=>{let crosses=0;for(let i=2;i<a.length;i+=2)if(a[i-2]<0&&a[i]>=0)crosses++;return crosses/(a.length/2/44100);};
test('seeking into a slide restores chord pitch and continues the remaining glide',async()=>{
 const e=await LumaEngine.create(wasm,44100);e.load('factory',font);const p=newProject();p.channels.push(channel());p.bpm=120;p.bars=1;
 p.channels[0].notes=[note(60,0,1920),note(64,0,1920),{...note(76,480,960),slide:true}];
 const seq=new Sequencer(e,44100);seq.setProject(p);seq.start(720);
 const pitches=()=>[...seq.handles.values()].map(h=>e.pitchOf(h)).sort((a,b)=>a-b);
 assert.deepEqual(pitches(),[63,67]);seq.render(new Float32Array(33075),new Float32Array(33075));assert.deepEqual(pitches(),[72,76]);
 seq.start(1500);assert.deepEqual(pitches(),[72,76]);
});
test('SoundFont channel cents are independent and slide moves held voices without retriggering',async()=>{
 const e=await LumaEngine.create(wasm,44100);e.load('factory',font);const p=newProject();p.channels.push(channel(),channel(1));for(const c of p.channels)c.adsr={enabled:true,a:0,d:0,s:1,r:.01};p.channels[0].cents=100;e.configure(p);e.api.note_on(0,60,1);assert.ok(Math.abs(frequency(render(e,22050))-277.18)<4);e.panic();e.api.note_on(1,60,1);assert.ok(Math.abs(frequency(render(e,22050))-261.63)<4);e.panic();const handle=e.noteOn(1,60,1);e.slide(handle,72,4410);render(e,2205);assert.ok(Math.abs(e.pitchOf(handle)-66)<.2);render(e,2205);assert.ok(Math.abs(e.pitchOf(handle)-72)<.01);assert.ok(Math.abs(frequency(render(e,22050))-523.25)<4);
});
test('slide notes alone are silent; held chords move by their highest note interval',async()=>{
 const e=await LumaEngine.create(wasm,44100);e.load('factory',font);const p=newProject();p.channels.push(channel());p.bpm=120;p.bars=1;p.channels[0].notes=[{...note(72,0,480),slide:true}];let seq=new Sequencer(e,44100);seq.setProject(p);seq.start();const l=new Float32Array(1000),r=new Float32Array(1000);seq.render(l,r);assert.equal(energy(l),0);seq.stop();p.channels[0].notes=[note(60,0,1800),note(64,0,1800),{...note(76,480,480),slide:true}];seq.setProject(p);seq.start();seq.render(new Float32Array(44100),new Float32Array(44100));assert.deepEqual([...seq.handles.values()].map(h=>Math.round(e.pitchOf(h))).sort((a,b)=>a-b),[72,76]);
});
