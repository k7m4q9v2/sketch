import {PPQ} from './model.js';
// The worklet reports the render head, which can be ahead of the speakers.
// Use the output clock where available, otherwise the browser's reported latency.
export function audiblePosition(context,message,now=performance.now()){
 if(!context||!Number.isFinite(message.contextTime)||!(message.bpm>0)||!(message.loopTicks>0))return message;
 const current=context.currentTime;if(!Number.isFinite(current))return message;
 let audibleTime=current-Math.max(0,context.baseLatency||0)-Math.max(0,context.outputLatency||0);
 try{
  const stamp=context.getOutputTimestamp?.();
  if(stamp&&stamp.contextTime>0&&stamp.performanceTime>0&&Math.abs(now-stamp.performanceTime)<1000)audibleTime=stamp.contextTime+(now-stamp.performanceTime)/1000;
 }catch{}
 audibleTime=Math.max(0,Math.min(current,audibleTime));
 const absolute=Math.max(message.startTick??0,(message.cycle??0)*message.loopTicks+message.tick+(audibleTime-message.contextTime)*message.bpm/60*PPQ);
 return {...message,tick:absolute%message.loopTicks,cycle:Math.floor(absolute/message.loopTicks)};
}
