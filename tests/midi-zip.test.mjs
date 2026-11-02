import test from 'node:test';
import assert from 'node:assert/strict';
import {midiZipBytes,midiBytes} from '../site/export.js';
import {newProject,channel,note} from '../site/model.js';
test('ZIP contains independent MIDI parts including muted parts, with rests and unique UTF-8 names',()=>{
 const p=newProject();const a=channel(),b=channel(),empty=channel();
 a.name=b.name='Piano / 音';a.notes=[note(60,480,240)];b.notes=[note(72,960,480)];b.mute=true;p.channels=[a,empty,b];
 const zip=midiZipBytes(p),v=new DataView(zip.buffer);let at=0;const names=[];
 for(const c of [a,b]){
  assert.equal(v.getUint32(at,true),0x04034b50);assert.equal(v.getUint16(at+6,true),0x800);
  const length=v.getUint32(at+18,true),n=v.getUint16(at+26,true);names.push(new TextDecoder().decode(zip.slice(at+30,at+30+n)));
  const data=zip.slice(at+30+n,at+30+n+length);
  assert.deepEqual(data,midiBytes({...p,channels:[{...c,mute:false,solo:false}]}));at+=30+n+length;
 }
 assert.deepEqual(names,['01 - Piano _ 音.mid','02 - Piano _ 音.mid']);
 assert.equal(v.getUint32(at,true),0x02014b50);assert.equal(v.getUint16(zip.length-12,true),2);
 assert.equal(v.getUint32(zip.length-6,true),at);
});
test('empty MIDI export gives an actionable error',()=>assert.throws(()=>midiZipBytes(newProject()),/No MIDI notes/));
