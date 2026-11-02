import test from 'node:test';import assert from 'node:assert/strict';
import {PianoRoll} from '../site/piano-roll.js';import {newProject,channel,note} from '../site/model.js';
import {snapTicks,snapPosition,gridTicks,SNAP_CHOICES} from '../site/snap.js';
globalThis.ResizeObserver=class{observe(){}};globalThis.devicePixelRatio=1;
function setup(){const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});const canvas={clientWidth:390,clientHeight:500,getContext:()=>context,getBoundingClientRect:()=>({left:0,top:0,width:390,height:500}),addEventListener(){},focus(){},setPointerCapture(){}};let checkpoints=0,changes=0,menus=0;const roll=new PianoRoll(canvas,{beforeChange:()=>checkpoints++,change:()=>changes++,preview(){},previewOff(){},menu:()=>menus++});const project=newProject();project.channels.push(channel());roll.set(project,0);roll.y=(127-72)*24;const event=(x,y,id=1)=>({clientX:x,clientY:y,pointerId:id,preventDefault(){}});return{roll,project,event,get checkpoints(){return checkpoints;},get changes(){return changes;},get menus(){return menus;}};}
test('ruler tap plays from the snapped, scrolled time without changing notes',()=>{
 const s=setup(),seeks=[];s.roll.callbacks.seek=tick=>seeks.push(tick);s.roll.x=288;
 s.roll.down(s.event(106,12));assert.deepEqual(seeks,[]);s.roll.up(s.event(106,12));assert.deepEqual(seeks,[2400]);
 s.roll.mode='erase';s.roll.down(s.event(178,12));s.roll.up(s.event(178,12));assert.deepEqual(seeks,[2400,2880]);
 assert.equal(s.roll.channel.notes.length,0);assert.equal(s.checkpoints,0);assert.equal(s.changes,0);
});
test('ruler drag, pinch, cancellation and the pitch-label corner do not trigger playback',()=>{
 const s=setup(),seeks=[];s.roll.callbacks.seek=tick=>seeks.push(tick);s.roll.x=200;
 s.roll.down(s.event(120,12));s.roll.move(s.event(160,12));s.roll.up(s.event(160,12));assert.equal(s.roll.x,160);
 s.roll.down(s.event(120,12));s.roll.up(s.event(120,12),true);
 s.roll.down(s.event(120,12));s.roll.down(s.event(220,12,2));s.roll.up(s.event(120,12));s.roll.up(s.event(220,12,2));
 s.roll.down(s.event(10,12));s.roll.up(s.event(10,12));assert.deepEqual(seeks,[]);assert.equal(s.checkpoints,0);
});
test('pencil taps add and delete with one undo step, while cancelled touches keep notes',()=>{const s=setup();s.roll.down(s.event(60,85));s.roll.up(s.event(60,85));assert.equal(s.roll.channel.notes.length,1);s.roll.down(s.event(60,85));s.roll.up(s.event(60,85),true);assert.equal(s.roll.channel.notes.length,1);s.roll.down(s.event(60,85));assert.equal(s.roll.channel.notes.length,1);s.roll.up(s.event(60,85));assert.equal(s.roll.channel.notes.length,0);assert.equal(s.checkpoints,2);assert.equal(s.changes,2);s.roll.down(s.event(60,85));s.roll.up(s.event(60,85));s.roll.mode='erase';s.roll.down(s.event(60,85));s.roll.up(s.event(60,85));assert.equal(s.roll.channel.notes.length,0);assert.equal(s.checkpoints,4);});
test('hold creates a selection rectangle; group move, copy/paste, delete retain relative notes',t=>{t.mock.timers.enable({apis:['setTimeout']});const s=setup();const notes=[note(70,0,240,70),note(68,480,360,90),note(60,1920)];s.roll.channel.notes=notes;s.roll.down(s.event(35,50));t.mock.timers.tick(451);assert.equal(s.roll.gesture.type,'box');s.roll.move(s.event(180,150));s.roll.up(s.event(180,150));assert.equal(s.roll.selectedNotes.length,2);assert.equal(s.menus,1);s.roll.down(s.event(45,85));s.roll.move(s.event(81,61));s.roll.up(s.event(81,61));assert.equal(notes[0].start,240);assert.equal(notes[1].start,720);assert.equal(notes[0].pitch,71);assert.equal(notes[1].pitch,69);s.roll.copySelected();s.roll.pasteTick=1920;s.roll.pasteNotes();assert.equal(s.roll.selectedNotes.length,2);const pasted=s.roll.selectedNotes;assert.equal(pasted[0].start,1920);assert.equal(pasted[1].start,2400);assert.deepEqual(pasted.map(n=>n.velocity),[70,90]);assert.notEqual(pasted[0].id,notes[0].id);s.roll.deleteSelected();assert.equal(s.roll.channel.notes.length,3);assert.equal(s.checkpoints,3);});
test('scroll and pinch cancel selection timer without adding or deleting notes',t=>{t.mock.timers.enable({apis:['setTimeout']});const s=setup();s.roll.down(s.event(120,150));s.roll.move(s.event(120,200));t.mock.timers.tick(500);assert.equal(s.roll.gesture.type,'pan');s.roll.up(s.event(120,200));assert.equal(s.roll.channel.notes.length,0);s.roll.down(s.event(100,100));s.roll.down(s.event(150,100,2));t.mock.timers.tick(500);assert.equal(s.roll.gesture.type,'pinch');s.roll.up(s.event(100,100));s.roll.up(s.event(150,100,2));assert.equal(s.roll.channel.notes.length,0);});
test('eraser sweep deletes every crossed note with one undo checkpoint',()=>{const s=setup();s.roll.channel.notes=[note(70,0,120),note(70,480,120),note(70,960,120),note(60,0,120)];s.roll.mode='erase';s.roll.down(s.event(40,82));s.roll.move(s.event(220,82));s.roll.up(s.event(220,82));assert.equal(s.roll.channel.notes.length,1);assert.equal(s.roll.channel.notes[0].pitch,60);assert.equal(s.checkpoints,1);assert.equal(s.changes,1);});
test('FL snap entries have step/beat/triplet values; Line rounds and Cell floors with zoom',()=>{assert.equal(SNAP_CHOICES.length,14);assert.equal(snapTicks('step6',72),20);assert.equal(snapTicks('beat6',72),80);assert.equal(snapTicks('beat3',72),160);assert.equal(snapTicks('bar',72),1920);assert.equal(snapPosition(100,'line',72),120);assert.equal(snapPosition(100,'cell',72),0);assert.equal(snapPosition(101.4,'none',72),101);assert.equal(gridTicks(180),60);assert.equal(gridTicks(25),480);});

