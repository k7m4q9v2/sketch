import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {quantizeTaps,generateMelody,shiftMelody,scalePitches,contourAt} from '../site/melody.js';
import {TapRecorder,tapClock} from '../site/tap-recorder.js';
import {newProject,channel} from '../site/model.js';
import {renderAudio} from '../site/render-audio.js';

test('tap quantization preserves performed onsets, leading rests and triplets without inventing rhythm',()=>{
 assert.deepEqual(quantizeTaps([.502,1.003,1.497],120,2),{grid:480,ticks:[480,960,1440]});
 assert.deepEqual(quantizeTaps([0,.167,.333,.5],120,1),{grid:160,ticks:[0,160,320,480]});
 assert.deepEqual(quantizeTaps([],120,4).ticks,[]);
 assert.deepEqual(quantizeTaps([-.2,0,0,4,NaN],120,1).ticks,[0]);
 assert.throws(()=>quantizeTaps([0],0,4),/Invalid/);
});
test('contour produces rising/falling in-key MIDI and regenerate never changes tapped rhythm',()=>{
 const points=[{x:0,y:.9},{x:.5,y:.1},{x:1,y:.9}],ticks=[0,480,960,1920,2880,3600];
 const options={points,ticks,bars:2,root:2,mode:'Minor'};const first=generateMelody(options),second=generateMelody({...options,variant:2});
 assert.ok(first.every(n=>scalePitches(2,'Minor').includes(n.pitch)));
 assert.ok(first[0].pitch<first[3].pitch);assert.ok(first.at(-1).pitch<first[3].pitch);
 assert.deepEqual(first.map(n=>[n.start,n.duration,n.velocity]),second.map(n=>[n.start,n.duration,n.velocity]));
 assert.notDeepEqual(first.map(n=>n.pitch),second.map(n=>n.pitch));
 assert.ok(first.every(n=>n.duration>0&&n.start+n.duration<=3840));
 assert.deepEqual(ticks,[0,480,960,1920,2880,3600]);assert.throws(()=>generateMelody({...options,points:[]}),/Draw/);
});
test('range moves preserve the key and octave controls preserve all relative timing and intervals',()=>{
 const notes=generateMelody({points:[{x:0,y:.8},{x:1,y:.2}],ticks:[0,480,960],bars:1,root:1});
 const moved=shiftMelody(notes,1,1,'Major'),octave=shiftMelody(notes,7,1,'Major');
 assert.ok(moved.every(n=>scalePitches(1).includes(n.pitch)));assert.deepEqual(octave.map(n=>n.pitch),notes.map(n=>n.pitch+12));
 assert.deepEqual(octave.map(n=>[n.start,n.duration]),notes.map(n=>[n.start,n.duration]));assert.equal(shiftMelody(notes,100,1,'Major'),null);
 assert.equal(contourAt([{x:1,y:.2},{x:0,y:.8}],.5),.5);
});
test('four scheduled count-in beats precede capture; metronome continues and cleanup cancels nodes',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const clicks=[],stopped=[];let result,status;
 const ctx={currentTime:0,state:'running',destination:{},createOscillator(){return{frequency:{},connect(){},disconnect(){},start(at){clicks.push(at);},stop(at){if(at===undefined)stopped.push(1);}};},createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 const recorder=new TapRecorder(ctx,{bpm:120,bars:1,status:s=>status=s,done:r=>result=r});recorder.start();assert.equal(status,'4');assert.equal(recorder.tap(),null);
 for(let i=1;i<=80;i++){ctx.currentTime=i*.025;t.mock.timers.tick(25);}assert.deepEqual(clicks.slice(0,4),[.15,.65,1.15,1.65]);assert.equal(result,undefined);
 ctx.currentTime=2.15;assert.equal(recorder.tap(),0);ctx.currentTime=2.65;recorder.tap();
 ctx.currentTime=4.2;t.mock.timers.tick(25);assert.deepEqual(result.ticks,[0,480]);assert.ok(clicks.length>4);assert.equal(recorder.running,false);assert.ok(stopped.length>0);assert.equal(recorder.tap(),null);
});
test('tap capture follows the audible clock; disabling metronome retains the four-beat count-in',t=>{
 assert.equal(tapClock(null),0);
 assert.ok(Math.abs(tapClock({currentTime:10,getOutputTimestamp:()=>({contextTime:9.8,performanceTime:100})},150)-9.85)<1e-9);
 t.mock.timers.enable({apis:['setTimeout']});let clicks=0;
 const ctx={currentTime:0,state:'running',destination:{},createOscillator:()=>({frequency:{},connect(){},disconnect(){},start(){clicks++;},stop(){}}),createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}})};
 const r=new TapRecorder(ctx,{bpm:120,bars:1,metronome:false,status(){},done(){}});r.start();ctx.currentTime=3;t.mock.timers.tick(25);assert.equal(clicks,4);r.cancel();ctx.currentTime=5;t.mock.timers.tick(200);assert.equal(clicks,4);
});
test('generated melody renders actual SoundFont PCM through the production export engine',async()=>{
 const p=newProject();p.bars=1;p.channels=[channel()];p.channels[0].notes=generateMelody({points:[{x:0,y:.8},{x:1,y:.2}],ticks:[0,480,960],bars:1});
 const wasm=await readFile(new URL('../site/lumafont.wasm',import.meta.url)),font=await readFile(new URL('./fixtures/starter.sf2',import.meta.url));
 const {buffer}=await renderAudio({project:p,fonts:[{id:'factory',buffer:font}]},wasm);const data=new Int16Array(buffer,44);assert.ok(data.some(v=>Math.abs(v)>100));
});
