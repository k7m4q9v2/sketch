import {clamp} from './model.js';
export function zoomDragRatio(distance){return 2**(-distance/70);}
export function mountQuickZoom(roll){
 const control=document.createElement('button');control.className='quick-zoom';control.type='button';control.setAttribute('aria-label','Zoom. Slide up to zoom in, down to zoom out.');control.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>';roll.canvas.parentElement.append(control);
 const value=document.createElement('output');value.className='zoom-value';value.hidden=true;roll.canvas.parentElement.append(value);let drag=null;
 control.addEventListener('pointerdown',e=>{e.preventDefault();control.setPointerCapture(e.pointerId);const n=roll.selectedNote,r=n&&roll.rect(n);const ax=r&&r.x>=roll.keyWidth&&r.x<roll.canvas.clientWidth?r.x:(roll.canvas.clientWidth+roll.keyWidth)/2,ay=r&&r.y>=roll.ruler&&r.y<roll.canvas.clientHeight?r.y+roll.row/2:(roll.canvas.clientHeight+roll.ruler)/2;drag={y:e.clientY,bw:roll.beatWidth,row:roll.row,x:roll.x,scrollY:roll.y,ax,ay};value.hidden=false;value.textContent=Math.round(roll.beatWidth/72*100)+'%';});
 control.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();const g=drag,ratio=zoomDragRatio(e.clientY-g.y);roll.beatWidth=clamp(g.bw*ratio,12,720);roll.row=clamp(g.row*ratio,18,64);roll.x=(g.x+g.ax-roll.keyWidth)*roll.beatWidth/g.bw-g.ax+roll.keyWidth;roll.y=(g.scrollY+g.ay-roll.ruler)*roll.row/g.row-g.ay+roll.ruler;roll.bounds();roll.callbacks.zoom?.(roll.beatWidth/72);roll.draw();value.textContent=Math.round(roll.beatWidth/72*100)+'%';});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(type,()=>{drag=null;value.hidden=true;});
 control.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();roll.zoom(e.key==='ArrowUp'?1.25:.8);}});
 control.addEventListener('contextmenu',e=>e.preventDefault());
}
