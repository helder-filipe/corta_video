// One scale for the ruler, clips, audio, text and cursor. Trim values always refer
// to the source; only their visible positions use the project clock.
let timelineGesture = null;
const timelineInset = 76;
function timelineScale() { return Number(document.getElementById('timelineZoom').value); }
function timelineClock(value) { return Math.max(0, value).toFixed(2).replace('.', ',') + ' s'; }
function updateTimelinePlayhead() {
  const head = $('timelinePlayhead'); if (!head) return;
  head.hidden = !clips.length; head.style.left = `${timelineInset + time * timelineScale()}px`;
}
function timelineItemState(kind, index) {
  if (kind === 'video') {
    const clip = clips[index];
    return { start: clip.start, end: clip.end, at: clips.slice(0, index).reduce((n, c) => n + c.end - c.start, 0), max: clip.video.duration };
  }
  if (kind === 'audio') return { start: music.start, end: music.end, at: music.timelineStart || 0, max: music.video.duration };
  return { start: +$('textStart').value || 0, end: +$('textEnd').value || 0, at: +$('textStart').value || 0, max: Math.max(duration(), +$('textEnd').value || 0, .1) };
}
function trimValues(original, kind, edge, delta) {
  const result = { ...original };
  if (edge === 'start') {
    result.start = Math.min(original.end - .05, Math.max(0, original.start + delta));
    if (kind === 'audio') {
      result.start = Math.max(result.start, original.start - original.at);
      result.at = original.at + result.start - original.start;
    }
    if (kind === 'text') result.at = result.start;
  } else result.end = Math.min(original.max, Math.max(original.start + .05, original.end + delta));
  return result;
}
function applyTimelineValues(kind, index, values) {
  if (kind === 'video') {
    clips[index].start = values.start; clips[index].end = values.end;
    $('trimStart').value = values.start.toFixed(2); $('trimEnd').value = values.end.toFixed(2);
  } else if (kind === 'audio') {
    music.start = values.start; music.end = values.end; music.timelineStart = values.at;
    $('musicTrimStart').value = values.start.toFixed(2); $('musicTrimEnd').value = values.end.toFixed(2); $('musicTimelineStart').value = values.at.toFixed(2);
  } else {
    $('textStart').value = values.start.toFixed(2); $('textEnd').value = values.end.toFixed(2);
  }
}
function timelineFeedback(kind, values) {
  const name = kind === 'video' ? 'Vídeo' : kind === 'audio' ? 'Áudio' : 'Texto';
  $('trimFeedback').textContent = `${name}: ${timelineClock(values.start)} → ${timelineClock(values.end)} · duração ${timelineClock(values.end - values.start)}`;
}
function layoutTimelineBars() {
  const scale = timelineScale();
  document.querySelectorAll('.timeline-bar').forEach(bar => {
    const s = timelineItemState(bar.dataset.kind, +bar.dataset.index);
    bar.style.left = `${s.at * scale}px`; bar.style.width = `${Math.max(1, (s.end - s.start) * scale)}px`;
    bar.querySelector('.bar-duration').textContent = timelineClock(s.end - s.start);
    bar.querySelectorAll('.trim-handle').forEach(h => {
      const start = h.dataset.edge === 'start';
      h.setAttribute('aria-valuenow', (start ? s.start : s.end).toFixed(2));
      h.setAttribute('aria-valuemin', start ? '0' : (s.start + .05).toFixed(2));
      h.setAttribute('aria-valuemax', (start ? s.end - .05 : s.max).toFixed(2));
      h.setAttribute('aria-valuetext', timelineClock(start ? s.start : s.end));
    });
  });
  document.querySelectorAll('[data-boundary]').forEach(b => {
    const i = +b.dataset.boundary, offset = clips.slice(0, i + 1).reduce((n, c) => n + c.end - c.start, 0);
    b.style.left = `${offset * scale}px`;
  });
  time = Math.min(time, duration()); $('seek').max = duration(); draw();
}
function finishTimelineGesture(cancel = false) {
  const gesture = timelineGesture; if (!gesture) return;
  timelineGesture = null;
  if (cancel) applyTimelineValues(gesture.kind, gesture.index, gesture.original);
  if (gesture.handle.hasPointerCapture?.(gesture.pointerId)) gesture.handle.releasePointerCapture(gesture.pointerId);
  const values = timelineItemState(gesture.kind, gesture.index);
  render(); updateMusicUi();
  const handle = document.querySelector(`[data-kind="${gesture.kind}"][data-index="${gesture.index}"] [data-edge="${gesture.edge}"]`);
  handle?.focus({ preventScroll: true });
  if (cancel) $('trimFeedback').textContent = 'Recorte cancelado.';
  else timelineFeedback(gesture.kind, values);
  // Show the frame adjoining the edited boundary once the gesture is committed.
  const at = gesture.edge === 'start' ? values.at : values.at + values.end - values.start - .025;
  seek(Math.min(duration(), Math.max(0, at))).catch(error => status(error.message));
}
function startTimelineGesture(event, kind, index, edge, handle) {
  if (event.button !== 0 || exporting || busy) return;
  event.preventDefault(); event.stopPropagation(); pause();
  if (kind === 'video') { selected = index; $('selected').textContent = clips[index].name; updateTransitionControls(); }
  const original = timelineItemState(kind, index);
  timelineGesture = { kind, index, edge, handle, original, pointerId: event.pointerId, x: event.clientX, scroll: $('timelineScroll').scrollLeft, scale: timelineScale() };
  handle.setPointerCapture(event.pointerId); handle.focus({ preventScroll: true });
  handle.closest('.timeline-bar').classList.add('trimming'); timelineFeedback(kind, original);
}
function makeTrimHandle(kind, index, edge) {
  const handle = document.createElement('button'); handle.type = 'button'; handle.className = `trim-handle trim-${edge}`; handle.dataset.edge = edge;
  const name = kind === 'video' ? `vídeo ${index + 1}` : kind === 'audio' ? 'áudio' : 'texto';
  handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `Recortar ${edge === 'start' ? 'início' : 'fim'} de ${name}`);
  handle.title = 'Arrasta para recortar · setas: 0,1 s · Shift: 1 s'; handle.textContent = '⋮';
  handle.onpointerdown = event => startTimelineGesture(event, kind, index, edge, handle);
  handle.onpointermove = event => {
    const g = timelineGesture; if (!g || g.handle !== handle || g.pointerId !== event.pointerId) return;
    const delta = (event.clientX - g.x + $('timelineScroll').scrollLeft - g.scroll) / g.scale;
    const values = trimValues(g.original, kind, edge, delta);
    applyTimelineValues(kind, index, values); layoutTimelineBars(); timelineFeedback(kind, values);
  };
  handle.onpointerup = () => { if (timelineGesture?.handle === handle) finishTimelineGesture(); };
  handle.onpointercancel = () => { if (timelineGesture?.handle === handle) finishTimelineGesture(true); };
  handle.onlostpointercapture = () => { if (timelineGesture?.handle === handle) finishTimelineGesture(true); };
  handle.onclick = event => event.stopPropagation();
  handle.onkeydown = event => {
    if (event.key === 'Escape' && timelineGesture) { event.preventDefault(); finishTimelineGesture(true); return; }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || exporting) return;
    event.preventDefault(); pause(); if (kind === 'video') selected = index;
    const original = timelineItemState(kind, index), delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : .1);
    applyTimelineValues(kind, index, trimValues(original, kind, edge, delta));
    timelineGesture = { kind, index, edge, handle, original }; finishTimelineGesture();
  };
  return handle;
}
function makeTimelineBar(kind, index, name, active = false) {
  const bar = document.createElement('div'); bar.className = `timeline-bar bar-${kind}${active ? ' active' : ''}`;
  bar.dataset.kind = kind; bar.dataset.index = index;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'bar-select'; button.title = name;
  const title = document.createElement('span'); title.textContent = name; const detail = document.createElement('span'); detail.className = 'bar-duration';
  button.append(title, detail);
  button.onclick = () => {
    if (kind === 'video') { selected = index; render(); }
    else $(kind === 'text' ? 'text' : 'musicTrimStart').focus({ preventScroll: false });
  };
  bar.append(button, makeTrimHandle(kind, index, 'start'), makeTrimHandle(kind, index, 'end'));
  return bar;
}
function renderTimeline() {
  if (timelineGesture) return;
  const scale = timelineScale(), total = duration();
  const textEnd = $('text').value.trim() ? +$('textEnd').value || 0 : 0;
  const audioEnd = music ? (music.timelineStart || 0) + music.end - music.start : 0;
  const seconds = Math.max(total, textEnd, audioEnd, 5) + 1;
  $('timelineContent').style.width = `${Math.max($('timelineScroll').clientWidth, timelineInset + seconds * scale)}px`;
  const ruler = $('timelineRuler'); ruler.replaceChildren();
  const step = scale >= 60 ? 1 : scale >= 35 ? 2 : 5;
  for (let s = 0; s < seconds; s += step) {
    const tick = document.createElement('button'); tick.type = 'button'; tick.style.left = `${s * scale}px`;
    tick.textContent = format(s); tick.setAttribute('aria-label', `Ir para ${s} segundos`);
    tick.onclick = () => seek(Math.min(s, duration())).catch(error => status(error.message)); ruler.append(tick);
  }
  const track = $('timeline'); track.replaceChildren();
  if (!clips.length) { const empty = document.createElement('div'); empty.className = 'timeline-empty'; empty.textContent = 'Importa vídeos para começar.'; track.append(empty); }
  clips.forEach((clip, index) => {
    track.append(makeTimelineBar('video', index, `${index + 1}. ${clip.name}`, index === selected));
    if (index < clips.length - 1) {
      const boundary = document.createElement('button'); boundary.type = 'button'; boundary.className = 'timeline-boundary'; boundary.dataset.boundary = index;
      boundary.textContent = clip.transition && clip.transition !== 'none' ? '◫' : '+';
      boundary.setAttribute('aria-label', `Transição depois do clip ${index + 1}`);
      boundary.onclick = () => { selected = index; render(); $('transitionGallery').scrollIntoView({ block: 'nearest' }); };
      track.append(boundary);
    }
  });
  const audio = $('audio-track'); audio.className = 'editable-track'; audio.replaceChildren();
  if (music) {
    audio.append(makeTimelineBar('audio', 0, music.name + (music.loop ? ' · ↻ repetir trecho' : '')));
    if (music.loop && total > audioEnd) {
      const tail = document.createElement('div'); tail.className = 'repeat-tail'; tail.style.left = `${audioEnd * scale}px`; tail.style.width = `${(total - audioEnd) * scale}px`; tail.textContent = '↻ repete até ao fim'; audio.append(tail);
    }
  } else audio.textContent = 'Adiciona música para recortar o áudio.';
  const textTrack = $('text-track'); textTrack.className = 'editable-track'; textTrack.replaceChildren();
  if ($('text').value.trim() && +$('textEnd').value > +$('textStart').value) textTrack.append(makeTimelineBar('text', 0, $('text').value.trim()));
  else textTrack.textContent = 'Escreve um título para ajustar a duração.';
  layoutTimelineBars();
}
function initTimeline() {
  $('timelineZoom').oninput = () => renderTimeline();
  $('timelineRuler').addEventListener('click', event => {
    if (event.target !== $('timelineRuler')) return;
    const x = event.clientX - $('timelineRuler').getBoundingClientRect().left;
    seek(Math.max(0, Math.min(duration(), x / timelineScale()))).catch(error => status(error.message));
  });
  window.addEventListener('resize', () => { if (!timelineGesture) renderTimeline(); });
}
