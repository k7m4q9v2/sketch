import {PianoRoll} from './piano-roll.js';
import {PPQ,clamp} from './model.js';
export function loupeFocus(main,left,top,width,height){return main.musical({x:left+width/2,y:top+height/2});}
export function mountNoteLoupe(main){
 const panel=document.createElement('div');panel.id='note-loupe';panel.setAttribute('role','region');panel.setAttribute('aria-label','Movable piano roll magnifier');
 panel.innerHTML='<div class="loupe-heading" role="button" tabindex="0" aria-label="Move magnifier"><span aria-hidden="true">──</span></div><div class="loupe-canvas"><canvas tabindex="0" aria-label="Magnified notes"></canvas></div>';
 main.canvas.parentElement.append(panel);const canvas=panel.querySelector('canvas'),handle=panel.querySelector('.loupe-heading');let left=45,top=45,drag=null,initialized=false;
 const lens=new PianoRoll(canvas,{
 beforeChange:()=>main.callbacks.beforeChange(),
 change:()=>{main.selection=new Set(lens.selection);main.selected=lens.selected;main.callbacks.change();},
 liveChange:()=>{main.callbacks.liveChange?.();main.draw();},
 select:note=>{main.selected=note?.id??null;main.selection=new Set(lens.selection);main.callbacks.select?.(note);},
 preview:(pitch,id)=>main.callbacks.preview(pitch,'loupe-'+id),previewOff:id=>main.callbacks.previewOff('loupe-'+id)
 });
 function position(){left=clamp(left,main.keyWidth,Math.max(main.keyWidth,main.canvas.clientWidth-panel.offsetWidth-4));top=clamp(top,main.ruler,Math.max(main.ruler,main.canvas.clientHeight-panel.offsetHeight-4));panel.style.left=left+'px';panel.style.top=top+'px';}
 function sync(){
  if(!main.channel)return;
  position();lens.snapMode=main.snapMode;lens.mode=main.mode;lens.slide=main.slide;lens.length=main.length;lens.velocity=main.velocity;
  if(!lens.pointers.size){
   const focus=loupeFocus(main,left,top,panel.offsetWidth,panel.offsetHeight);
   lens.beatWidth=Math.max(48,main.beatWidth*1.4);lens.row=Math.max(22,main.row*1.15);
   lens.set(main.project,main.index);lens.x=focus.tick/PPQ*lens.beatWidth-(canvas.clientWidth-lens.keyWidth)/2;lens.y=(127-focus.pitch+.5)*lens.row-(canvas.clientHeight-lens.ruler)/2;lens.bounds();lens.draw();
  }
 }
 for(const corner of ['nw','ne','sw','se']){
  const grip=document.createElement('div');grip.className='loupe-resize '+corner;grip.setAttribute('aria-label','Resize magnifier');panel.append(grip);let resizing=null;
  grip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();grip.setPointerCapture(e.pointerId);resizing={x:e.clientX,y:e.clientY,left,top,width:panel.offsetWidth,height:panel.offsetHeight};});
  grip.addEventListener('pointermove',e=>{if(!resizing)return;e.preventDefault();const a=resizing,west=corner.includes('w'),north=corner.includes('n'),dx=e.clientX-a.x,dy=e.clientY-a.y;
   const right=a.left+a.width,bottom=a.top+a.height;
   const width=clamp(a.width+(west?-dx:dx),160,Math.max(160,west?right-main.keyWidth:main.canvas.clientWidth-a.left-4));
   const height=clamp(a.height+(north?-dy:dy),100,Math.max(100,north?bottom-main.ruler:main.canvas.clientHeight-a.top-4));
   left=west?right-width:a.left;top=north?bottom-height:a.top;panel.style.width=width+'px';panel.style.height=height+'px';sync();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(type,()=>resizing=null);
 }
 const draw=main.draw.bind(main);main.draw=()=>{draw();sync();};
 handle.addEventListener('pointerdown',e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,left,top};});
 handle.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();left=drag.left+e.clientX-drag.x;top=drag.top+e.clientY-drag.y;sync();});
 for(const type of ['pointerup','pointercancel'])handle.addEventListener(type,()=>drag=null);
 handle.addEventListener('keydown',e=>{const delta={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];if(delta){e.preventDefault();left+=delta[0];top+=delta[1];sync();}});
 for(const type of ['touchstart','touchmove','selectstart'])panel.addEventListener(type,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
 // Refresh tools before editing; never consume touches outside the lens.
 canvas.addEventListener('pointerdown',()=>{lens.mode=main.mode;lens.snapMode=main.snapMode;lens.slide=main.slide;lens.length=main.length;},true);
 new ResizeObserver(()=>{if(!initialized&&main.canvas.clientWidth){initialized=true;left=main.keyWidth+12;top=main.ruler+20;}sync();}).observe(main.canvas);
 return {sync};
}
