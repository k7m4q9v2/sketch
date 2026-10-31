import {renderAudio} from './render-audio.js';
self.onmessage=async({data})=>{try{const result=await renderAudio(data,await(await fetch('./lumafont.wasm')).arrayBuffer(),progress=>self.postMessage({progress}));self.postMessage(result,[result.buffer]);}catch(error){self.postMessage({error:error.message});}};
