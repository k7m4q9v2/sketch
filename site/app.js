import {icon} from './icons.js';
import {STANDARD_FONT} from './standard-font.js';
import {BUNDLED_FONTS} from './bundled-fonts.js';
import {createFontLoader} from './font-cache.js';
import {cleanSf2Name} from './sf2-name.js';
import {droppedSoundFonts} from './file-drop.js';
import {SNAP_CHOICES} from './snap.js';
import {inspectFont,fontId,fontBlob} from './font-library.js';
import {canShareFile,shareFile} from './share.js';
import {delayDefaults,TIME_DIVISIONS,delayTimeIndex} from './delay.js';
import {Knob} from './knob.js';
import {envelopeDefaults,envelopeGraph} from './envelope.js';
import {PPQ,MAX_CHANNELS,COLORS,uid,clamp,clone,channel,newProject,validateProject,validateSf2,History,displayColor} from './model.js';
import {AudioHost} from './audio.js';
import {bindAudioLifecycle} from './audio-lifecycle.js';
import {inspectWav,wavFile} from './wav-file.js';
import {PianoRoll,pitchName} from './piano-roll.js';
import {midiBytes} from './export.js';
import * as storage from './storage.js';
const $=id=>document.getElementById(id),fonts=new Map(),history=new History();
for(const [id,name]of Object.entries({'back-to-projects':'back','back-to-rack':'back','go-to-start':'start','new-project':'plus','add-channel':'plus','dialog-close':'close','undo':'undo','redo':'redo','draw-tool':'pencil','erase-tool':'eraser','preset-prev':'back','preset-next':'next','metronome':'metronome','play':'play'}))$(id).innerHTML=icon(name);
for(const element of document.querySelectorAll('.chevron'))element.innerHTML=icon('chevron');
let project=newProject(),selected=0,playing=false,playToken=0,saveTimer,toastTimer,octave=4,exportWorker=null,exportRun=0,exportPreview=null,objectUrls=[],ready=false,dirty=false,saving=false,revision=0,browserMode=null,emptyLibrary=false,hasOpenProject=false;
const ensureFontBlob=createFontLoader(fonts,{save:font=>storage.put('fonts',font),onDownload:font=>{navigator.storage?.persist?.().catch(()=>{});toast('Downloading '+font.name+'…');}});
const audio=new AudioHost(fonts,ensureFontBlob),heldPreviews=new Set();
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?7000:3500);}
function on(id,event,fn){$(id).addEventListener(event,e=>Promise.resolve(fn(e)).catch(error=>toast(error.message||String(error),true)));}
function current(){return project.channels[selected];}
function checkpoint(){history.push(project);}
function changed(render=true){revision++;dirty=true;project.updatedAt=Date.now();audio.update(project);if(render===true)renderAll();else if(render==='quiet')renderHistory();else{renderRack();renderHistory();}$('save-status').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(e=>toast('Autosave failed. '+e.message,true)),600);}
async function save(){if(!ready||!hasOpenProject)return;if(saving){dirty=true;return;}saving=true;const savingRevision=revision;const snapshot=clone(project);try{await storage.put('projects',snapshot);await storage.put('settings',{id:'libraryEmpty',value:false});await storage.put('settings',{id:'lastProject',value:snapshot.id});if(revision===savingRevision){dirty=false;$('save-status').textContent='Saved';}else{clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(e=>toast(e.message,true)),10);}}finally{saving=false;}}
function warmChannel(){if(current())audio.ensure(project,selected).catch(e=>toast(e.message,true));}
function setSelected(index,open=false){selected=clamp(index,0,project.channels.length-1);roll.select(null);if(open)setEditor(true);renderAll();warmChannel();requestAnimationFrame(()=>{if(open)roll.fit();roll.draw();});}
async function preview(pitch,id,velocity=100){heldPreviews.add(id);try{await audio.preview(project,selected,pitch,id,velocity);if(!heldPreviews.has(id))audio.off(id);}catch(e){heldPreviews.delete(id);toast(e.message,true);}}
function previewOff(id){heldPreviews.delete(id);audio.off(id);}
const roll=new PianoRoll($('piano-roll'),{beforeChange:checkpoint,change:()=>changed(),liveChange:()=>audio.update(clone(project)),select:n=>{if(n)roll.velocity=n.velocity;renderEnvelope();$('octave-down').disabled=roll.selectedNotes.some(n=>n.pitch<12);$('octave-up').disabled=roll.selectedNotes.some(n=>n.pitch>115);},preview,previewOff,seek:tick=>startPlayback(tick).catch(e=>toast(e.message,true)),menu:(p,count)=>{$('paste-right').hidden=!count;$('octave-down').hidden=$('octave-up').hidden=count<2;$('octave-down').disabled=roll.selectedNotes.some(n=>n.pitch<12);$('octave-up').disabled=roll.selectedNotes.some(n=>n.pitch>115);$('copy-notes').hidden=!count;$('delete-note').hidden=!count;$('paste-notes').hidden=!roll.clipboard.length;$('delete-note').hidden=!count||roll.mode!=='erase';$('toggle-slide').hidden=!count;$('toggle-slide').textContent=roll.selectedNotes.every(n=>n.slide)?'Normal notes':'Slide notes';$('delete-note').textContent=count>1?`Delete ${count} notes`:'Delete note';const menu=$('note-popover');menu.hidden=false;menu.style.left=clamp(p.x,6,Math.max(6,$('piano-container').clientWidth-menu.offsetWidth-6))+'px';menu.style.top=clamp(p.y,5,$('piano-container').clientHeight-menu.offsetHeight-6)+'px';menu.hidden=false;},hideMenu:()=>$('note-popover').hidden=true,zoom:z=>$('zoom-label').textContent=Math.round(z*100)+'%'});
// Safari's native selection loupe can survive pointer preventDefault alone.
// Cancel native touch defaults on the canvas; Pointer Events still own editing/pinch.
for(const type of ['touchstart','touchmove'])$('piano-roll').addEventListener(type,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
$('piano-roll').addEventListener('selectstart',e=>e.preventDefault());
function renderHistory(){$('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;}
function renderRack(){
 $('channels').replaceChildren();
 project.channels.forEach((c,i)=>{
  const item=document.createElement('div');item.className='channel'+(i===selected?' selected':'')+(c.mute?' muted':'');item.style.setProperty('--channel-color',c.color);
  const number=document.createElement('span');number.className='channel-index';number.textContent=String(i+1).padStart(2,'0');
  const name=document.createElement('button');name.className='channel-name';name.textContent=c.name;name.setAttribute('aria-label',`Select ${c.name}`);name.onclick=()=>{setSelected(i,false);openSound();};
  const controls=document.createElement('div');controls.className='channel-switches';
  for(const [key,label]of [['mute','M'],['solo','S']]){const b=document.createElement('button');b.className='ms-button'+(c[key]?' active':'');b.textContent=label;b.setAttribute('aria-label',`${c.name} ${key}`);b.setAttribute('aria-pressed',String(c[key]));b.onclick=e=>{e.stopPropagation();checkpoint();c[key]=!c[key];changed();};controls.append(b);}
  const pattern=document.createElementNS('http://www.w3.org/2000/svg','svg');pattern.classList.add('channel-pattern');pattern.setAttribute('viewBox','0 0 400 28');pattern.setAttribute('preserveAspectRatio','none');pattern.setAttribute('aria-hidden','true');
  for(let k=0;k<16;k++){const rect=document.createElementNS(pattern.namespaceURI,'rect');rect.setAttribute('x',k*25+1);rect.setAttribute('y',0);rect.setAttribute('width',23);rect.setAttribute('height',28);rect.setAttribute('rx',2);rect.setAttribute('fill',k%4<2?'#e3e3e7':'#f1f1f4');pattern.append(rect);}
  const visible=c.notes.filter(n=>n.start<project.bars*4*PPQ),low=Math.min(48,...visible.map(n=>n.pitch)),high=Math.max(72,...visible.map(n=>n.pitch));
  for(const n of visible){const rect=document.createElementNS(pattern.namespaceURI,'rect');rect.setAttribute('x',n.start/(project.bars*4*PPQ)*400);rect.setAttribute('y',3+(high-n.pitch)/(high-low)*20);rect.setAttribute('width',Math.max(2,Math.min(n.duration,project.bars*4*PPQ-n.start)/(project.bars*4*PPQ)*400-1));rect.setAttribute('height',2.5);rect.setAttribute('rx',1);rect.setAttribute('fill',displayColor(c.color));pattern.append(rect);}
  const menu=document.createElement('button');menu.className='channel-more';menu.innerHTML=icon('more');menu.setAttribute('aria-label',`${c.name} options`);menu.onclick=e=>{e.stopPropagation();setSelected(i,false);showChannelMenu();};
  const mix=document.createElement('div');mix.className='rack-knobs';for(const key of ['pan','volume']){const pan=key==='pan';const knob=new Knob({label:pan?'PAN':'VOL',min:pan?-1:0,max:1,value:c[key],reset:pan?0:.72,small:true,format:v=>pan?(Math.abs(v)<.01?'C':`${v<0?'L':'R'}${Math.round(Math.abs(v)*100)}`):`${Math.round(v*100)}%`,beforeChange:checkpoint,change:v=>{c[key]=v;changed('quiet');},commit:()=>{renderHistory();}});knob.dial.setAttribute('aria-label',`${c.name} ${pan?'Pan':'Volume'}`);mix.append(knob.element);}const midi=document.createElement('button');midi.className='midi-window';midi.setAttribute('aria-label',`Open ${c.name} piano roll`);midi.append(pattern);midi.onclick=()=>setSelected(i,true);item.append(number,mix,name,controls,midi,menu);enableChannelSwipe(item,i);$('channels').append(item);
 });$('add-channel').disabled=project.channels.length>=MAX_CHANNELS;
}

function enableChannelSwipe(item,index){const remove=document.createElement('button');remove.className='channel-delete';remove.textContent='Delete';remove.setAttribute('aria-label',`Delete ${project.channels[index].name}`);remove.onclick=()=>{const body=dialog('Delete channel?');paragraph(body,project.channels[index].name);action(body,'Cancel','',()=>$('dialog').close());action(body,'Delete','',()=>{checkpoint();project.channels.splice(index,1);selected=clamp(selected-(index<selected?1:0),0,project.channels.length-1);changed();$('dialog').close();},'danger');};item.append(remove);let start=null,swiped=false;item.addEventListener('pointerdown',e=>{swiped=false;if(e.target.closest('.knob-control,.channel-switches,.channel-more,.channel-delete'))return;start={x:e.clientX,y:e.clientY};swiped=false;});item.addEventListener('pointermove',e=>{if(!start)return;const x=e.clientX-start.x,y=e.clientY-start.y;if(Math.abs(x)>30&&Math.abs(x)>Math.abs(y)*1.2){swiped=true;item.classList.toggle('reveal-delete',x<0);}});item.addEventListener('pointerup',()=>start=null);item.addEventListener('pointercancel',()=>start=null);item.addEventListener('click',e=>{if(swiped){e.preventDefault();e.stopImmediatePropagation();swiped=false;}},true);}

function option(select,value,label,selected=false){const o=document.createElement('option');o.value=value;o.textContent=label;o.selected=selected;select.append(o);}
function renderPresets(){const c=current();if(!c)return;const font=fonts.get(c.fontId);$('font-picker-name').textContent=font?.name||'Locate SoundFont';$('preset-picker-name').textContent=c.presetName||'Choose instrument';$('target-channel').textContent=`CH ${String(selected+1).padStart(2,'0')}`;$('target-channel').style.color=c.color;$('roll-channel').textContent=c.name;$('roll-channel').style.color=c.color;$('preset-prev').disabled=$('preset-next').disabled=!font?.presets.length;if(browserMode)renderBrowser();}
function closeBrowser(){browserMode=null;$('player').classList.remove('browsing');$('player-browser').hidden=true;$('selector-back').hidden=true;$('player-title').textContent='SoundFont';}
function openBrowser(mode){browserMode=mode;$('player').classList.add('browsing');$('player-browser').hidden=false;$('selector-back').hidden=false;$('selector-search').value='';$('player-title').textContent=mode==='fonts'?'SoundFonts':'Instruments';$('browser-import').hidden=mode!=='fonts';renderBrowser();}
function renderBrowser(){
 const list=$('selector-list'),c=current(),query=$('selector-search').value.toLowerCase(),isFonts=browserMode==='fonts';list.replaceChildren();
 $('browser-import').hidden=!isFonts;
 const entries=isFonts?[...fonts.values()]:fonts.get(c.fontId)?.presets||[];
 for(const item of entries){if(!item.name.toLowerCase().includes(query))continue;
  const row=document.createElement('div');row.className='font-list-row';const chosen=isFonts?item.id===c.fontId:item.bank===c.bank&&item.program===c.program;
  const b=document.createElement('button');b.className='selector-item'+(chosen?' selected':'');b.setAttribute('aria-label',item.name);
  const name=document.createElement('span');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=isFonts?`${item.presets.length} sounds`:`${item.bank} : ${String(item.program).padStart(3,'0')}`;b.append(name,meta);
  b.onclick=()=>Promise.resolve(isFonts?chooseFont(item):choosePreset(item)).then(closeBrowser).catch(e=>toast(e.message,true));row.append(b);
  if(isFonts&&item.id===STANDARD_FONT.id){const more=document.createElement('button');more.className='font-more';more.innerHTML=icon('more');more.setAttribute('aria-label',`${item.name} options`);more.onclick=()=>{const body=dialog(item.name);paragraph(body,'GeneralUser GS SoftSynth 1.44 · S. Christian Collins');const a=document.createElement('a');a.href='./GeneralUser-LICENSE.txt';a.target='_blank';a.textContent='License';body.append(a);};row.append(more);}
  list.append(row);
 }
 if(!list.children.length){const empty=document.createElement('p');empty.className='library-empty';empty.textContent='No sounds';list.append(empty);}
}
async function chooseFont(font){audio.unlock().catch(e=>toast(e.message,true));await ensureFontBlob(font.id);checkpoint();const c=current(),p=font.presets[0];c.fontId=font.id;c.bank=p.bank;c.program=p.program;c.presetName=p.name;c.name=p.name;changed();auditionSelection();}
on('font-picker','click',()=>openBrowser('fonts'));on('preset-picker','click',()=>openBrowser('presets'));on('selector-back','click',closeBrowser);on('selector-search','input',()=>renderBrowser());
function nextPreset(step){const c=current(),presets=fonts.get(c.fontId)?.presets||[];if(!presets.length)return;const i=presets.findIndex(p=>p.bank===c.bank&&p.program===c.program);choosePreset(presets[(i+step+presets.length)%presets.length]);}
on('preset-prev','click',()=>nextPreset(-1));on('preset-next','click',()=>nextPreset(1));
function choosePreset(p){checkpoint();const c=current();const rename=c.name===c.presetName||c.name.startsWith('Channel ');c.bank=p.bank;c.program=p.program;c.presetName=p.name;if(rename)c.name=p.name;changed();auditionSelection();}
let selectedSoundPreview=null;
function auditionSelection(){if(selectedSoundPreview)previewOff(selectedSoundPreview);const id='sound-'+uid();selectedSoundPreview=id;const pitch=roll.selectedNote?.pitch??current().notes[0]?.pitch??60;preview(pitch,id).then(()=>setTimeout(()=>{previewOff(id);if(selectedSoundPreview===id)selectedSoundPreview=null;},350));}
const timeText=v=>v<1?`${Math.round(v*1000)} ms`:`${v.toFixed(2)} s`;
const envKnobs=new Map();let envelopeChannel=null;
function renderEnvelope(){if(!current())return;const e=envelopeDefaults(current().adsr),duration=roll?.selectedNote?.duration,width=Math.max(220,$('envelope-graph').clientWidth||340),graph=envelopeGraph(e,project.bpm,duration?duration/PPQ*60/project.bpm:null,width);$('envelope-graph').setAttribute('viewBox',`0 0 ${width} 86`);$('env-time').setAttribute('x',width-8);$('envelope-line').setAttribute('d',graph.path);$('envelope-gate').setAttribute('d',`M${graph.gateX} 10V70`);$('env-off').setAttribute('x',graph.gateX);$('env-time').textContent=timeText(graph.total);$('envelope-graph').style.opacity=e.enabled?'1':'.35';$('envelope-nodes').replaceChildren();for(const point of graph.stages){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);circle.setAttribute('r',2.5);circle.setAttribute('fill','#18221b');circle.setAttribute('stroke','#a9e5a4');$('envelope-nodes').append(circle);}}
function renderControls(){const c=current();if(!c)return;c.adsr=envelopeDefaults(c.adsr);channelCent.set(c.cents??0);const e=c.adsr;$('adsr-enabled').checked=e.enabled;$('env-tempo').checked=e.tempo;if(envelopeChannel!==c.id){envelopeChannel=c.id;envKnobs.clear();$('envelope-knobs').replaceChildren();$('tension-knobs').replaceChildren();for(const [key,label,max]of [['delay','DEL',4],['a','ATT',8],['hold','HOLD',4],['d','DEC',8],['s','SUS',1],['r','REL',8],['curveA','ATT',1],['curveD','DEC',1],['curveR','REL',1]]){const curve=key.startsWith('curve'),normalized=curve||key==='s';const direction=key==='curveD'||key==='curveR'?-1:1;const toValue=v=>normalized?v*direction:Math.min(max,.001*Math.expm1(v*Math.log1p(max/.001)));const fromValue=v=>normalized?v*direction:Math.log1p(v/.001)/Math.log1p(max/.001);const format=v=>{const val=toValue(v);return curve?`${v>0?'+':''}${Math.round(v*100)}%`:key==='s'?`${Math.round(val*100)}%`:current().adsr.tempo?`${(val*2).toFixed(2)} b`:timeText(val);};const knob=new Knob({label,min:curve?-1:0,max:1,value:fromValue(e[key]),reset:0,small:curve,format,beforeChange:checkpoint,change:v=>{current().adsr[key]=toValue(v);changed('quiet');renderEnvelope();},commit:()=>renderHistory()});knob.dial.setAttribute('aria-label',({delay:'Delay',a:'Attack',hold:'Hold',d:'Decay',s:'Sustain',r:'Release',curveA:'Attack tension',curveD:'Decay tension',curveR:'Release tension'})[key]);envKnobs.set(key,{knob,fromValue});$(curve?'tension-knobs':'envelope-knobs').append(knob.element);}}for(const [key,{knob,fromValue}]of envKnobs)knob.set(fromValue(e[key]));renderEnvelope();}

const pitchButtons=new Map();
const signed=v=>v>0?'+'+v:String(v);
for(const [key,label]of [['note','NOTE'],['cents','CENT']]){
 const button=document.createElement('button');button.className='pitch-picker';button.setAttribute('aria-haspopup','dialog');
 const value=document.createElement('output'),caption=document.createElement('span');caption.textContent=label;button.append(value,caption);
 let drag=null,suppressClick=false;
 button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);drag={id:e.pointerId,y:e.clientY,value:project.pitch?.[key]??0,changed:false};suppressClick=false;};
 button.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const dy=drag.y-e.clientY;if(!drag.changed&&Math.abs(dy)<6)return;if(!drag.changed){checkpoint();drag.changed=true;suppressClick=true;}const max=key==='note'?24:100,v=clamp(Math.round(drag.value+dy*(max*2)/180),-max,max);project.pitch[key]=v;changed('quiet');renderPitch();showPitchValue(key,v);};
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;const moved=drag.changed;drag=null;if(moved)hidePitchValue();};button.onpointerup=button.onpointercancel=button.onlostpointercapture=end;
 button.onclick=()=>{if(suppressClick){suppressClick=false;return;}showPitchPicker(key);};pitchButtons.set(key,{button,value});$('master-pitch-knobs').append(button);
}
let pitchHud=null,pitchHudTimer;
function showPitchValue(key,value){clearTimeout(pitchHudTimer);if(!pitchHud){pitchHud=document.createElement('div');pitchHud.className='pitch-hud';pitchHud.setAttribute('aria-live','polite');pitchHud.append(document.createElement('output'),document.createElement('span'));}$('sound-dialog').open?$('sound-dialog').append(pitchHud):$('app').append(pitchHud);pitchHud.firstElementChild.textContent=key==='bpm'?String(value):signed(value);pitchHud.lastElementChild.textContent=key==='note'?'semitones':key==='bpm'?'BPM':'cents';pitchHud.hidden=false;}
function hidePitchValue(){clearTimeout(pitchHudTimer);pitchHudTimer=setTimeout(()=>{if(pitchHud)pitchHud.hidden=true;},450);}
function renderPitch(){project.pitch??={note:0,cents:0};for(const [key,{button,value}]of pitchButtons){value.textContent=signed(project.pitch[key]);button.setAttribute('aria-label',`Master ${key}, ${signed(project.pitch[key])}`);}}
function showPitchPicker(key){showTempoPicker(key);}
const delayKnobs=new Map();
const delayParameters=[
 ['pan','PAN','Input pan','input',-1,1,0,v=>Math.abs(v)<.01?'C':`${v<0?'L':'R'}${Math.round(Math.abs(v)*100)}`],
 ['input','VOL','Input volume','input',0,1,.35,v=>`${Math.round(v*100)}%`],
 ['feedback','VOL','Feedback volume','feedback',0,1,.35,v=>`${Math.round(v*100)}%`],
 ['cut','CUT','Feedback cutoff','feedback',0,1,Math.log(6000/20)/Math.log(1000),v=>{const hz=20*1000**v;return hz>=1000?`${(hz/1000).toFixed(1)}k`:`${Math.round(hz)}Hz`;}],
 ['time','TIME','Delay time','time',0,TIME_DIVISIONS.length-1,delayTimeIndex(4),v=>TIME_DIVISIONS[Math.round(v)][0]],
 ['offset','OFS','Stereo offset','time',-1,1,0,v=>Math.abs(v)<.005?'0 ms':`${v<0?'L':'R'} ${Math.round(Math.abs(v)*50)}`],
 ['dry','VOL','Dry volume','dry',0,1,1,v=>`${Math.round(v*100)}%`]
];
for(const [key,label,accessible,group,min,max,reset,format] of delayParameters){const knob=new Knob({label,min,max,reset,format,step:key==='time'?1:null,beforeChange:checkpoint,change:v=>{project.delay[key]=key==='cut'?20*1000**v:key==='time'?TIME_DIVISIONS[Math.round(v)][1]:v;changed('quiet');},commit:()=>renderDelay()});knob.dial.setAttribute('aria-label',accessible);delayKnobs.set(key,knob);$('delay-'+group).append(knob.element);}
function renderDelay(){project.delay=delayDefaults(project.delay);const d=project.delay;$('delay-enabled').checked=d.enabled;for(const [key,knob]of delayKnobs)knob.set(key==='cut'?Math.log(d.cut/20)/Math.log(1000):key==='time'?delayTimeIndex(d.time):d[key]);for(const radio of document.querySelectorAll('input[name="delay-mode"]'))radio.checked=radio.value===d.mode;}
on('delay-enabled','change',()=>{checkpoint();project.delay.enabled=$('delay-enabled').checked;changed('quiet');});
for(const radio of document.querySelectorAll('input[name="delay-mode"]'))radio.onchange=()=>{checkpoint();project.delay.mode=radio.value;changed('quiet');};
for(const effect of ['envelope','delay'])on(effect+'-tab','click',()=>{for(const tab of ['envelope','delay']){$(tab+'-tab').setAttribute('aria-selected',String(tab===effect));$(tab+'-panel').hidden=tab!==effect;}});

