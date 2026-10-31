import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {BUNDLED_FONTS} from '../site/bundled-fonts.js';
import {createFontLoader} from '../site/font-cache.js';
import {downloadFont} from '../site/font-library.js';
import {subsetFont} from '../site/sf2-subset.js';
import {LumaEngine} from '../site/synth-core.js';
import {newProject,channel} from '../site/model.js';

test('selected bank downloads once, concurrent play shares it, and a restored bank works offline',async()=>{
 const [a,b]=BUNDLED_FONTS,fonts=new Map([[a.id,{...a}],[b.id,{...b}]]),saved=new Map(),requests=[];
 const blob=new Blob(['cached sample data']);
 const load=createFontLoader(fonts,{save:async f=>saved.set(f.id,structuredClone(f)),download:async f=>{requests.push(f.id);await Promise.resolve();return blob;}});
 assert.deepEqual(requests,[],'listing the catalog must not fetch any bank');
 const results=await Promise.all([load(b.id),load(b.id),load(b.id)]);
 assert.ok(results.every(result=>result===blob));
 assert.deepEqual(requests,[b.id]);
 assert.equal(await load(b.id),blob);
 assert.equal(saved.size,1);
 assert.ok(!saved.has(a.id),'unselected bank stays undownloaded');
 const restored=new Map([...saved].map(([id,f])=>[id,structuredClone(f)]));
 const offline=createFontLoader(restored,{save:()=>assert.fail('must already be saved'),download:()=>assert.fail('no network after restore')});
 assert.equal(await (await offline(b.id)).text(),'cached sample data');
});

test('failed downloads and saves can be retried without marking a bank as cached',async()=>{
 const source=BUNDLED_FONTS[0],font={...source},fonts=new Map([[font.id,font]]);
 let downloads=0,saves=0;
 const load=createFontLoader(fonts,{download:async()=>{if(++downloads===1)throw Error('offline');return new Blob(['sound']);},save:async()=>{if(++saves===1)throw Error('storage full');}});
 await assert.rejects(load(font.id),/offline/);
 await assert.rejects(load(font.id),/storage full/);
 assert.equal(font.blob,undefined);
 assert.equal(await (await load(font.id)).text(),'sound');
 assert.equal(downloads,3);
 assert.equal(saves,2);
});

test('downloads route to the selected bank and reject swapped or truncated audio',async t=>{
 const bank=BUNDLED_FONTS.find(f=>f.file==='pokemon-hgss.sf2');
 const bytes=await readFile(new URL('../site/'+bank.file,import.meta.url));
 let calls=0;
 t.mock.method(globalThis,'fetch',async url=>{
  calls++;
  assert.equal(new URL(url).pathname.split('/').at(-1),bank.file);
  return new Response(bytes);
 });
 assert.equal((await downloadFont(bank)).size,bank.size);
 assert.equal(calls,1);
 const swapped=Uint8Array.from(bytes);swapped[swapped.length-1]^=1;
 t.mock.method(globalThis,'fetch',async()=>new Response(swapped));
 await assert.rejects(downloadFont(bank),/incomplete/);
 t.mock.method(globalThis,'fetch',async()=>new Response(bytes.subarray(0,100)));
 await assert.rejects(downloadFont(bank),/incomplete/);
});

const wasm=await readFile(new URL('../site/lumafont.wasm',import.meta.url));
for(const bank of BUNDLED_FONTS){
 test(bank.name+' plays in the actual SoundFont engine',async()=>{
  const blob=await openAsBlob(new URL('../site/'+bank.file,import.meta.url));
  const preset=bank.presets[0],compact=await subsetFont(blob,[preset]);
  const engine=await LumaEngine.create(wasm,44100);
  const presets=engine.load(bank.id,await compact.arrayBuffer());
  assert.ok(presets.some(p=>p.bank===preset.bank&&p.program===preset.program));
  const project=newProject();project.channels.push({...channel(),fontId:bank.id,bank:preset.bank,program:preset.program});
  engine.configure(project);engine.api.note_on(0,60,1);
  let energy=0;
  for(let block=0;block<172;block++)for(const sample of engine.render(128)){assert.ok(Number.isFinite(sample));energy+=sample*sample;}
  assert.ok(energy>1e-6,'first instrument must produce non-silent audio');
  engine.unload(bank.id);
 });
}
