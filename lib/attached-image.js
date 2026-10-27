const MAX_IMAGE_BYTES = 3_500_000;
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ChatGPT supplies temporary signed download URLs. Never log or persist them.
function attachmentUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enlace temporal del adjunto inválido'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') ||
      !(url.hostname === 'oaiusercontent.com' || url.hostname.endsWith('.oaiusercontent.com'))) {
    throw new Error('El adjunto debe proceder del almacenamiento de archivos de ChatGPT');
  }
  return url;
}

export function validAttachment(file) {
  return file && typeof file === 'object' && !Array.isArray(file) &&
    typeof file.file_id === 'string' && file.file_id.length > 0 &&
    typeof file.download_url === 'string' &&
    (file.mime_type === undefined || supportedTypes.has(file.mime_type)) &&
    (file.file_name === undefined || typeof file.file_name === 'string');
}

export async function readAttachedImage(file) {
  if (!validAttachment(file)) throw new Error('Adjunta una fotografía JPG, PNG o WebP');
  const url = attachmentUrl(file.download_url);
  let response;
  try {
    response = await fetch(url, {redirect: 'error', signal: AbortSignal.timeout(15_000)});
  } catch {
    throw new Error('No se pudo descargar el adjunto; vuelve a adjuntar la fotografía');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('El enlace del adjunto caducó o no está disponible; vuelve a adjuntar la fotografía');
  }
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error('El adjunto supera 3,5 MB');
  }
  if (!response.body) throw new Error('El adjunto está vacío');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('El adjunto supera 3,5 MB');
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (size > MAX_IMAGE_BYTES) throw error;
    throw new Error('La descarga del adjunto se interrumpió; vuelve a adjuntar la fotografía');
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' :
    bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' :
    bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!mimeType || (file.mime_type && file.mime_type !== mimeType)) {
    throw new Error('El contenido del adjunto no corresponde a una fotografía JPG, PNG o WebP válida');
  }
  return {base64: bytes.toString('base64'), mimeType};
}
