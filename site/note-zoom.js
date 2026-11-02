import {PPQ} from './model.js';
export function needsNoteZoom(roll,n){return roll.beatWidth<48||roll.rect(n).w<24;}
export function zoomToNewNote(roll,n){
 if(!needsNoteZoom(roll,n))return;
 const before=roll.rect(n),oldWidth=roll.beatWidth,oldRow=roll.row;
 // A modest working scale, never the extreme magnification needed for tiny ticks.
 roll.beatWidth=Math.max(oldWidth,Math.min(96,Math.max(48,24*PPQ/n.duration)));
 roll.row=Math.max(oldRow,24);
 if(roll.beatWidth===oldWidth&&roll.row===oldRow)return;
 // Keep the note's start and pitch center at their existing screen position.
 roll.x=roll.keyWidth+n.start/PPQ*roll.beatWidth-before.x;
 roll.y=roll.ruler+(127-n.pitch+.5)*roll.row-(before.y+oldRow/2);
 roll.bounds();roll.callbacks.zoom?.(roll.beatWidth/72);roll.draw();
}
