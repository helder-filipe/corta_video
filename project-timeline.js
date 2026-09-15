/* Projects and precise timeline controls. Load after editor-upgrade/video-formats. */
(() => {
  'use strict';
  const editor = window.CortaEditor;
  const blocked = () => busy || exporting;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const offsetAt = index => clips.slice(0,index).reduce((sum,c)=>sum+c.end-c.start,0);
  const node = (tag, attrs = {}, text = '') => {
    const element = document.createElement(tag);
    Object.assign(element, attrs); element.textContent = text; return element;
  };
  const save = node('button',{id:'saveProject'},'Guardar projeto');
  const open = node('button',{id:'openProject'},'Abrir projeto');
  const input = node('input',{type:'file',accept:'.corta',hidden:true});
  $('export').before(open,save,input);

  const controls = node('div',{className:'timeline-tools'});
  controls.innerHTML = `<label>Reproduzir<select id="previewScope"><option value="all">Filme completo</option><option value="selected">Só o corte selecionado</option></select></label>
    <label>Cursor (s)<input id="preciseTime" type="number" min="0" step="0.001" value="0.000"></label><button id="goTime">Ir para o tempo</button>
    <label>Zoom da linha de tempo<input id="timelineZoom" type="range" min="20" max="300" step="10" value="60"></label>`;
  $('seek').before(controls);
  const scroller = node('div',{className:'timeline-scroll'});
  const surface = node('div',{className:'timeline-surface'});
  const ruler = node('div',{className:'timeline-ruler'});
  const playhead = node('div',{className:'timeline-playhead'});
  $('timeline').before(scroller);
  scroller.append(surface); surface.append(ruler,$('timeline'),playhead);
  $('timeline').classList.add('precise-timeline');
  const help = node('p',{className:'hint'},'Clica num ponto do clip e usa «Dividir aqui». Arrasta as extremidades para aparar. Os cortes e o som original ficam sincronizados.');
  scroller.after(help);
  const audio = node('section',{className:'timeline-audio'});
  audio.innerHTML = '<h3>Áudio na linha de tempo</h3><p id="audioSelection" class="hint"></p><div class="audio-mixer"></div>';
  help.after(audio);
  const mixer = audio.querySelector('.audio-mixer');
  for (const id of ['clipVolume','musicVolume']) {
    const box = node('div',{className:'audio-channel'});
    const label = $(id).closest('label');
    if (id === 'musicVolume') label.firstChild.textContent = 'Música adicional ';
    const output = node('output',{id:id+'Percent'});
    const mute = node('button',{type:'button',id:id+'Mute'},'Silenciar');
    box.append(label,output,mute); mixer.append(box);
    $(id).step = '0.01';
    let previous = 1;
    mute.onclick = () => {
      if (blocked() || (id === 'clipVolume' ? !clips[selected] : !music)) return;
      const value = Number($(id).value);
      if (value > 0) previous = value;
      $(id).value = value > 0 ? 0 : previous;
      $(id).dispatchEvent(new Event('input'));
      $(id).dispatchEvent(new Event('change'));
      refreshAudio();
    };
    $(id).addEventListener('input',refreshAudio);
  }
  const selectedOnly = () => $('previewScope').value === 'selected' && !!clips[selected];
  const bounds = () => selectedOnly()
    ? {start:offsetAt(selected),end:offsetAt(selected)+clips[selected].end-clips[selected].start}
    : {start:0,end:duration()};
  const settings = () => ({ratio:window.CortaFormats.ratio, scope:$('previewScope').value,
    fps:$('fps').value,resolution:$('resolution').value,exportFormat:$('exportFormat').value,
    includeAudio:$('includeAudio').checked, zoom:$('timelineZoom').value});
  function restoreSettings(s = {}) {
    window.CortaFormats.setRatio(s.ratio || '16:9');
    for (const [id,key] of [['previewScope','scope'],['fps','fps'],['resolution','resolution'],['exportFormat','exportFormat']]) {
      if ([...$(id).options].some(option=>option.value === s[key])) $(id).value=s[key];
    }
    $('timelineZoom').value = clamp(Number(s.zoom)||60,20,300);
    if (typeof s.includeAudio === 'boolean') $('includeAudio').checked=s.includeAudio;
    $('resolution').dispatchEvent(new Event('change'));
  }
  window.CortaTimeline = {bounds,selectedOnly,settings,restoreSettings};

  const originalLocate = locate;
  locate = function(t) {
    if (selectedOnly()) {
      const b=bounds();
      if (t >= b.start && t <= b.end) return {i:selected,local:clips[selected].start+t-b.start};
    }
    return originalLocate(t);
  };
  const originalSeek = seek;
  seek = target => {const b=bounds();return originalSeek(clamp(Number(target)||0,b.start,b.end));};
  const originalDraw = draw;
  draw = function() {
    originalDraw();
    playhead.style.left = (time*Number($('timelineZoom').value))+'px';
    if (document.activeElement !== $('preciseTime')) $('preciseTime').value=time.toFixed(3);
    $('preciseTime').max = duration().toFixed(3);
  };
  function refreshAudio() {
    $('audioSelection').textContent = clips[selected] ? 'Corte '+(selected+1)+' · '+clips[selected].name : 'Seleciona um corte para ajustar o som original.';
    for (const id of ['clipVolume','musicVolume']) {
      const exists = id==='clipVolume' ? !!clips[selected] : !!music;
      $(id).disabled = blocked() || !exists;
      $(id+'Mute').disabled = blocked() || !exists;
      const value = id==='clipVolume' ? (clips[selected]?.volume ?? 1) : Number($('musicVolume').value);
      $(id+'Percent').textContent = Math.round(value*100)+'%';
      $(id+'Mute').textContent = value===0 ? 'Repor som' : 'Silenciar';
      $(id+'Mute').setAttribute('aria-pressed',String(value===0));
    }
  }
  async function trim(index, side, value) {
    if (blocked()) return;
    await editor.transaction(async()=>{
      const c=clips[index]; if (!c) return;
      const next = side==='start' ? clamp(value,0,c.end-.05) : clamp(value,c.start+.05,c.video.duration);
      if (Math.abs(next-c[side])<.00001) return;
      editor.record('aparar corte na linha de tempo'); selected=index; c[side]=next;
      await seek(offsetAt(index)); status('Corte ajustado. O áudio original acompanha o vídeo.');
    });
  }
  function refreshTimeline() {
    const scale=Number($('timelineZoom').value);
    surface.style.width=Math.max(scroller.clientWidth,duration()*scale)+'px';
    ruler.replaceChildren();
    const step=scale>=180 ? .5 : scale>=60 ? 1 : 5;
    // Limit ruler nodes on very long projects, while retaining an accurate scale.
    const spacing=Math.max(step,Math.ceil(duration()/1500));
    for(let t=0;t<=duration();t+=spacing) {
      const mark=node('span',{},format(t)); mark.style.left=t*scale+'px'; ruler.append(mark);
    }
    $('timeline').replaceChildren();
    clips.forEach((c,i)=>{
      const block=node('div',{className:'timeline-cut'+(i===selected?' active':'')});
      block.style.width=(c.end-c.start)*scale+'px';
      const button=node('button',{className:'cut-body',title:c.name},`${i+1} · ${c.name}\n${format(c.end-c.start)}`);
      button.setAttribute('aria-label',`Selecionar corte ${i+1}: ${c.name}`);
      button.onclick=event=>{
        if(blocked())return;
        pause(); selected=i;
        const rect=block.getBoundingClientRect();
        const local=event.detail ? clamp((event.clientX-rect.left)/scale,0,c.end-c.start-.0001) : 0;
        render(); seek(offsetAt(i)+local).catch(e=>status(e.message));
      };
      block.append(button);
      for(const side of ['start','end']) {
        const handle=node('button',{className:'trim-handle '+side,type:'button'},'');
        handle.setAttribute('aria-label',(side==='start'?'Entrada':'Saída')+' do corte '+(i+1));
        handle.title='Arrastar para aparar; setas ajustam 0,001 s; Shift + seta ajusta 0,100 s';
        handle.onkeydown=event=>{
          if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
          event.preventDefault(); trim(i,side,c[side]+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?.1:.001));
        };
        handle.onpointerdown=event=>{
          if(blocked() || event.button!==0)return;
          event.preventDefault(); pause();
          const origin=event.clientX, initial=c[side]; let next=initial;
          handle.setPointerCapture(event.pointerId);
          const move=e=>{
            next=side==='start'?clamp(initial+(e.clientX-origin)/scale,0,c.end-.05):clamp(initial+(e.clientX-origin)/scale,c.start+.05,c.video.duration);
            button.textContent=`${side==='start'?'Entrada':'Saída'}: ${format(next)}\nDuração: ${format(side==='start'?c.end-next:next-c.start)}`;
          };
          const finish=e=>{
            handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);
            if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
            if(e.type==='pointerup')trim(i,side,next);else render();
          };
          const cancel=e=>finish(e);
          handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
        };
        block.append(handle);
      }
      $('timeline').append(block);
    });
    if(!clips.length)$('timeline').append(node('p',{className:'hint'},'Importa vídeos para começar.'));
  }
  const originalRender=render;
  render=function(){originalRender();refreshTimeline();refreshAudio();};
  $('previewScope').onchange=()=>{if(blocked())return;pause();seek(bounds().start).catch(e=>status(e.message));};
  $('goTime').onclick=()=>{if(!blocked())seek(Number($('preciseTime').value)).catch(e=>status(e.message));};
  $('preciseTime').onkeydown=e=>{if(e.key==='Enter')$('goTime').click();};
  $('timelineZoom').oninput=()=>{refreshTimeline();draw();};
  ruler.onclick=event=>{if(!blocked())seek((event.clientX-ruler.getBoundingClientRect().left)/Number($('timelineZoom').value)).catch(e=>status(e.message));};
  for(const id of ['seek','trimStart','trimEnd','textStart','textEnd'])$(id).step='0.001';

  save.onclick=()=>{
    if(blocked())return;
    editor.transaction(async()=>{
      status('A preparar projeto com vídeos, música e edições…');
      const {packProject}=await import('./project-file.mjs');
      const files=[];const ids=new Map();
      const asset=file=>{if(!ids.has(file)){ids.set(file,files.length);files.push(file);}return ids.get(file);};
      const serialize=c=>({asset:asset(c.file),name:c.name,start:c.start,end:c.end,volume:c.volume});
      const values=editor.getValues();
      const fonts=[...editor.fonts].filter(([alias])=>alias===values.fontFamily).map(([alias,file])=>({alias,asset:asset(file)}));
      const state={clips:clips.map(serialize),music:music?serialize(music):null,values,fonts,selected,time,settings:settings()};
      const blob=packProject(state,files);
      const url=URL.createObjectURL(blob),a=node('a',{href:url,download:($('project').value.trim()||'Projeto').replace(/[<>:"/\\|?*]/g,'_')+'.corta'});
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status('Projeto preparado para guardar (.corta). Inclui os ficheiros originais e as edições.');
    });
  };
  open.onclick=()=>{if(!blocked())input.click();};
  input.onchange=()=>{
    const file=input.files[0];input.value='';if(!file || blocked())return;
    editor.transaction(async()=>{
      status('A abrir projeto…');
      const {unpackProject}=await import('./project-file.mjs');
      const {state,files}=await unpackProject(file);
      const restore=async(data,audio=false)=>{
        const c=await media(files[data.asset],audio);
        if(data.end>c.video.duration+.001)throw new Error('O corte ultrapassa a duração do ficheiro de origem.');
        Object.assign(c,{start:data.start,end:Math.min(data.end,c.video.duration),volume:data.volume});
        if(audio)c.video.loop=true;
        return c;
      };
      const next=[];
      for(const c of state.clips)next.push(await restore(c));
      const nextMusic=state.music?await restore(state.music,true):null;
      const values={...state.values};
      for(const font of state.fonts){const alias=await editor.loadFont(files[font.asset]);if(values.fontFamily===font.alias)values.fontFamily=alias;}
      editor.record('abrir projeto');
      clips=next;music=nextMusic;musicGain=null;
      selected=clips.length?clamp(Number.isInteger(state.selected)?state.selected:0,0,clips.length-1):-1;
      editor.setValues(values);restoreSettings(state.settings || {});
      await seek(Number(state.time)||0);
      status('Projeto aberto. Os cortes, o áudio e a formatação estão prontos a editar.');
    });
  };
  render();
})();
