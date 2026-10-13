const {JSDOM}=require('jsdom');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
const root=require('node:path').resolve(__dirname,'..')+'/';
const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only'});
const w=dom.window,context=dom.getInternalVMContext();
const run=code=>vm.runInContext(code,context);
const $=id=>w.document.getElementById(id);
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};
let blobResult,pickerCalls=0,writes=0,closed=0,aborted=0,downloadCalls=0,pickerMode='save',pickerOptions;
w.HTMLAnchorElement.prototype.click=function(){downloadCalls++;};
w.showSaveFilePicker=async options=>{
  pickerCalls++;pickerOptions=options;
  if(pickerMode==='cancel')throw new w.DOMException('Cancelado','AbortError');
  if(pickerMode==='denied')throw new w.DOMException('Sem acesso','NotAllowedError');
  return {createWritable:async()=>({write:async blob=>{if(pickerMode==='write-error')throw Error('Disco cheio');writes++;blobResult=blob;},close:async()=>{closed++;},abort:async()=>{aborted++;}})};
};
w.URL.createObjectURL=blob=>{blobResult=blob;return 'blob:test'};w.URL.revokeObjectURL=()=>{};

w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};
w.HTMLMediaElement.prototype.play=async function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*10})},{get:(o,k)=>o[k]??(()=>{})});
w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
w.createImageBitmap=async()=>({width:640,height:480,close(){}});let clock=0;w.performance.now=()=>clock;w.AudioContext=class{async resume(){}createMediaElementSource(){throw Error('Image must not connect to audio')}};w.Blob=Blob;w.File=File;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
w.__import=async path=>path.endsWith('project-file.mjs')?import(root+'project-file.mjs'):{Input:class{async getPrimaryAudioTrack(){return null}dispose(){}},BlobSource:class{},ALL_FORMATS:[]};
for(const file of ['image-media.js','timeline.js','app.js','formats.js','text-animations.js','export-ui.js','subtitle-projects.js','subtitles-core.js','subtitles.js']){
  run(fs.readFileSync(root+file,'utf8').replaceAll('await import(', 'await __import('));
  if(file==='app.js')run(`media=async function(file,isAudio=false){if(!isAudio&&isImageFile(file))return imageMedia(file);const v=document.createElement(isAudio?'audio':'video');Object.defineProperty(v,'duration',{value:10});Object.defineProperty(v,'readyState',{value:3});let t=0;Object.defineProperty(v,'currentTime',{get:()=>t,set:n=>{t=n;queueMicrotask(()=>v.dispatchEvent(new Event('seeked')))}});return {video:v,file,url:'blob:test',name:file.name,start:0,end:10,volume:1}};`);
}

