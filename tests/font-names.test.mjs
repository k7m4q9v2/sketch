import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readSf2Name,cleanSf2Name} from '../site/sf2-name.js';
import {inspectFont} from '../site/font-library.js';
import {STANDARD_FONT} from '../site/standard-font.js';
import {validateProject,newProject,channel} from '../site/model.js';

test('SF2 names stop at the first NUL even when binary padding contains newlines',()=>{
 const field=new Uint8Array(20);field.set(new TextEncoder().encode('Viola'));field.set([0,32,84,48,13,255,1,48,49,54],5);
 assert.equal(readSf2Name(field),'Viola');
 assert.equal(cleanSf2Name('English Horn\0 ** \n�\x01'),'English Horn');
 assert.equal(readSf2Name(new TextEncoder().encode('ABCDEFGHIJKLMNOPQRST')),'ABCDEFGHIJKLMNOPQRST');
 assert.equal(readSf2Name(new TextEncoder().encode('Piano   \0junk')),'Piano');
});
test('all bundled GM preset names match the real SF2 headers without binary padding',async()=>{
 const bank=new Blob([await readFile(new URL('../site/GeneralUser-GS.sf2',import.meta.url))]);
 const {presets}=await inspectFont(bank);
 assert.equal(presets.length,275);
 const sorted=[...presets].sort((a,b)=>a.bank-b.bank||a.program-b.program);
 assert.deepEqual(STANDARD_FONT.presets,sorted);
 assert.ok(presets.every(p=>!/[\u0000-\u001f\ufffd]/.test(p.name)));
 assert.equal(presets.find(p=>p.bank===0&&p.program===41).name,'Viola');
 assert.equal(presets.find(p=>p.bank===0&&p.program===69).name,'English Horn');
});
test('restoring a saved project repairs old preset names and retains renamed channels',()=>{
 const p=newProject();const c=channel();p.channels.push(c);c.presetName='Viola\0 T0\r�';c.name='My strings';
 const restored=validateProject(p);assert.equal(restored.channels[0].presetName,'Viola');assert.equal(restored.channels[0].name,'My strings');
 c.name='Viola\0 T0\r�';assert.equal(validateProject(p).channels[0].name,'Viola');
});
