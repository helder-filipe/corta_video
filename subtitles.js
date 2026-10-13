(() => {
  'use strict';
  const core=window.CortaSubtitleCore,editor=window.CortaEditor;
  let data=core.normalize(null),group=null,previewEnd=null,serial=0;
  const uid=()=> 'subtitle-'+Date.now().toString(36)+'-'+(++serial);
  const blocked=()=>busy||exporting;
  const chosen=()=>data.cues.find(c=>c.id===data.selected);
  const section=document.createElement('section');section.className='subtitle-panel';section.id='subtitlesPanel';
  section.innerHTML=`<details open><summary>Legendas <span id="subtitleCount">0</span></summary>
    <p class="hint">Escreve as legendas ou importa SRT/WebVTT. Os tempos referem-se ao filme completo. Revê a sincronização depois de alterar os cortes do vídeo.</p>
    <div class="subtitle-toolbar"><button id="subAdd">＋ Legenda no cursor</button><button id="subImport">Importar SRT/VTT</button>
      <input id="subFile" type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" hidden>
      <label>Ao importar<select id="subImportMode"><option value="append">Acrescentar</option><option value="replace">Substituir legendas</option></select></label>
      <button id="subSrt">Guardar SRT</button><button id="subVtt">Guardar VTT</button></div>
    <div class="subtitle-switches"><label><input id="subVisible" type="checkbox" checked> Mostrar na pré-visualização</label><label><input id="subBurn" type="checkbox" checked> Incluir legendas no vídeo exportado</label></div>
    <p class="hint">No vídeo, as legendas ficam gravadas na imagem. SRT/VTT permitem fornecê-las separadamente, sem a formatação visual.</p>
    <div class="subtitle-edit-grid"><div><label>Procurar legendas<input id="subSearch" type="search" placeholder="Procurar no texto…"></label><div id="subList" class="subtitle-list" aria-label="Lista de legendas"></div></div>
      <div class="subtitle-editor"><p id="subSelection" class="hint">Seleciona ou cria uma legenda.</p>
        <div class="two"><label>Entrada (s)<input id="subStart" type="number" min="0" step="0.001"></label><label>Saída (s)<input id="subEnd" type="number" min="0" step="0.001"></label></div>
        <div class="subtitle-toolbar"><button id="subIn">Entrada = cursor</button><button id="subOut">Saída = cursor</button></div>
        <label>Texto da legenda<textarea id="subText" rows="3" placeholder="Texto da legenda…"></textarea></label><p id="subMetrics" class="hint"></p>
        <div class="subtitle-toolbar"><button id="subApply">Aplicar tempos e texto</button><button id="subPreview">▶ Ouvir este intervalo</button><button id="subDuplicate">Duplicar</button><button id="subSplit">Dividir no cursor</button><button id="subMerge">Juntar à seguinte</button><button id="subDelete">Eliminar legenda</button></div>
        <p id="subFeedback" role="status" class="subtitle-warning"></p>
      </div>
    </div>
    <details><summary>Sincronização e formatação</summary>
      <div class="subtitle-toolbar"><label>Deslocar todas (s)<input id="subOffset" type="number" step="0.001" value="0"></label><button id="subShift">Aplicar deslocamento</button><span class="hint">Positivo: mais tarde. Negativo: mais cedo.</span></div>
      <div class="subtitle-style-grid">
        <label>Fonte<select id="subFont"></select></label><label>Tamanho<input id="subSize" type="number" min="16" max="160" value="54"></label>
        <label>Cor<input id="subColor" type="color" value="#ffffff"></label><label>Fundo<input id="subBackground" type="color" value="#000000"></label>
        <label>Opacidade do fundo<input id="subOpacity" type="range" min="0" max="1" step="0.05" value="0.65"></label>
        <label>Contorno<input id="subOutline" type="number" min="0" max="10" step="0.5" value="3"></label>
        <label>Posição<select id="subPosition"><option value="bottom">Em baixo</option><option value="center">Ao centro</option><option value="top">Em cima</option></select></label>
        <label>Alinhamento<select id="subAlign"><option value="center">Centro</option><option value="left">Esquerda</option><option value="right">Direita</option></select></label>
        <label>Margem vertical (%)<input id="subMargin" type="number" min="2" max="30" value="7"></label>
        <label>Largura (%)<input id="subWidth" type="number" min="30" max="95" value="86"></label>
        <label>Entrelinha<input id="subLineHeight" type="number" min="1" max="2" step="0.05" value="1.25"></label>
        <label><input id="subBold" type="checkbox" checked> Negrito</label><label><input id="subItalic" type="checkbox"> Itálico</label>
      </div><p class="hint">A formatação aplica-se a todas as legendas. As fontes do computador e os ficheiros de fonte carregados no painel Texto também ficam disponíveis aqui.</p>
    </details>
    <p class="hint">Ctrl+Alt+L: nova legenda no cursor. Usa Desfazer / Ctrl+Z para recuperar alterações. Não inclui transcrição automática de voz.</p>
  </details>`;
  document.querySelector('.workspace').append(section);
  const exportLabel=document.createElement('label');exportLabel.className='checkbox-label';
  exportLabel.innerHTML='<input id="exportSubtitles" type="checkbox" checked> Gravar legendas na imagem do vídeo';
  $('includeAudio').closest('label').after(exportLabel);
  $('exportSubtitles').onchange=()=>{if(blocked())return;$('subBurn').checked=$('exportSubtitles').checked;$('subBurn').dispatchEvent(new Event('input'));group=null;};
  const track=document.createElement('div');track.className='subtitle-track';track.setAttribute('aria-label','Legendas na linha de tempo');
  document.querySelector('.timeline-content').append(track); track.style.marginLeft='76px';
  const styleFields={subFont:'font',subSize:'size',subColor:'color',subBackground:'background',subOpacity:'opacity',subOutline:'outline',subPosition:'position',subAlign:'align',subMargin:'margin',subWidth:'width',subLineHeight:'lineHeight',subBold:'bold',subItalic:'italic',subVisible:'visible',subBurn:'burn'};
  function message(text){$('subFeedback').textContent=text;}
  function record(label,key=null){if(!key||group!==key)editor.record(label);group=key;}
  function syncFonts(){
    const names=new Map([...$('fontFamily').options].map(o=>[o.value,o.textContent]));names.set(data.style.font,names.get(data.style.font)||data.style.font);
    $('subFont').replaceChildren(...[...names].map(([v,t])=>new Option(t,v)));$('subFont').value=data.style.font;
  }
  function fields(){
    const c=chosen();$('subSelection').textContent=c?'Legenda '+(data.cues.indexOf(c)+1):'Seleciona ou cria uma legenda.';
    $('subStart').value=c?c.start.toFixed(3):'';$('subEnd').value=c?c.end.toFixed(3):'';$('subText').value=c?.text||'';
    for(const id of ['subStart','subEnd','subText','subIn','subOut','subApply','subPreview','subDuplicate','subSplit','subMerge','subDelete'])$(id).disabled=!c;
    for(const [id,key] of Object.entries(styleFields)){if($(id).type==='checkbox')$(id).checked=data.style[key];else $(id).value=data.style[key];}
    $('exportSubtitles').checked=data.style.burn;
    metrics();
  }
  function metrics(){const c=chosen();$('subMetrics').textContent=c?`${(c.end-c.start).toFixed(3)} s · ${[...c.text.replace(/\s/g,'')].length} caracteres · ${([...c.text.replace(/\s/g,'')].length/(c.end-c.start)).toFixed(1)} caracteres/s`:'';}
  function refresh(){
    $('subtitleCount').textContent=String(data.cues.length);metrics();
    const list=$('subList'),query=$('subSearch').value.toLocaleLowerCase();list.replaceChildren();track.replaceChildren();
    const flags=core.warnings(data.cues,duration()),scale=Number($('timelineZoom').value);
    data.cues.forEach((c,i)=>{
      if(c.text.toLocaleLowerCase().includes(query)){
        const button=document.createElement('button');button.className='subtitle-row'+(c.id===data.selected?' active':'');button.dataset.cueId=c.id;
        const title=document.createElement('strong');title.textContent=`${i+1} · ${core.timecode(c.start)} → ${core.timecode(c.end)}`;
        const text=document.createElement('span');text.textContent=c.text||'(sem texto)';
        const warning=document.createElement('small');warning.textContent=flags[i].join(' · ');warning.className='subtitle-warning';
        button.append(title,text,warning);button.onclick=()=>select(c.id);list.append(button);
      }
      const block=document.createElement('div');block.className='subtitle-block'+(c.id===data.selected?' active':'');
      block.style.left=c.start*scale+'px';block.style.width=Math.max(4,(c.end-c.start)*scale)+'px';
      const button=document.createElement('button');button.textContent=c.text||'Legenda '+(i+1);button.title=`${core.timecode(c.start)} → ${core.timecode(c.end)} · ${c.text}`;button.onclick=()=>select(c.id);block.append(button);
      button.onpointerdown=e=>drag(e,c,block,'move');
      for(const edge of ['start','end']){const h=document.createElement('button');h.className='subtitle-edge '+edge;h.setAttribute('aria-label',(edge==='start'?'Entrada':'Saída')+' da legenda '+(i+1));h.onpointerdown=e=>drag(e,c,block,edge);block.append(h);}
      track.append(block);
    });
    if(!list.children.length){const p=document.createElement('p');p.className='hint';p.textContent=data.cues.length?'Sem resultados.':'Cria uma legenda no cursor ou importa um ficheiro.';list.append(p);}
    track.style.width=Math.max(duration(),...data.cues.map(c=>c.end),0)*scale+'px';
    $('subSrt').disabled=$('subVtt').disabled=!data.cues.length;
  }
  function apply(){
    const c=chosen();if(!c)return true;if(blocked())return false;
    const start=Number($('subStart').value),end=Number($('subEnd').value),text=$('subText').value;
    if($('subStart').value===''||$('subEnd').value===''||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1e9||Math.round(end*1000)-Math.round(start*1000)<1){message('A entrada tem de ser anterior à saída. Os tempos não podem ser negativos.');return false;}
    if(start!==c.start||end!==c.end||text!==c.text){record('editar legenda','cue:'+c.id);Object.assign(c,{start:Math.round(start*1000)/1000,end:Math.round(end*1000)/1000,text});data.cues.sort((a,b)=>a.start-b.start||a.end-b.end);refresh();draw();}
    message('');return true;
  }
  async function select(id){if(blocked()||!apply())return;group=null;pause();previewEnd=null;data.selected=id;fields();refresh();if($('previewScope'))$('previewScope').value='all';await seek(chosen().start).catch(e=>message(e.message));}
  function commit(label,work){if(blocked()||!apply())return;pause();previewEnd=null;record(label);work();data=core.normalize(data);fields();refresh();draw();render();}
  function drag(event,c,block,edge){
    if(blocked()||event.button!==0||!apply())return;event.preventDefault();pause();previewEnd=null;
    const handle=event.currentTarget,origin=event.clientX,scale=Number($('timelineZoom').value),old={start:c.start,end:c.end};let start=c.start,end=c.end,moved=false;
    handle.setPointerCapture(event.pointerId);
    const move=e=>{const delta=Math.round((e.clientX-origin)/scale*1000)/1000;moved ||= Math.abs(e.clientX-origin)>3;
      if(edge==='move'){start=Math.max(0,old.start+delta);end=start+old.end-old.start;}
      else if(edge==='start')start=Math.max(0,Math.min(old.end-.001,old.start+delta));
      else end=Math.max(old.start+.001,old.end+delta);
      block.style.left=start*scale+'px';block.style.width=Math.max(4,(end-start)*scale)+'px';message(`${core.timecode(start)} → ${core.timecode(end)}`);
    };
    const finish=e=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);
      if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
      if(e.type==='pointerup'&&moved){record('sincronizar legenda na linha de tempo');Object.assign(c,{start:Math.round(start*1000)/1000,end:Math.round(end*1000)/1000});data.selected=c.id;data=core.normalize(data);handle.onclick=e=>e.stopPropagation();}
      fields();refresh();draw();message('');
    };
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  }
  $('subAdd').onclick=()=>commit('adicionar legenda',()=>{const start=Math.round(time*1000)/1000;const next=data.cues.find(c=>c.start>start);const end=Math.min(start+3,next?.start??Infinity,duration()>start?duration():Infinity);const c={id:uid(),start,end:Math.max(start+.05,end),text:''};data.cues.push(c);data.selected=c.id;});
  $('subApply').onclick=()=>{if(apply()){group=null;fields();message('Legenda atualizada.');}};
  $('subText').oninput=apply;
  for(const id of ['subStart','subEnd'])$(id).onchange=()=>{if(apply()){group=null;fields();}};
  $('subText').onblur=()=>group=null;
  $('subIn').onclick=()=>{if(blocked())return;$('subStart').value=time.toFixed(3);apply();};
  $('subOut').onclick=()=>{if(blocked())return;$('subEnd').value=time.toFixed(3);apply();};
  $('subDelete').onclick=()=>commit('eliminar legenda',()=>{data.cues=data.cues.filter(c=>c.id!==data.selected);data.selected=data.cues[0]?.id||null;});
  $('subDuplicate').onclick=()=>commit('duplicar legenda',()=>{const c=chosen();if(!c)return;const copy={...c,id:uid(),start:c.end,end:c.end+c.end-c.start};data.cues.push(copy);data.selected=copy.id;});
  $('subSplit').onclick=()=>{
    if(blocked()||!apply())return;const c=chosen();if(!c||time<=c.start+.001||time>=c.end-.001){message('Coloca o cursor dentro do intervalo da legenda.');return;}
    const split=$('subText').selectionStart||Math.round(c.text.length*(time-c.start)/(c.end-c.start));
    commit('dividir legenda',()=>{const tail={...c,id:uid(),start:time,text:c.text.slice(split).trim()};c.end=time;c.text=c.text.slice(0,split).trim();data.cues.push(tail);data.selected=tail.id;});
  };
  $('subMerge').onclick=()=>{const c=chosen(),i=data.cues.indexOf(c),next=data.cues[i+1];if(!next){message('Não existe uma legenda seguinte.');return;}commit('juntar legendas',()=>{c.end=Math.max(c.end,next.end);c.text=[c.text,next.text].filter(Boolean).join('\n');data.cues.splice(i+1,1);});};
  $('subShift').onclick=()=>{
    const amount=Number($('subOffset').value);if(!Number.isFinite(amount))return;
    if(data.cues.some(c=>c.start+amount<0)){message('Esse deslocamento colocaria legendas antes do início do filme.');return;}
    commit('deslocar todas as legendas',()=>{data.cues.forEach(c=>{c.start+=amount;c.end+=amount;});});
  };
  $('subPreview').onclick=async()=>{if(blocked()||!apply())return;const c=chosen();if(!c||!clips.length)return;if(c.start>=duration()){message('Esta legenda começa depois do fim do filme.');return;}if($('previewScope'))$('previewScope').value='all';await seek(c.start);previewEnd=Math.min(c.end,duration());await play();};
  const baseTick=tick;tick=async function(...args){await baseTick(...args);if(previewEnd!==null&&(!playing||time>=previewEnd)){const end=previewEnd;previewEnd=null;pause();await seek(end);}};
  $('subSearch').oninput=refresh;
  for(const [id,key] of Object.entries(styleFields)){
    $(id).oninput=()=>{if(blocked())return;record('formatar legendas','style:'+id);data.style[key]=$(id).type==='checkbox'?$(id).checked:$(id).type==='number'||$(id).type==='range'?Number($(id).value):$(id).value;data=core.normalize(data);$('exportSubtitles').checked=data.style.burn;draw();render();};
    $(id).onchange=()=>{group=null;};
  }
  $('subFont').onfocus=syncFonts;
  $('subFont').onchange=()=>{group=null;editor.transaction(async()=>{await document.fonts.load('16px '+JSON.stringify(data.style.font));draw();});};
  $('subImport').onclick=()=>{if(!blocked())$('subFile').click();};
  $('subFile').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file||blocked()||!apply())return;
    if(file.size>10*1024*1024){message('O ficheiro de legendas excede 10 MB.');return;}
    await editor.transaction(async()=>{
      const parsed=core.parse(await file.text());
      if($('subImportMode').value==='append'&&data.cues.length+parsed.cues.length>10000)throw Error('Máximo: 10 000 legendas.');
      record('importar legendas');const added=parsed.cues.map(c=>({...c,id:uid()}));
      data.cues=$('subImportMode').value==='replace'?added:[...data.cues,...added];data.selected=added[0]?.id;data=core.normalize(data);fields();refresh();draw();
      message(parsed.discardedFormatting?'Texto e tempos importados. A formatação e as posições do ficheiro foram substituídas pelo estilo do editor.':`${added.length} legendas importadas.`);
    });
  };
  for(const format of ['srt','vtt'])$('sub'+(format==='srt'?'Srt':'Vtt')).onclick=()=>{
    if(blocked()||!apply())return;
    if(data.cues.some(c=>!c.text.trim())){message('Preenche ou elimina as legendas sem texto antes de guardar.');return;}
    const blob=new Blob([core.serialize(data.cues,format)],{type:format==='vtt'?'text/vtt;charset=utf-8':'application/x-subrip;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=($('project').value||'Legendas').replace(/[<>:"/\\|?*]/g,'_')+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==='l'){e.preventDefault();$('subAdd').click();}});
  window.addEventListener('beforeunload',e=>{if(data.cues.length){e.preventDefault();e.returnValue='';}});
  for(const id of ['play','rewind','goTime','split','remove'])$(id)?.addEventListener('click',()=>{previewEnd=null;},true);
  $('seek').addEventListener('input',()=>{previewEnd=null;},true);
  const basePaint=paintText;paintText=function(ctx,surface,t,settings){basePaint(ctx,surface,t,settings);if(settings)return;core.paint(ctx,surface,t,data,surface!==canvas);};
  const baseRender=render;render=function(){baseRender();refresh();};
  $('timelineZoom').addEventListener('input',refresh);
  // Commit drafts before project/video export. Invalid drafts stop the action.
  for(const id of ['saveProject','render'])$(id).addEventListener('click',e=>{if(!apply()){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.CortaSubtitles={snapshot:()=>JSON.parse(JSON.stringify(data)),validate:core.normalize,
    restore(value){data=core.normalize(value);group=null;previewEnd=null;syncFonts();fields();refresh();},
    reset(){this.restore(null);},usedFonts:()=>[data.style.font]};
  syncFonts();fields();refresh();draw();
})();
