// Capture entries synchronously during drop; the drag data store closes afterward.
export function droppedSoundFonts(transfer){
 const items=[...(transfer.items||[])].filter(item=>item.kind==='file');
 const roots=items.map(item=>({entry:item.getAsEntry?.()||item.webkitGetAsEntry?.(),file:item.getAsFile?.()}));
 const fallback=[...(transfer.files||[])];
 return (async()=>{
  const files=[];
  async function walk(entry){
   if(entry.isFile){if(/\.sf2$/i.test(entry.name))files.push(await new Promise((resolve,reject)=>entry.file(resolve,reject)));return;}
   if(!entry.isDirectory)return;
   const reader=entry.createReader();
   while(true){const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;for(const child of batch)await walk(child);}
  }
  if(roots.length){for(const root of roots){if(root.entry)await walk(root.entry);else if(root.file&&/\.sf2$/i.test(root.file.name))files.push(root.file);}}
  else files.push(...fallback.filter(file=>/\.sf2$/i.test(file.name)));
  return files;
 })();
}
