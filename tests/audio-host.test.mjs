import test from 'node:test';import assert from 'node:assert/strict';
import {AudioHost} from '../site/audio.js';import {newProject,channel} from '../site/model.js';
test('rapid edits coalesce to one latest audio update and preview flush is immediate',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const host=new AudioHost(new Map(),()=>{}),messages=[];host.node={port:{postMessage:m=>messages.push(structuredClone(m))}};
 const p=newProject();for(let i=0;i<100;i++){p.bpm=100+i;host.update(p);}assert.equal(messages.length,0);t.mock.timers.tick(32);assert.equal(messages.length,1);assert.equal(messages[0].project.bpm,199);
 host.update(p);t.mock.timers.tick(32);assert.equal(messages.length,1);
 p.pitch.note=12;host.update(p);host.update(p,true);assert.equal(messages.length,2);assert.equal(messages[1].project.pitch.note,12);t.mock.timers.tick(32);assert.equal(messages.length,2);
});

function readyHost(getBlob=()=>assert.fail('unexpected font read')){
 const fonts=new Map([['one',{id:'one',size:100}],['two',{id:'two',size:100}]]),host=new AudioHost(fonts,getBlob),messages=[];
 host.context={state:'running',resume:()=>assert.fail('running context must not be resumed per note')};host.ready=true;host.initializing=Promise.resolve();
 host.node={port:{postMessage:m=>messages.push(structuredClone(m))}};
 host.request=async(type,data)=>{messages.push({type,...data});return[];};
 const project=newProject();project.channels.push({...channel(),fontId:'one'},{...channel(1),fontId:'two'});
 return{host,project,messages};
}
test('transport sends the requested start tick after loading and clears preview tokens',async()=>{
 const {host,project,messages}=readyHost();for(const id of ['one','two']){host.loaded.add(id);host.signatures.set(id,'*');}
 host.previewTokens.set('old',{});await host.start(project,1440);assert.deepEqual(messages.at(-1),{type:'start',tick:1440});assert.equal(host.previewTokens.size,0);
});
test('closed or failed audio reconnects and reloads the saved SoundFont on the very first note',async t=>{
 const previous=globalThis.AudioContext;t.after(()=>globalThis.AudioContext=previous);
 globalThis.AudioContext=class{constructor(){this.state='suspended';}async resume(){this.state='running';}async close(){this.state='closed';}};
 for(const broken of [false,true]){let reads=0,inits=0,disconnects=0;const messages=[],host=new AudioHost(new Map(),async()=>{reads++;return new Blob(['sample data']);});
  host.context={state:broken?'running':'closed',close:async()=>{}};host.node={disconnect(){disconnects++;},port:{}};host.broken=broken;host.loaded.add('factory');host.ready=true;
  host.initialize=async()=>{inits++;host.node={disconnect(){},port:{postMessage:m=>messages.push(m)}};};host.request=async(type,data)=>{messages.push({type,...data});};
  const p=newProject();p.channels=[channel()];await host.preview(p,0,60,'first');assert.equal(reads,1);assert.equal(inits,1);assert.equal(disconnects,1);assert.ok(messages.some(m=>m.type==='previewOn'&&m.id==='first'));host.reset();await host.start(p);assert.equal(reads,2);assert.equal(inits,2);assert.ok(messages.some(m=>m.type==='start'));host.reset();
 }
});
test('warm preview is dispatched synchronously without waiting for unrelated channel banks',async()=>{
 const {host,project,messages}=readyHost();host.loaded.add('one');host.signatures.set('one','*');
 const finished=host.preview(project,0,60,'touch');
 assert.ok(messages.some(m=>m.type==='previewOn'&&m.id==='touch'),'no asynchronous work before a warm note');
 assert.ok(!messages.some(m=>m.type==='load'));
 await finished;
});
test('cold preview loads only its bank; full transport preparation still loads every channel',async()=>{
 const reads=[],{host,project,messages}=readyHost(async id=>{reads.push(id);return new Blob(['samples']);});
 await host.preview(project,1,64,'touch');
 assert.deepEqual(reads,['two']);assert.equal(messages.filter(m=>m.type==='previewOn').length,1);
 await host.ensure(project);
 assert.deepEqual(reads,['two','one']);
});
test('releasing or stopping during loading prevents late ghost previews',async()=>{
 for(const cancel of ['off','stop']){
  let release;const pending=new Promise(resolve=>release=resolve),{host,project,messages}=readyHost(()=>pending);
  const preview=host.preview(project,0,60,'old-touch');
  if(cancel==='off')host.off('old-touch');else host.stop();
  release(new Blob(['samples']));await preview;
  assert.ok(!messages.some(m=>m.type==='previewOn'));
 }
});
test('instrument changes during preparation cannot audition the previous instrument later',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),{host,project,messages}=readyHost(()=>pending);
 const preview=host.preview(project,0,60,'old-instrument');project.channels[0].program=1;
 release(new Blob(['samples']));await preview;
 assert.ok(!messages.some(m=>m.type==='previewOn'));
});
test('resuming interrupted audio retains the existing engine, banks and transport position',async()=>{
 const {host,messages}=readyHost();host.loaded.add('one');const node=host.node;let resumes=0;
 host.context={state:'interrupted',resume:async()=>{resumes++;host.context.state='running';}};
 await host.resume();assert.equal(resumes,1);assert.equal(host.node,node);assert.ok(host.loaded.has('one'));
 assert.deepEqual(messages,[],'resume must not stop, restart or replace the sequencer');
 await host.resume();assert.equal(resumes,1);
});
