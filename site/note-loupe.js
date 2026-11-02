import {PianoRoll,pitchName} from './piano-roll.js';
import {PPQ,clamp} from './model.js';
export function needsNoteLoupe(roll,n){return roll.beatWidth<48||roll.rect(n).w<26;}
export function openNoteLoupe(main,n){
 if(!needsNoteLoupe(main,n)||document.getElementById('note-loupe'))return;
 const project=main.project,channel=main.channel,dialog=document.createElement('dialog');dialog.id='note-loupe';dialog.setAttribute('aria-label','Magnified piano roll');dialog.innerHTML='<div class="loupe-heading"><strong>Note</strong><button type="button">Done</button></div><div class="loupe-canvas"><canvas tabindex="0" aria-label="Magnified notes. Drag to move, drag the right edge to resize, tap to delete."></canvas></div>';
 document.body.append(dialog);const canvas=dialog.querySelector('canvas'),title=dialog.querySelector('strong'),held=new Set();let closed=false;
 const lens=new PianoRoll(canvas,{
 beforeChange:()=>main.callbacks.beforeChange(),
 change:()=>{main.selection=new Set(lens.selection);main.selected=lens.selected;main.callbacks.change();lens.set(project,main.index);if(!channel.notes.length)dialog.close();},
 liveChange:()=>{main.callbacks.liveChange?.();main.draw();},
 select:note=>{title.textContent=note?pitchName(note.pitch):'Note';},
 preview:(pitch,id)=>{held.add(id);return main.callbacks.preview(pitch,id);},
 previewOff:id=>{held.delete(id);main.callbacks.previewOff(id);}
 });
 lens.snapMode=main.snapMode;lens.slide=main.slide;lens.length=n.duration;lens.velocity=n.velocity;
 lens.beatWidth=Math.min(720,Math.max(160,main.beatWidth*3,64*PPQ/n.duration));lens.row=28;
 for(const type of ['touchstart','touchmove','selectstart'])canvas.addEventListener(type,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
 dialog.querySelector('button').onclick=()=>dialog.close();let outside=false;
 const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
 dialog.addEventListener('pointerdown',e=>outside=isOutside(e));dialog.addEventListener('pointerup',e=>{if(outside&&isOutside(e))dialog.close();outside=false;});
 dialog.addEventListener('close',()=>{closed=true;clearTimeout(lens.longPress);lens.cancelEdge();lens.resize.disconnect();for(const id of held)main.callbacks.previewOff(id);dialog.remove();main.draw();},{once:true});
 const marker=document.createElement('div');marker.className='loupe-source';marker.setAttribute('aria-hidden','true');dialog.append(marker);
 const anchor=()=>{const r=main.rect(channel.notes.find(v=>v.id===n.id)??n),c=main.canvas.getBoundingClientRect();return {x:c.left+r.x,y:c.top+r.y,w:r.w,h:r.h};};
 const mark=()=>{const a=anchor();Object.assign(marker.style,{left:(a.x-3)+'px',top:(a.y-3)+'px',width:(a.w+6)+'px',height:(a.h+6)+'px'});marker.hidden=!channel.notes.some(v=>v.id===n.id);};
 dialog.showModal();const a=anchor(),d=dialog.getBoundingClientRect();dialog.style.left=clamp(a.x+a.w/2-d.width/2,8,innerWidth-d.width-8)+'px';dialog.style.top=clamp(a.y>d.height+20?a.y-d.height-12:a.y+a.h+12,8,innerHeight-d.height-8)+'px';mark();const oldSelect=lens.callbacks.select;lens.callbacks.select=note=>{oldSelect(note);mark();};requestAnimationFrame(()=>{if(closed)return;lens.set(project,main.index);lens.select(n.id);lens.x=Math.max(0,n.start/PPQ*lens.beatWidth-(canvas.clientWidth-lens.keyWidth)*.25);lens.y=(127-n.pitch)*lens.row-(canvas.clientHeight-lens.ruler)/2;lens.bounds();lens.draw();});
}
