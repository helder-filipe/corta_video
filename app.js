const $ = id => document.getElementById(id), canvas = $('canvas'), ctx = canvas.getContext('2d');
let clips = [], selected = -1, time = 0, playing = false, exporting = false;
let music = null, audioCtx = null, destination = null, musicGain = null, raf = 0, current = -1, busy = false;

const duration = () => clips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
const format = value => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
function status(message) { $('status').textContent = message; }

function locate(projectTime, list = clips) {
  let offset = 0;
  for (let i = 0; i < list.length; i++) {
    const length = list[i].end - list[i].start;
    if (projectTime < offset + length || i === list.length - 1) {
      const elapsed = clamp(projectTime - offset, 0, length);
      return { i, offset, length, elapsed, local: list[i].start + elapsed };
    }
    offset += length;
  }
  return null;
}

function connect(mediaElement) {
  if (!audioCtx) audioCtx = new AudioContext();
  if (!destination) destination = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createMediaElementSource(mediaElement), gain = audioCtx.createGain();
  source.connect(gain); gain.connect(audioCtx.destination); gain.connect(destination);
  return gain;
}

function transitionState(index, projectTime, list = clips) {
  const position = locate(projectTime, list);
  if (!position || position.i !== index) return null;
  const clip = list[index], previous = list[index - 1];
  if (previous?.transition && previous.transition !== 'none') {
    const half = Math.min((previous.transitionDuration || .8) / 2, position.length / 2);
    if (position.elapsed < half) return { type: previous.transition, phase: 'in', progress: clamp(position.elapsed / half) };
  }
  if (clip.transition && clip.transition !== 'none' && index < list.length - 1) {
    const half = Math.min((clip.transitionDuration || .8) / 2, position.length / 2);
    const remaining = position.length - position.elapsed;
    if (remaining < half) return { type: clip.transition, phase: 'out', progress: clamp(1 - remaining / half) };
  }
  return null;
}

