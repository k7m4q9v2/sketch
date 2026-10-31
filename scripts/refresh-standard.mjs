import {readFile,writeFile} from 'node:fs/promises';
import {inspectFont,fontId} from '../site/font-library.js';
import {STANDARD_FONT} from '../site/standard-font.js';
const blob=new Blob([await readFile(new URL('../site/GeneralUser-GS.sf2',import.meta.url))]);
if(await fontId(blob)!==STANDARD_FONT.id)throw Error('Unexpected standard bank.');
const {presets,sampleBytes}=await inspectFont(blob);
presets.sort((a,b)=>a.bank-b.bank||a.program-b.program);
await writeFile(new URL('../site/standard-font.js',import.meta.url),'// GeneralUser GS SoftSynth v1.44 by S. Christian Collins. See GeneralUser-LICENSE.txt.\nexport const STANDARD_FONT='+JSON.stringify({...STANDARD_FONT,presets,sampleBytes})+';\n');
console.log(`Regenerated ${presets.length} preset names from SF2 headers.`);
