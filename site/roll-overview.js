import {PPQ,clamp} from './model.js';
export function overviewRange(notes){return {low:Math.max(0,Math.min(48,...notes.map(n=>n.pitch))-3),high:Math.min(127,Math.max(72,...notes.map(n=>n.pitch))+3)};}
export function mountRollOverview(main){
 const canvas=document.createElement('canvas');canvas.className='roll-overview';canvas.tabIndex=0;canvas.setAttribute('aria-label','Pattern overview. Drag to choose the editing area.');main.canvas.parentElement.before(canvas);
 const ctx=canvas.getContext('2d');let range={low:45,high:75},drag=false;
 function draw(){
  if(!main.channel||!canvas.clientWidth)return;const w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const notes=main.channel.notes;range=overviewRange(notes);const total=main.project.bars*4*PPQ,rows=range.high-range.low+1,px=p=>8+(range.high-p)/rows*(h-16);
  ctx.strokeStyle='#dedee4';for(let bar=0;bar<=main.project.bars;bar++){const x=bar/main.project.bars*w;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  ctx.fillStyle='#797980';for(const n of notes)ctx.fillRect(n.start/total*w,px(n.pitch),Math.max(2,n.duration/total*w),Math.max(2,(h-16)/rows));
  const x=main.x/main.beatWidth*PPQ/total*w,width=(main.canvas.clientWidth-main.keyWidth)/main.beatWidth*PPQ/total*w;
  const high=127-main.y/main.row,low=high-(main.canvas.clientHeight-main.ruler)/main.row,y=clamp(px(high),0,h),bottom=clamp(px(low),0,h);
  ctx.fillStyle='#a5a5b01c';ctx.fillRect(x,y,width,bottom-y);ctx.strokeStyle='#666670';ctx.lineWidth=1.5;ctx.strokeRect(Math.max(.75,x),Math.max(.75,y),Math.max(2,Math.min(width,w-x-1)),Math.max(3,bottom-y-1));
 }
 function navigate(e){const r=canvas.getBoundingClientRect(),x=clamp(e.clientX-r.left,0,r.width),y=clamp(e.clientY-r.top,8,r.height-8);const tick=x/r.width*main.project.bars*4*PPQ,pitch=range.high-(y-8)/(r.height-16)*(range.high-range.low+1);
  main.x=tick/PPQ*main.beatWidth-(main.canvas.clientWidth-main.keyWidth)/2;main.y=(127-pitch)*main.row-(main.canvas.clientHeight-main.ruler)/2;main.bounds();main.draw();
 }
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();drag=true;canvas.setPointerCapture(e.pointerId);navigate(e);});canvas.addEventListener('pointermove',e=>{if(drag){e.preventDefault();navigate(e);}});for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=false);
 canvas.addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();main.x+=e.key==='ArrowRight'?main.beatWidth:e.key==='ArrowLeft'?-main.beatWidth:0;main.y+=e.key==='ArrowDown'?main.row:e.key==='ArrowUp'?-main.row:0;main.bounds();main.draw();});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());const original=main.draw.bind(main);main.draw=()=>{original();draw();};new ResizeObserver(draw).observe(canvas);
}
