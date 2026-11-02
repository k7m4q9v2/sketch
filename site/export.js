import {PPQ,activeChannels} from './model.js';
const text=s=>Array.from(new TextEncoder().encode(s));
const be=(n,size)=>Array.from({length:size},(_,i)=>(n>>>((size-i-1)*8))&255);
function vlq(n){n=Math.round(n);const a=[n&127];while(n>>=7)a.unshift((n&127)|128);return a;}
const chunk=(name,data)=>[...text(name),...be(data.length,4),...data];
function track(events,end){events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let prev=0;const data=[];for(const e of events){data.push(...vlq(e.tick-prev),...e.bytes);prev=e.tick;}data.push(...vlq(Math.max(0,end-prev)),255,47,0);return chunk('MTrk',data);}
export function midiBytes(p){const loopEnd=p.bars*4*PPQ;let end=0;for(const c of activeChannels(p))for(const n of c.notes)if(!n.slide&&n.start<loopEnd)end=Math.max(end,Math.min(loopEnd,n.start+n.duration));const tempo=Math.round(60000000/p.bpm);const title=text(p.name);const tracks=[track([{tick:0,order:0,bytes:[255,3,...vlq(title.length),...title]},{tick:0,order:1,bytes:[255,81,3,...be(tempo,3)]},{tick:0,order:2,bytes:[255,88,4,4,2,24,8]}],end)];const audible=new Set(activeChannels(p).map(c=>c.id));p.channels.forEach((c,ch)=>{const name=text(c.name),font=text(`SoundFont=${c.fontId}; bank=${c.bank}; preset=${c.program}`);const events=[{tick:0,order:0,bytes:[255,3,...vlq(name.length),...name]},{tick:0,order:0,bytes:[255,1,...vlq(font.length),...font]},{tick:0,order:0,bytes:[176+ch,0,(c.bank>>7)&127]},{tick:0,order:1,bytes:[176+ch,32,c.bank&127]},{tick:0,order:2,bytes:[192+ch,c.program]},{tick:0,order:3,bytes:[176+ch,7,Math.round(c.volume*127)]},{tick:0,order:4,bytes:[176+ch,10,Math.round((c.pan+1)*63.5)]}];const cents=(p.pitch?.cents??0)+(c.cents??0),extra=Math.trunc(cents/100),coarse=64+(p.pitch?.note??0)+extra,fine=Math.max(0,Math.min(16383,Math.round(8192+(cents-extra*100)/100*8192)));for(const [cc,value]of [[101,0],[100,2],[6,coarse],[101,0],[100,1],[6,fine>>7],[38,fine&127],[101,127],[100,127]])events.push({tick:0,order:5,bytes:[176+ch,cc,value]});if(audible.has(c.id))for(const n of c.notes){if(n.slide||n.start>=end)continue;events.push({tick:n.start,order:10,bytes:[144+ch,n.pitch,n.velocity]},{tick:Math.min(end,n.start+n.duration),order:9,bytes:[128+ch,n.pitch,0]});}tracks.push(track(events,end));});const header=chunk('MThd',[0,1,...be(tracks.length,2),...be(PPQ,2)]),bytes=new Uint8Array(header.length+tracks.reduce((n,t)=>n+t.length,0));bytes.set(header);let at=header.length;for(const t of tracks){bytes.set(t,at);at+=t.length;}return bytes;}
export function wavHeader(frames,rate){const b=new ArrayBuffer(44+frames*4),v=new DataView(b);const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,36+frames*4,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*4,true);return b;}

// Standard ZIP (stored entries): MIDI is small, so no compression dependency is needed.
export function midiZipBytes(project){
 const enc=new TextEncoder(),parts=[];
 for(const channel of project.channels){
  if(!channel.notes.some(n=>!n.slide&&n.start<project.bars*4*PPQ))continue;
  const label=(channel.name||'Part').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().slice(0,100)||'Part';
  parts.push({name:enc.encode(`${String(parts.length+1).padStart(2,'0')} - ${label}.mid`),data:midiBytes({...project,channels:[{...channel,mute:false,solo:false}]})});
 }
 if(!parts.length)throw new Error('No MIDI notes to export.');
 const chunks=[],central=[];let offset=0;
 const header=(size)=>{const b=new Uint8Array(size);return [b,new DataView(b.buffer)];};
 for(const {name,data} of parts){
  let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const [local,l]=header(30);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);
  const [dir,d]=header(46);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);
  chunks.push(local,name,data);central.push(dir,name);offset+=30+name.length+data.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0),[end,e]=header(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,parts.length,true);e.setUint16(10,parts.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 const result=new Uint8Array(offset+centralSize+22);let at=0;for(const b of [...chunks,...central,end]){result.set(b,at);at+=b.length;}return result;
}
