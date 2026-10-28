import {test,mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.ELAH_ADMIN_TOKEN='synthetic-server-only-key';process.env.BLOB_READ_WRITE_TOKEN='synthetic-blob';
const records=new Map();let version=0,offline=false;
await mock.module('@vercel/blob',{namedExports:{
 list:async()=>({blobs:[]}),
 get:async(path)=>{if(offline)throw Error('offline');const row=records.get(path);return row?{statusCode:200,stream:new Response(row.body).body,blob:{etag:row.etag}}:null;},
 put:async(path,body,opts)=>{if(offline)throw Error('offline');const row=records.get(path);if(opts.ifMatch?row?.etag!==opts.ifMatch:row)throw Error('conflict');records.set(path,{body,etag:String(++version)});}
}});
const admin=await import('../lib/admin-session.js');
const oauth=await import('../lib/oauth.js');
const {default:endpoint}=await import('../api/admin.js');
const {default:upload}=await import('../api/upload-product-image.js');
const {default:registry}=await import('../api/image-registry.js');
const {default:mcp}=await import('../api/mcp.js');
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(d){this.data=d;return this},end(d){this.html=d;return this}};}
async function session(){const pending=await admin.startAdminLogin();const key='oauth/request-'+pending.id+'.json',row=records.get(key);records.set(key,{...row,body:JSON.stringify({...JSON.parse(row.body),status:'approved',subject:'github:123'})});return {pending,token:await admin.completeAdminLogin(pending.id,pending.session)};}
const cookie=token=>'__Host-elah_admin='+token;
async function browser(token){return admin.adminSession({headers:{cookie:cookie(token)}});}
beforeEach(()=>{records.clear();offline=false;});
test('browser login requires approval and binds the same pending session; completion cannot replay',async()=>{
 const pending=await admin.startAdminLogin();await assert.rejects(admin.completeAdminLogin(pending.id,pending.session));await assert.rejects(admin.completeAdminLogin(pending.id,'wrong'));
 const s=await session();assert.ok(await browser(s.token));await assert.rejects(admin.completeAdminLogin(s.pending.id,s.pending.session));
 assert.ok(!JSON.stringify([...records.values()]).includes(s.token.split('.')[2]));
});
test('browser and OAuth transactions cannot be interchanged',async()=>{
 const s=await session();await assert.rejects(oauth.finishAuthorization(s.pending.id,s.pending.session));
 const pending=await admin.startAdminLogin(),key='oauth/request-'+pending.id+'.json',row=records.get(key);records.set(key,{...row,body:JSON.stringify({...JSON.parse(row.body),kind:'oauth',status:'approved'})});await assert.rejects(admin.completeAdminLogin(pending.id,pending.session));
});
test('cookie flags, tampering, duplicates, expiry and revocation fail securely',async()=>{
 const {token}=await session();assert.match(admin.adminCookie(token),/Secure; HttpOnly; SameSite=Strict/);assert.match(admin.adminCookie(''),/Max-Age=0/);
 assert.equal(await browser(token+'tampered'),null);assert.equal(await admin.adminSession({headers:{cookie:cookie(token)+'; '+cookie(token)}}),null);
 const s=await browser(token),key='oauth/admin-'+s.id+'.json',row=records.get(key);records.set(key,{...row,body:JSON.stringify({...s.value,expires:1})});assert.equal(await browser(token),null);
 records.set(key,{...row,body:JSON.stringify({...s.value,revoked:true})});assert.equal(await browser(token),null);
});
test('browser writes require the exact origin and a matching CSRF token',async()=>{
 const {token}=await session(),s=await browser(token);
 assert.equal(await admin.authorizeAdmin({headers:{cookie:cookie(token),origin:oauth.ISSUER,'x-csrf-token':s.value.csrf}}),true);
 for(const headers of [{},{origin:oauth.ISSUER},{origin:'https://evil.test','x-csrf-token':s.value.csrf},{origin:oauth.ISSUER,'x-csrf-token':'wrong'}])await assert.rejects(admin.authorizeAdmin({headers:{cookie:cookie(token),...headers}}));
 assert.equal(await admin.authorizeAdmin({headers:{cookie:cookie(token),authorization:'Bearer wrong',origin:oauth.ISSUER,'x-csrf-token':s.value.csrf}}),false);
 assert.equal(await admin.authorizeAdmin({headers:{authorization:'Bearer '+process.env.ELAH_ADMIN_TOKEN}}),true);
});
test('upload and registry enforce browser authentication before reading image data',async()=>{
 const {token}=await session(),s=await browser(token);
 for(const handler of [upload,registry]){
  for(const [headers,expected] of [[{},401],[{cookie:cookie(token)},403],[{cookie:cookie(token),origin:oauth.ISSUER,'x-csrf-token':s.value.csrf},400]]){
   const r=response();await handler({method:'POST',headers,body:{}},r);assert.equal(r.code,expected);
  }
 }
});
test('logout requires CSRF, revokes the stored session and invalidates future use',async()=>{
 const {token}=await session(),s=await browser(token);await assert.rejects(admin.closeAdminSession({headers:{cookie:cookie(token)}}));assert.ok(await browser(token));
 await admin.closeAdminSession({headers:{cookie:cookie(token),origin:oauth.ISSUER,'x-csrf-token':s.value.csrf}});assert.equal(await browser(token),null);
});
test('storage outage cannot authorize upload or logout',async()=>{
 const {token}=await session();offline=true;const r=response();await upload({method:'POST',headers:{cookie:cookie(token),origin:oauth.ISSUER},body:{}},r);assert.equal(r.code,503);
});
test('MCP never accepts the browser cookie in place of OAuth',async()=>{
 const {token}=await session(),r=response();await mcp({method:'POST',headers:{cookie:cookie(token)},body:{jsonrpc:'2.0',id:1,method:'tools/list'}},r);assert.equal(r.code,401);assert.match(r.headers['WWW-Authenticate'],/resource_metadata/);
});
test('login and session responses never expose server credentials or browser authentication tokens to JS',async()=>{
 let r=response();await endpoint({method:'GET',headers:{},query:{action:'login'}},r);assert.equal(r.code,200);assert.equal(r.headers['Referrer-Policy'],'same-origin');assert.match(r.headers['Set-Cookie'],/Secure; HttpOnly/);assert.ok(!r.html.includes(process.env.ELAH_ADMIN_TOKEN));
 const {token}=await session();r=response();await endpoint({method:'GET',headers:{cookie:cookie(token)},query:{action:'session'}},r);assert.equal(r.data.authenticated,true);assert.ok(r.data.csrf);assert.ok(!JSON.stringify(r.data).includes(token));assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['Access-Control-Allow-Origin'],undefined);
 r=response();await endpoint({method:'POST',headers:{origin:'https://evil.test'},query:{action:'complete'},body:{}},r);assert.equal(r.code,403);
});
test('photo manager does not ask for keys or persist authentication credentials',()=>{
 const html=fs.readFileSync(new URL('../cargar-fotos.html',import.meta.url),'utf8'),script=fs.readFileSync(new URL('../admin-photos.js',import.meta.url),'utf8');
 assert.ok(!html.includes('type="password"'));assert.ok(!html.includes('id="token"'));assert.ok(html.includes('/admin/login'));assert.ok(!script.includes('localStorage'));assert.ok(!script.includes('sessionStorage'));assert.ok(!script.includes('Authorization'));assert.ok(script.includes('X-CSRF-Token'));
});
