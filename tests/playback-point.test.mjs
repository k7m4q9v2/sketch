import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackPoint} from '../site/playback-point.js';
import {newProject,channel,note} from '../site/model.js';
import {AudioHost} from '../site/audio.js';

test('ruler point remains the start for repeated Play/Stop while the playhead advances',async()=>{
 const p=newProject();p.channels=[channel()];p.channels[0].notes=[note(60,0,480)];
 const point=new PlaybackPoint(),host=new AudioHost(new Map(),()=>{}),messages=[];
 host.prepare=async()=>{};host.node={port:{postMessage:m=>messages.push(m)}};
 point.set(p,1920);
 for(let i=0;i<3;i++){await host.start(p,point.get(p));host.stop();}
 assert.deepEqual(messages.filter(m=>m.type==='start').map(m=>m.tick),[1920,1920,1920]);
 assert.equal(point.get(p),1920);
 point.set(p,2880);assert.equal(point.get(p),2880);
 point.set(p,0);await host.start(p,point.get(p));assert.equal(messages.at(-1).tick,0);
});

test('switching channels keeps the point; changing project or removing its bar resets it',()=>{
 const point=new PlaybackPoint(),p=newProject();p.bars=4;
 point.set(p,5760);p.channels.push(channel());assert.equal(point.get(p),5760);
 p.bars=8;assert.equal(point.get(p),5760);p.bars=1;assert.equal(point.get(p),0);
 point.set(p,960);assert.equal(point.get(newProject()),0);
});

test('ruler points stay inside the loop and never modify saved MIDI',()=>{
 const point=new PlaybackPoint(),p=newProject(),original=structuredClone(p);
 assert.equal(point.set(p,-1),0);assert.equal(point.set(p,Infinity),0);
 assert.equal(point.set(p,999999),p.bars*1920-1);assert.deepEqual(p,original);
});
