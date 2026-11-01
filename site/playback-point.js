import {PPQ} from './model.js';

// A ruler selection belongs to this open project, independently of the playhead.
export class PlaybackPoint{
 get(project){
  if(this.projectId!==project.id||this.tick>=project.bars*4*PPQ){this.projectId=project.id;this.tick=0;}
  return this.tick??0;
 }
 set(project,tick){
  this.projectId=project.id;
  this.tick=Math.max(0,Math.min(project.bars*4*PPQ-1,Number.isFinite(tick)?tick:0));
  return this.tick;
 }
}
