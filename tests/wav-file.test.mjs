import test from 'node:test';
import assert from 'node:assert/strict';
import {wavHeader} from '../site/export.js';
import {inspectWav,wavFile} from '../site/wav-file.js';
test('the shared WAV file retains its PCM bytes, extension and content type',async()=>{
 const buffer=wavHeader(44100,44100),view=new DataView(buffer);view.setInt16(44,12345,true);view.setInt16(46,-12345,true);
 const file=wavFile(buffer,'Sketch 日本語.wav');
 assert.equal(file.name,'Sketch 日本語.wav');assert.equal(file.type,'audio/wav');
 const saved=await file.arrayBuffer();assert.deepEqual(new Uint8Array(saved),new Uint8Array(buffer));
 assert.deepEqual(inspectWav(saved),{rate:44100,channels:2,bits:16,frames:44100,duration:1,offset:44});
});
test('incomplete or inconsistent audio is rejected before sharing',()=>{
 const good=wavHeader(128,44100);
 for(const buffer of [good.slice(0,0),good.slice(0,-2),new TextEncoder().encode('<html>Error</html>').buffer])assert.throws(()=>wavFile(buffer,'test.wav'));
 for(const [offset,value,bytes]of [[4,0,4],[20,3,2],[24,0,4],[28,44100,4],[32,2,2],[40,4,4]]){
  const copy=good.slice(0),view=new DataView(copy);bytes===2?view.setUint16(offset,value,true):view.setUint32(offset,value,true);
  assert.throws(()=>wavFile(copy,'test.wav'));
 }
});
