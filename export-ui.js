let exportController = null, savedResult = null, resultUrl = null;
const hasPicker = typeof window.showSaveFilePicker === 'function' && window.top === window.self;
if (!hasPicker) {
  $('saveMode').value = 'download';
  $('saveMode').options[0].disabled = true;
}
$('saveHint').textContent = hasPicker
  ? 'Ao exportar, escolhe a pasta e o nome na janela «Guardar como». O vídeo é escrito diretamente no destino escolhido.'
  : 'A escolha de pasta está disponível no Chrome ou Edge, com o editor aberto diretamente. Podes também ativar «Perguntar onde guardar cada ficheiro» nas definições de transferências do navegador.';

function openExport() {
  if ($('previewDialog').open) $('previewDialog').close();
  if (!exporting) pause();
  if (!$('dialog').open) $('dialog').showModal();
}
$('export').onclick = openExport;
$('exportDetails').onclick = openExport;
$('closeExport').onclick = () => $('dialog').close();
$('cancel').onclick = () => {
  exportController?.abort();
  $('cancel').disabled = true;
  $('exportStatus').textContent = 'A cancelar…';
};

const stage = document.querySelector('.stage'), transport = document.querySelector('.transport');
const stageMarker = document.createComment('preview-position'); stage.before(stageMarker);
$('expandPreview').onclick = () => {
  $('previewContent').append(stage, transport);
  $('previewDialog').showModal();
};
$('closePreview').onclick = () => $('previewDialog').close();
$('previewDialog').addEventListener('close', () => {
  pause(); stageMarker.after(stage, transport);
  $('expandPreview').focus();
});
$('closeResult').onclick = () => $('resultDialog').close();
$('resultDialog').addEventListener('close', () => {
  $('resultVideo').pause(); $('resultVideo').removeAttribute('src'); $('resultVideo').load();
  if (resultUrl) URL.revokeObjectURL(resultUrl); resultUrl = null;
});
async function resultBlob() { return savedResult.blob || await savedResult.handle.getFile(); }
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$('downloadResult').onclick = async () => {
  try { downloadBlob(await resultBlob(), savedResult.name); }
  catch (e) { $('exportStatus').textContent = 'Não foi possível abrir o ficheiro guardado: ' + e.message; }
};
$('viewResult').onclick = async () => {
  try {
    const blob = await resultBlob(); resultUrl = URL.createObjectURL(blob);
    $('resultVideo').src = resultUrl; $('resultDialog').showModal();
  } catch (e) { $('exportStatus').textContent = 'Não foi possível visualizar: ' + e.message; }
};

$('render').onclick = async () => {
  if (exporting || !clips.length || busy) return;
  if ($('text').value.trim() && (+$('textEnd').value <= +$('textStart').value)) {
    $('exportStatus').textContent = 'O fim do texto deve ser posterior ao início.'; return;
  }
  const format = $('exportFormat').value, fps = +$('fps').value, height = +$('resolution').value;
  const name = ($('project').value.trim() || 'meu-filme').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') + '.' + format;
  const oldTime = time;
  let handle, writable;
  // Invoke the picker in the click's activation, before loading or encoding anything.
  const picker = hasPicker && $('saveMode').value === 'choose'
    ? window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Vídeo ' + format.toUpperCase(), accept: { [format === 'mp4' ? 'video/mp4' : 'video/webm']: ['.' + format] } }] })
    : null;
  exporting = true; pause(); exportController = new AbortController();
  const controls = Array.from(document.querySelectorAll('main input,main button,main textarea,main select,header input,#dialog select,#includeAudio'));
  const disabled = controls.map(el => el.disabled);
  controls.forEach(el => el.disabled = true);
  document.querySelector('main').inert = true;
  $('render').disabled = true; $('cancel').hidden = false; $('cancel').disabled = false;
  $('exportDetails').hidden = false;
  $('downloadResult').hidden = true; $('viewResult').hidden = true; savedResult = null;
  $('progress').value = 0; $('exportStatus').textContent = 'A preparar exportação…';
  const check = () => { if (exportController.signal.aborted) throw new DOMException('Cancelado', 'AbortError'); };
  try {
    if (picker) handle = await picker;
    check();
    const { exportFilm } = await import('./export-engine.mjs');
    check();
    if (handle) writable = await handle.createWritable();
    const blob = await exportFilm({
      clips: clips.map(c => ({ ...c })), music: music ? { ...music } : null,
      musicVolume: +$('musicVolume').value, width: height * 16 / 9, height, fps, format,
      includeAudio: $('includeAudio').checked, writable, signal: exportController.signal, paintText, paintVideoFrame,
      onProgress: (percent, message) => {
        $('progress').value = percent;
        $('exportStatus').textContent = message + (percent > 0 ? ` · ${Math.round(percent)}%` : '');
        status($('exportStatus').textContent);
      }
    });
    check();
    if (writable) { await writable.close(); writable = null; }
    savedResult = { blob, handle, name: handle ? handle.name : name };
    if (blob) downloadBlob(blob, name);
    $('progress').value = 100;
    $('exportStatus').textContent = `${format.toUpperCase()} · ${height * 16 / 9} × ${height} · ${fps} fps — ${handle ? 'guardado em «' + handle.name + '».' : 'pronto. Transferência iniciada.'}`;
    $('downloadResult').hidden = false; $('viewResult').hidden = false;
    status('Vídeo exportado · ' + fps + ' fps');
  } catch (e) {
    if (writable) await writable.abort().catch(() => {});
    $('exportStatus').textContent = e.name === 'AbortError'
      ? 'Exportação cancelada. O projeto continua disponível.'
      : 'Não foi possível exportar: ' + e.message;
    status($('exportStatus').textContent);
  } finally {
    exporting = false; exportController = null;
    document.querySelector('main').inert = false;
    controls.forEach((el, i) => el.disabled = disabled[i]);
    $('render').disabled = false; $('cancel').hidden = true;
    time = oldTime; draw();
  }
};
