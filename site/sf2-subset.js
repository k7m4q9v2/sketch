import {inspectFont} from './font-library.js';
const tableCache=new WeakMap();
const bytes=s=>new TextEncoder().encode(s);
const uint32=n=>{const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n,true);return a;};
function chunk(id,data){return new Blob([bytes(id),uint32(data.size),data,...(data.size&1?[new Uint8Array(1)]:[])]);}
function list(type,parts){return chunk('LIST',new Blob([bytes(type),...parts]));}
async function tables(blob){if(!tableCache.has(blob))tableCache.set(blob,(async()=>{const {chunks}=await inspectFont(blob),result={chunks};for(const id of ['phdr','pbag','pmod','pgen','inst','ibag','imod','igen','shdr']){const c=chunks.get('pdta/'+id);result[id]=new Uint8Array(await blob.slice(c.at,c.at+c.size).arrayBuffer());}return result;})());return tableCache.get(blob);}
const view=a=>new DataView(a.buffer,a.byteOffset,a.byteLength);
// Keep the original TSF decoder. Feed it a valid, compact SF2 containing only the
// requested presets and their referenced samples; the original multi-GB Blob stays on disk.
export async function subsetFont(blob,requested){
 if(blob.size<=32*1024*1024)return blob;
 const t=await tables(blob),ph=view(t.phdr),pb=view(t.pbag),pg=view(t.pgen),ins=view(t.inst),ib=view(t.ibag),ig=view(t.igen),sh=view(t.shdr);
 const wanted=new Set(requested.map(p=>`${p.bank}:${p.program}`)),presets=[],instruments=new Set(),samples=new Set();
 for(let i=0;i<t.phdr.length/38-1;i++){if(!wanted.has(`${ph.getUint16(i*38+22,true)}:${ph.getUint16(i*38+20,true)}`))continue;presets.push(i);const first=ph.getUint16(i*38+24,true),end=ph.getUint16((i+1)*38+24,true);if(end>=t.pbag.length/4||first>end)throw Error('Invalid preset zones.');for(let b=first;b<end;b++){const from=pb.getUint16(b*4,true),to=pb.getUint16((b+1)*4,true);if(to>t.pgen.length/4||from>to)throw Error('Invalid preset generators.');for(let g=from;g<to;g++)if(pg.getUint16(g*4,true)===41)instruments.add(pg.getUint16(g*4+2,true));}}
 if(presets.length!==wanted.size)throw Error('This instrument is not available in the SoundFont.');
 for(const i of instruments){if(i>=t.inst.length/22-1)throw Error('Invalid instrument index.');const first=ins.getUint16(i*22+20,true),end=ins.getUint16((i+1)*22+20,true);if(end>=t.ibag.length/4||first>end)throw Error('Invalid instrument zones.');for(let b=first;b<end;b++){const from=ib.getUint16(b*4,true),to=ib.getUint16((b+1)*4,true);if(to>t.igen.length/4||from>to)throw Error('Invalid instrument generators.');for(let g=from;g<to;g++)if(ig.getUint16(g*4,true)===53)samples.add(ig.getUint16(g*4+2,true));}}
 for(const i of samples){if(i>=t.shdr.length/46-1)throw Error('Invalid sample index.');const type=sh.getUint16(i*46+44,true),link=sh.getUint16(i*46+42,true);if(type&0x8000)throw Error('ROM samples are not supported.');if((type&6)&&link<t.shdr.length/46-1)samples.add(link);}
 const sampleData=t.chunks.get('sdta/smpl'),headers=t.shdr.slice(),hv=view(headers),pieces=[];let frames=0;
 for(const i of [...samples].sort((a,b)=>a-b)){const start=sh.getUint32(i*46+20,true),end=sh.getUint32(i*46+24,true);if(end<=start||end*2>sampleData.size)throw Error('Invalid sample bounds.');const length=end-start;if((frames+length+46)*2>512*1024*1024)throw Error('The selected instruments need more audio memory than this device can safely load. Try fewer instruments from this bank.');pieces.push(blob.slice(sampleData.at+start*2,sampleData.at+end*2),new Uint8Array(92));for(const offset of [20,24,28,32]){const old=sh.getUint32(i*46+offset,true);hv.setUint32(i*46+offset,frames+Math.max(0,Math.min(length,old-start)),true);}frames+=length+46;}
 const outPh=[],outBag=[],outGen=[],outMod=[];let bagIndex=0,genIndex=0,modIndex=0;
 const bag=()=>{if(genIndex>65535||modIndex>65535)throw Error('Too many preset generators.');const a=new Uint8Array(4),v=view(a);v.setUint16(0,genIndex,true);v.setUint16(2,modIndex,true);outBag.push(a);bagIndex++;};
 for(const i of presets){const h=t.phdr.slice(i*38,(i+1)*38);view(h).setUint16(24,bagIndex,true);outPh.push(h);const from=ph.getUint16(i*38+24,true),to=ph.getUint16((i+1)*38+24,true);for(let b=from;b<to;b++){bag();const g1=pb.getUint16(b*4,true),g2=pb.getUint16((b+1)*4,true),m1=pb.getUint16(b*4+2,true),m2=pb.getUint16((b+1)*4+2,true);if(m1>m2||m2>t.pmod.length/10)throw Error('Invalid preset modulators.');outGen.push(t.pgen.slice(g1*4,g2*4));outMod.push(t.pmod.slice(m1*10,m2*10));genIndex+=g2-g1;modIndex+=m2-m1;}}
 const terminal=new Uint8Array(38);terminal.set(bytes('EOP'));view(terminal).setUint16(24,bagIndex,true);outPh.push(terminal);bag();outGen.push(new Uint8Array(4));outMod.push(new Uint8Array(10));
 const data={phdr:new Blob(outPh),pbag:new Blob(outBag),pmod:new Blob(outMod),pgen:new Blob(outGen),inst:new Blob([t.inst]),ibag:new Blob([t.ibag]),imod:new Blob([t.imod]),igen:new Blob([t.igen]),shdr:new Blob([headers])};
 const ifil=new Blob([new Uint8Array([2,0,1,0])]),info=list('INFO',[chunk('ifil',ifil)]),sdta=list('sdta',[chunk('smpl',new Blob(pieces))]),pdta=list('pdta',Object.entries(data).map(([id,data])=>chunk(id,data)));
 const body=new Blob([bytes('sfbk'),info,sdta,pdta]);return new Blob([bytes('RIFF'),uint32(body.size),body]);
}
export function requiredPresets(project,id){const keys=new Map();for(const c of project.channels)if(c.fontId===id)keys.set(`${c.bank}:${c.program}`,{bank:c.bank,program:c.program});return [...keys.values()].sort((a,b)=>a.bank-b.bank||a.program-b.program);}
