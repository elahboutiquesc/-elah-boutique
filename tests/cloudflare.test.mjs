import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {withStorage,get,put,list} from '../lib/storage.js';
process.env.ELAH_PUBLIC_ORIGIN='https://elah.example';
process.env.ELAH_ADMIN_TOKEN='synthetic-only';
delete process.env.BLOB_READ_WRITE_TOKEN;
const oauth=await import('../lib/oauth.js');
const {default:worker}=await import('../cloudflare/worker.js');
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../cloudflare/migrations/0001_records.sql',import.meta.url),'utf8'));
 return {sql,prepare(query){const stmt=sql.prepare(query);return {bind(...args){return {async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return {meta:stmt.run(...args)};}};}};}};
}
test('D1 JSON round trip, duplicate prevention, conditional writes and request isolation',async()=>{
 const a=database(),b=database();await withStorage(a,()=>put('oauth/test.json',JSON.stringify({expires:1234,n:'á'})));
 await assert.rejects(withStorage(a,()=>put('oauth/test.json','{}')));
 const old=await withStorage(a,()=>get('oauth/test.json'));assert.equal((await new Response(old.stream).json()).n,'á');
 const attempts=await withStorage(a,()=>Promise.allSettled([put('oauth/test.json','{"n":1}',{ifMatch:old.blob.etag}),put('oauth/test.json','{"n":2}',{ifMatch:old.blob.etag})]));
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(await withStorage(b,()=>get('oauth/test.json')),null);
});
test('D1 indexed listing paginates all 1001 image records without exposing OAuth values',async()=>{
 const db=database();await withStorage(db,async()=>{
  for(let i=0;i<1001;i++)await put('image-registry/'+String(i).padStart(4,'0')+'.json',JSON.stringify({i}));
  await put('oauth/private.json','{"secret":"synthetic"}');
  const first=await list({prefix:'image-registry/',limit:1000});assert.equal(first.blobs.length,1000);assert.equal(first.hasMore,true);
  const last=await list({prefix:'image-registry/',cursor:first.cursor,limit:1000});assert.equal(last.blobs.length,1);assert.equal(last.hasMore,false);
  assert.ok(first.blobs.every(x=>x.pathname.startsWith('image-registry/')));
 });
});
test('OAuth PKCE exchange is single use with real SQL conditional updates and no Blob',async()=>{
 await withStorage(database(),async()=>{
  const redirect='https://chatgpt.com/connector_platform_oauth_redirect',verifier='a'.repeat(43);
  const client=oauth.registerClient({redirect_uris:[redirect]});
  const pending=await oauth.startAuthorization({client_id:client.client_id,redirect_uri:redirect,response_type:'code',code_challenge_method:'S256',code_challenge:oauth.hash(verifier),resource:oauth.RESOURCE,scope:oauth.SCOPE,state:'test-state'});
  const record=await get('oauth/request-'+pending.id+'.json');const value=await new Response(record.stream).json();
  await put('oauth/request-'+pending.id+'.json',JSON.stringify({...value,status:'approved',subject:'test'}),{ifMatch:record.blob.etag});
  const callback=new URL(await oauth.finishAuthorization(pending.id,pending.session));
  const body={grant_type:'authorization_code',client_id:client.client_id,redirect_uri:redirect,code:callback.searchParams.get('code'),code_verifier:verifier,resource:oauth.RESOURCE};
  const attempts=await Promise.allSettled([oauth.exchangeToken(body),oauth.exchangeToken(body)]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  const tokens=attempts.find(x=>x.status==='fulfilled').value;
  assert.ok(await oauth.validateAccess(tokens.access_token));
  await oauth.revokeToken({client_id:client.client_id,token:tokens.refresh_token});assert.equal(await oauth.validateAccess(tokens.access_token),null);
 });
});
test('Worker metadata uses configured origin, D1 admin login sets secure cookie, private paths stay protected',async()=>{
 const env={DB:database(),ASSETS:{fetch:async()=>new Response('static')}};
 let r=await worker.fetch(new Request('https://elah.example/.well-known/oauth-authorization-server'),env);
 assert.equal(r.status,200);assert.equal((await r.json()).issuer,'https://elah.example');
 r=await worker.fetch(new Request('https://elah.example/admin/login'),env);assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/Secure; HttpOnly/);
 r=await worker.fetch(new Request('https://elah.example/api/upload-product-image',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env);assert.equal(r.status,401);
 r=await worker.fetch(new Request('https://elah.example/api/mcp',{method:'POST'}),env);assert.equal(r.status,401);assert.match(r.headers.get('WWW-Authenticate'),/elah.example/);
 r=await worker.fetch(new Request('https://attacker.test/admin/login'),env);assert.equal(r.status,503);
 r=await worker.fetch(new Request('https://elah.example/api/missing'),env);assert.equal(r.status,404);
});
test('bulk photo endpoint returns public records in one call, without private OAuth records',async()=>{
 const env={DB:database()};const ref='ELAH-AC034',url='https://res.cloudinary.com/bl7tzrfk/image/upload/'+ref;
 await withStorage(env.DB,async()=>{await put('image-registry/'+ref+'.json',JSON.stringify({reference:ref,url,public_id:ref}));await put('oauth/private.json','{"private":true}');});
 const r=await worker.fetch(new Request('https://elah.example/api/image-registry?ref=ALL&records=1'),env);assert.equal(r.status,200);
 const payload=await r.json();assert.equal(payload.records.length,1);assert.equal(payload.records[0].url,url);assert.ok(!JSON.stringify(payload).includes('private'));
});