test('horizontal pinch expands time independently and supports a wider zoom range',()=>{
 const s=setup(),row=s.roll.row;s.roll.down(s.event(100,100));s.roll.down(s.event(150,100,2));s.roll.move(s.event(350,100,2));assert.equal(s.roll.gesture.axis,'x');assert.equal(s.roll.row,row);assert.equal(s.roll.beatWidth,360);
 s.roll.zoom(10);assert.equal(s.roll.beatWidth,720);s.roll.zoom(.001);assert.equal(s.roll.beatWidth,12);s.roll.up(s.event(100,100));s.roll.up(s.event(350,100,2));assert.equal(s.roll.channel.notes.length,0);
});

test('horizontal moves and resizing stay silent, while pitch changes audition',()=>{
 const s=setup(),heard=[],stopped=[];s.roll.callbacks.preview=(pitch,id)=>heard.push(pitch);s.roll.callbacks.previewOff=id=>stopped.push(id);s.roll.channel.notes=[note(70,0,480)];
 s.roll.down(s.event(45,85));assert.equal(heard.length,0);s.roll.move(s.event(81,85));assert.equal(heard.length,0);s.roll.move(s.event(81,61));assert.deepEqual(heard,[71]);s.roll.move(s.event(117,61));assert.equal(heard.length,1);assert.equal(stopped.length,1);s.roll.up(s.event(117,61));
 const n=s.roll.channel.notes[0],rect=s.roll.rect(n);s.roll.down(s.event(rect.x+rect.w-3,rect.y+8));s.roll.move(s.event(rect.x+rect.w+33,rect.y+8));s.roll.up(s.event(rect.x+rect.w+33,rect.y+8));assert.equal(heard.length,1);
});

