/* Carregar depois de app.js, export-ui.js e editor-upgrade.js (se existir). */
(() => {
  'use strict';
  if (window.CortaFormats) return;

  const options = [
    ['16:9', 16, 9, '16:9 · Horizontal'],
    ['9:16', 9, 16, '9:16 · Vertical'],
    ['1:1', 1, 1, '1:1 · Quadrado'],
    ['4:5', 4, 5, '4:5 · Retrato'],
    ['4:3', 4, 3, '4:3 · Horizontal clássico'],
    ['3:4', 3, 4, '3:4 · Retrato clássico']
  ];
  const el = id => document.getElementById(id);
  const surface = el('canvas');
  const stage = document.querySelector('.stage');
  const resolution = el('resolution');
  let selected = options[0];

  const panel = document.createElement('div');
  panel.className = 'video-format-controls';
  const label = document.createElement('label');
  label.htmlFor = 'videoRatio';
  label.textContent = 'Formato do vídeo';
  const select = document.createElement('select');
  select.id = 'videoRatio';
  for (const [value, , , name] of options) select.add(new Option(name, value));
  label.append(select);
  const description = document.createElement('p');
  description.className = 'hint';
  description.textContent = 'O vídeo é ajustado sem deformação nem cortes. Podem surgir margens quando as proporções são diferentes.';
  panel.append(label, description);
  document.querySelector('.viewer-title').after(panel);

  const summary = document.createElement('p');
  summary.id = 'exportRatioSummary';
  summary.className = 'hint';
  resolution.closest('label').after(summary);

  const style = document.createElement('style');
  style.textContent = `
    .video-format-controls{display:flex;align-items:center;gap:18px;margin:0 0 18px;flex-wrap:wrap}
    .video-format-controls label{font-size:14px;min-width:210px}
    .video-format-controls .hint{flex:1;min-width:170px;margin:0;font-size:13px}
    .workspace .stage,#previewContent .stage{
      --corta-ratio:1.7777777778;
      width:min(100%,calc(58vh * var(--corta-ratio)));
      height:auto;max-height:none;aspect-ratio:var(--corta-ratio);margin-inline:auto;
      box-sizing:content-box;border:0;box-shadow:0 0 0 1px #292a2f;
    }
    #previewContent .stage{width:min(100%,calc(68vh * var(--corta-ratio)))}
    .stage #canvas{width:100%;height:100%;aspect-ratio:var(--corta-ratio)}
    @media(max-width:680px){.video-format-controls{gap:10px}.video-format-controls label{width:100%}}
  `;
  document.head.append(style);

  function exportSize(value) {
    const base = [720, 1080, 2160].includes(Number(value)) ? Number(value) : 1080;
    const [, x, y] = selected;
    // The shorter side matches the chosen resolution. All codec dimensions are even.
    const unit = base / Math.min(x, y);
    return { width: Math.round(x * unit / 2) * 2, height: Math.round(y * unit / 2) * 2 };
  }

  function labels() {
    const badge = document.querySelector('.viewer-title .badge');
    if (badge) badge.textContent = selected[0];
    const transportHint = document.querySelector('.transport .hint');
    if (transportHint) transportHint.textContent = 'Pré-visualização · ' + selected[0];
    for (const option of resolution.options) {
      const size = exportSize(option.value);
      option.textContent = size.width + ' × ' + size.height;
    }
    const size = exportSize(resolution.value);
    summary.textContent = 'Formato ' + selected[0] + ' · ' + size.width + ' × ' + size.height + ' px';
  }

  function applyRatio() {
    const [, x, y] = selected;
    // Keep the preview lightweight, including when the output is high resolution.
    const unit = 960 / Math.max(x, y);
    surface.width = Math.round(x * unit / 2) * 2;
    surface.height = Math.round(y * unit / 2) * 2;
    stage.style.setProperty('--corta-ratio', String(x / y));
    labels();
    draw();
  }

  select.addEventListener('change', () => {
    if (exporting || busy) { select.value = selected[0]; return; }
    pause();
    selected = options.find(item => item[0] === select.value) || options[0];
    applyRatio();
    status('Formato alterado para ' + selected[0] + '. A exportação utilizará estas proporções.');
  });
  resolution.addEventListener('change', labels);
  window.CortaFormats = Object.freeze({ exportSize, get ratio() { return selected[0]; } });
  applyRatio();
})();
