import {get, put} from '@vercel/blob';

// Private durable OAuth state. Explicitly bind production Blob credentials,
// rather than relying on SDK environment discovery.
function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('oauth_blob_token_missing');
  return token;
}

export async function readState(id) {
  const result = await get(`oauth/${id}.json`, {
    access: 'private', useCache: false, token: blobToken()
  });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream || !result.blob?.etag) {
    throw new Error('oauth_blob_read_invalid');
  }
  return {
    value: await new Response(result.stream).json(),
    etag: result.blob.etag
  };
}

export async function writeState(id, value, etag) {
  return put(`oauth/${id}.json`, JSON.stringify(value), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    token: blobToken(),
    ...(etag ? {ifMatch: etag} : {allowOverwrite: false})
  });
}
