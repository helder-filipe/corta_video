/* Subtitle parsing and layout shared by preview and video export. */
(() => {
  'use strict';
  const defaults={font:'sans-serif',size:54,color:'#ffffff',background:'#000000',opacity:.65,
    outline:3,bold:true,italic:false,align:'center',position:'bottom',margin:7,width:86,lineHeight:1.25,burn:true,visible:true};
  const limit=(n,a,b,f)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;
  function normalize(data) {
    if(data == null)return {cues:[],style:{...defaults},selected:null};
    if(!Array.isArray(data.cues)||data.cues.length>10000)throw Error('Lista de legendas inválida (máximo: 10 000).');
    const ids=new Set();
    const cues=data.cues.map((c,i)=>{
      if(!c || !Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end>1e9||Math.round(c.end*1000)-Math.round(c.start*1000)<1||typeof c.text!=='string'||c.text.length>20000)throw Error('Tempos ou texto inválidos na legenda '+(i+1)+'.');
      let id=typeof c.id==='string'?c.id:'cue-'+i;
      if(ids.has(id))id='cue-'+i+'-'+ids.size;
      ids.add(id);return {id,start:Math.round(c.start*1000)/1000,end:Math.round(c.end*1000)/1000,text:c.text};
    }).sort((a,b)=>a.start-b.start||a.end-b.end);
    const s=data.style||{},style={...defaults};
    for(const [key,a,b] of [['size',16,160],['opacity',0,1],['outline',0,10],['margin',2,30],['width',30,95],['lineHeight',1,2]])style[key]=limit(s[key]??defaults[key],a,b,defaults[key]);
    for(const key of ['burn','visible','bold','italic'])if(typeof s[key]==='boolean')style[key]=s[key];
    for(const key of ['color','background'])if(/^#[\da-f]{6}$/i.test(s[key]))style[key]=s[key];
    if(['left','center','right'].includes(s.align))style.align=s.align;
    if(['top','center','bottom'].includes(s.position))style.position=s.position;
    if(typeof s.font==='string'&&s.font.length<200)style.font=s.font;
    return {cues,style,selected:ids.has(data.selected)?data.selected:(cues[0]?.id||null)};
  }
  function timestamp(value) {
    const match=String(value).match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})$/);
    if(!match||+match[2]>59||+match[3]>59)throw Error('Tempo inválido: '+value);
    return (+match[1]||0)*3600+(+match[2])*60+(+match[3])+(+match[4])/1000;
  }
  function timecode(value,comma=false) {
    const n=Math.max(0,Math.round(value*1000));
    const pad=(n,w=2)=>String(n).padStart(w,'0');
    return `${pad(Math.floor(n/3600000))}:${pad(Math.floor(n/60000)%60)}:${pad(Math.floor(n/1000)%60)}${comma?',':'.'}${pad(n%1000,3)}`;
  }
  function plain(text) {
    return text.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|nbsp|quot|apos);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',nbsp:' ',quot:'"',apos:"'"}[k]));
  }
  function parse(text) {
    const source=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    const vtt=/^WEBVTT(?:\s|$)/.test(source);let discardedFormatting=false;
    const blocks=source.split(/\n[ \t]*\n/),cues=[];
    for(const block of blocks) {
      const lines=block.split('\n');
      if(vtt&&(/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])))continue;
      const index=lines.findIndex(line=>line.includes('-->'));
      if(index<0)throw Error('Bloco sem tempos de entrada e saída. Usa um ficheiro SRT ou WebVTT válido.');
      const match=lines[index].trim().match(/^(\S+)\s+-->\s+(\S+)(.*)$/);
      if(!match)throw Error('Intervalo de legenda inválido.');
      const raw=lines.slice(index+1).join('\n');
      discardedFormatting ||= !!match[3].trim()||/<[^>]+>/.test(raw);
      cues.push({id:'import-'+cues.length,start:timestamp(match[1]),end:timestamp(match[2]),text:plain(raw)});
    }
    if(!cues.length)throw Error('O ficheiro não contém legendas.');
    return {...normalize({cues}),discardedFormatting};
  }
  function serialize(cues,format) {
    const sorted=normalize({cues}).cues;
    const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return (format==='vtt'?'WEBVTT\n\n':'')+sorted.map((c,i)=>`${i+1}\n${timecode(c.start,format==='srt')} --> ${timecode(c.end,format==='srt')}\n${escape(c.text.trim()).replace(/\n\s*\n/g,'\n')}\n`).join('\n');
  }
  function warnings(cues,total) {
    let latestEnd=-Infinity;
    return cues.map((c,i)=>{
      const out=[],length=[...c.text.replace(/\s/g,'')].length;
      if(!c.text.trim())out.push('Sem texto');
      if(total>0 && c.end>total+.001)out.push('Ultrapassa o filme');
      if(c.end-c.start<1)out.push('Menos de 1 segundo');
      if(length/(c.end-c.start)>20)out.push('Leitura rápida (>20 caracteres/s)');
      if(c.text.split('\n').length>2)out.push('Mais de duas linhas');
      if(c.text.split('\n').some(line=>[...line].length>42))out.push('Linha longa (>42 caracteres)');
      if(latestEnd>c.start || (cues[i+1]&&cues[i+1].start<c.end))out.push('Sobreposição');
      latestEnd=Math.max(latestEnd,c.end);
      return out;
    });
  }
  function linesFor(ctx,text,width) {
    const result=[];
    for(const paragraph of text.split('\n')) {
      let line='';
      for(const word of paragraph.split(/\s+/)) {
        if(ctx.measureText((line?line+' ':'')+word).width<=width){line+=(line?' ':'')+word;continue;}
        if(line){result.push(line);line='';}
        for(const char of word){if(line&&ctx.measureText(line+char).width>width){result.push(line);line='';}line+=char;}
      }
      result.push(line);
    }
    return result;
  }
  function paint(ctx,surface,t,data,exporting=false) {
    const s=data.style;
    if(exporting?!s.burn:!s.visible)return;
    const active=data.cues.filter(c=>c.start<=t&&t<c.end&&c.text.trim());
    if(!active.length)return;
    ctx.save();
    const scale=Math.min(surface.width,surface.height)/1080;
    let size=s.size*scale,lines=[],lineHeight=0;
    const width=surface.width*s.width/100,margin=surface.height*s.margin/100;
    // Reduce size only when needed to keep the complete caption inside the frame.
    for(let attempt=0;attempt<12;attempt++) {
      ctx.font=`${s.italic?'italic ':''}${s.bold?'700':'400'} ${size}px ${JSON.stringify(s.font)}, sans-serif`;
      lines=active.flatMap(c=>linesFor(ctx,c.text,width));lineHeight=size*s.lineHeight;
      if(lines.length*lineHeight<=surface.height-2*margin)break;
      size*=.85;
    }
    const height=lines.length*lineHeight,pad=size*.24;
    let top=s.position==='top'?margin:s.position==='center'?(surface.height-height)/2:surface.height-margin-height;
    ctx.textBaseline='top';ctx.textAlign=s.align;ctx.lineJoin='round';
    const x=s.align==='left'?(surface.width-width)/2:s.align==='right'?(surface.width+width)/2:surface.width/2;
    for(const line of lines) {
      const w=ctx.measureText(line).width;
      const left=s.align==='left'?x:s.align==='right'?x-w:x-w/2;
      if(s.opacity>0&&line){ctx.globalAlpha=s.opacity;ctx.fillStyle=s.background;ctx.fillRect(left-pad,top-pad,w+2*pad,lineHeight+pad);ctx.globalAlpha=1;}
      if(s.outline>0){ctx.strokeStyle='#000000';ctx.lineWidth=s.outline*scale;ctx.strokeText(line,x,top);}
      ctx.fillStyle=s.color;ctx.fillText(line,x,top);top+=lineHeight;
    }
    ctx.restore();
  }
  window.CortaSubtitleCore={defaults,normalize,parse,serialize,warnings,paint,timecode};
})();
