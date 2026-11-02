export const referencePattern = /^ELAH-[A-Z]{2,5}[0-9]{3,5}$/;
export function validImageUrl(value, reference) {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname);
    const cf = url.protocol === 'https:' && url.hostname === 'imagedelivery.net' && !url.username && !url.password && !url.port && url.pathname.split('/')[2]===reference && url.pathname.split('/').length===4;\n    if(cf)return true;\n    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      !url.username && !url.password && !url.port &&
      path.startsWith('/bl7tzrfk/image/upload/') &&
      path.split('/').at(-1).replace(/\.(jpg|jpeg|png|webp)$/i, '') === reference;
  } catch { return false; }
}
export function validPublicId(value, reference) {
  return value === reference || value === 'elah_catalogo/' + reference;
}
