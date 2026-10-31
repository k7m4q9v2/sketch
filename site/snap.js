export const SNAP_CHOICES=[['line','Line'],['cell','Cell'],['none','(none)'],['step6','1/6 step'],['step4','1/4 step'],['step3','1/3 step'],['step2','1/2 step'],['step','Step'],['beat6','1/6 beat'],['beat4','1/4 beat'],['beat3','1/3 beat'],['beat2','1/2 beat'],['beat','Beat'],['bar','Bar']];
const TICKS={none:1,step6:20,step4:30,step3:40,step2:60,step:120,beat6:80,beat4:120,beat3:160,beat2:240,beat:480,bar:1920};
export function gridTicks(beatWidth){return beatWidth>=160?60:beatWidth>=70?120:beatWidth>=35?240:480;}
export function snapTicks(mode,beatWidth){return TICKS[mode]??gridTicks(beatWidth);}
export function snapPosition(tick,mode,beatWidth){const step=snapTicks(mode,beatWidth);return (mode==='cell'?Math.floor(tick/step):Math.round(tick/step))*step;}
