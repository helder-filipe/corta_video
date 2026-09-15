/* Corta Studio: áudio original, histórico e formatação de texto.
   Carregar DEPOIS de app.js e export-ui.js. */
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const baseRender = render;
  const baseMedia = media;
  const oldText = {};

  for (const id of [
    'text', 'textStart', 'textEnd', 'fontSize', 'color', 'position'
  ]) {
    oldText[id] = byId(id).value;
  }

  const styles = document.createElement('style');

  styles.textContent =
    '.corta-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}' +
    '.corta-tools button{font-size:14px}' +
    '.corta-type label{font-size:14px;margin-top:10px}' +
    '.corta-type .checks{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}' +
    '.corta-type .checks label{display:flex;align-items:center;gap:5px;margin:0}' +
    '.corta-type input[type=checkbox]{width:18px;height:18px;margin:0;accent-color:var(--lime)}' +
    '.corta-type textarea{min-height:100px}' +
    '.corta-type select{max-width:100%}' +
    '.corta-type .hint{font-size:13px}' +
    '.corta-warning{color:#ffcd86;font-size:13px}' +
    '#cortaMedia{position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden}' +
    '#cortaMedia video,#cortaMedia audio{width:1px;height:1px}' +
    '#audio-track{white-space:normal!important}' +
    '#clearDialog{max-height:85vh;overflow:auto}';

  document.head.append(styles);

  const bar = document.createElement('div');
  bar.className = 'corta-tools';

  bar.innerHTML =
    '<button id="undoEdit" type="button" disabled>↶ Desfazer</button>' +
    '<button id="clearEdit" type="button">Limpar projeto</button>';

  document.querySelector('.timeline-head').before(bar);

  const textSection = byId('text').closest('section');
  textSection.classList.add('corta-type');

  textSection.innerHTML =
    '<h2>Texto</h2>' +
    '<label>Conteúdo<textarea id="text" rows="4" placeholder="Escreve o teu título…"></textarea></label>' +
    '<p class="hint">Enter: novo parágrafo. Shift+Enter: quebra de linha. A formatação aplica-se ao título inteiro.</p>' +
    '<div class="two"><label>De (s)<input id="textStart" type="number" min="0" step="0.1" value="0"></label>' +
    '<label>Até (s)<input id="textEnd" type="number" min="0" step="0.1" value="5"></label></div>' +
    '<label>Fonte<select id="fontFamily"></select></label>' +
    '<div class="corta-tools"><button id="systemFonts" type="button">Fontes do computador</button>' +
    '<button id="importFont" type="button">Importar fonte…</button></div>' +
    '<input id="fontFile" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>' +
    '<p id="fontHint" class="hint">Podes importar um ficheiro TTF, OTF, WOFF ou WOFF2.</p>' +
    '<div class="two"><label>Tamanho<input id="fontSize" type="number" min="16" max="200" value="56"></label>' +
    '<label>Cor<input id="color" type="color" value="#ffffff"></label></div>' +
    '<div class="checks"><label><input id="textBold" type="checkbox" checked>Negrito</label>' +
    '<label><input id="textItalic" type="checkbox">Itálico</label>' +
    '<label><input id="textUnderline" type="checkbox">Sublinhado</label></div>' +
    '<label>Alinhamento<select id="textAlign"><option value="left">Esquerda</option>' +
    '<option value="center" selected>Centro</option><option value="right">Direita</option>' +
    '<option value="justify">Justificado</option></select></label>' +
    '<div class="two"><label>Entrelinha<input id="lineSpacing" type="number" min="0.8" max="3" step="0.05" value="1.25"></label>' +
    '<label>Após parágrafo (px)<input id="paragraphSpacing" type="number" min="0" max="200" step="1" value="12"></label></div>' +
    '<div class="two"><label>Recuo inicial (px)<input id="firstIndent" type="number" min="0" max="300" value="0"></label>' +
    '<label>Largura (%)<input id="textWidth" type="number" min="20" max="95" value="90"></label></div>' +
    '<label>Posição<select id="position"><option value="bottom">Em baixo</option>' +
    '<option value="center">Ao centro</option><option value="top">Em cima</option></select></label>' +
    '<p id="textOverflow" class="corta-warning" hidden>O texto excede a altura disponível. Reduz o tamanho, a entrelinha ou o conteúdo antes de exportar.</p>';

  for (const [id, value] of Object.entries(oldText)) {
    byId(id).value = value;
  }

  const families = [
    'sans-serif', 'Arial', 'Calibri', 'Cambria', 'Candara',
    'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia',
    'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana'
  ];

  function addFamily(value, label = value) {
    const exists = [...byId('fontFamily').options]
      .some(option => option.value === value);

    if (!exists) {
      byId('fontFamily').add(new Option(label, value));
    }
  }

  families.forEach(family => {
    addFamily(
      family,
      family === 'sans-serif' ? 'Sem serifa (predefinida)' : family
    );
  });

  const clearDialog = document.createElement('dialog');
  clearDialog.id = 'clearDialog';
  clearDialog.setAttribute('aria-labelledby', 'clearTitle');

  clearDialog.innerHTML =
    '<h2 id="clearTitle">Limpar o projeto?</h2>' +
    '<p>Remove os vídeos, a música e o texto deste projeto. Os ficheiros no computador não são apagados.</p>' +
    '<p>Podes recuperar o projeto com «Desfazer» enquanto esta página estiver aberta e a ação permanecer no histórico.</p>' +
    '<div class="corta-tools"><button id="keepProject" type="button" autofocus>Manter projeto</button>' +
    '<button id="confirmClear" type="button">Limpar projeto</button></div>';

  document.body.append(clearDialog);

  const mediaBin = document.createElement('div');
  mediaBin.id = 'cortaMedia';
  mediaBin.setAttribute('aria-hidden', 'true');
  document.body.append(mediaBin);

  const fieldIds = [
    'project', 'text', 'textStart', 'textEnd', 'fontSize',
    'color', 'position', 'fontFamily', 'textBold', 'textItalic',
    'textUnderline', 'textAlign', 'lineSpacing',
    'paragraphSpacing', 'firstIndent', 'textWidth', 'musicVolume'
  ];

  const readField = id => {
    const element = byId(id);
    return element.type === 'checkbox'
      ? element.checked
      : element.value;
  };

  let values = Object.fromEntries(
    fieldIds.map(id => [id, readField(id)])
  );

  const defaults = {
    ...values,
    project: 'O meu primeiro filme',
    text: '',
    textStart: '0',
    textEnd: '5',
    fontSize: '56',
    color: '#ffffff',
    position: 'bottom',
    fontFamily: 'sans-serif',
    textBold: true,
    textItalic: false,
    textUnderline: false,
    textAlign: 'center',
    lineSpacing: '1.25',
    paragraphSpacing: '12',
    firstIndent: '0',
    textWidth: '90',
    musicVolume: '0.35'
  };

  const history = [];
  const resources = new Map();
  const probes = new WeakMap();
  const MAX_UNDO = 40;

  let generation = 0;
  let fieldGroup = null;
  let fontCounter = 0;
  const importedFonts = new Map();
  let overflow = false;
  let mediaLibrary;

  const blocked = () => busy || exporting;

  const number = (value, fallback, min, max) => {
    const n = value === '' ? fallback : Number(value);

    return Math.min(
      max,
      Math.max(min, Number.isFinite(n) ? n : fallback)
    );
  };

  function snapshot() {
    return {
      clips: clips.map(clip => ({ ...clip })),
      music: music ? { ...music } : null,
      selected,
      time,
      values: { ...values },
      includeAudio: byId('includeAudio').checked,
      settings: window.CortaTimeline?.settings()
    };
  }

  function retainLiveResources() {
    const live = new Set();

    const keep = state => {
      state.clips.forEach(clip => live.add(clip.video));
      if (state.music) live.add(state.music.video);
    };

    keep({ clips, music });
    history.forEach(entry => keep(entry.state));

    for (const [video, resource] of resources) {
      if (live.has(video)) continue;

      video.pause();
      resource.gain?.disconnect();
      video.removeAttribute('src');
      video.load();
      video.remove();

      URL.revokeObjectURL(resource.url);
      resources.delete(video);
    }
  }

  function record(label) {
    history.push({ label, state: snapshot() });

    if (history.length > MAX_UNDO) {
      history.shift();
    }

    fieldGroup = null;
  }

  function buttons() {
    byId('undoEdit').disabled = blocked() || !history.length;

    byId('undoEdit').title = history.length
      ? 'Desfazer: ' + history[history.length - 1].label + ' (Ctrl+Z)'
      : 'Nada para desfazer';

    byId('clearEdit').disabled = blocked();
    for (const id of ['saveProject', 'openProject', 'project']) {
      if (byId(id)) byId(id).disabled = blocked();
    }
    byId('export').disabled = busy || !clips.length;
  }

  function volumes() {
    clips.forEach(clip => {
      clip.video.muted = false;
      clip.video.defaultMuted = false;
      clip.video.volume = number(clip.volume, 1, 0, 1);
    });

    if (music) {
      music.video.muted = false;
      music.video.volume = number(values.musicVolume, .35, 0, 1);
    }
  }

  function tracks() {
    const count = clips.filter(
      clip => clip.audioInfo === 'presente'
    ).length;

    const absent = clips.filter(
      clip => clip.audioInfo === 'ausente'
    ).length;

    let label = clips.length
      ? 'Áudio original acompanha os cortes e o volume de cada clip.'
      : 'Importa vídeos com áudio ou adiciona uma música.';

    if (count) {
      label += ' Detetado em ' + count + ' clip(s).';
    }

    if (absent) {
      label += ' ' + absent + ' clip(s) sem faixa de áudio.';
    }

    if (clips.some(clip => clip.audioInfo === 'incompatível')) {
      label += ' Há áudio não descodificável neste navegador.';
    }

    if (music) {
      label += ' Música adicional: ' + music.name;
    }

    byId('audio-track').textContent = label;
    byId('audio-track').className =
      clips.length || music ? 'filled' : '';

    byId('musicName').textContent = music
      ? music.name
      : 'MP3, WAV ou outro áudio compatível';

    byId('text-track').textContent =
      values.text || 'O teu título, no momento certo';

    byId('text-track').className = values.text ? 'filled' : '';
  }

  render = function () {
    baseRender();
    volumes();
    tracks();
    buttons();
  };

  pause = function () {
    generation++;
    playing = false;

    cancelAnimationFrame(raf);
    clips.forEach(clip => clip.video.pause());
    music?.video.pause();

    byId('play').textContent = '▶';
    byId('play').setAttribute('aria-label', 'Reproduzir');
  };

  seek = async function (target) {
    pause();

    const token = generation;
    time = number(target, 0, 0, duration());

    const point = locate(time);

    if (point) {
      await seekVideo(clips[point.i].video, point.local);

      if (token !== generation) return;
      current = point.i;
    } else {
      current = -1;
    }

    if (music) {
      await seekVideo(music.video, time % music.end);
    }

    if (token === generation) draw();
  };

  play = async function () {
    if (blocked() || !clips.length) return;

    const bounds = window.CortaTimeline?.bounds() || {start: 0, end: duration()};
    if (time >= bounds.end - .001 || time < bounds.start) {
      time = bounds.start;
    }

    const token = ++generation;
    busy = true;
    buttons();

    try {
      volumes();

      const point = locate(time);
      current = point.i;

      const video = clips[current].video;

      await seekVideo(video, point.local);

      if (music) {
        await seekVideo(music.video, time % music.end);
      }

      if (token !== generation) return;

      await Promise.all([
        video.play(),
        ...(music ? [music.video.play()] : [])
      ]);

      if (token !== generation) {
        video.pause();
        music?.video.pause();
        return;
      }

      playing = true;
      byId('play').textContent = 'Ⅱ';
      byId('play').setAttribute('aria-label', 'Pausar');

      raf = requestAnimationFrame(() => tick(token));
    } catch (error) {
      pause();
      status('Não foi possível reproduzir: ' + error.message);
    } finally {
      busy = false;
      buttons();
    }
  };

  tick = async function (token = generation) {
    if (!playing || token !== generation) return;

    const clip = clips[current];

    if (!clip) {
      pause();
      return;
    }

    const offset = clips
      .slice(0, current)
      .reduce((sum, item) => sum + item.end - item.start, 0);

    time = Math.min(
      duration(),
      offset + Math.max(
        0,
        Math.min(clip.end, clip.video.currentTime) - clip.start
      )
    );

    if (music && music.end > 0) {
      const target = time % music.end;
      const delta = Math.abs(target - music.video.currentTime);

      if (
        Math.min(delta, Math.abs(music.end - delta)) > .25 &&
        !music.video.seeking
      ) {
        music.video.currentTime = target;
      }
    }

    if (clip.video.ended || clip.video.currentTime >= clip.end - .001) {
      clip.video.pause();

      if (current === clips.length - 1 || window.CortaTimeline?.selectedOnly()) {
        time = offset + clip.end - clip.start;
        draw();
        pause();
        return;
      }

      current++;
      const next = clips[current];

      try {
        await seekVideo(next.video, next.start);

        if (token !== generation || !playing) return;

        await next.video.play();

        if (token !== generation || !playing) {
          next.video.pause();
          return;
        }

        time = offset + clip.end - clip.start;
      } catch (error) {
        if (token === generation) {
          pause();
          status(error.message);
        }
        return;
      }
    }

    draw();

    if (playing && token === generation) {
      raf = requestAnimationFrame(() => tick(token));
    }
  };

  async function audioInfo(file) {
    if (!probes.has(file)) {
      probes.set(file, (async () => {
        let input;

        try {
          mediaLibrary ??= import('./vendor/mediabunny-1.56.2.mjs');
          const M = await mediaLibrary;

          input = new M.Input({
            source: new M.BlobSource(file),
            formats: M.ALL_FORMATS
          });

          const track = await input.getPrimaryAudioTrack();

          return !track
            ? 'ausente'
            : await track.canDecode()
              ? 'presente'
              : 'incompatível';
        } catch {
          return 'por verificar';
        } finally {
          input?.dispose();
        }
      })());
    }

    return probes.get(file);
  }

  media = async function (file, isAudio = false) {
    const item = await baseMedia(file, isAudio);

    item.video.muted = false;
    item.video.defaultMuted = false;
    item.video.volume = 1;
    item.video.tabIndex = -1;

    mediaBin.append(item.video);
    resources.set(item.video, item);

    item.audioInfo = await audioInfo(file);

    return item;
  };

  async function transaction(work) {
    if (blocked()) return;

    pause();
    fieldGroup = null;
    busy = true;

    const main = document.querySelector('main');
    main.inert = true;
    buttons();

    try {
      await work();
    } catch (error) {
      status(error.message);
    } finally {
      busy = false;
      main.inert = false;

      retainLiveResources();
      render();
    }
  }

  function applyFields() {
    for (const id of fieldIds) {
      const element = byId(id);

      if (element.type === 'checkbox') {
        element.checked = Boolean(values[id]);
      } else {
        element.value = values[id];
      }
    }
  }

  async function undo() {
    if (blocked() || !history.length) return;

    await transaction(async () => {
      const last = history.pop();
      const previous = last.state;

      clips = previous.clips.map(clip => ({ ...clip }));
      music = previous.music ? { ...previous.music } : null;
      selected = previous.selected;
      values = { ...previous.values };
      window.CortaTimeline?.restoreSettings(previous.settings);

      applyFields();

      byId('includeAudio').checked = previous.includeAudio;
      musicGain = null;

      volumes();
      await seek(previous.time);

      status('Desfeito: ' + last.label);
    });
  }

  byId('undoEdit').onclick = undo;

  document.addEventListener('keydown', event => {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === 'z' &&
      !document.querySelector('dialog[open]')
    ) {
      event.preventDefault();
      undo();
    }
  });

  byId('clearEdit').onclick = () => {
    if (!blocked()) clearDialog.showModal();
  };

  byId('keepProject').onclick = () => clearDialog.close();

  byId('confirmClear').onclick = () => {
    clearDialog.close();

    transaction(async () => {
      record('limpar projeto');

      clips = [];
      music = null;
      musicGain = null;
      selected = -1;
      current = -1;
      time = 0;

      values = { ...defaults };
      window.CortaTimeline?.restoreSettings({scope:'all',fps:'30',resolution:'1080',exportFormat:'mp4',includeAudio:true});
      applyFields();

      byId('includeAudio').checked = true;
      byId('files').value = '';
      byId('music').value = '';

      status('Projeto limpo. Podes recuperar tudo com Desfazer.');
    });
  };

  byId('files').onchange = event => {
    const files = [...event.target.files];
    event.target.value = '';

    if (!files.length) return;

    transaction(async () => {
      const added = [];
      const errors = [];

      status('A importar vídeo e áudio…');

      for (const file of files) {
        try {
          added.push(await media(file));
        } catch (error) {
          errors.push(file.name + ': ' + error.message);
        }
      }

      if (added.length) {
        record('importar vídeos');

        clips.push(...added);
        selected = clips.length - 1;
        byId('includeAudio').checked = true;

        await seek(time);
      }

      status(
        added.length + ' vídeo(s) importado(s).' +
        (errors.length
          ? ' Falhas: ' + errors.join(' | ')
          : ' O áudio existente acompanha o vídeo na reprodução e exportação.')
      );
    });
  };

  byId('music').onchange = event => {
    const file = event.target.files[0];
    event.target.value = '';

    if (!file) return;

    transaction(async () => {
      const next = await media(file, true);

      record('adicionar música');

      music = next;
      music.video.loop = true;
      musicGain = null;
      byId('includeAudio').checked = true;

      status('Música adicionada. O som original dos vídeos mantém-se.');
    });
  };

  byId('removeMusic').onclick = () => transaction(async () => {
    if (!music) return;

    record('remover música');

    music = null;
    musicGain = null;

    status('Música adicional removida. O áudio dos vídeos mantém-se.');
  });

  byId('applyTrim').onclick = () => transaction(async () => {
    const clip = clips[selected];
    if (!clip) return;

    const start = Number(byId('trimStart').value);
    const end = Number(byId('trimEnd').value);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > clip.video.duration ||
      end - start < .05
    ) {
      throw new Error(
        'Define uma entrada anterior à saída, dentro da duração do clip.'
      );
    }

    if (start === clip.start && end === clip.end) return;

    record('aplicar corte');

    clip.start = start;
    clip.end = end;

    await seek(Math.min(time, duration()));
    status('Corte aplicado ao vídeo e ao áudio.');
  });

  byId('remove').onclick = () => transaction(async () => {
    if (!clips[selected]) return;

    record('eliminar clip');

    clips.splice(selected, 1);
    selected = Math.min(selected, clips.length - 1);

    await seek(Math.min(time, duration()));
    status('Clip eliminado. Disponível no histórico de Desfazer.');
  });

  move = direction => transaction(async () => {
    const target = selected + direction;

    if (selected < 0 || target < 0 || target >= clips.length) return;

    record('mover clip');

    [clips[selected], clips[target]] = [clips[target], clips[selected]];
    selected = target;

    await seek(time);
  });

  byId('left').onclick = () => move(-1);
  byId('right').onclick = () => move(1);

  byId('split').onclick = () => transaction(async () => {
    const point = locate(time);
    if (!point) return;

    const clip = clips[point.i];

    if (
      point.local - clip.start < .05 ||
      clip.end - point.local < .05
    ) {
      throw new Error(
        'Coloca o cursor no interior do clip para o dividir.'
      );
    }

    const copy = await media(clip.file);

    record('dividir clip');

    copy.start = point.local;
    copy.end = clip.end;
    copy.volume = clip.volume;
    clip.end = point.local;

    clips.splice(point.i + 1, 0, copy);
    selected = point.i + 1;

    await seek(time);
    status('Vídeo e áudio divididos no mesmo ponto.');
  });

  function changedField(id) {
    if (blocked()) {
      applyFields();
      return;
    }

    const next = readField(id);

    if (values[id] === next) return;

    if (fieldGroup !== id) {
      record('alterar texto ou formatação');
      fieldGroup = id;
    }

    values[id] = next;

    volumes();
    tracks();
    draw();
    buttons();
    retainLiveResources();
  }

  for (const id of fieldIds) {
    const element = byId(id);

    element.oninput = () => changedField(id);

    element.onchange = () => {
      changedField(id);
      fieldGroup = null;
    };

    element.addEventListener('blur', () => {
      fieldGroup = null;
    });
  }

  byId('clipVolume').oninput = event => {
    const clip = clips[selected];
    if (blocked() || !clip) return;

    const next = number(event.target.value, 1, 0, 1);
    if (next === clip.volume) return;

    const group = 'volume:' + selected;

    if (fieldGroup !== group) {
      record('alterar volume original');
      fieldGroup = group;
    }

    clip.volume = next;

    volumes();
    buttons();
    retainLiveResources();
  };

  byId('clipVolume').onchange = () => {
    fieldGroup = null;
  };

  byId('text').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.shiftKey && !blocked()) {
      event.preventDefault();

      const element = event.currentTarget;

      element.setRangeText(
        '\u2028',
        element.selectionStart,
        element.selectionEnd,
        'end'
      );

      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  byId('systemFonts').onclick = async () => {
    if (blocked()) return;

    if (typeof window.queryLocalFonts !== 'function') {
      byId('fontHint').textContent =
        'Este navegador não permite listar fontes locais. Usa «Importar fonte…».';
      return;
    }

    busy = true;
    buttons();

    try {
      const fonts = await window.queryLocalFonts();

      [...new Set(fonts.map(font => font.family))]
        .sort((a, b) => a.localeCompare(b))
        .forEach(family => addFamily(family));

      byId('fontHint').textContent =
        'Fontes do computador disponíveis na lista.';
    } catch {
      byId('fontHint').textContent =
        'Não foi concedido acesso às fontes. Podes importar um ficheiro de fonte.';
    } finally {
      busy = false;
      buttons();
    }
  };

  byId('importFont').onclick = () => {
    if (!blocked()) byId('fontFile').click();
  };

  byId('fontFile').onchange = event => {
    const file = event.target.files[0];
    event.target.value = '';

    if (!file) return;

    transaction(async () => {
      const alias = 'CortaImported' + (++fontCounter);
      const face = new FontFace(alias, await file.arrayBuffer());

      await face.load();
      document.fonts.add(face);
      importedFonts.set(alias, file);

      addFamily(
        alias,
        file.name.replace(/\.(ttf|otf|woff2?)$/i, '') + ' (importada)'
      );

      record('importar fonte');

      values.fontFamily = alias;
      byId('fontFamily').value = alias;

      status('Fonte carregada para a pré-visualização e exportação.');
    });
  };

  byId('fontFamily').onchange = async () => {
    if (blocked()) {
      applyFields();
      return;
    }

    changedField('fontFamily');
    fieldGroup = null;
    busy = true;
    buttons();

    try {
      await document.fonts.load(
        '16px ' + JSON.stringify(values.fontFamily)
      );
    } catch {
      status(
        'Não foi possível carregar esta fonte. Experimenta importar o ficheiro.'
      );
    } finally {
      busy = false;
      draw();
      buttons();
    }
  };

  // Esta função é partilhada pela pré-visualização e pela exportação.
  paintText = function (context, surface, timestamp) {
    if (surface === canvas) {
      overflow = false;
      byId('textOverflow').hidden = true;
    }

    const text = String(values.text || '').replace(/\r/g, '');
    const start = number(values.textStart, 0, 0, 1e9);
    const end = number(values.textEnd, 5, 0, 1e9);

    if (!text.trim() || timestamp < start || timestamp >= end) return;

    const scale = surface.width / 1920;
    const size = number(values.fontSize, 56, 16, 200) * scale;
    const step = size * number(values.lineSpacing, 1.25, .8, 3);
    const paragraphGap =
      number(values.paragraphSpacing, 12, 0, 200) * scale;

    const boxWidth =
      surface.width * number(values.textWidth, 90, 20, 95) / 100;

    const indent = Math.min(
      boxWidth * .45,
      number(values.firstIndent, 0, 0, 300) * scale
    );

    const left = (surface.width - boxWidth) / 2;

    context.save();

    context.font =
      (values.textItalic ? 'italic ' : '') +
      (values.textBold ? '700 ' : '400 ') +
      size + 'px ' +
      JSON.stringify(values.fontFamily) +
      ', sans-serif';

    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = values.color;
    context.strokeStyle = values.color;
    context.shadowColor = '#000';
    context.shadowBlur = size * .16;

    const lines = [];
    let y = 0;
    const paragraphs = text.split('\n');

    paragraphs.forEach((paragraph, paragraphIndex) => {
      let first = true;
      const parts = paragraph.split('\u2028');

      parts.forEach((part, partIndex) => {
        const words = part.trim().split(/\s+/).filter(Boolean);
        let line = '';

        const width = () => boxWidth - (first ? indent : 0);

        const emit = final => {
          lines.push({
            text: line,
            indent: first ? indent : 0,
            y,
            last: final && partIndex === parts.length - 1
          });

          y += step;
          first = false;
          line = '';
        };

        for (const word of words) {
          if (
            line &&
            context.measureText(line + ' ' + word).width > width()
          ) {
            emit(false);
          }

          if (context.measureText(word).width > width()) {
            if (line) emit(false);

            for (const character of Array.from(word)) {
              if (
                line &&
                context.measureText(line + character).width > width()
              ) {
                emit(false);
              }

              line += character;
            }
          } else {
            line = line ? line + ' ' + word : word;
          }
        }

        emit(true);
      });

      if (paragraphIndex < paragraphs.length - 1) {
        y += paragraphGap;
      }
    });

    const height = Math.max(size, y - step + size);
    const margin = surface.height * .07;

    if (surface === canvas) {
      overflow = height > surface.height - 2 * margin;
      byId('textOverflow').hidden = !overflow;
    }

    const top = values.position === 'top'
      ? margin
      : values.position === 'center'
        ? (surface.height - height) / 2
        : surface.height - margin - height;

    context.beginPath();
    context.rect(0, 0, surface.width, surface.height);
    context.clip();

    for (const line of lines) {
      const available = boxWidth - line.indent;
      const natural = context.measureText(line.text).width;
      const words = line.text.split(' ').filter(Boolean);

      const justify =
        values.textAlign === 'justify' &&
        !line.last &&
        words.length > 1;

      let x = left + line.indent;

      if (values.textAlign === 'center') {
        x += (available - natural) / 2;
      }

      if (values.textAlign === 'right') {
        x += available - natural;
      }

      const baseline = top + line.y + size * .85;

      if (justify) {
        const wordWidth = words.reduce(
          (sum, word) => sum + context.measureText(word).width,
          0
        );

        const gap = Math.max(
          0,
          (available - wordWidth) / (words.length - 1)
        );

        let position = x;

        for (const word of words) {
          context.fillText(word, position, baseline);
          position += context.measureText(word).width + gap;
        }
      } else {
        context.fillText(line.text, x, baseline);
      }

      if (values.textUnderline && line.text) {
        context.lineWidth = Math.max(1, size * .045);
        context.beginPath();

        context.moveTo(x, baseline + size * .12);

        context.lineTo(
          x + (justify ? available : natural),
          baseline + size * .12
        );

        context.stroke();
      }
    }

    context.restore();
  };

  byId('render').addEventListener('click', event => {
    if (blocked()) return;

    // Verifica a altura mesmo com o cursor fora do intervalo do título.
    const previousTime = time;

    time = number(values.textStart, 0, 0, 1e9);
    draw();

    const tooTall = overflow;

    time = previousTime;
    draw();

    if (tooTall) {
      event.preventDefault();
      event.stopImmediatePropagation();

      byId('exportStatus').textContent =
        'O título excede a altura do vídeo. Reduz o texto, o tamanho ou o espaçamento.';
    }
  }, true);

  window.addEventListener('beforeunload', event => {
    if (
      clips.length ||
      music ||
      String(values.text).trim() ||
      exporting
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  byId('start').onclick = () => {
    if (!blocked()) byId('files').click();
  };

  byId('play').onclick = () => playing ? pause() : play();

  byId('rewind').onclick = () => {
    if (!blocked()) {
      seek(0).catch(error => status(error.message));
    }
  };

  byId('seek').oninput = event => {
    if (!blocked()) {
      seek(Number(event.target.value))
        .catch(error => status(error.message));
    }
  };

  window.CortaEditor = {
    record, transaction, fonts: importedFonts,
    getValues: () => ({...values}),
    setValues(next) {
      values = {...defaults, ...Object.fromEntries(fieldIds.filter(id => Object.hasOwn(next, id)).map(id => [id, next[id]]))};
      addFamily(values.fontFamily);
      applyFields();
    },
    async loadFont(file) {
      const alias = 'CortaImported' + (++fontCounter);
      const face = new FontFace(alias, await file.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      importedFonts.set(alias, file);
      addFamily(alias, file.name + ' (importada)');
      return alias;
    }
  };
  render();
})();
