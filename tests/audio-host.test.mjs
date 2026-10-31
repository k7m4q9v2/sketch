import test from 'node:test';import assert from 'node:assert/strict';
import {AudioHost} from '../site/audio.js';import {newProject} from '../site/model.js';
test('rapid edits coalesce to one latest audio update and preview flush is immediate',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const host=new AudioHost(new Map(),()=>{}),messages=[];host.node={port:{postMessage:m=>messages.push(structuredClone(m))}};
 const p=newProject();for(let i=0;i<100;i++){p.bpm=100+i;host.update(p);}assert.equal(messages.length,0);t.mock.timers.tick(32);assert.equal(messages.length,1);assert.equal(messages[0].project.bpm,199);
 host.update(p);t.mock.timers.tick(32);assert.equal(messages.length,1);
 p.pitch.note=12;host.update(p);host.update(p,true);assert.equal(messages.length,2);assert.equal(messages[1].project.pitch.note,12);t.mock.timers.tick(32);assert.equal(messages.length,2);
});
