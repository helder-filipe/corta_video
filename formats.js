function projectRatio() {
  return $('aspectRatio').value === 'custom'
    ? [clamp(Math.round(+$('ratioWidth').value || 16), 1, 32), clamp(Math.round(+$('ratioHeight').value || 9), 1, 32)]
    : $('aspectRatio').value.split(':').map(Number);
}
function outputDimensions(shortEdge) {
  const [w, h] = projectRatio();
  const scale = Math.min(shortEdge / Math.min(w, h), 3840 / Math.max(w, h));
  return { width: Math.max(2, Math.round(scale * w / 2) * 2),
    height: Math.max(2, Math.round(scale * h / 2) * 2) };
}
function updateProjectFormat() {
  if (exporting) return;
  const ratio = projectRatio().join(':');
  $('customRatio').hidden = $('aspectRatio').value !== 'custom';
  const dimensions = outputDimensions(540);
  canvas.width = dimensions.width; canvas.height = dimensions.height;
  const stage = document.querySelector('.stage');
  stage.style.aspectRatio = ratio.replace(':', ' / ');
  stage.style.maxWidth = `${480 * dimensions.width / dimensions.height}px`;
  $('ratioBadge').textContent = ratio;
  $('previewRatio').textContent = `Pré-visualização · ${ratio}`;
  $('exportAspect').textContent = `Proporção do vídeo: ${ratio} · ${$('frameFit').selectedOptions[0].textContent}`;
  $('framePosition').hidden = $('frameFit').value !== 'cover';
  for (const option of $('resolution').options) {
    const size = outputDimensions(+option.value);
    const label = {720: 'HD', 1080: 'Full HD', 2160: 'Ultra HD'}[option.value];
    option.textContent = `${label} · ${size.width} × ${size.height}`;
  }
  draw();
}
['aspectRatio', 'ratioWidth', 'ratioHeight', 'frameFit', 'frameX', 'frameY'].forEach(id => $(id).addEventListener('input', updateProjectFormat));
['ratioWidth', 'ratioHeight'].forEach((id, i) => $(id).addEventListener('change', () => { $(id).value = projectRatio()[i]; updateProjectFormat(); }));
updateProjectFormat();
