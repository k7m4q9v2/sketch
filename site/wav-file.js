// Validate the bytes being handed to Files / another app, not just render metadata.
export function inspectWav(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<44)throw Error('The audio file is incomplete. Export it again.');
 const view=new DataView(buffer),tag=at=>String.fromCharCode(...new Uint8Array(buffer,at,4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||view.getUint32(4,true)+8!==buffer.byteLength)throw Error('The audio file has an invalid WAV header.');
 let format,data;
 for(let at=12;at<buffer.byteLength;){
  if(at+8>buffer.byteLength)throw Error('The audio file is incomplete.');
  const size=view.getUint32(at+4,true),end=at+8+size;
  if(end+(size&1)>buffer.byteLength)throw Error('The audio file is incomplete.');
  if(tag(at)==='fmt '){
   if(format||size<16)throw Error('Invalid WAV format.');
   format={encoding:view.getUint16(at+8,true),channels:view.getUint16(at+10,true),rate:view.getUint32(at+12,true),byteRate:view.getUint32(at+16,true),align:view.getUint16(at+20,true),bits:view.getUint16(at+22,true)};
  }else if(tag(at)==='data'){
   if(data)throw Error('Invalid WAV data.');
   data={offset:at+8,size};
  }
  at=end+(size&1);
 }
 if(!format||!data||format.encoding!==1||format.channels!==2||format.bits!==16||format.rate!==44100||format.align!==4||format.byteRate!==format.rate*format.align||!data.size||data.size%format.align)throw Error('Invalid stereo PCM audio.');
 return{rate:format.rate,channels:format.channels,bits:format.bits,frames:data.size/format.align,duration:data.size/format.byteRate,offset:data.offset};
}
export function wavFile(buffer,name){inspectWav(buffer);return new File([buffer],name,{type:'audio/wav'});}
