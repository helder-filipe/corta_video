import { Input, BlobSource, ALL_FORMATS, CanvasSink, AudioBufferSink, Output,
  Mp4OutputFormat, WebMOutputFormat, BufferTarget, StreamTarget, CanvasSource,
  AudioBufferSource, canEncodeVideo, canEncodeAudio } from './vendor/mediabunny-1.56.2.mjs';

export function frameRange(start, end, fps) {
  return [Math.ceil(start * fps - 1e-8), Math.ceil(end * fps - 1e-8)];
}

// Every output frame uses the project clock, never elapsed wall time.
export async function exportFilm({ clips, music, musicVolume, width, height, fps, format,
  includeAudio, writable, signal, paintText, onProgress }) {
  const check = () => { if (signal.aborted) throw new DOMException('Exportação cancelada.', 'AbortError'); };
  const inputs = new Map();
  let output;
  const total = clips.reduce((n, c) => n + c.end - c.start, 0);
  const codec = format === 'mp4' ? 'avc' : 'vp8';
  const audioCodec = format === 'mp4' ? 'aac' : 'opus';
  const bitrate = (height >= 2160 ? 35000000 : height >= 1080 ? 12000000 : 6000000) * (fps / 30);
  try {
    if (!await canEncodeVideo(codec, { width, height, bitrate })) {
      throw new Error(`O navegador não suporta ${format.toUpperCase()} nesta resolução. Experimenta uma resolução inferior${format === 'mp4' ? ' ou WebM' : ''}.`);
    }
    async function inspect(file) {
      if (inputs.has(file)) return inputs.get(file);
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const entry = { input }; inputs.set(file, entry);
      entry.video = await input.getPrimaryVideoTrack();
      entry.audio = includeAudio ? await input.getPrimaryAudioTrack() : null;
      if (entry.audio && !await entry.audio.canDecode()) throw new Error(`Não foi possível descodificar o áudio de «${file.name}». Converte o ficheiro ou desmarca «Incluir áudio».`);
      entry.audioSink = entry.audio ? new AudioBufferSink(entry.audio) : null;
      return entry;
    }
    onProgress(0, 'A preparar vídeos e áudio…');
    for (const c of clips) {
      check(); const e = await inspect(c.file);
      if (!e.video || !await e.video.canDecode()) throw new Error(`Não foi possível descodificar «${c.name}». Converte o original para MP4 H.264.`);
    }
    if (music && includeAudio) await inspect(music.file);
    const hasAudio = includeAudio && (clips.some(c => inputs.get(c.file).audio && c.volume > 0) || (music && musicVolume > 0 && inputs.get(music.file).audio));
    if (hasAudio && !await canEncodeAudio(audioCodec, { numberOfChannels: 2, sampleRate: 48000, bitrate: 192000 })) {
      throw new Error(`O navegador não suporta áudio ${audioCodec.toUpperCase()}. Escolhe ${format === 'mp4' ? 'WebM' : 'MP4'} ou desmarca «Incluir áudio».`);
    }
    check();
    const target = writable ? new StreamTarget(new WritableStream({
      write: chunk => writable.write(chunk)
    }), { chunked: true, chunkSize: 1024 * 1024 }) : new BufferTarget();
    // Seekable disk writes avoid keeping the whole movie in memory.
    output = new Output({ target, format: format === 'mp4'
      ? new Mp4OutputFormat({ fastStart: writable ? false : 'in-memory' }) : new WebMOutputFormat() });
    const surface = document.createElement('canvas'); surface.width = width; surface.height = height;
    const ctx = surface.getContext('2d', { alpha: false });
    const videoSource = new CanvasSource(surface, { codec, bitrate, keyFrameInterval: 2, latencyMode: 'quality' });
    output.addVideoTrack(videoSource, { frameRate: fps });
    const audioSource = hasAudio ? new AudioBufferSource({ codec: audioCodec, bitrate: 192000 }) : null;
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();

    // Mix only one second at a time, preserving trims, clip gains and music loops.
    async function mixBlock(start, end) {
      const offline = new OfflineAudioContext(2, Math.round(end * 48000) - Math.round(start * 48000), 48000);
      async function schedule(entry, sourceStart, sourceEnd, at, volume) {
        if (!entry.audioSink || volume === 0) return;
        const gain = offline.createGain(); gain.gain.value = volume; gain.connect(offline.destination);
        for await (const item of entry.audioSink.buffers(sourceStart, sourceEnd)) {
          check();
          const a = Math.max(sourceStart, item.timestamp), b = Math.min(sourceEnd, item.timestamp + item.duration);
          if (b <= a) continue;
          const source = offline.createBufferSource(); source.buffer = item.buffer; source.connect(gain);
          source.start(Math.max(0, at + a - sourceStart - start), Math.max(0, a - item.timestamp), b - a);
        }
      }
      let offset = 0;
      for (const c of clips) {
        const a = Math.max(start, offset), b = Math.min(end, offset + c.end - c.start);
        if (b > a) await schedule(inputs.get(c.file), c.start + a - offset, c.start + b - offset, a, c.volume);
        offset += c.end - c.start;
      }
      if (music && musicVolume > 0) {
        let at = start;
        while (at < end - 1e-8) {
          const loop = Math.floor((at + 1e-8) / music.end);
          const local = Math.max(0, at - loop * music.end);
          const span = Math.min(end - at, (loop + 1) * music.end - at);
          await schedule(inputs.get(music.file), local, local + span, at, musicVolume);
          at += span;
        }
      }
      check();
      const buffer = await offline.startRendering();
      await audioSource.add(buffer);
    }

    let offset = 0, audioUntil = 0, lastUpdate = 0;
    for (const c of clips) {
      const end = offset + c.end - c.start;
      const [first, stop] = frameRange(offset, end, fps);
      const sink = new CanvasSink(inputs.get(c.file).video, { width, height, fit: 'contain', poolSize: 2 });
      function* timestamps() { for (let i = first; i < stop; i++) yield c.start + i / fps - offset; }
      let index = first;
      for await (const frame of sink.canvasesAtTimestamps(timestamps())) {
        check();
        if (!frame) throw new Error(`Falta um fotograma em «${c.name}». Ajusta o início do corte.`);
        const t = index / fps;
        ctx.fillStyle = '#090a0b'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(frame.canvas, 0, 0, width, height);
        paintText(ctx, surface, t);
        await videoSource.add(t, Math.min(1 / fps, total - t));
        index++;
        if (audioSource && (index / fps >= audioUntil + 1 || index / fps >= total)) {
          const until = Math.min(total, audioUntil + 1);
          await mixBlock(audioUntil, until); audioUntil = until;
        }
        if (performance.now() - lastUpdate > 150) {
          onProgress(Math.min(98, index / (total * fps) * 98), `A exportar ${format.toUpperCase()} · ${fps} fps`);
          lastUpdate = performance.now();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      offset = end;
    }
    while (audioSource && audioUntil < total - 1e-8) {
      const until = Math.min(total, audioUntil + 1);
      await mixBlock(audioUntil, until); audioUntil = until;
    }
    check(); onProgress(99, 'A finalizar o ficheiro…');
    await output.finalize();
    check();
    return writable ? null : new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
  } catch (error) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw error;
  } finally {
    for (const entry of inputs.values()) entry.input.dispose();
  }
}
