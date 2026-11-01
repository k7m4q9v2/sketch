import {PPQ,clamp,note} from './model.js';
export const SCALES={Major:[0,2,4,5,7,9,11],Minor:[0,2,3,5,7,8,10]};
export function scalePitches(root=0,mode='Major'){
 const intervals=SCALES[mode];if(!intervals||!Number.isInteger(root)||root<0||root>11)throw Error('Invalid key.');
 return Array.from({length:128},(_,i)=>i).filter(n=>intervals.includes((n-root+120)%12));
}
// Select the coarsest binary/triplet grid that fits the played rhythm within 45 ms.
export function quantizeTaps(seconds,bpm,bars){
 if(!(bpm>=30&&bpm<=300)||!Number.isInteger(bars)||bars<1||bars>32)throw Error('Invalid tempo or bars.');
 const end=bars*4*PPQ,ticks=seconds.filter(t=>Number.isFinite(t)&&t>=-.045).map(t=>Math.max(0,t*bpm/60*PPQ)).filter(t=>t<end);
 if(!ticks.length)return {ticks:[],grid:120};
 const tolerance=Math.min(50,.045*bpm/60*PPQ);
 const grids=[480,240,160,120,80,60,40,30,20];
 const grid=grids.find(g=>ticks.every(t=>Math.abs(t-Math.round(t/g)*g)<=tolerance))??20;
 return {grid,ticks:[...new Set(ticks.map(t=>Math.round(t/grid)*grid).filter(t=>t<end))].sort((a,b)=>a-b)};
}
export function contourAt(points,x){
 if(!points.length)throw Error('Draw a line first.');
 const ordered=[...new Map(points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>[Math.round(clamp(p.x,0,1)*1000),p.y])).entries()].sort((a,b)=>a[0]-b[0]);
 if(!ordered.length)throw Error('Draw a line first.');
 const at=clamp(x,0,1)*1000;
 if(at<=ordered[0][0])return ordered[0][1];
 for(let i=1;i<ordered.length;i++)if(at<=ordered[i][0]){const [ax,ay]=ordered[i-1],[bx,by]=ordered[i];return ay+(by-ay)*(at-ax)/(bx-ax);}
 return ordered.at(-1)[1];
}
export function generateMelody({points,ticks,bars,root=0,mode='Major',variant=0,durations=[]}){
 const pitches=scalePitches(root,mode),end=bars*4*PPQ;
 let seed=(variant+1)*2654435761>>>0;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 return [...new Set(ticks)].filter(t=>Number.isFinite(t)&&t>=0&&t<end).sort((a,b)=>a-b).map((start,i,starts)=>{
  const target=48+(1-contourAt(points,start/end))*36;
  let index=0;for(let k=1;k<pitches.length;k++)if(Math.abs(pitches[k]-target)<Math.abs(pitches[index]-target))index=k;
  // Regenerate changes pitch choices only; tap timing never changes.
  if(variant)index=clamp(index+([-1,0,0,1][Math.floor(random()*4)]),0,pitches.length-1);
  const duration=Math.max(1,Math.min(end-start,durations[i]??Math.round(((starts[i+1]??Math.min(end,start+PPQ))-start)*.9)));
  return note(pitches[index],start,duration,100);
 });
}
export function shiftMelody(notes,steps,root,mode){
 const scale=scalePitches(root,mode),indices=notes.map(n=>scale.indexOf(n.pitch)+steps);
 if(notes.some(n=>!scale.includes(n.pitch))||indices.some(i=>i<0||i>=scale.length))return null;
 return notes.map((n,i)=>({...n,pitch:scale[indices[i]]}));
}
