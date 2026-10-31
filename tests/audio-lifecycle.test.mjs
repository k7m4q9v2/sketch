import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAudioLifecycle} from '../site/audio-lifecycle.js';
test('Control Center visibility changes preserve playback intent; leaving the page stops it',async()=>{
 const page=new EventTarget(),win=new EventTarget();page.hidden=false;
 let playing=true,position=12345,resumes=0,saves=0,stops=0;
 const cleanup=bindAudioLifecycle({page,win,isPlaying:()=>playing,resume:async()=>{resumes++;},stop:()=>{stops++;playing=false;position=0;},save:async()=>{saves++;}});
 page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('focus'));
 assert.equal(stops,0);assert.equal(resumes,0);assert.equal(saves,1);assert.equal(position,12345);
 page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));
 assert.equal(resumes,1);assert.equal(position,12345);
 playing=false;win.dispatchEvent(new Event('focus'));assert.equal(resumes,1,'manual stop must not be undone');
 playing=true;win.dispatchEvent(new Event('pagehide'));assert.equal(stops,1);assert.equal(saves,2);
 win.dispatchEvent(new Event('pageshow'));assert.equal(resumes,1,'returning to a stopped page must not start it');
 cleanup();win.dispatchEvent(new Event('pagehide'));assert.equal(stops,1);
});
