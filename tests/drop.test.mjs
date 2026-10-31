import test from 'node:test';import assert from 'node:assert/strict';
import {droppedSoundFonts} from '../site/file-drop.js';
const file=name=>({isFile:true,name,file:callback=>callback({name})});
const folder=batches=>({isDirectory:true,createReader(){let at=0;return{readEntries:callback=>callback(batches[at++]||[])};}});
test('folder drop reads every directory batch and nested SF2, ignoring unrelated files',async()=>{
 let readable=true;
 const root=folder([[file('a.sf2'),file('notes.txt')],[folder([[file('b.SF2')]])]]);
 const transfer={items:[{kind:'file',webkitGetAsEntry(){assert.ok(readable);return root;}}]};
 const pending=droppedSoundFonts(transfer);readable=false;
 assert.deepEqual((await pending).map(f=>f.name),['a.sf2','b.SF2']);
});
test('file drops fall back without directory APIs and surface directory read failures',async()=>{
 assert.deepEqual(await droppedSoundFonts({files:[{name:'a.sf2'},{name:'ignore.wav'}]}),[{name:'a.sf2'}]);
 const entry={isDirectory:true,createReader:()=>({readEntries:(_,reject)=>reject(Error('Folder unavailable'))})};
 await assert.rejects(droppedSoundFonts({items:[{kind:'file',getAsEntry:()=>entry}]}),/Folder unavailable/);
});
