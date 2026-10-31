export function bindAudioLifecycle({page=document,win=window,isPlaying,resume,stop,save}){
 const restore=()=>{if(!page.hidden&&isPlaying())Promise.resolve(resume()).catch(()=>{});};
 const persist=()=>Promise.resolve(save()).catch(()=>{});
 // Opening Control Center is not a stop command. Keep the user's playback intent
 // while iOS suspends/interrupts the context, then resume from the same position.
 const visibility=()=>{if(page.hidden)persist();else restore();};
 const leave=()=>{stop();persist();};
 page.addEventListener('visibilitychange',visibility);
 win.addEventListener('focus',restore);win.addEventListener('pageshow',restore);win.addEventListener('pagehide',leave);
 return()=>{page.removeEventListener('visibilitychange',visibility);win.removeEventListener('focus',restore);win.removeEventListener('pageshow',restore);win.removeEventListener('pagehide',leave);};
}
