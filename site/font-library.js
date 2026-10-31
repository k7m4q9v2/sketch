import {readSf2Name} from './sf2-name.js';
export const MAX_FONT_BYTES=4*1024*1024*1024, PART_SIZE=8*1024*1024;
const ascii=b=>String.fromCharCode(...b);
const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
// Read only chunk headers and preset tables. Large sample payloads stay in Blob storage.
export async function inspectFont(blob){
 if(blob.size<12||blob.size>MAX_FONT_BYTES)throw Error('Choose an SF2 up to 4 GB.');
 const read=async(at,n)=>new Uint8Array(await blob.slice(at,at+n).arrayBuffer());
 const header=await read(0,12),view=new DataView(header.buffer);
 if(ascii(header.slice(0,4))!=='RIFF'||ascii(header.slice(8,12))!=='sfbk')throw Error('Not a valid SF2 file.');
 const end=view.getUint32(4,true)+8;if(end>blob.size||end<12)throw Error('The SF2 file is truncated.');
 const chunks=new Map();let count=0;
 async function walk(a,b,list='',depth=0){if(depth>4)throw Error('Invalid SF2 nesting.');while(a<b){if(++count>20000||a+8>b)throw Error('Invalid SF2 chunks.');const h=await read(a,8),v=new DataView(h.buffer),id=ascii(h.slice(0,4)),size=v.getUint32(4,true),next=a+8+size+(size&1);if(next>b)throw Error('Invalid SF2 chunk bounds.');if(id==='LIST'){if(size<4)throw Error('Invalid SF2 list.');await walk(a+12,a+8+size,ascii(await read(a+8,4)),depth+1);}else chunks.set(list+'/'+id,{at:a+8,size});a=next;}}
 await walk(12,end);
 const samples=chunks.get('sdta/smpl');if(!samples||samples.size<2||samples.size%2)throw Error('The SF2 has no valid PCM samples.');
 for(const [id,stride]of Object.entries({phdr:38,pbag:4,pmod:10,pgen:4,inst:22,ibag:4,imod:10,igen:4,shdr:46})){const c=chunks.get('pdta/'+id);if(!c||c.size<stride||c.size%stride||c.size>8*1024*1024)throw Error(`Invalid SF2 ${id} table.`);}
 const table=chunks.get('pdta/phdr'),bytes=await read(table.at,table.size),v=new DataView(bytes.buffer),presets=[];
 for(let at=0;at<bytes.length-38;at+=38){const name=readSf2Name(bytes.subarray(at,at+20));presets.push({name,program:v.getUint16(at+20,true),bank:v.getUint16(at+22,true)});}
 if(!presets.length)throw Error('The SF2 contains no presets.');
 return {presets,sampleBytes:samples.size,chunks};
}
// Bounded-memory content identity: retain legacy SHA-256 IDs for small banks.
export async function fontId(blob){if(blob.size<=64*1024*1024)return hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));const hashes=[];for(let at=0;at<blob.size;at+=PART_SIZE)hashes.push(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.slice(at,at+PART_SIZE).arrayBuffer())));const data=new Uint8Array(hashes.length*32+8);new DataView(data.buffer).setBigUint64(0,BigInt(blob.size));hashes.forEach((h,i)=>data.set(h,8+i*32));return hex(await crypto.subtle.digest('SHA-256',data));}
export function fontBlob(font){return font.blob??(font.buffer?new Blob([font.buffer]):null);}
// The bundled GM bank is served by the same static site. Imported banks stay on this device.
export async function downloadFont(font){
 if(!font.bundled)throw Error('Load the original SF2 file to restore this sound.');
 const response=await fetch(new URL('./GeneralUser-GS.sf2',import.meta.url));
 if(!response.ok)throw Error('Could not load the piano bank. Connect to the internet and try again.');
 const blob=await response.blob();
 if(blob.size!==font.size||await fontId(blob)!==font.id)throw Error('The SoundFont download was incomplete. Try again.');
 return blob;
}