test('octave actions transpose the selected group together with one undo step and preserve intervals',()=>{
 const s=setup();s.roll.channel.notes=[note(60,120,240,85),note(67,480,360,95),note(72,960)];const [a,b,c]=s.roll.channel.notes;s.roll.selection=new Set([a.id,b.id]);s.roll.selected=a.id;
 assert.equal(s.roll.transposeSelected(12),true);assert.deepEqual([a.pitch,b.pitch,c.pitch],[72,79,72]);assert.equal(s.checkpoints,1);assert.equal(s.changes,1);assert.deepEqual([a.start,a.duration,a.velocity,b.start,b.duration,b.velocity],[120,240,85,480,360,95]);
 assert.equal(s.roll.transposeSelected(-12),true);assert.deepEqual([a.pitch,b.pitch],[60,67]);b.pitch=120;assert.equal(s.roll.transposeSelected(12),false);assert.deepEqual([a.pitch,b.pitch],[60,120]);assert.equal(s.checkpoints,2);a.pitch=5;assert.equal(s.roll.transposeSelected(-12),false);assert.equal(s.checkpoints,2);
});

test('paste right repeats the selected phrase, expands the loop, selects copies and makes one undo step',()=>{
 const s=setup();s.project.bars=1;const notes=[note(60,960,480,80),note(67,1680,240,95),note(36,0,240,70)];s.roll.channel.notes=notes;s.roll.selection=new Set(notes.slice(0,2).map(n=>n.id));s.roll.selected=notes[0].id;
 assert.equal(s.roll.pasteRight(),true);assert.equal(s.project.bars,2);assert.equal(s.roll.channel.notes.length,5);assert.equal(s.checkpoints,1);assert.equal(s.changes,1);assert.deepEqual(s.roll.selectedNotes.map(n=>[n.pitch,n.start,n.duration,n.velocity]),[[60,2880,480,80],[67,3600,240,95]]);assert.ok(s.roll.selectedNotes.every(n=>!notes.slice(0,3).some(o=>o.id===n.id)));
 assert.equal(s.roll.pasteRight(),true);assert.deepEqual(s.roll.selectedNotes.map(n=>n.start),[4800,5520]);assert.equal(s.checkpoints,2);
 for(const n of s.roll.selectedNotes)n.start=32*4*480-n.duration;const count=s.roll.channel.notes.length;assert.equal(s.roll.pasteRight(),false);assert.equal(s.roll.channel.notes.length,count);assert.equal(s.checkpoints,2);
});

