import {PianoRoll,pitchName} from './piano-roll.js';
import {PPQ,clamp} from './model.js';
export function needsNoteLoupe(roll,n){return roll.beatWidth<48||roll.rect(n).w<24;}
export function loupePosition(area,note,size){
 const top=area.top+25+8,bottom=area.bottom-size.height-8;
 return {left:clamp(note.x+note.w/2-size.width/2,area.left+8,Math.max(area.left+8,area.right-size.width-8)),top:note.y+note.h/2<(top+bottom+size.height)/2?Math.max(top,bottom):top};
}
export function dismissLoupeOutside(root,close,event){if(!root.contains(event.target))close();}
export function openNoteLoupe(main,n){
 if(!needsNoteLoupe(main,n)||document.getElementById('note-loupe'))return;
 const project=main.project,channel=main.channel,panel=document.createElement('div');panel.id='note-loupe';panel.setAttribute('role','region');panel.setAttribute('aria-label','Magnified piano roll');
 panel.innerHTML='<div class="loupe-heading"><strong>Note</strong><button type="button">Done</button></div><div class="loupe-canvas"><canvas tabindex="0" aria-label="Magnified notes"></canvas></div>';
 document.body.append(panel);const canvas=panel.querySelector('canvas'),title=panel.querySelector('strong'),held=new Set();let closed=false;
 const close=()=>{if(closed)return;closed=true;document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',close);clearTimeout(lens.longPress);lens.cancelEdge();lens.resize.disconnect();for(const id of held)main.callbacks.previewOff(id);panel.remove();main.draw();};
 // Nonmodal: the original pointer event continues to the underlying control.
 const outside=e=>dismissLoupeOutside(panel,close,e);
 const lens=new PianoRoll(canvas,{
 beforeChange:()=>main.callbacks.beforeChange(),
 change:()=>{main.selection=new Set(lens.selection);main.selected=lens.selected;main.callbacks.change();lens.set(project,main.index);if(!channel.notes.some(v=>v.id===n.id))close();},
 liveChange:()=>{main.callbacks.liveChange?.();main.draw();},
 select:note=>{title.textContent=note?pitchName(note.pitch):'Note';},
 preview:(pitch,id)=>{held.add(id);return main.callbacks.preview(pitch,id);},
 previewOff:id=>{held.delete(id);main.callbacks.previewOff(id);}
 });
 lens.snapMode=main.snapMode;lens.mode=main.mode;lens.slide=main.slide;lens.length=n.duration;lens.velocity=n.velocity;
 lens.beatWidth=Math.max(main.beatWidth,Math.min(144,Math.max(72,28*PPQ/n.duration)));lens.row=Math.max(24,main.row);
 for(const type of ['touchstart','touchmove','selectstart'])canvas.addEventListener(type,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
 panel.querySelector('button').onclick=close;
 const c=main.canvas.getBoundingClientRect(),r=main.rect(n),pos=loupePosition(c,{x:c.left+r.x,y:c.top+r.y,w:r.w,h:r.h},panel.getBoundingClientRect());
 panel.style.left=pos.left+'px';panel.style.top=pos.top+'px';
 document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',close);
 lens.set(project,main.index);lens.select(n.id);lens.x=Math.max(0,n.start/PPQ*lens.beatWidth-(canvas.clientWidth-lens.keyWidth)*.25);lens.y=(127-n.pitch)*lens.row-(canvas.clientHeight-lens.ruler)/2;lens.bounds();lens.draw();
}
