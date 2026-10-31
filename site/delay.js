export const TIME_DIVISIONS=[['1/32',.5],['1/16T',2/3],['1/16',1],['1/8T',4/3],['1/16D',1.5],['1/8',2],['1/4T',8/3],['1/8D',3],['1/4',4],['1/2T',16/3],['1/4D',6],['1/2',8],['1/2D',12],['1/1',16]];
export const delayTimeIndex=time=>TIME_DIVISIONS.reduce((best,item,i)=>Math.abs(item[1]-time)<Math.abs(TIME_DIVISIONS[best][1]-time)?i:best,0);
// Master stereo delay. Shared by AudioWorklet playback and offline WAV rendering.
// INVERT swaps the wet stereo field once; P.PONG crosses each feedback repeat.
export const delayDefaults=(d={})=>({enabled:false,pan:0,input:.35,mode:'normal',feedback:.35,cut:6000,time:4,offset:0,dry:1,...d});
export function validateDelay(raw){
 const d=delayDefaults(raw);const ranges={pan:[-1,1],input:[0,1],feedback:[0,1],cut:[20,20000],time:[1/48,16],offset:[-1,1],dry:[0,1]};
 for(const [key,[min,max]] of Object.entries(ranges))if(typeof d[key]!=='number'||!Number.isFinite(d[key])||d[key]<min||d[key]>max)throw Error('Invalid delay settings.');
 if(!['normal','invert','pingpong'].includes(d.mode))throw Error('Invalid delay mode.');d.enabled=!!d.enabled;d.time=TIME_DIVISIONS[delayTimeIndex(d.time)][1];return d;
}
export function delayTail(d,bpm){d=delayDefaults(d);if(!d.enabled||!d.input)return 0;const seconds=d.time*15/bpm+Math.abs(d.offset)*.05;const repeats=d.feedback>=1?Infinity:d.feedback>0?Math.ceil(Math.log(.001)/Math.log(d.feedback)):1;return Math.min(30,seconds*(1+repeats));}
export class StereoDelay{
 constructor(rate){this.rate=rate;this.size=Math.ceil(rate*8.1)+4;this.left=new Float32Array(this.size);this.right=new Float32Array(this.size);this.write=0;this.lpL=0;this.lpR=0;this.mix=0;this.smoothing=1-Math.exp(-1/(rate*.01));this.configure(delayDefaults(),120);this.current={...this.target};this.currentTime=this.target.time;}
 configure(raw,bpm){const d=delayDefaults(raw);if(d.enabled&&!this.enabled)this.clear();this.enabled=d.enabled;this.mode=d.mode;this.target={inputL:d.input*(d.pan>0?Math.cos(d.pan*Math.PI/2):1),inputR:d.input*(d.pan<0?Math.cos(d.pan*Math.PI/2):1),feedback:d.feedback,cut:1-Math.exp(-2*Math.PI*Math.min(d.cut,this.rate*.45)/this.rate),dry:d.dry,time:d.time*15/bpm*this.rate,offset:d.offset*.05*this.rate};}
 clear(){this.left.fill(0);this.right.fill(0);this.lpL=this.lpR=0;this.write=0;}
 reset(){this.clear();this.mix=this.enabled?1:0;if(this.target){this.current={...this.target};this.currentTime=this.target.time;}}
 read(buffer,delay){const pos=(this.write-Math.max(1,Math.min(this.size-2,delay))+this.size)%this.size;const i=Math.floor(pos),f=pos-i;return buffer[i]+(buffer[(i+1)%this.size]-buffer[i])*f;}
 process(audio,frames){if(!this.enabled&&this.mix<1e-6)return;const c=this.current,t=this.target,k=this.smoothing;for(let i=0;i<frames;i++){
   c.inputL+=(t.inputL-c.inputL)*k;c.inputR+=(t.inputR-c.inputR)*k;c.feedback+=(t.feedback-c.feedback)*k;c.cut+=(t.cut-c.cut)*k;c.dry+=(t.dry-c.dry)*k;c.offset+=(t.offset-c.offset)*k;this.currentTime+=(t.time-this.currentTime)*k;
   const inL=audio[i*2],inR=audio[i*2+1],l=this.read(this.left,this.currentTime+Math.max(0,-c.offset)),r=this.read(this.right,this.currentTime+Math.max(0,c.offset));
   this.lpL+=(l-this.lpL)*c.cut;this.lpR+=(r-this.lpR)*c.cut;
   const feedL=this.mode==='pingpong'?this.lpR:this.lpL,feedR=this.mode==='pingpong'?this.lpL:this.lpR;
   // Bounded storage prevents an accidental self-sustaining overload at 100% feedback.
   this.left[this.write]=Math.max(-4,Math.min(4,inL*c.inputL+feedL*c.feedback));this.right[this.write]=Math.max(-4,Math.min(4,inR*c.inputR+feedR*c.feedback));this.write=(this.write+1)%this.size;
   this.mix+=((this.enabled?1:0)-this.mix)*k;const wetL=this.mode==='normal'?l:r,wetR=this.mode==='normal'?r:l;
   audio[i*2]=inL+(inL*c.dry+wetL-inL)*this.mix;audio[i*2+1]=inR+(inR*c.dry+wetR-inR)*this.mix;
 }}
}