test('selection scrolls past the viewport while retaining its original musical anchor',()=>{
 const s=setup();s.project.bars=8;s.roll.channel.notes=[note(70,0,240),note(70,4800,240)];s.roll.down(s.event(35,60));s.roll.beginBox();s.roll.move(s.event(389,120));for(let i=0;i<90;i++)s.roll.scrollSelection(16);assert.ok(s.roll.x>500);assert.equal(s.roll.selectedNotes.length,2);s.roll.up(s.event(389,120));assert.equal(s.roll.selectedNotes.length,2);
});
test('a touch outside a note right edge resizes instead of scrolling the canvas',()=>{
 const s=setup(),n=note(70,0,480);s.roll.channel.notes=[n];const r=s.roll.rect(n);s.roll.down(s.event(r.x+r.w+16,r.y+4));assert.equal(s.roll.gesture.type,'resize');s.roll.move(s.event(r.x+r.w+52,r.y+4));s.roll.up(s.event(r.x+r.w+52,r.y+4));assert.ok(n.duration>480);assert.equal(s.roll.x,0);
});
test('resize taps, long holds, pinches and a drag returning to its start never delete notes',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const s=setup(),n=note(70,0,480);s.roll.channel.notes=[n];const r=s.roll.rect(n);
 s.roll.down(s.event(r.x+r.w+12,r.y+4));s.roll.up(s.event(r.x+r.w+12,r.y+4));assert.equal(s.roll.channel.notes.length,1);
 s.roll.down(s.event(r.x+8,r.y+4));t.mock.timers.tick(451);s.roll.up(s.event(r.x+8,r.y+4));assert.equal(s.roll.channel.notes.length,1);
 s.roll.down(s.event(r.x+8,r.y+4));s.roll.down(s.event(r.x+100,r.y+4,2));s.roll.up(s.event(r.x+8,r.y+4));s.roll.up(s.event(r.x+100,r.y+4,2));assert.equal(s.roll.channel.notes.length,1);
 s.roll.down(s.event(r.x+8,r.y+4));s.roll.move(s.event(r.x+44,r.y+4));s.roll.move(s.event(r.x+8,r.y+4));s.roll.up(s.event(r.x+8,r.y+4));assert.equal(s.roll.channel.notes.length,1);assert.equal(n.start,0);
});
test('tapping a selected group member deletes only that note',()=>{
 const s=setup(),a=note(70,0,480),b=note(68,480,480);s.roll.channel.notes=[a,b];s.roll.selection=new Set([a.id,b.id]);s.roll.selected=a.id;
 s.roll.down(s.event(45,85));s.roll.up(s.event(45,85));assert.deepEqual(s.roll.channel.notes,[b]);assert.equal(s.checkpoints,1);
});
test('slide properties survive copy and both paste operations',()=>{
 const s=setup(),n={...note(70,960,480),slide:true};s.roll.channel.notes=[n];s.roll.select(n.id);s.roll.copySelected();s.roll.pasteTick=1920;s.roll.pasteNotes();assert.equal(s.roll.selectedNote.slide,true);s.roll.pasteRight();assert.equal(s.roll.selectedNote.slide,true);
});

test('new-note audition begins on touch down, before release or MIDI creation, without retriggering',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const s=setup(),heard=[],off=[];
 s.roll.callbacks.preview=(pitch,id)=>heard.push({pitch,id});s.roll.callbacks.previewOff=id=>off.push(id);
 s.roll.down(s.event(60,85));assert.equal(heard.length,1);assert.equal(s.roll.channel.notes.length,0);
 t.mock.timers.tick(100);s.roll.up(s.event(60,85));assert.equal(heard.length,1);assert.equal(s.roll.channel.notes.length,1);assert.equal(off.length,0);
 await Promise.resolve();t.mock.timers.tick(180);assert.deepEqual(off,[heard[0].id]);
});
test('scroll, pinch, cancellation and box selection release the early preview',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const action of ['scroll','pinch','cancel','box']){
  const s=setup(),heard=[],off=[];s.roll.callbacks.preview=(pitch,id)=>heard.push(id);s.roll.callbacks.previewOff=id=>off.push(id);
  s.roll.down(s.event(120,150));
  if(action==='scroll')s.roll.move(s.event(160,150));
  if(action==='pinch')s.roll.down(s.event(220,150,2));
  if(action==='box')t.mock.timers.tick(451);
  s.roll.up(s.event(120,150),action==='cancel');if(action==='pinch')s.roll.up(s.event(220,150,2));
  assert.ok(off.includes(heard[0]),action);assert.equal(s.roll.channel.notes.length,0,action);
 }
});

test('zoomed-out note taps delete even in resize region, while edge drags resize',()=>{
 for(const width of [12,24,72]){
  const s=setup();s.roll.beatWidth=width;const n=note(70,480,120);s.roll.channel.notes=[n];let r=s.roll.rect(n);const x=r.x+r.w-1,y=r.y+5;
  s.roll.down(s.event(x,y));assert.equal(s.roll.gesture.type,'resize');s.roll.up(s.event(x,y));assert.equal(s.roll.channel.notes.length,0);assert.equal(s.checkpoints,1);
  s.roll.channel.notes=[n];s.roll.down(s.event(x,y));s.roll.move(s.event(x+24,y));s.roll.up(s.event(x+24,y));assert.ok(n.duration>120);assert.equal(s.roll.channel.notes.length,1);assert.equal(s.roll.x,0);
  r=s.roll.rect(n);s.roll.down(s.event(r.x+r.w-1,y));s.roll.move(s.event(r.x+r.w-13,y));s.roll.up(s.event(r.x+r.w-13,y));assert.equal(s.roll.channel.notes.length,1);
 }
});

