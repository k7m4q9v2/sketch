import test from 'node:test';
import assert from 'node:assert/strict';
import {audiblePosition} from '../site/audio-timing.js';

test('playhead follows audible output time rather than the worklet render head',()=>{
 const context={currentTime:10,baseLatency:.02,outputLatency:.1,getOutputTimestamp:()=>({contextTime:9.75,performanceTime:900})};
 const message={tick:960,cycle:0,bpm:120,loopTicks:1920,contextTime:10,startTick:0};
 const result=audiblePosition(context,message,1000);
 assert.ok(Math.abs(result.tick-816)<1e-6);assert.equal(result.cycle,0);
 assert.equal(message.tick,960,'does not alter the render clock');
});
test('output clock wraps across loop boundaries and does not rewind a fresh seek',()=>{
 const context={currentTime:10,baseLatency:.05,outputLatency:.05};
 const message={tick:48,cycle:1,bpm:120,loopTicks:1920,contextTime:10,startTick:0};
 const result=audiblePosition(context,message,1000);assert.equal(result.cycle,0);assert.ok(Math.abs(result.tick-1872)<1e-6);
 const sought=audiblePosition(context,{...message,tick:960,cycle:0,startTick:960},1000);assert.equal(sought.tick,960);
});
test('stale or missing output timestamps use reported latency and older messages stay usable',()=>{
 const context={currentTime:10,baseLatency:.02,outputLatency:.03,getOutputTimestamp:()=>({contextTime:5,performanceTime:1})};
 const message={tick:960,cycle:0,bpm:120,loopTicks:1920,contextTime:10};
 assert.ok(Math.abs(audiblePosition(context,message,5000).tick-912)<1e-6);
 assert.equal(audiblePosition(context,{tick:40},5000).tick,40);
});
