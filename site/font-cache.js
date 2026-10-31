import {fontBlob,downloadFont} from './font-library.js';

// Keep one download per bank in flight. Restored IndexedDB Blobs never need a fetch.
export function createFontLoader(fonts,{save,download=downloadFont,onDownload=()=>{}}){
 const pending=new Map();
 return async id=>{
  const font=fonts.get(id);
  if(!font)throw Error('This SoundFont is missing.');
  const local=fontBlob(font);
  if(local)return local;
  if(!pending.has(id))pending.set(id,(async()=>{
   onDownload(font);
   const blob=await download(font);
   await save({...font,blob});
   font.blob=blob;
   return blob;
  })().finally(()=>pending.delete(id)));
  return pending.get(id);
 };
}