test('moving into the last grid cell trims the overhang and restores length when dragged back',()=>{
 const s=setup();s.project.bars=1;const n=note(70,960,480);s.roll.channel.notes=[n];const r=s.roll.rect(n),x=r.x+5,y=r.y+5;
 s.roll.down(s.event(x,y));s.roll.move(s.event(x+126,y));assert.equal(n.start,1800);assert.equal(n.duration,120);assert.equal(s.project.bars,1);
 s.roll.move(s.event(x,y));assert.equal(n.start,960);assert.equal(n.duration,480);
 s.roll.move(s.event(x+126,y));s.roll.up(s.event(x+126,y));assert.equal(n.start+n.duration,1920);assert.equal(s.checkpoints,1);assert.equal(s.changes,1);
});
test('loop end can scroll into the viewport; tapping the extra space does not create notes',()=>{
 const s=setup();s.project.bars=4;s.roll.x=99999;s.roll.bounds();const endX=s.roll.keyWidth+16*s.roll.beatWidth-s.roll.x;assert.ok(endX<300&&endX>100);
 s.roll.down(s.event(endX+60,85));s.roll.up(s.event(endX+60,85));assert.equal(s.roll.channel.notes.length,0);assert.equal(s.checkpoints,0);assert.equal(s.project.bars,4);
});
test('group movement at loop end preserves spacing and only trims overflowing durations',()=>{
 const s=setup();s.project.bars=1;const a=note(70,480,240),b=note(68,960,720);s.roll.channel.notes=[a,b];s.roll.selection=new Set([a.id,b.id]);s.roll.selected=a.id;const r=s.roll.rect(a),x=r.x+4,y=r.y+5;
 s.roll.down(s.event(x,y));s.roll.move(s.event(x+126,y));s.roll.up(s.event(x+126,y));assert.equal(b.start-a.start,480);assert.equal(a.duration,240);assert.equal(b.duration,120);assert.equal(b.start+b.duration,1920);
});

test('created callback opens editing aid only after a note is committed, not on drag/cancel',()=>{
 const s=setup(),created=[];s.roll.callbacks.created=n=>created.push(n);s.roll.down(s.event(60,85));assert.equal(created.length,0);s.roll.up(s.event(60,85));assert.equal(created[0],s.roll.channel.notes[0]);
 s.roll.down(s.event(220,180));s.roll.move(s.event(250,180));s.roll.up(s.event(250,180));assert.equal(created.length,1);
 s.roll.down(s.event(220,220));s.roll.up(s.event(220,220),true);assert.equal(created.length,1);
});
test('magnifier is automatic only for zoomed-out or narrow notes',async()=>{
 const {needsNoteLoupe}=await import('../site/note-loupe.js');const s=setup(),n=note(70,0,480);assert.equal(needsNoteLoupe(s.roll,n),false);s.roll.beatWidth=24;assert.equal(needsNoteLoupe(s.roll,n),true);s.roll.beatWidth=72;n.duration=120;assert.equal(needsNoteLoupe(s.roll,n),true);
});

test('loupe sits at the opposite vertical edge and outside taps continue normally',async()=>{
 const {loupePosition,dismissLoupeOutside}=await import('../site/note-loupe.js');
 const area={left:0,right:390,top:100,bottom:600},size={width:250,height:154};
 assert.equal(loupePosition(area,{x:100,y:140,w:12,h:20},size).top,438);
 assert.equal(loupePosition(area,{x:100,y:520,w:12,h:20},size).top,133);
 let closed=0;const inside={},root={contains:target=>target===inside};
 const event={target:{},preventDefault(){throw Error('must not swallow tap');},stopPropagation(){throw Error('must not swallow tap');}};
 dismissLoupeOutside(root,()=>closed++,{target:inside});assert.equal(closed,0);
 dismissLoupeOutside(root,()=>closed++,event);assert.equal(closed,1);
});