function drawContained(context, surface, image) {
  const sourceWidth = image.videoWidth || image.width || surface.width;
  const sourceHeight = image.videoHeight || image.height || surface.height;
  const scale = Math.min(surface.width / sourceWidth, surface.height / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  context.drawImage(image, (surface.width - width) / 2, (surface.height - height) / 2, width, height);
}

function paintVideoFrame(context, surface, image, clipIndex, projectTime, list = clips) {
  const state = transitionState(clipIndex, projectTime, list);
  context.fillStyle = '#090a0b'; context.fillRect(0, 0, surface.width, surface.height);
  context.save();
  if (!state) drawContained(context, surface, image);
  else {
    const p = state.progress, incoming = state.phase === 'in';
    if (state.type === 'fade') context.globalAlpha = incoming ? p : 1 - p;
    if (state.type === 'slide') context.translate((incoming ? 1 - p : -p) * surface.width, 0);
    if (state.type === 'zoom') {
      const scale = incoming ? 1.18 - .18 * p : 1 + .15 * p;
      context.globalAlpha = incoming ? p : 1 - p;
      context.translate(surface.width / 2, surface.height / 2); context.scale(scale, scale); context.translate(-surface.width / 2, -surface.height / 2);
    }
    if (state.type === 'wipe' && incoming) {
      context.beginPath(); context.rect(0, 0, surface.width * p, surface.height); context.clip();
    }
    drawContained(context, surface, image);
    context.restore(); context.save();
    if (state.type === 'wipe' && !incoming) {
      context.fillStyle = '#090a0b'; context.fillRect(0, 0, surface.width * p, surface.height);
    }
    if (state.type === 'flash') {
      context.fillStyle = `rgba(255,255,255,${incoming ? 1 - p : p})`;
      context.fillRect(0, 0, surface.width, surface.height);
    }
  }
  context.restore();
}

function textSettings() {
  return { text: $('text').value.trim(), start: +$('textStart').value, end: +$('textEnd').value,
    motion: $('textMotion').value, effect: $('textEffect').value, size: +$('fontSize').value || 56,
    color: $('color').value, position: $('position').value, animationDuration: +$('textAnimationDuration').value || .6 };
}
function paintText(context, surface, projectTime, settings = textSettings()) {
  let text = settings.text;
  const start = settings.start, end = settings.end;
  if (!text || projectTime < start || projectTime >= end || end <= start) return;
  const span = end - start, local = projectTime - start, edge = Math.min(clamp(settings.animationDuration, .1, 5), span / 2);
  const intro = edge ? clamp(local / edge) : 1, outro = edge ? clamp((end - projectTime) / edge) : 1;
  const motion = settings.motion, effect = settings.effect;
  if (motion === 'typewriter') text = Array.from(text).slice(0, Math.ceil(Array.from(text).length * clamp(local / edge))).join('');
  const size = Math.max(16, Math.min(160, settings.size)) * surface.width / 1920;
  const lines = text.split('\n'), gap = size * 1.25, color = settings.color;
  let x = surface.width / 2;
  let y = settings.position === 'top' ? surface.height * .15 : settings.position === 'bottom' ? surface.height * .82 : surface.height * .5;
  y -= (lines.length - 1) * gap / 2;
  let alpha = 1, scale = 1;
  if (motion === 'fade') alpha = Math.min(intro, outro);
  if (motion === 'rise') { y += (1 - intro) * surface.height * .12 - (1 - outro) * surface.height * .05; alpha = Math.min(1, intro * 1.5, outro * 1.5); }
  if (motion === 'slide') { x -= (1 - intro) * surface.width * .65; alpha = Math.min(1, intro * 1.4, outro * 1.4); }
  if (motion === 'zoom') { scale = .62 + .38 * intro; alpha = Math.min(intro, outro); }
  if (motion === 'bounce') { y -= Math.abs(Math.sin(intro * Math.PI * 2.5)) * (1 - intro) * surface.height * .14; alpha = Math.min(1, intro * 2, outro * 2); }
  if (motion === 'pulse') { scale = 1 + .065 * Math.sin(local * Math.PI * 2 / Math.max(.3, edge)); alpha = Math.min(intro, outro); }
  if (motion === 'float') { y += Math.sin(local * Math.PI * 2 / Math.max(1, edge * 3)) * surface.height * .035; alpha = Math.min(intro, outro); }
  if (motion === 'rotate') { scale = .8 + .2 * intro; alpha = Math.min(intro, outro); }
  context.save(); context.globalAlpha = alpha;
  context.translate(x, y); if (motion === 'rotate') context.rotate((intro - 1) * Math.PI * .7); context.scale(scale, scale); context.translate(-x, -y);
  context.font = `700 ${size}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = color;
  if (effect === 'shadow') { context.shadowColor = '#000'; context.shadowBlur = size * .16; context.shadowOffsetY = size * .08; }
  if (effect === 'glow' || effect === 'neon') { context.shadowColor = color; context.shadowBlur = size * (effect === 'neon' ? .42 : .28); }
  if (effect === 'box') {
    const width = Math.max(...lines.map(line => context.measureText(line).width));
    context.fillStyle = 'rgba(0,0,0,.68)'; context.fillRect(x - width / 2 - size * .35, y - size * .72, width + size * .7, lines.length * gap + size * .2);
    context.fillStyle = color;
  }
  lines.forEach((line, index) => {
    const lineY = y + index * gap;
    if (effect === 'outline' || effect === 'neon') {
      context.lineWidth = Math.max(2, size * (effect === 'neon' ? .08 : .055));
      context.strokeStyle = effect === 'neon' ? '#111' : 'rgba(0,0,0,.9)'; context.strokeText(line, x, lineY, surface.width * .9);
    }
    context.fillText(line, x, lineY, surface.width * .9);
  });
  context.restore();
}

function draw() {
  ctx.fillStyle = '#090a0b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const position = locate(time);
  if (position) {
    const video = clips[position.i].video;
    if (video.readyState >= 2) paintVideoFrame(ctx, canvas, video, position.i, time, clips);
  }
  paintText(ctx, canvas, time);
  $('time').textContent = `${format(time)} / ${format(duration())}`; $('seek').value = time;
  updateTimelinePlayhead();
}

function pause() {
  playing = false; cancelAnimationFrame(raf); clips.forEach(clip => clip.video.pause()); music?.video.pause();
  $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproduzir');
}

function seekVideo(video, target) {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - target) < .025 && video.readyState >= 2) { resolve(); return; }
    const timer = setTimeout(() => { clean(); reject(new Error('Não foi possível ler este ponto do ficheiro.')); }, 10000);
    function clean() { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', fail); }
    function done() { clean(); resolve(); } function fail() { clean(); reject(new Error('Não foi possível ler o ficheiro.')); }
    video.addEventListener('seeked', done); video.addEventListener('error', fail); video.currentTime = Math.max(0, target);
  });
}

function musicPositionAt(projectTime) {
  if (!music) return null;
  const timelineStart = music.timelineStart || 0, span = music.end - music.start, elapsed = projectTime - timelineStart;
  if (elapsed < 0 || span <= 0) return null;
  if (!music.loop && elapsed >= span) return null;
  return music.start + (music.loop ? elapsed % span : elapsed);
}

async function syncMusic(projectTime, shouldPlay) {
  if (!music) return;
  const position = musicPositionAt(projectTime);
  if (position === null) { music.video.pause(); return; }
  if (Math.abs(music.video.currentTime - position) > .25 || music.video.currentTime < music.start || music.video.currentTime >= music.end) music.video.currentTime = position;
  if (shouldPlay && music.video.paused) await music.video.play().catch(() => {});
}

async function seek(target) {
  pause(); time = Math.max(0, Math.min(duration(), target));
  const position = locate(time);
  if (position) { await seekVideo(clips[position.i].video, position.local); current = position.i; }
  if (music) { const point = musicPositionAt(time); if (point !== null) await seekVideo(music.video, point); }
  draw();
}

async function play() {
  if (!clips.length || busy) return; if (time >= duration() - .02) time = 0; busy = true;
  try {
    if (!audioCtx) audioCtx = new AudioContext(); await audioCtx.resume();
    clips.forEach(clip => { if (!clip.gain) clip.gain = connect(clip.video); clip.gain.gain.value = clip.volume; });
    if (music) { if (!musicGain) musicGain = connect(music.video); musicGain.gain.value = +$('musicVolume').value; }
    const position = locate(time); current = position.i; await seekVideo(clips[current].video, position.local); await clips[current].video.play();
    await syncMusic(time, true);
    playing = true; $('play').textContent = 'Ⅱ'; $('play').setAttribute('aria-label', 'Pausar'); raf = requestAnimationFrame(tick);
  } catch (error) { pause(); status(error.message); throw error; } finally { busy = false; }
}

async function tick() {
  if (!playing) return;
  const clip = clips[current], offset = clips.slice(0, current).reduce((sum, item) => sum + item.end - item.start, 0);
  time = Math.min(duration(), offset + Math.max(0, Math.min(clip.end, clip.video.currentTime) - clip.start));
  await syncMusic(time, true);
  if (clip.video.ended || clip.video.currentTime >= clip.end - .008) {
    clip.video.pause();
    if (current === clips.length - 1) { time = duration(); draw(); pause(); return; }
    current++;
    try { await seekVideo(clips[current].video, clips[current].start); await clips[current].video.play(); }
    catch (error) { status(error.message); pause(); return; }
  }
  if (!playing) return; draw(); raf = requestAnimationFrame(tick);
}

const transitionNames = { none: 'Sem transição', fade: 'Fundido', wipe: 'Cortina', slide: 'Deslizar', zoom: 'Zoom', flash: 'Flash' };
function updateTransitionControls() {
  const clip = clips[selected], enabled = !!clip && selected < clips.length - 1;
  document.querySelectorAll('#transitionGallery button').forEach(button => {
    button.disabled = !enabled;
    const active = (clip?.transition || 'none') === button.dataset.transition;
    button.setAttribute('aria-pressed', String(active)); button.classList.toggle('active', active);
  });
  $('transitionDuration').disabled = !enabled || !clip || clip.transition === 'none';
  $('transitionDuration').value = clip?.transitionDuration || .8;
  $('transitionDurationValue').textContent = `${Number($('transitionDuration').value).toFixed(1).replace('.', ',')} s`;
}

function render() {
  const total = duration(); $('count').textContent = `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}`;
  $('empty').hidden = clips.length > 0; $('seek').max = total; $('timeline').replaceChildren(); $('library').replaceChildren();
  clips.forEach((clip, index) => {
    const asset = document.createElement('div'); asset.className = 'asset';
    const thumb = document.createElement('video'); thumb.src = clip.url; thumb.muted = true; thumb.preload = 'metadata';
    const title = document.createElement('div'); title.textContent = clip.name; asset.append(thumb, title); $('library').append(asset);
  });
  if (!clips.length) {
    $('timeline').innerHTML = '<div class="timeline-empty">Os clips aparecem aqui, pela ordem do filme.</div>';
    $('library').innerHTML = '<div class="empty-small">Os teus vídeos começam aqui.<br>Importa um ou vários clips.</div>';
  }
  const clip = clips[selected]; $('selected').textContent = clip ? clip.name : 'Seleciona um clip na linha de tempo.';
  ['trimStart', 'trimEnd'].forEach(id => $(id).disabled = !clip); $('trimStart').value = clip ? clip.start.toFixed(2) : ''; $('trimEnd').value = clip ? clip.end.toFixed(2) : '';
  $('clipVolume').value = clip ? clip.volume : 1; ['split', 'remove', 'left', 'right', 'applyTrim'].forEach(id => $(id).disabled = !clip);
  $('export').disabled = !clips.length; updateTransitionControls(); renderTimeline(); draw();
}

function media(file, isAudio = false) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), mediaElement = document.createElement(isAudio ? 'audio' : 'video');
    mediaElement.preload = 'auto'; mediaElement.playsInline = true;
    const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('O ficheiro demorou demasiado a abrir.')); }, 20000);
    mediaElement.onloadeddata = () => {
      clearTimeout(timer);
      if (!Number.isFinite(mediaElement.duration) || mediaElement.duration <= 0) { URL.revokeObjectURL(url); reject(new Error('Duração de ficheiro inválida.')); return; }
      mediaElement.onloadeddata = null;
      resolve({ video: mediaElement, url, name: file.name, start: 0, end: mediaElement.duration, volume: 1, file, transition: 'none', transitionDuration: .8 });
    };
    mediaElement.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error(`Formato não suportado: ${file.name}`)); };
    mediaElement.src = url;
  });
}

$('files').onchange = async event => {
  if (exporting) return; pause(); status('A importar vídeos…');
  for (const file of event.target.files) {
    try { const clip = await media(file); clips.push(clip); selected = clips.length - 1; status(`${clips.length} clips prontos a editar`); }
    catch (error) { status(error.message); }
  }
  event.target.value = ''; render(); await seek(time);
};
$('start').onclick = () => $('files').click(); $('play').onclick = () => playing ? pause() : play().catch(() => {});
$('rewind').onclick = () => seek(0).catch(error => status(error.message)); $('seek').oninput = event => seek(+event.target.value).catch(error => status(error.message));

$('applyTrim').onclick = async () => {
  const clip = clips[selected]; if (!clip) return;
  const start = +$('trimStart').value, end = Math.min(clip.video.duration, +$('trimEnd').value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > clip.video.duration || end - start < .05) { status('Define uma entrada anterior à saída, dentro da duração do clip.'); render(); return; }
  pause(); clip.start = start; clip.end = end; time = Math.min(time, duration()); render(); await seek(time); status('Corte aplicado.');
};
$('remove').onclick = () => {
  pause(); const [clip] = clips.splice(selected, 1); clip.video.pause(); clip.gain?.disconnect(); URL.revokeObjectURL(clip.url);
  selected = Math.min(selected, clips.length - 1); time = Math.min(time, duration()); render(); seek(time).catch(error => status(error.message));
};
function move(direction) { const target = selected + direction; if (target < 0 || target >= clips.length) return; pause(); [clips[selected], clips[target]] = [clips[target], clips[selected]]; selected = target; render(); seek(time).catch(error => status(error.message)); }
$('left').onclick = () => move(-1); $('right').onclick = () => move(1);
$('split').onclick = async () => {
  pause(); const position = locate(time); if (!position) return; const clip = clips[position.i];
  if (position.local - clip.start < .05 || clip.end - position.local < .05) { status('Coloca o cursor no interior de um clip para o dividir.'); return; }
  try {
    const copy = await media(clip.file); copy.start = position.local; copy.end = clip.end; copy.volume = clip.volume; copy.transition = clip.transition; copy.transitionDuration = clip.transitionDuration;
    clip.end = position.local; clip.transition = 'none'; clips.splice(position.i + 1, 0, copy); selected = position.i + 1; render(); status('Clip dividido. Podes cortar ou mover cada parte.');
  } catch (error) { status(error.message); }
};
$('clipVolume').oninput = event => { const clip = clips[selected]; if (clip) { clip.volume = +event.target.value; if (clip.gain) clip.gain.gain.value = clip.volume; } };

document.querySelectorAll('#transitionGallery button').forEach(button => button.onclick = () => {
  const clip = clips[selected]; if (!clip || selected >= clips.length - 1) return;
  clip.transition = button.dataset.transition; updateTransitionControls(); render(); status(clip.transition === 'none' ? 'Transição removida.' : `${transitionNames[clip.transition]} aplicado entre os clips.`);
});
$('transitionDuration').oninput = event => {
  const clip = clips[selected]; if (!clip) return; clip.transitionDuration = +event.target.value;
  $('transitionDurationValue').textContent = `${clip.transitionDuration.toFixed(1).replace('.', ',')} s`; draw();
};

function updateMusicUi() {
  const enabled = !!music;
  ['musicTrimStart', 'musicTrimEnd', 'musicTimelineStart', 'applyMusicTrim', 'musicStartAtCursor', 'musicEndAtCursor', 'musicLoop'].forEach(id => $(id).disabled = !enabled);
  if (!music) { renderTimeline(); return; }
  $('musicTrimStart').value = music.start.toFixed(2); $('musicTrimEnd').value = music.end.toFixed(2); $('musicTimelineStart').value = (music.timelineStart || 0).toFixed(2); $('musicLoop').checked = music.loop;
  const span = music.end - music.start;
  $('audio-track').textContent = `${music.name} · trecho ${span.toFixed(1)} s · começa aos ${(music.timelineStart || 0).toFixed(1)} s${music.loop ? ' · repete' : ''}`;
  $('audio-track').className = 'filled';
  renderTimeline();
}
$('music').onchange = async event => {
  if (!event.target.files[0]) return; pause();
  try {
    const next = await media(event.target.files[0], true);
    if (music) { music.video.pause(); URL.revokeObjectURL(music.url); musicGain?.disconnect(); }
    music = next; music.timelineStart = 0; music.loop = true; music.video.loop = false; musicGain = null;
    $('musicName').textContent = music.name; updateMusicUi(); status('Música adicionada. Define o trecho e o ponto de entrada no filme.');
  } catch (error) { status(error.message); }
  event.target.value = '';
};
$('applyMusicTrim').onclick = async () => {
  if (!music) return; pause();
  const start = +$('musicTrimStart').value, end = Math.min(music.video.duration, +$('musicTrimEnd').value), timelineStart = +$('musicTimelineStart').value;
  if (![start, end, timelineStart].every(Number.isFinite) || start < 0 || end > music.video.duration || end - start < .05 || timelineStart < 0) { status('Confirma a entrada, a saída e o início da música no filme.'); updateMusicUi(); return; }
  music.start = start; music.end = end; music.timelineStart = timelineStart; music.loop = $('musicLoop').checked; updateMusicUi(); await seek(time); status('Corte de áudio aplicado.');
};
$('musicStartAtCursor').onclick = () => { if (!music) return; $('musicTimelineStart').value = time.toFixed(2); $('applyMusicTrim').click(); };
$('musicEndAtCursor').onclick = () => {
  if (!music) return; const length = Math.max(.05, time - +$('musicTimelineStart').value);
  $('musicTrimEnd').value = Math.min(music.video.duration, +$('musicTrimStart').value + length).toFixed(2); $('musicLoop').checked = false; $('applyMusicTrim').click();
};
$('musicLoop').onchange = () => { if (music) { music.loop = $('musicLoop').checked; updateMusicUi(); } };
$('musicVolume').oninput = event => { if (musicGain) musicGain.gain.value = +event.target.value; };
$('removeMusic').onclick = () => {
  music?.video.pause(); if (music) URL.revokeObjectURL(music.url); musicGain?.disconnect(); music = null; musicGain = null;
  $('musicName').textContent = 'MP3, WAV ou outro áudio compatível'; $('audio-track').textContent = 'Adiciona uma banda sonora no painel à direita'; $('audio-track').className = ''; updateMusicUi(); status('Música removida.');
};

function updateTextTrack() {
  const text = $('text').value.trim(), motion = $('textMotion').selectedOptions[0].textContent;
  $('text-track').textContent = text ? `${text.replace(/\n/g, ' ')} · ${+$('textStart').value || 0}–${+$('textEnd').value || 0} s · ${motion}` : 'O teu título, no momento certo';
  $('text-track').className = text ? 'filled' : ''; renderTimeline(); draw();
}
['text', 'textStart', 'textEnd', 'fontSize', 'color', 'position', 'textMotion', 'textEffect'].forEach(id => $(id).oninput = updateTextTrack);
$('textStartAtCursor').onclick = () => { $('textStart').value = time.toFixed(2); if (+$('textEnd').value <= time) $('textEnd').value = Math.min(duration() || time + 3, time + 3).toFixed(2); updateTextTrack(); };
$('textEndAtCursor').onclick = () => { $('textEnd').value = Math.max(time, +$('textStart').value + .1).toFixed(2); updateTextTrack(); };

window.addEventListener('beforeunload', event => { if (clips.length) { event.preventDefault(); event.returnValue = ''; } });
initTimeline(); updateMusicUi(); render();
