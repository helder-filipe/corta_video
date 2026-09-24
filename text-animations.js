const animationLabels = { none: 'Sem animação', fade: 'Suave', rise: 'Subir', slide: 'Deslizar', zoom: 'Zoom', bounce: 'Salto', typewriter: 'Escrever', pulse: 'Pulsar', float: 'Flutuar', rotate: 'Rodar' };
let animationPreviewFrame = 0;
function drawAnimationSample(at) {
  const surface = $('textAnimationCanvas'), context = surface.getContext('2d');
  context.fillStyle = '#101217'; context.fillRect(0, 0, surface.width, surface.height);
  const settings = { ...textSettings(), text: $('text').value.trim() || 'A tua história', start: 0, end: 3, size: 105, position: 'center' };
  paintText(context, surface, at, settings);
}
function syncAnimationChoices() {
  document.querySelectorAll('#textAnimationGallery button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.motion === $('textMotion').value)));
}
function previewTextAnimation() {
  cancelAnimationFrame(animationPreviewFrame);
  const beginning = performance.now();
  function frame(now) {
    const elapsed = (now - beginning) / 1000;
    drawAnimationSample(Math.min(elapsed, 2.99));
    if (elapsed < 3 && !document.hidden) animationPreviewFrame = requestAnimationFrame(frame);
    else drawAnimationSample(1.4);
  }
  animationPreviewFrame = requestAnimationFrame(frame);
}
Object.entries(animationLabels).forEach(([motion, label]) => {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.motion = motion;
  const sample = document.createElement('span'); sample.className = 'animation-symbol'; sample.textContent = 'Aa';
  const name = document.createElement('span'); name.textContent = label; button.append(sample, name);
  button.setAttribute('aria-label', `Animação: ${label}`);
  button.onclick = () => { $('textMotion').value = motion; updateTextTrack(); syncAnimationChoices(); previewTextAnimation(); status(`Animação de texto: ${label}.`); };
  $('textAnimationGallery').append(button);
});
['textMotion', 'textEffect', 'color', 'text', 'textAnimationDuration'].forEach(id => $(id).addEventListener('input', () => {
  updateTextTrack(); syncAnimationChoices(); cancelAnimationFrame(animationPreviewFrame); drawAnimationSample(.8);
}));
$('previewTextAnimation').onclick = previewTextAnimation;
syncAnimationChoices(); drawAnimationSample(1.4);
