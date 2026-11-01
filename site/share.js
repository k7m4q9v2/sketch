export function canShareFile(file,nav=navigator){
 try{return typeof nav.share==='function'&&typeof nav.canShare==='function'&&nav.canShare({files:[file]});}catch{return false;}
}
// Call directly from a button click, after the file has finished rendering.
export async function shareFile(file,nav=navigator){
 if(!canShareFile(file,nav))return false;
 try{await nav.share({files:[file]});return true;}catch(error){if(error.name==='AbortError')return true;throw error;}
}
