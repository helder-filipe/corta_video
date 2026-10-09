/* Project storage and subtitle history for the current timeline/transition editor. */
(() => {
  const history=[],fonts=new Map();let counter=0;
  const ids=[...document.querySelectorAll('main input,main select,main textarea,header input,#dialog select,#includeAudio')]
    .filter(e=>e.id&&e.type!=='file'&&!['seek','preciseTime','trimStart','trimEnd','clipVolume','transitionDuration','musicTrimStart','musicTrimEnd','musicTimelineStart'].includes(e.id)).map(e=>e.id);
  const values=()=>Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
  const setValues=v=>{for(const id of ids)if(Object.hasOwn(v,id)){if($(id).type==='checkbox')$(id).checked=!!v[id];else $(id).value=v[id];}updateProjectFormat();updateMusicUi();};
  const snapshot=()=>({clips:clips.map(c=>({...c})),music:music?{...music}:null,selected,time,values:values(),subtitles:window.CortaSubtitles?.snapshot()});
  const bar=document.createElement('div');bar.className='subtitle-toolbar';bar.innerHTML='<button id="undoEdit" disabled>↶ Desfazer legendas/projeto</button><button id="clearEdit">Limpar projeto</button>';
  $('trimFeedback').after(bar);
  const header=document.createElement('span');header.innerHTML='<button id="openProject">Abrir projeto</button> <button id="saveProject">Guardar projeto</button><input type="file" id="projectInput" accept=".corta" hidden>';$('export').before(header);
  const refresh=()=>{$('undoEdit').disabled=busy||exporting||!history.length;};
  function record(label){history.push({label,state:snapshot()});if(history.length>30)history.shift();refresh();}
  async function transaction(work){if(busy||exporting)return;pause();busy=true;document.querySelector('main').inert=true;try{await work();}catch(e){status(e.message);}finally{busy=false;document.querySelector('main').inert=false;refresh();render();}}
  window.CortaEditor={record,transaction,fonts,getValues:values};
  $('undoEdit').onclick=()=>transaction(async()=>{const entry=history.pop();if(!entry)return;const s=entry.state;clips=s.clips;music=s.music;selected=s.selected;setValues(s.values);window.CortaSubtitles?.restore(s.subtitles);await seek(s.time);status('Desfeito: '+entry.label);});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!document.querySelector('dialog[open]')){e.preventDefault();$('undoEdit').click();}});
  const clear=document.createElement('dialog');clear.innerHTML='<h2>Limpar projeto?</h2><p>Remove os clips, a música, o texto e as legendas. Podes recuperar com Desfazer.</p><button id="cancelClear">Cancelar</button> <button id="confirmClear">Limpar projeto</button>';document.body.append(clear);
  $('clearEdit').onclick=()=>{if(!busy&&!exporting)clear.showModal();};$('cancelClear').onclick=()=>clear.close();
  $('confirmClear').onclick=()=>{clear.close();transaction(async()=>{record('limpar projeto');clips=[];music=null;musicGain=null;selected=-1;time=0;$('text').value='';window.CortaSubtitles?.reset();updateMusicUi();});};
  // A removed source URL cannot be restored by an older project snapshot.
  for(const id of ['remove','removeMusic'])$(id).addEventListener('click',()=>{if(!busy&&!exporting){history.length=0;refresh();}},true);
  const originalMedia=media;media=async(...args)=>{const result=await originalMedia(...args);return result;};
  const fontHolder=document.createElement('div');fontHolder.hidden=true;fontHolder.innerHTML='<select id="fontFamily"></select>';document.body.append(fontHolder);
  for(const family of ['sans-serif','Arial','Calibri','Georgia','Verdana','Times New Roman','Courier New'])$('fontFamily').add(new Option(family,family));
  const fontControls=document.createElement('div');fontControls.className='subtitle-toolbar';fontControls.innerHTML='<button id="captionSystemFonts">Fontes do computador</button><button id="captionImportFont">Importar fonte</button><input id="captionFontFile" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>';
  bar.after(fontControls);
  $('captionSystemFonts').onclick=async()=>{if(busy||exporting)return;try{if(!window.queryLocalFonts)throw Error('Usa Importar fonte neste navegador.');for(const family of new Set((await window.queryLocalFonts()).map(f=>f.family)))if(![...$('fontFamily').options].some(o=>o.value===family))$('fontFamily').add(new Option(family,family));status('Fontes disponíveis na lista de legendas.');}catch(e){status(e.message);}};
  async function loadFont(file){const alias='CortaCaptionFont'+(++counter),font=new FontFace(alias,await file.arrayBuffer());await font.load();document.fonts.add(font);fonts.set(alias,file);$('fontFamily').add(new Option(file.name,alias));return alias;}
  $('captionImportFont').onclick=()=>{if(!busy&&!exporting)$('captionFontFile').click();};
  $('captionFontFile').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)transaction(async()=>{const alias=await loadFont(file);record('importar fonte');const s=CortaSubtitles.snapshot();s.style.font=alias;CortaSubtitles.restore(s);});};
  $('saveProject').onclick=()=>transaction(async()=>{
    const {packProject}=await import('./project-file.mjs'),files=[],map=new Map();
    const asset=f=>{if(!map.has(f)){map.set(f,files.length);files.push(f);}return map.get(f);};
    const clip=c=>({asset:asset(c.file),name:c.name,start:c.start,end:c.end,volume:c.volume,transition:c.transition,transitionDuration:c.transitionDuration,timelineStart:c.timelineStart,loop:c.loop});
    const subtitles=CortaSubtitles.snapshot();const state={clips:clips.map(clip),music:music?clip(music):null,values:values(),subtitles,selected,time,fonts:[...fonts].filter(([a])=>a===subtitles.style.font).map(([alias,f])=>({alias,asset:asset(f)}))};
    const blob=packProject(state,files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=($('project').value||'Projeto').replace(/[<>:"/\\|?*]/g,'_')+'.corta';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('Projeto preparado para guardar com vídeos, legendas, transições e ajustes.');
  });
  $('openProject').onclick=()=>{if(!busy&&!exporting)$('projectInput').click();};
  $('projectInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(!file)return;transaction(async()=>{
    const {unpackProject}=await import('./project-file.mjs'),{state,files}=await unpackProject(file),subtitles=CortaSubtitles.validate(state.subtitles),staged=[];
    try{
      const restore=async(c,audio=false)=>{const item=await media(files[c.asset],audio);staged.push(item);if(c.end>item.video.duration+.001)throw Error('Corte fora da duração do original.');Object.assign(item,{start:c.start,end:Math.min(c.end,item.video.duration),volume:c.volume,transition:['none','fade','wipe','slide','zoom','flash'].includes(c.transition)?c.transition:'none',transitionDuration:Math.max(.3,Math.min(2,+c.transitionDuration||.8)),timelineStart:Math.max(0,+c.timelineStart||0),loop:c.loop!==false});return item;};
      const next=[];for(const c of state.clips)next.push(await restore(c));const nextMusic=state.music?await restore(state.music,true):null;
      for(const font of state.fonts){const alias=await loadFont(files[font.asset]);if(subtitles.style.font===font.alias)subtitles.style.font=alias;}
      record('abrir projeto');clips=next;music=nextMusic;musicGain=null;selected=clips.length?Math.max(0,Math.min(clips.length-1,Number.isInteger(state.selected)?state.selected:0)):-1;
      const v={...state.values};if(state.settings?.ratio)v.aspectRatio=state.settings.ratio;
      setValues(v);CortaSubtitles.restore(subtitles);await seek(Number(state.time)||0);status('Projeto aberto.');
    }catch(error){for(const c of staged)if(!clips.includes(c)&&music!==c)URL.revokeObjectURL(c.url);throw error;}
  });};
})();
