import {readFile,readdir,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
const sf=await readFile(path.join(root,'GeneralUser-GS.sf2'));
assert.equal(createHash('sha256').update(sf).digest('hex'),'00725296486f652ba42bdbf2098254762ca80239353d04b55a27454fc8edb8a8');
const html=await readFile(path.join(root,'index.html'),'utf8');
assert.ok(!/id="(?:account-button|shared-fonts|font-library-tabs)"/.test(html));
const sw=await readFile(path.join(root,'sw.js'),'utf8');
for(const [,name]of sw.matchAll(/'\.\/([^']+)'/g))await stat(path.join(root,name));
console.log(`Static deployment checked: ${count} source files; verified GM bank; no account or upload API dependency.`);