function renderAll(){selected=clamp(selected,0,Math.max(0,project.channels.length-1));const empty=!project.channels.length;if(empty){setEditor(false);$('sound-dialog').close();}for(const id of ['play','main-menu','roll-channel-menu','export-btn'])$(id).disabled=empty||!ready;$('project-name').textContent=project.name;$('bpm').value=project.bpm;$('bpm-value').value=project.bpm;$('bpm').setAttribute('aria-label',`BPM, ${project.bpm}`);$('bars').value=project.bars;$('bars-picker').textContent=`${project.bars} ${project.bars===1?'bar':'bars'}`;$('metronome').classList.toggle('active',project.metronome);$('metronome').setAttribute('aria-pressed',String(project.metronome));renderRack();renderPresets();renderControls();renderPitch();renderDelay();renderHistory();roll.set(project,selected);}
function renderPlayButton(){const interrupted=playing&&audio.context?.state!=='running';$('play').classList.toggle('playing',playing&&!interrupted);$('play').setAttribute('aria-label',interrupted?'Resume playback':playing?'Stop playback':'Play');$('play').innerHTML=icon(playing&&!interrupted?'pause':'play');}
async function startPlayback(tick=0){
 if(!ready||!project.channels.length)return;const token=++playToken;startingPlayback=true;$('play').disabled=true;
 try{await audio.ensure(project);if(token!==playToken)return;heldPreviews.clear();audio.send('start',{tick});playing=true;roll.tick=tick;roll.updatePlayhead();renderPlayButton();}
 catch(error){if(token===playToken){stop();throw error;}}finally{if(token===playToken){startingPlayback=false;$('play').disabled=!ready||!project.channels.length;}}
}
let startingPlayback=false;
function stop(){playToken++;startingPlayback=false;playing=false;audio.stop();heldPreviews.clear();$('play').disabled=!ready||!project.channels.length;renderPlayButton();$('position').innerHTML='01<span>:</span>01<span>:</span>00';roll.tick=-1;roll.draw();}
on('play','click',async()=>{if(playing&&!audio.broken){if(audio.context?.state!=='running'){try{await audio.resume();}catch(error){stop();throw error;}renderPlayButton();return;}stop();return;}await startPlayback();});on('stop','click',stop);
on('go-to-start','click',async()=>{roll.x=0;roll.tick=0;roll.draw();if(playing||startingPlayback)await startPlayback(0);else{$('position').innerHTML='01<span>:</span>01<span>:</span>00';}});
audio.addEventListener('position',({detail:d})=>{if(playing&&d.playing){roll.tick=d.tick;roll.updatePlayhead();const beat=Math.floor(d.tick/PPQ);$('position').innerHTML=`${String(Math.floor(beat/4)+1).padStart(2,'0')}<span>:</span>${String(beat%4+1).padStart(2,'0')}<span>:</span>${String(Math.floor(d.tick%PPQ/PPQ*100)).padStart(2,'0')}`;}$('meter-fill').style.width=Math.min(100,d.peak*200)+'%';});
audio.addEventListener('state',({detail:state})=>{$('audio-status').textContent=state==='running'?'AUDIO READY':'Tap Play to resume audio';$('audio-light').classList.toggle('on',state==='running');renderPlayButton();});audio.addEventListener('error',({detail})=>{stop();toast(detail.error,true);});
window.addEventListener('pagehide',()=>audio.reset());
bindAudioLifecycle({isPlaying:()=>playing,resume:()=>audio.resume(),stop,save:()=>dirty?save():Promise.resolve()});
on('bars','change',()=>{checkpoint();project.bars=Number($('bars').value);changed();});on('metronome','click',()=>{checkpoint();project.metronome=!project.metronome;changed();});
on('add-channel','click',()=>{if(project.channels.length>=MAX_CHANNELS)return;checkpoint();const c=channel(project.channels.length);c.fontId=current()?.fontId??STANDARD_FONT.id;const p=fonts.get(c.fontId)?.presets[0];if(p){c.bank=p.bank;c.program=p.program;c.presetName=p.name;c.name=p.name;}project.channels.push(c);selected=project.channels.length-1;changed();warmChannel();});
on('adsr-enabled','change',()=>{checkpoint();current().adsr.enabled=$('adsr-enabled').checked;changed();});on('env-tempo','change',()=>{checkpoint();current().adsr.tempo=$('env-tempo').checked;changed();});
for(const mode of ['draw','erase'])on(mode+'-tool','click',()=>{roll.mode=mode;for(const tool of ['draw','erase']){$(tool+'-tool').classList.toggle('active',tool===mode);$(tool+'-tool').setAttribute('aria-pressed',String(tool===mode));}$('note-popover').hidden=true;if(mode==='erase'&&roll.selection.size)roll.callbacks.menu({x:40,y:40},roll.selection.size);});on('fit-notes','click',()=>roll.fit());on('delete-note','click',()=>roll.deleteSelected());on('paste-right','click',()=>{if(!roll.pasteRight())toast('The selection does not fit within 32 bars or 20,000 notes.');});on('octave-down','click',()=>roll.transposeSelected(-12));on('octave-up','click',()=>roll.transposeSelected(12));
on('copy-notes','click',()=>roll.copySelected());on('paste-notes','click',()=>roll.pasteNotes());
function undo(){if(!history.past.length)return;project=history.undo(project);selected=clamp(selected,0,project.channels.length-1);changed();}function redo(){if(!history.future.length)return;project=history.redo(project);selected=clamp(selected,0,project.channels.length-1);changed();}on('undo','click',undo);on('redo','click',redo);
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||$('dialog').open||$('sound-dialog').open)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(e.code==='Space'){e.preventDefault();$('play').click();}});
let split=40;function setSplit(value){split=clamp(value,25,65);$('studio').style.setProperty('--split',split+'%');$('splitter').setAttribute('aria-valuenow',Math.round(split));}on('splitter','pointerdown',e=>{$('splitter').setPointerCapture(e.pointerId);});on('splitter','pointermove',e=>{if(!$('splitter').hasPointerCapture(e.pointerId))return;const r=$('studio').getBoundingClientRect();setSplit((e.clientY-r.top)/r.height*100);});on('splitter','pointerup',()=>storage.put('settings',{id:'split',value:split}));on('splitter','keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setSplit(split+(e.key==='ArrowDown'?2:-2));storage.put('settings',{id:'split',value:split}).catch(()=>{});}});
function clearExportResult(){if(exportPreview){exportPreview.pause();exportPreview.onplay=exportPreview.onerror=exportPreview.onloadedmetadata=null;exportPreview.removeAttribute('src');exportPreview.load();exportPreview=null;}for(const url of objectUrls)URL.revokeObjectURL(url);objectUrls=[];}
function dialog(title){clearExportResult();$('dialog').classList.remove('choice-dialog','tempo-dialog','pitch-dialog');$('dialog-title').textContent=title;$('dialog-body').replaceChildren();if(!$('dialog').open)$('dialog').showModal();return $('dialog-body');}function paragraph(body,text,cls=''){const p=document.createElement('p');p.textContent=text;p.className=cls;body.append(p);return p;}function action(body,label,description,fn,cls=''){const b=document.createElement('button');b.className='dialog-button '+cls;b.textContent=label;if(description){const s=document.createElement('small');s.textContent=description;b.append(s);}b.onclick=()=>Promise.resolve(fn()).catch(e=>toast(e.message,true));body.append(b);return b;}on('dialog-close','click',()=>$('dialog').close());on('dialog','click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});$('dialog').addEventListener('close',()=>{exportRun++;clearExportResult();if(exportWorker){exportWorker.terminate();exportWorker=null;toast('WAV export cancelled.');}});
on('project-name','click',()=>{const b=dialog('Project name');const input=document.createElement('input');input.type='text';input.value=project.name;input.maxLength=80;input.setAttribute('aria-label','Project name');b.append(input);action(b,'Save name','',()=>{checkpoint();project.name=input.value.trim()||'Untitled sketch';changed();$('dialog').close();},'primary');input.focus();});
function showChannelMenu(){const c=current(),body=dialog(c.name);action(body,'Rename','',()=>{const b=dialog('Channel name');const input=document.createElement('input');input.type='text';input.value=c.name;input.maxLength=60;b.append(input);action(b,'Save changes','',()=>{checkpoint();c.name=input.value.trim()||'Channel';changed();$('dialog').close();},'primary');input.focus();});action(body,'Duplicate channel','Copy notes and instrument settings',()=>{if(project.channels.length>=MAX_CHANNELS)throw Error('Up to 16 channels are supported.');checkpoint();const next=clone(c);next.id=uid();next.name+=' copy';next.solo=false;next.color=COLORS[project.channels.length%COLORS.length];next.notes.forEach(n=>n.id=uid());project.channels.push(next);selected=project.channels.length-1;changed();$('dialog').close();});action(body,'Delete channel','You can undo this.',()=>{checkpoint();project.channels.splice(selected,1);selected=Math.min(selected,project.channels.length-1);changed();$('dialog').close();},'danger');}
on('roll-channel-menu','click',showExport);on('back-to-rack','click',()=>{setEditor(false);$('note-popover').hidden=true;});
on('save-btn','click',async()=>{await save();toast('Saved in this browser.');});
async function openProjects(skipSave=false){if(skipSave!==true)await save();stop();$('dialog').close();$('sound-dialog').close();$('app').classList.add('projects-open');$('project-page').hidden=false;$('new-project').hidden=false;const list=$('project-list');list.replaceChildren();const projects=(await storage.all('projects')).sort((a,b)=>b.updatedAt-a.updatedAt);for(const p of projects){const wrap=document.createElement('div');wrap.className='project-swipe';const row=document.createElement('button');row.className='project-list-item';const title=document.createElement('strong');title.textContent=p.name;const meta=document.createElement('span');meta.textContent=`${new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date(p.updatedAt||Date.now()))} · ${p.channels.length} ${p.channels.length===1?'channel':'channels'}`;row.append(title,meta);const remove=document.createElement('button');remove.className='project-delete';remove.textContent='Delete';remove.setAttribute('aria-label',`Delete ${p.name}`);remove.onclick=()=>confirmDeleteProject(p);let start=null,moved=false,hold;row.onpointerdown=e=>{start={x:e.clientX,y:e.clientY};moved=false;hold=setTimeout(()=>{moved=true;confirmDeleteProject(p);},600);};row.onpointermove=e=>{if(!start)return;const x=e.clientX-start.x,y=e.clientY-start.y;if(Math.hypot(x,y)>8)clearTimeout(hold);if(Math.abs(x)>30&&Math.abs(x)>Math.abs(y)*1.2){moved=true;wrap.classList.toggle('reveal-delete',x<0);}};row.onpointerup=row.onpointercancel=()=>{clearTimeout(hold);start=null;};row.oncontextmenu=e=>{e.preventDefault();clearTimeout(hold);moved=true;confirmDeleteProject(p);};row.onkeydown=e=>{if(e.key==='Delete'){e.preventDefault();confirmDeleteProject(p);}};row.onclick=()=>{if(moved)return;if(wrap.classList.contains('reveal-delete')){wrap.classList.remove('reveal-delete');return;}if(p.channels.some(c=>c.type==='sample')||p.patterns?.length>1||p.arrangement?.clips?.length){toast('This saved draft uses APK-only features. Its data is kept.',true);return;}project=validateProject(p);audio.reset();hasOpenProject=true;selected=0;history.clear();closeProjects();changed();roll.fit();notifyMissing();};const more=document.createElement('button');more.className='project-more';more.innerHTML=icon('more');more.setAttribute('aria-label',`${p.name} options`);more.onclick=()=>confirmDeleteProject(p);wrap.append(row,more,remove);list.append(wrap);}}
function confirmDeleteProject(p){const body=dialog('Delete project?');paragraph(body,p.name);action(body,'Cancel','',()=>$('dialog').close());action(body,'Delete','',async()=>{clearTimeout(saveTimer);await storage.remove('projects',p.id);if(project.id===p.id){hasOpenProject=false;const remaining=(await storage.all('projects')).sort((a,b)=>b.updatedAt-a.updatedAt);project=remaining.length?validateProject(remaining[0]):newProject();selected=0;history.clear();dirty=false;await storage.remove('settings','lastProject');if(remaining.length)await storage.put('settings',{id:'lastProject',value:project.id});else await storage.put('settings',{id:'libraryEmpty',value:true});renderAll();}await openProjects(true);},'danger');}

function closeProjects(){$('app').classList.remove('projects-open');$('project-page').hidden=true;setEditor(false);}
on('back-to-projects','click',openProjects);
on('new-project','click',async()=>{navigator.storage?.persist?.().catch(()=>{});await save();stop();project=newProject();hasOpenProject=true;history.clear();selected=0;closeProjects();changed();});

on('projects-btn','click',openProjects);
function notifyMissing(){const missing=[...new Set(project.channels.map(c=>c.fontId))].filter(id=>!fonts.has(id));if(missing.length)toast(`${missing.length} SoundFont file(s) missing. Load the original SF2 files to restore their sounds.`,true);}
let importingFonts=false;

async function importFonts(input){const files=[...input].filter(f=>/\.sf2$/i.test(f.name));if(importingFonts){toast('Wait for the current import to finish.');return;}if(!files.length){toast('No SF2 files found.');return;}importingFonts=true;navigator.storage?.persist?.().catch(()=>{});const errors=[];let imported=0,first=null;try{for(const file of files){try{toast(`Loading ${file.name} (${imported+1}/${files.length})…`);const {presets,sampleBytes}=await inspectFont(file),id=await fontId(file);let font=fonts.get(id);if(!font){font={id,name:file.name,blob:new Blob([file]),presets,sampleBytes,size:file.size};await storage.put('fonts',font);fonts.set(id,font);}else if(!fontBlob(font)){font.blob=new Blob([file]);await storage.put('fonts',font);}first??=font;imported++;if(browserMode==='fonts')renderBrowser();}catch(e){errors.push(`${file.name}: ${e.message}`);}}if(first&&current()){checkpoint();const c=current(),preset=first.presets[0];Object.assign(c,{fontId:first.id,bank:preset.bank,program:preset.program,presetName:preset.name,name:preset.name});changed();closeBrowser();}toast(errors.length?`${imported} loaded. ${errors.join(' ')}`:`${imported} SoundFont${imported===1?'':'s'} saved.`,!!errors.length);}finally{importingFonts=false;}}
on('sf2-input','change',e=>{const files=[...e.target.files];e.target.value='';return importFonts(files);});
for(const event of ['dragenter','dragover'])document.addEventListener(event,e=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();if(browserMode==='fonts')$('player-browser').classList.add('drag-over');});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget||!$('player-browser').contains(e.relatedTarget))$('player-browser').classList.remove('drag-over');});
document.addEventListener('drop',e=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();$('player-browser').classList.remove('drag-over');const files=droppedSoundFonts(e.dataTransfer);files.then(importFonts).catch(error=>toast(error.message,true));});
function download(blob,name,body){const file=blob instanceof File?blob:new File([blob],name,{type:blob.type}),url=URL.createObjectURL(file);objectUrls.push(url);const a=document.createElement('a');a.href=url;a.download=file.name;a.textContent='Save file';a.onclick=()=>exportPreview?.pause();if(body){const result=document.createElement('div');result.className='export-result';if(canShareFile(file)){const button=document.createElement('button');button.className='share-file-button';button.textContent='Export';button.onclick=async()=>{button.disabled=true;try{exportPreview?.pause();stop();await shareFile(file);}catch(e){toast('Could not open sharing. Use Save file.',true);}finally{button.disabled=false;}};result.append(button);}result.append(a);body.append(result);}return {url,a};}
const safeName=()=>project.name.replace(/[\\/:*?"<>|]/g,'_').slice(0,70)||'Sketch';
function showExport(){if(!project.channels.length)return;const b=dialog('Export');action(b,'Audio','WAV',()=>renderWav(true));action(b,'MIDI','.mid',()=>{const body=dialog('MIDI');download(new Blob([midiBytes(project)],{type:'audio/midi'}),safeName()+'.mid',body);});}
on('export-btn','click',showExport);
async function renderWav(tail){
 const token=++exportRun,snapshot=clone(project),filename=safeName()+'.wav',ids=[...new Set(snapshot.channels.map(c=>c.fontId))];stop();
 const b=dialog('Preparing audio…'),progress=document.createElement('progress');progress.max=1;progress.value=0;b.append(progress);
 const failed=error=>{if(token!==exportRun)return;exportWorker?.terminate();exportWorker=null;showExport();toast(error.message||String(error),true);};
 try{
  for(const id of ids){await ensureFontBlob(id);if(token!==exportRun)return;}
  const worker=new Worker('./export-worker.js',{type:'module'});exportWorker=worker;
  worker.onmessage=({data})=>{
   if(token!==exportRun)return;
   if(data.progress!==undefined){progress.value=data.progress;return;}
   worker.terminate();exportWorker=null;
   try{
    if(data.error)throw Error(data.error);
    const file=wavFile(data.buffer,filename),info=inspectWav(data.buffer),body=dialog('Audio');
    paragraph(body,`44.1 kHz · Stereo · 16-bit · ${(file.size/1024/1024).toFixed(1)} MB`);
    if(data.tailLimited)paragraph(body,'The effect tail reached the two-minute limit.');
    if(data.clipped)paragraph(body,'Clipping detected. Lower the channel volumes and export again.');
    const player=document.createElement('audio');player.controls=true;player.preload='metadata';player.setAttribute('aria-label','Exported audio');player.style.width='100%';body.append(player);exportPreview=player;
    // This player and the share sheet receive the exact same file. No Web Audio
    // conversion or live rendering is involved in checking the exported audio.
    player.onplay=()=>stop();player.onerror=()=>toast('This browser could not read the exported audio file.',true);
    player.onloadedmetadata=()=>{if(Math.abs(player.duration-info.duration)>.05)toast('The exported audio duration could not be verified.',true);};
    player.src=download(file,filename,body).url;
   }catch(error){failed(error);}
  };
  worker.onerror=e=>failed(Error(e.message||'Export failed.'));
  worker.postMessage({project:snapshot,fonts:ids.map(id=>({id,blob:fontBlob(fonts.get(id))})),tail});
 }catch(error){failed(error);}
}

// The MIDI canvas owns the main screen; sound design opens only when requested.
const transport=document.querySelector('.transport'),playHome=document.querySelector('.transport-controls'),rollToolbar=document.querySelector('.roll-toolbar');
const transportDock=document.createElement('div');transportDock.className='transport-dock';transport.hidden=false;$('app').append(transportDock);transportDock.append(transport);playHome.prepend($('play'));
function setEditor(open){document.querySelector('.sequencer').classList.toggle('show-roll',open);$('app').classList.toggle('editing',open);requestAnimationFrame(()=>roll.draw());}
function positionSoundPlay(){const r=transportDock.getBoundingClientRect();$('sound-dialog').style.setProperty('--transport-left',r.left+'px');$('sound-dialog').style.setProperty('--transport-top',r.top+'px');$('sound-dialog').style.setProperty('--transport-width',r.width+'px');}
new ResizeObserver(()=>{if($('sound-dialog').open)positionSoundPlay();}).observe($('app'));
function openSound(){if(!current())return;closeBrowser();positionSoundPlay();$('sound-transport').append(transport);$('sound-dialog').showModal();requestAnimationFrame(renderEnvelope);}
on('sound-close','click',()=>$('sound-dialog').close());on('roll-channel','click',openSound);
on('main-menu','click',showExport);



function showTempoPicker(parameter='bpm'){
 const isTempo=parameter==='bpm',min=isTempo?30:parameter==='note'?-24:-100,max=isTempo?300:-min,title=isTempo?'BPM':parameter==='note'?'Master note':'Master cents',read=()=>isTempo?project.bpm:project.pitch[parameter],format=isTempo?String:signed;
 const body=dialog(title);$('dialog').classList.add('tempo-dialog');
 const frame=document.createElement('div');frame.className='tempo-wheel-frame';
 const wheel=document.createElement('div');wheel.className='tempo-wheel';wheel.role='listbox';wheel.tabIndex=0;wheel.setAttribute('aria-label',title);
 const options=[];let timer,edited=false,closing=false,pending=read(),drag=null,flight=0,suppressClick=false;
 for(let value=min;value<=max;value++){const item=document.createElement('div');item.className='tempo-option';item.role='option';item.id=`wheel-${parameter}-${value}`;item.textContent=format(value);item.setAttribute('aria-selected',String(value===read()));item.onclick=()=>wheel.scrollTo({top:(value-min)*40,behavior:'smooth'});wheel.append(item);options.push(item);}
 const finishSpin=()=>{cancelAnimationFrame(flight);wheel.classList.remove('scrubbing');wheel.scrollTop=Math.round(wheel.scrollTop/40)*40;};
 wheel.addEventListener('pointerdown',e=>{cancelAnimationFrame(flight);wheel.classList.add('scrubbing');drag={id:e.pointerId,y:e.clientY,start:e.clientY,at:performance.now(),velocity:0};suppressClick=false;wheel.setPointerCapture(e.pointerId);});
 wheel.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const now=performance.now(),dy=drag.y-e.clientY,dt=Math.max(8,now-drag.at);if(Math.abs(e.clientY-drag.start)>4)suppressClick=true;const gain=clamp(.75+Math.abs(dy)/dt*3.5,1,6),distance=dy*gain;wheel.scrollTop+=distance;drag.velocity=clamp(distance/dt,-12,12);drag.y=e.clientY;drag.at=now;});
 const release=e=>{if(!drag||e.pointerId!==drag.id)return;let speed=performance.now()-drag.at<90?drag.velocity:0;drag=null;if(e.type==='pointercancel'||!suppressClick){finishSpin();if(e.type!=='pointercancel'){const r=wheel.getBoundingClientRect(),value=clamp(Math.floor((e.clientY-r.top+wheel.scrollTop-80)/40)+min,min,max);wheel.scrollTo({top:(value-min)*40,behavior:'smooth'});}return;}let previous=performance.now();const glide=now=>{if(closing)return;const dt=Math.min(32,now-previous);previous=now;wheel.scrollTop+=speed*dt;speed*=Math.exp(-dt/180);if(Math.abs(speed)<.035||wheel.scrollTop<=0||wheel.scrollTop>=wheel.scrollHeight-wheel.clientHeight){finishSpin();return;}flight=requestAnimationFrame(glide);};flight=requestAnimationFrame(glide);};
 wheel.addEventListener('pointerup',release);wheel.addEventListener('pointercancel',release);wheel.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
 const nearest=()=>clamp(Math.round(wheel.scrollTop/40)+min,min,max);
 const showValue=()=>{const value=nearest();pending=value;for(let i=0;i<options.length;i++)options[i].setAttribute('aria-selected',String(i+min===value));wheel.setAttribute('aria-activedescendant',`wheel-${parameter}-${value}`);return value;};
 const commit=()=>{const value=pending;if(value===read())return;if(!edited){checkpoint();edited=true;}if(isTempo){project.bpm=value;$('bpm-value').value=value;$('bpm').setAttribute('aria-label',`BPM, ${value}`);renderEnvelope();}else{project.pitch[parameter]=value;renderPitch();}changed('quiet');};
 wheel.addEventListener('scroll',()=>{if(closing)return;showValue();clearTimeout(timer);timer=setTimeout(commit,90);},{passive:true});
 wheel.addEventListener('keydown',e=>{const keys={ArrowUp:-1,ArrowDown:1,PageUp:-10,PageDown:10};if(e.key in keys){e.preventDefault();wheel.scrollTo({top:(clamp(nearest()+keys[e.key],min,max)-min)*40});showValue();commit();}else if(e.key==='Enter'){$('dialog').close();}});
 frame.append(wheel);body.append(frame);const done=document.createElement('button');done.className='tempo-done';done.textContent='Done';done.onclick=()=>$('dialog').close();body.append(done);
 wheel.scrollTop=(read()-min)*40;showValue();wheel.focus({preventScroll:true});
 $('dialog').addEventListener('close',()=>{closing=true;cancelAnimationFrame(flight);clearTimeout(timer);commit();},{once:true});
}
function bindTempoDrag(){
 const button=$('bpm');let drag=null,suppressClick=false;
 button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);drag={id:e.pointerId,y:e.clientY,start:e.clientY,at:performance.now(),value:project.bpm,changed:false};suppressClick=false;};
 button.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const now=performance.now(),dy=drag.y-e.clientY,dt=Math.max(8,now-drag.at);if(!drag.changed&&Math.abs(e.clientY-drag.start)<6)return;if(!drag.changed){checkpoint();drag.changed=true;suppressClick=true;}const gain=clamp(.75+Math.abs(dy)/dt*3.5,1,6);drag.value=clamp(drag.value+dy*gain/6,30,300);drag.y=e.clientY;drag.at=now;project.bpm=Math.round(drag.value);$('bpm-value').value=project.bpm;button.setAttribute('aria-label',`BPM, ${project.bpm}`);changed('quiet');renderEnvelope();showPitchValue('bpm',project.bpm);};
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;const moved=drag.changed;drag=null;if(moved)hidePitchValue();};button.onpointerup=button.onpointercancel=button.onlostpointercapture=end;
 button.onclick=()=>{if(suppressClick){suppressClick=false;return;}showTempoPicker();};
}
bindTempoDrag();

