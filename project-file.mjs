// Portable project: 12-byte header, UTF-8 manifest, then original media bytes.
const magic = 'CORTA001';
const encoder = new TextEncoder();
export function packProject(state, files) {
  const assets = files.map(file => ({name:file.name, type:file.type, size:file.size, lastModified:file.lastModified}));
  const manifest = encoder.encode(JSON.stringify({version:1, state, assets}));
  if (manifest.length > 16 * 1024 * 1024) throw new Error('O projeto contém demasiados dados de edição.');
  const header = new Uint8Array(12);
  header.set(encoder.encode(magic));
  new DataView(header.buffer).setUint32(8, manifest.length, true);
  return new Blob([header, manifest, ...files], {type:'application/octet-stream'});
}
export async function unpackProject(blob) {
  const invalid = () => { throw new Error('Ficheiro de projeto inválido, incompleto ou de uma versão não suportada.'); };
  if (blob.size < 12) invalid();
  const header = await blob.slice(0,12).arrayBuffer();
  if (new TextDecoder().decode(header.slice(0,8)) !== magic) invalid();
  const length = new DataView(header).getUint32(8,true);
  if (length > 16 * 1024 * 1024 || 12 + length > blob.size) invalid();
  let data;
  try { data = JSON.parse(await blob.slice(12,12+length).text()); } catch { invalid(); }
  if (data?.version !== 1 || !Array.isArray(data.assets) || !data.state || !Array.isArray(data.state.clips)) invalid();
  let offset = 12 + length;
  const files = data.assets.map(asset => {
    if (!asset || typeof asset.name !== 'string' || typeof asset.type !== 'string' || !Number.isSafeInteger(asset.size) || asset.size < 0 || asset.size > blob.size-offset) invalid();
    const file = new File([blob.slice(offset,offset+asset.size)], asset.name, {type:asset.type, lastModified:asset.lastModified});
    offset += asset.size;
    return file;
  });
  if (offset !== blob.size) invalid();
  const validRef = ref => Number.isInteger(ref) && ref >= 0 && ref < files.length;
  for (const clip of [...data.state.clips, ...(data.state.music ? [data.state.music] : [])]) {
    if (!clip || !validRef(clip.asset) || !Number.isFinite(clip.start) || !Number.isFinite(clip.end) || clip.start < 0 || clip.end <= clip.start || !Number.isFinite(clip.volume) || clip.volume < 0 || clip.volume > 1) invalid();
  }
  if (!data.state.values || typeof data.state.values !== 'object' || Array.isArray(data.state.values)) invalid();
  for (const value of Object.values(data.state.values)) if (!['string','number','boolean'].includes(typeof value)) invalid();
  if (!Array.isArray(data.state.fonts) || data.state.fonts.some(font => !font || typeof font.alias !== 'string' || !validRef(font.asset))) invalid();
  return {state:data.state, files};
}