run(`(async()=>{clips=[await media(new File(['video'],'a.mp4',{type:'video/mp4'}))];clips[0].transition='fade';selected=0;render();await seek(1.250);})()`);await flush();
$('subAdd').click();$('subText').value='Teste de publicação';$('subText').dispatchEvent(new w.Event('input'));$('subEnd').value='3.750';$('subApply').click();
assert.equal(w.CortaSubtitles.snapshot().cues.length,1);assert.equal(w.CortaSubtitles.snapshot().cues[0].text,'Teste de publicação');
$('saveProject').click();await flush();const archive=blobResult;
$('confirmClear').click();await flush();assert.equal(run('clips.length'),0);
const pi=$('projectInput');Object.defineProperty(pi,'files',{value:[new File([archive],'test.corta')],configurable:true});pi.dispatchEvent(new w.Event('change'));await flush();
assert.equal(run('clips.length'),1);assert.equal(run('clips[0].transition'),'fade');assert.equal(w.CortaSubtitles.snapshot().cues[0].end,3.75);
$('subDuplicate').click();assert.equal(w.CortaSubtitles.snapshot().cues.length,2);await $('undoEdit').onclick();await flush();assert.equal(w.CortaSubtitles.snapshot().cues.length,1);
$('subSrt').click();assert.match(await blobResult.text(),/Teste de publicação/);
assert.ok($('transitionGallery'));assert.ok($('textMotion'));assert.ok($('frameFit'));
console.log('PASS: current repository initializes; subtitles edit/export; portable save/reopen preserves transition and captions; Undo; existing transition/animation/framing controls retained.');
await run(`(async()=>{clips=[await media(new File(['image'],'photo.png',{type:'image/png'}))];selected=0;render();await seek(0);})()`);await flush();
assert.equal(run('clips[0].kind'),'image');assert.equal(run('duration()'),5);assert.equal($('clipVolume').disabled,true);
$('imageDuration').value='7.125';await $('imageDuration').onchange();assert.equal(run('duration()'),7.125);
await run('play()');clock=1000;await run('tick()');assert.equal(run('time'),1);run('pause()');clock=2000;assert.equal(run('clips[0].video.currentTime'),1);
await run('seek(2)');await $('split').onclick();assert.equal(run('clips.length'),2);assert.equal(run('clips[1].kind'),'image');assert.equal(run('duration()'),7.125);
$('saveProject').click();await flush();const imageArchive=blobResult;$('confirmClear').click();await flush();
Object.defineProperty(pi,'files',{value:[new File([imageArchive],'images.corta')],configurable:true});pi.dispatchEvent(new w.Event('change'));await flush();
assert.equal(run('clips.length'),2);assert.equal(run('clips[1].kind'),'image');assert.equal(run('duration()'),7.125);
console.log('PASS: image import/clock/pause/duration/split and image project roundtrip. Decoding and canvas simulated.');
await run(`(async()=>{clips=[];for(const name of ['A.png','B.png','C.png'])clips.push(await media(new File(['image'],name,{type:'image/png'})));selected=0;render();await seek(1);})()`);await flush();
const names=()=>run('clips.map(c=>c.name).join(",")');
const cards=()=>[...$('library').children].map(e=>e.querySelector('.library-select span').textContent).join('|');
await $('library').children[0].querySelector('[data-library-control="down"]').onclick();await flush();
assert.equal(names(),'B.png,A.png,C.png');assert.equal(run('selected'),1);assert.equal(run('time'),6);assert.match(cards(),/^1. B.png/);
await $('undoEdit').onclick();await flush();assert.equal(names(),'A.png,B.png,C.png');assert.equal(run('time'),1);
const drag=(from,target,after)=>{const source=$('library').children[from],dest=$('library').children[target];dest.getBoundingClientRect=()=>({top:0,height:100});const dataTransfer={setData(){}};source.ondragstart({dataTransfer,preventDefault(){}});return dest.ondrop({dataTransfer,clientY:after?90:10,preventDefault(){}});};
drag(0,2,true);await flush();assert.equal(names(),'B.png,C.png,A.png');
drag(2,0,false);await flush();assert.equal(names(),'A.png,B.png,C.png');
await run('reorderClip(2,0)');assert.equal(names(),'C.png,A.png,B.png');
assert.equal($('timeline').querySelectorAll('.bar-select')[0].textContent.includes('C.png'),true);
run('exporting=true');await run('reorderClip(0,2)');run('exporting=false');assert.equal(names(),'C.png,A.png,B.png');
$('saveProject').click();await flush();const ordered=blobResult;$('confirmClear').click();await flush();Object.defineProperty(pi,'files',{value:[new File([ordered],'ordered.corta')],configurable:true});pi.dispatchEvent(new w.Event('change'));await flush();assert.equal(names(),'C.png,A.png,B.png');
console.log('PASS: library arrows and drag in both directions, timeline parity, selection/playhead, Undo, export guard and project order persistence.');