function showChoice(title,choices,value,choose){const body=dialog(title);$('dialog').classList.add('choice-dialog');const list=document.createElement('div');list.className='choice-list';list.role='listbox';list.setAttribute('aria-label',title);for(const [key,label]of choices){const button=document.createElement('button');button.className='choice-option';button.role='option';button.setAttribute('aria-selected',String(key===value));const text=document.createElement('span');text.textContent=label;const check=document.createElement('span');check.textContent=key===value?'✓':'';check.setAttribute('aria-hidden','true');button.append(text,check);button.onclick=()=>{choose(key);$('dialog').close();};list.append(button);}body.append(list);}
on('bars-picker','click',()=>showChoice('Bars',[1,2,4,8,16,32].map(n=>[n,`${n} ${n===1?'bar':'bars'}`]),project.bars,n=>{checkpoint();project.bars=n;changed();}));
on('snap-picker','click',()=>showChoice('Snap',SNAP_CHOICES,roll.snapMode,mode=>{roll.snapMode=mode;$('snap-picker').textContent=SNAP_CHOICES.find(c=>c[0]===mode)[1];roll.draw();}));

new ResizeObserver(()=>{if($('envelope-graph').clientWidth)renderEnvelope();}).observe($('envelope-graph'));
async function boot(){
 for(const font of BUNDLED_FONTS)fonts.set(font.id,{...font});
 try{for(const f of await storage.all('fonts')){
  if(f.id==='factory')continue;
  if(f.buffer){f.blob=new Blob([f.buffer]);f.size=f.buffer.byteLength;delete f.buffer;await storage.put('fonts',f);}
  const oldNames=JSON.stringify(f.presets);
  const bundled=BUNDLED_FONTS.find(font=>font.id===f.id);
  if(bundled)Object.assign(f,bundled);
  else f.presets=f.presets.map(p=>({...p,name:cleanSf2Name(p.name)}));
  if(JSON.stringify(f.presets)!==oldNames)await storage.put('fonts',f);
  fonts.set(f.id,f);
 }}catch(e){toast('Could not restore saved data: '+e.message,true);}
 ready=true;renderAll();await openProjects(true);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
const channelCent=new Knob({label:'CENT',min:-100,max:100,value:0,reset:0,step:1,small:true,format:v=>signed(Math.round(v)),beforeChange:checkpoint,change:value=>{if(!current())return;current().cents=Math.round(value);changed('quiet');showPitchValue('cents',current().cents);},commit:hidePitchValue});
channelCent.dial.setAttribute('aria-label','Channel cents');$('channel-cents').append(channelCent.element);
on('slide-tool','click',()=>{roll.slide=!roll.slide;$('slide-tool').classList.toggle('active',roll.slide);$('slide-tool').setAttribute('aria-pressed',String(roll.slide));});
on('toggle-slide','click',()=>{const selected=roll.selectedNotes;if(!selected.length)return;checkpoint();const slide=!selected.every(n=>n.slide);for(const n of selected)n.slide=slide;changed();$('note-popover').hidden=true;});
boot();

// Keep editing gestures in the app while allowing text entry in naming/search fields.
document.addEventListener('contextmenu',e=>{if(!e.target.closest('input[type=text],input[type=search],textarea'))e.preventDefault();});

$('sound-dialog').addEventListener('close',()=>transportDock.append(transport));
