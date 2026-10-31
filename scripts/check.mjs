import {readFile,readdir,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {openAsBlob} from 'node:fs';
import {BUNDLED_FONTS} from '../site/bundled-fonts.js';
import {fontId,inspectFont} from '../site/font-library.js';
const root=path.resolve(import.meta.dirname,'../site');
let count=0;
for(const name of await readdir(root)){
 const file=path.join(root,name);assert.ok((await stat(file)).isFile(),'Only public files may be published.');
 assert.ok(!/^(account|server|worker|\.env|hosting)/.test(name),'Server/private configuration is not part of Pages.');
 if(!/\.(js|html|webmanifest)$/.test(name))continue;
 const source=await readFile(file,'utf8');
 assert.ok(!/api\/(?:account|fonts|projects|community|standard-font)|oai-authenticated-user-id/.test(source),`${name}: server dependency remains`);
 if(name.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))await stat(path.resolve(root,match[1]));
 }
 count++;
}
assert.equal(new Set(BUNDLED_FONTS.map(f=>f.id)).size,BUNDLED_FONTS.length,'Duplicate bundled banks');
assert.equal(new Set(BUNDLED_FONTS.map(f=>f.file)).size,BUNDLED_FONTS.length,'Duplicate bank paths');
for(const font of BUNDLED_FONTS){
 assert.match(font.file,/^[a-zA-Z0-9._-]+\.sf2$/);
 const blob=await openAsBlob(path.join(root,font.file));
 assert.equal(blob.size,font.size,font.name+': size mismatch');
 assert.equal(await fontId(blob),font.id,font.name+': content mismatch');
 const metadata=await inspectFont(blob);
 metadata.presets.sort((a,b)=>a.bank-b.bank||a.program-b.program);
 assert.deepEqual(metadata.presets,font.presets,font.name+': preset mismatch');
 assert.equal(metadata.sampleBytes,font.sampleBytes);
}
const html=await readFile(path.join(root,'index.html'),'utf8');
assert.ok(!/id="(?:account-button|shared-fonts|font-library-tabs)"/.test(html));
const sw=await readFile(path.join(root,'sw.js'),'utf8');
for(const [,name]of sw.matchAll(/'\.\/([^']+)'/g)){
 assert.ok(!/\.sf2$/i.test(name),'SoundFont audio must not be downloaded at app installation.');
 await stat(path.join(root,name));
}
console.log(`Static deployment checked: ${count} source files; ${BUNDLED_FONTS.length} verified banks; no account or upload API dependency.`);