// Multiple independent titles, intervals, styles, selection, history and storage.
await run('seek(1)');$('addText').click();$('text').value='Primeiro';$('text').dispatchEvent(new w.Event('input'));
$('textEnd').value='3';$('textEnd').dispatchEvent(new w.Event('input'));
await run('seek(6)');$('addText').click();$('text').value='Segundo';$('text').dispatchEvent(new w.Event('input'));
$('color').value='#ff0000';$('color').dispatchEvent(new w.Event('input'));
assert.equal(run('textClips.length'),2);assert.equal(run('textClips[0].text'),'Primeiro');assert.equal(run('textClips[0].color'),'#ffffff');
assert.equal($('text-track').querySelectorAll('.bar-text').length,2);
$('text-track').querySelector('[data-index="0"] .bar-select').click();assert.equal($('text').value,'Primeiro');
const handle=$('text-track').querySelector('[data-index="0"] .trim-end');handle.onkeydown({key:'ArrowRight',shiftKey:true,preventDefault(){}});await flush();assert.equal(run('textClips[0].end'),3.1);assert.equal(run('textClips[1].start'),6);
await $('undoEdit').onclick();await flush();assert.equal(run('textClips[0].end'),3);
$('removeText').click();assert.equal(run('textClips.length'),1);await $('undoEdit').onclick();await flush();assert.equal(run('textClips.length'),2);
let painted=[];w.capture=(...args)=>painted.push(args[0]);
run("var captureCtx=new Proxy({fillText:window.capture,measureText:t=>({width:20})},{get:(o,k)=>o[k]??(()=>{})});paintText(captureCtx,canvas,2)");assert.deepEqual(painted,['Primeiro','Teste de publicação']);painted=[];
run('paintText(captureCtx,{width:1920,height:1080},7)');assert.deepEqual(painted,['Segundo']);painted=[];
run("paintText(captureCtx,{width:640,height:240},1,{...textSettings(),text:'Amostra',start:0,end:3})");assert.deepEqual(painted,['Amostra']);
$('saveProject').click();await flush();const textArchive=blobResult;$('confirmClear').click();await flush();assert.equal(run('textClips.length'),0);
Object.defineProperty(pi,'files',{value:[new File([textArchive],'titles.corta')],configurable:true});pi.dispatchEvent(new w.Event('change'));await flush();assert.equal(run('textClips.length'),2);assert.equal(run('textClips[1].color'),'#ff0000');
run("textClips[1].start=2;renderTimeline()");assert.equal($('text-track').style.height,'120px');assert.equal($('text-track').parentElement.style.height,'120px');
// Backwards-compatible legacy single-title project.
run("$('text').value='Antigo';$('textStart').value='0';$('textEnd').value='4';restoreTexts(undefined)");assert.equal(run('textClips.length'),1);assert.equal(run('textClips[0].text'),'Antigo');
// Follow during playback, disabled/paused/manual scrolling and restart left.
const viewport=$('timelineScroll');Object.defineProperty(viewport,'clientWidth',{value:400});Object.defineProperty(viewport,'scrollWidth',{value:2000});
run('playing=true;time=9;updateTimelinePlayhead()');assert.ok(viewport.scrollLeft>0);assert.ok(run('76+time*timelineScale()')>viewport.scrollLeft);assert.ok(run('76+time*timelineScale()')<viewport.scrollLeft+400);
$('followPlayhead').checked=false;viewport.scrollLeft=0;run('time=10;updateTimelinePlayhead()');assert.equal(viewport.scrollLeft,0);
$('followPlayhead').checked=true;run('playing=false;updateTimelinePlayhead()');assert.equal(viewport.scrollLeft,0);
viewport.scrollLeft=600;run('playing=true;time=0;updateTimelinePlayhead()');assert.equal(viewport.scrollLeft,0);run('pause()');
console.log('PASS: independent titles, timeline selection/trim/undo, rendering at different times, explicit animation preview, save/open/legacy, overlapping lanes and playback follow opt-out/pause/restart.');
// Save As always opens, writes only after selection, and never downloads on failure.
const before=pickerCalls;await $('saveProject').onclick();assert.equal(pickerCalls,before+1);assert.ok(pickerOptions.suggestedName.endsWith('.corta'));assert.equal(writes,closed);
const initialWrites=writes,initialDownloads=downloadCalls;
pickerMode='cancel';await $('saveProject').onclick();assert.equal(writes,initialWrites);assert.equal(downloadCalls,initialDownloads);assert.match($('status').textContent,/cancelado/);assert.equal(run('busy'),false);
pickerMode='denied';await $('saveProject').onclick();assert.equal(writes,initialWrites);assert.equal(downloadCalls,initialDownloads);assert.match($('status').textContent,/Não foi possível abrir/);
pickerMode='write-error';await $('saveProject').onclick();assert.equal(aborted,1);assert.equal(downloadCalls,initialDownloads);assert.match($('status').textContent,/Disco cheio/);assert.equal(run('busy'),false);
// Unsupported browsers may download only after explicit confirmation.
delete w.showSaveFilePicker;w.confirm=()=>false;await $('saveProject').onclick();assert.equal(downloadCalls,initialDownloads);
w.confirm=()=>true;await $('saveProject').onclick();assert.equal(downloadCalls,initialDownloads+1);
console.log('PASS: Save As, project roundtrip, cancellation, access/write errors, stream abort and explicit unsupported-browser fallback.');
dom.window.close();
})().catch(e=>{console.error(e);process.exit(1)});
