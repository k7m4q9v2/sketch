import test from 'node:test';
import assert from 'node:assert/strict';
import {TapRecorder} from '../site/tap-recorder.js';
import {generateMelody} from '../site/melody.js';
test('selected snap and held durations survive slow rhythm capture and regeneration',()=>{
 const ctx={currentTime:10};let result;const r=new TapRecorder(ctx,{bpm:60,bars:2,snapMode:'step',beatWidth:72,done:x=>result=x});Object.assign(r,{running:true,origin:10,end:18});
 r.tap();ctx.currentTime=10.09;r.release();ctx.currentTime=11.02;r.tap();ctx.currentTime=12.06;r.release();r.finish();
 assert.deepEqual(result.ticks,[0,480]);assert.deepEqual(result.durations,[120,480]);
 for(const variant of [0,1,2]){const notes=generateMelody({points:[{x:0,y:1.5},{x:1,y:-.5}],ticks:result.ticks,durations:result.durations,bars:2,variant});assert.deepEqual(notes.map(n=>n.duration),[120,480]);assert.ok(notes[0].pitch<48);}
});
test('no snap preserves short presses; an active hold is clipped at loop end',()=>{const ctx={currentTime:0};let result;const r=new TapRecorder(ctx,{bpm:60,bars:1,snapMode:'none',done:x=>result=x});Object.assign(r,{running:true,origin:0,end:4});r.tap();ctx.currentTime=.1;r.release();ctx.currentTime=3.5;r.tap();ctx.currentTime=5;r.finish();assert.deepEqual(result.durations,[48,240]);});
