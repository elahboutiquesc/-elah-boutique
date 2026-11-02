import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readAttachedImage} from '../lib/attached-image.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const file={file_id:'file-test',download_url:'https://files.oaiusercontent.com/test?sig=private-test',mime_type:'image/png'};
async function withFetch(fn,run){const m=mock.method(globalThis,'fetch',fn);try{await run(m);}finally{m.mock.restore();}}
test('downloads a ChatGPT attachment and derives MIME when optional metadata is missing',async()=>{
 await withFetch(async(url,opts)=>{assert.equal(url.hostname,'files.oaiusercontent.com');assert.equal(opts.redirect,'error');return new Response(png);},async()=>{
  const result=await readAttachedImage({download_url:file.download_url,file_id:file.file_id});assert.equal(result.mimeType,'image/png');assert.equal(result.base64,png.toString('base64'));
 });
});
test('rejects private, unrelated and non-HTTPS URLs without sending requests',async()=>{
 await withFetch(async()=>{throw Error('must not fetch')},async(m)=>{
  for(const download_url of ['http://files.oaiusercontent.com/test','https://127.0.0.1/test','https://example.com/test','https://files.oaiusercontent.com.evil.test/test','https://user:pass@files.oaiusercontent.com/test'])await assert.rejects(readAttachedImage({...file,download_url}));
  assert.equal(m.mock.callCount(),0);
 });
});
test('expired URL produces a useful error without leaking its signature',async()=>{
 await withFetch(async()=>new Response('',{status:403}),async()=>{await assert.rejects(readAttachedImage(file),e=>e.message.includes('vuelve a adjuntar')&&!e.message.includes('private-test'));});
});
test('rejects advertised and streamed oversized attachments',async()=>{
 for(const response of [new Response(png,{headers:{'content-length':'3500001'}}),new Response(new Uint8Array(3_500_001))])await withFetch(async()=>response,async()=>assert.rejects(readAttachedImage(file),/supera 3,5 MB/));
});
test('rejects disguised non-images and mismatched MIME',async()=>{
 for(const response of [new Response('<html>not an image</html>'),new Response(png)])await withFetch(async()=>response,async()=>assert.rejects(readAttachedImage({...file,mime_type:'image/jpeg'}),/no corresponde/));
});
test('redirection or network failures do not expose temporary URLs',async()=>{
 await withFetch(async()=>{throw Error(file.download_url)},async()=>assert.rejects(readAttachedImage(file),e=>e.message.includes('descargar')&&!e.message.includes('private-test')));
});

test('accepts ChatGPT signed URL string without allowing arbitrary hosts',async()=>{
 await withFetch(async()=>new Response(png),async()=>{
  const image=await readAttachedImage(file.download_url);
  assert.equal(image.mimeType,'image/png');
 });
 await withFetch(async()=>{throw Error('must not fetch')},async(m)=>{
  await assert.rejects(readAttachedImage('https://example.org/secret'));
  assert.equal(m.mock.callCount(),0);
 });
});

test('rejects local paths and bare ChatGPT file IDs with no network activity',async()=>{
 await withFetch(async()=>{throw Error('must not fetch')},async(m)=>{
  for(const input of ['/mnt/data/ELAH-JN054.webp','file_000000007e5c81f5b588b35aaa75d37a','sandbox:/mnt/data/ELAH-JN054.webp']){
   await assert.rejects(readAttachedImage(input),/ruta local o identificador/);
  }
  assert.equal(m.mock.callCount(),0);
 });
});

test('rejects HTTPS URL fragments, root-only URLs, malformed and backslash hosts',async()=>{
 await withFetch(async()=>{throw Error('must not fetch')},async(m)=>{
  for(const input of [
   'https://files.oaiusercontent.com/',
   'https://files.oaiusercontent.com/test#fragment',
   'https://files.oaiusercontent.com\\@evil.test/test',
   'https://files.oaiusercontent.com/test\\evil',
   'https://files.oaiusercontent.com/test\n'
  ]) await assert.rejects(readAttachedImage(input));
  assert.equal(m.mock.callCount(),0);
 });
});
