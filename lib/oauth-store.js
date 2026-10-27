import {get, put} from '@vercel/blob';

// Private durable state, outside image-registry/. Never use cached OAuth state.
export async function readState(id) {
  const result = await get(`oauth/${id}.json`, {access:'private', useCache:false});
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream || !result.blob?.etag) throw Error('oauth_storage_unavailable');
  return {value:await new Response(result.stream).json(), etag:result.blob.etag};
}
export async function writeState(id, value, etag) {
  await put(`oauth/${id}.json`, JSON.stringify(value), {
    access:'private', addRandomSuffix:false, contentType:'application/json',
    ...(etag ? {ifMatch:etag} : {allowOverwrite:false})
  });
}
