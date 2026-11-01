import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderAudio} from '../site/render-audio.js';
import {newProject,channel,note} from '../site/model.js';
import {inspectWav} from '../site/wav-file.js';
const wasm=await readFile(new URL('../site/lumafont.wasm',import.meta.url));
const fonts=[{id:'factory',buffer:await readFile(new URL('./fixtures/starter.sf2',import.meta.url))}];
const render=(project,mode='mix')=>renderAudio({project,fonts,mode},wasm);
const pcm=buffer=>new Uint8Array(buffer,44);
const sameAudio=(a,b)=>assert.equal(Buffer.compare(a,b),0,"stem PCM differs from its isolated render");

test('one WAV contains isolated channels in rack order with original rests and one-bar silence',async()=>{
 const p=newProject();p.bpm=120;p.bars=2;p.pitch={note:2,cents:15};p.metronome=true;
 const a=channel(),b=channel(1),muted=channel(2),empty=channel(3);
 a.name='Lead';a.pan=-.7;a.cents=20;a.notes=[note(60,480,240)];
 b.name='Counter';b.pan=.8;b.cents=-30;b.notes=[note(67,1440,480)];
 for(const c of [a,b])c.adsr={...c.adsr,enabled:true,a:0,d:0,s:1,r:.15};
 muted.mute=true;muted.notes=[note(48,0,480)];p.channels=[a,b,muted,empty];const saved=structuredClone(p);
 const stems=await render(p,'stems');assert.deepEqual(p,saved);assert.deepEqual(stems.stems.map(s=>s.name),['Lead','Counter']);
 assert.equal(stems.gapBars,1);assert.equal(stems.spacingBars,2);assert.equal(stems.stems[0].startFrame,10*44100);assert.equal(stems.stems[1].startFrame,16*44100);assert.equal(stems.intro.bars,4);
 for(let i=0;i<2;i++){
  const solo=await render({...p,channels:[p.channels[i]]});
  sameAudio(pcm(stems.buffer).slice(stems.stems[i].startFrame*4,(stems.stems[i].startFrame+stems.stems[i].frames)*4),pcm(solo.buffer));
 }
 assert.ok(pcm(stems.buffer).slice(14*44100*4,16*44100*4).every(v=>v===0),'one full bar is exactly silent');
 assert.ok(pcm(stems.buffer).slice(16*44100*4,17.49*44100*4).every(v=>v===0),'counter-melody keeps its leading rest');
 const info=inspectWav(stems.buffer);assert.equal(info.frames,stems.stems[1].startFrame+stems.stems[1].frames);
});

test('long release and delay tails finish before the gap, with no bleed into the next stem',async()=>{
 const p=newProject();p.bpm=137;p.bars=1;p.channels=[channel(),channel(1)];
 p.channels[0].adsr={...p.channels[0].adsr,enabled:true,a:0,d:0,s:1,r:3};
 p.channels[0].notes=[note(60,1440,480)];p.channels[1].notes=[note(72,0,120)];
 p.delay={...p.delay,enabled:true,time:16,input:.6,feedback:0};
 const result=await render(p,'stems'),bar=44100*240/137;
 assert.ok(result.spacingBars>1);assert.equal(result.stems[1].startFrame,result.stems[0].startFrame+Math.round((result.spacingBars+1)*bar));
 const end=result.stems[0].startFrame+result.stems[0].frames,next=result.stems[1].startFrame;
 assert.ok(next-end>=Math.floor(bar));assert.ok(pcm(result.buffer).slice(end*4,next*4).every(v=>v===0));
 const single=await render({...p,channels:[p.channels[1]]});sameAudio(pcm(result.buffer).slice(next*4),pcm(single.buffer));
});

test('stems honor solo, ignore slide-only channels, and reject an empty export',async()=>{
 const p=newProject();p.bars=1;p.channels=[channel(),channel(1),channel(2)];
 p.channels[0].notes=[note(60,0,240)];p.channels[1].solo=true;p.channels[1].notes=[note(72,240,240)];
 p.channels[2].solo=true;p.channels[2].notes=[{...note(80,0,480),slide:true}];
 const result=await render(p,'stems');assert.equal(result.stems.length,1);assert.equal(result.stems[0].id,p.channels[1].id);
 const single=await render({...p,channels:[p.channels[1]]});sameAudio(pcm(result.buffer).slice(result.stems[0].startFrame*4),pcm(single.buffer));
 p.channels[1].notes=[];await assert.rejects(render(p,'stems'),/Add notes/);
});

test('four-bar intro repeats short patterns and matches a standalone full mix',async()=>{
 const p=newProject();p.bpm=120;p.bars=1;p.channels=[channel(),channel(1)];
 p.channels[0].notes=[note(60,0,240)];p.channels[1].notes=[note(67,960,240)];
 const result=await render(p,'stems'),expanded=structuredClone(p);expanded.bars=4;
 for(const c of expanded.channels)c.notes=[0,1920,3840,5760].flatMap(offset=>c.notes.map(n=>({...n,start:n.start+offset})));
 const mix=await render(expanded);sameAudio(pcm(result.buffer).slice(0,result.intro.frames*4),pcm(mix.buffer));
 assert.equal(result.stems[0].startFrame,10*44100);assert.ok(pcm(result.buffer).slice(8*44100*4,10*44100*4).every(v=>v===0));
 assert.equal(result.stems[1].startFrame,14*44100);
});
