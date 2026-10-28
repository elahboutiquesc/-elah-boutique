import {test,mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
process.env.ELAH_ADMIN_TOKEN='synthetic-master-never-in-browser';
process.env.BLOB_READ_WRITE_TOKEN='synthetic-storage';
const records=new Map();let version=0,storageDown=false;
await mock.module('@vercel/blob',{namedExports:{
 list:async()=>({blobs:[]}),
 get:async(path,options)=>{
  assert.equal(options.useCache,false);if(storageDown)throw Error('offline');const record=records.get(path);if(!record)return null;
  return {statusCode:200,stream:new Response(record.body).body,blob:{etag:record.etag}};
 },
 put:async(path,body,options)=>{
  if(storageDown)throw Error('offline');const previous=records.get(path);
  if(options.ifMatch?previous?.etag!==options.ifMatch:previous)throw Error('precondition_failed');
  records.set(path,{body,etag:String(++version)});
 }
}});
const oauth=await import('../lib/oauth.js');
const {default:endpoint}=await import('../api/oauth.js');
const {default:mcp}=await import('../api/mcp.js');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',use:'sig',alg:'RS256'};
function oidc(overrides={},key=privateKey){const timestamp=Math.floor(Date.now()/1000);const claims={iss:'https://token.actions.githubusercontent.com',aud:oauth.APPROVAL_AUDIENCE,iat:timestamp,nbf:timestamp,exp:timestamp+300,repository_id:'1373614442',repository:'elahboutiquesc/-elah-boutique',ref:'refs/heads/main',event_name:'workflow_dispatch',workflow_ref:'elahboutiquesc/-elah-boutique/.github/workflows/autorizar-mcp.yml@refs/heads/main',actor_id:'123',...overrides};const parts=[{alg:'RS256',kid:'test-key'},claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url'));return parts.join('.')+'.'+sign('RSA-SHA256',Buffer.from(parts.join('.')),key).toString('base64url');}
const verifier='v'.repeat(43),redirect='https://chatgpt.com/connector_platform_oauth_redirect';
let client;
beforeEach(()=>{records.clear();storageDown=false;client=oauth.registerClient({redirect_uris:[redirect],client_name:'ChatGPT'});});
function query(extra={}){return {client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:oauth.SCOPE,resource:oauth.RESOURCE,code_challenge_method:'S256',code_challenge:oauth.hash(verifier),state:'test-state',...extra};}
async function approve(request){const f=mock.method(globalThis,'fetch',async(url)=>{assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');return new Response(JSON.stringify({keys:[jwk]}));});try{await oauth.approveAuthorization(request.id,oidc());}finally{f.mock.restore();}}
async function code(){const request=await oauth.startAuthorization(query());await approve(request);const callback=new URL(await oauth.finishAuthorization(request.id,request.session));assert.equal(callback.searchParams.get('state'),'test-state');assert.equal(callback.searchParams.get('iss'),oauth.ISSUER);return {request,code:callback.searchParams.get('code')};}
function exchange(c,extra={}){return oauth.exchangeToken({grant_type:'authorization_code',client_id:client.client_id,redirect_uri:redirect,resource:oauth.RESOURCE,code_verifier:verifier,code:c,...extra});}
function refresh(token){return oauth.exchangeToken({grant_type:'refresh_token',client_id:client.client_id,resource:oauth.RESOURCE,refresh_token:token});}
function response(){return {on(){},code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(d){this.data=d;return this},end(d){this.html=d;return this}};}
test('metadata advertises PKCE S256, issuer, registration, token, revocation and protected resource',()=>{const a=oauth.authorizationMetadata(),r=oauth.resourceMetadata();assert.deepEqual(a.code_challenge_methods_supported,['S256']);assert.equal(a.issuer,oauth.ISSUER);assert.equal(a.authorization_response_iss_parameter_supported,true);assert.deepEqual(a.token_endpoint_auth_methods_supported,['none','private_key_jwt']);assert.equal(r.resource,oauth.RESOURCE);assert.deepEqual(r.authorization_servers,[a.issuer]);});
test('DCR rejects arbitrary redirects, secrets and forged client IDs',async()=>{
 for(const url of ['https://evil.test/callback','http://chatgpt.com/connector_platform_oauth_redirect',redirect+'?x=1',redirect+'#frag'])assert.throws(()=>oauth.registerClient({redirect_uris:[url]}));
 assert.throws(()=>oauth.registerClient({redirect_uris:[redirect],token_endpoint_auth_method:'client_secret_post'}));
 await assert.rejects(oauth.resolveClient(client.client_id+'tampered'));
 assert.equal((await oauth.resolveClient(client.client_id)).client_name,'ChatGPT');
});
test('CIMD only fetches allowlisted ChatGPT metadata and validates its identity',async()=>{
 const id='https://chatgpt.com/oauth/client.json';const f=mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({client_id:id,redirect_uris:[redirect],token_endpoint_auth_method:'none'})));
 try{assert.equal((await oauth.resolveClient(id)).redirect_uris[0],redirect);await assert.rejects(oauth.resolveClient('https://127.0.0.1/oauth/client.json'));assert.equal(f.mock.callCount(),1);}finally{f.mock.restore();}
});
test('authorization requires resource, scope, state, exact registered redirect and S256',async()=>{
 for(const bad of [{resource:'https://elsewhere.test'},{scope:'admin'},{state:''},{redirect_uri:'https://chatgpt.com/connector/oauth/other'},{code_challenge_method:'plain'},{code_challenge:'short'}])await assert.rejects(oauth.startAuthorization(query(bad)));
 assert.equal(records.size,0);
});
test('browser cannot self-approve and cannot use another session',async()=>{
 const r=await oauth.startAuthorization(query());await assert.rejects(oauth.finishAuthorization(r.id,r.session));await assert.rejects(oauth.browserRequest(r.id,'wrong-cookie'));await assert.rejects(oauth.approveAuthorization(r.id,'forged'));
});
test('GitHub approval rejects wrong audience, fork, branch, workflow, event and expiry',async()=>{
 const r=await oauth.startAuthorization(query());const f=mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({keys:[jwk]})));
 try{
  for(const bad of [{aud:'other'},{repository_id:'different'},{repository:'attacker/repo'},{ref:'refs/heads/dev'},{workflow_ref:'elsewhere'},{event_name:'pull_request'},{exp:1},{iat:1},{actor_id:'not-numeric'}])await assert.rejects(oauth.approveAuthorization(r.id,oidc(bad)));
  const other=generateKeyPairSync('rsa',{modulusLength:2048});await assert.rejects(oauth.approveAuthorization(r.id,oidc({},other.privateKey)));
  assert.equal(JSON.parse(records.get('oauth/request-'+r.id+'.json').body).status,'pending');
 }finally{f.mock.restore();}
});
test('authorization code binds PKCE, client, redirect and resource; code cannot be replayed',async()=>{
 const {code:c}=await code();for(const bad of [{code_verifier:'x'.repeat(43)},{redirect_uri:'https://chatgpt.com/connector/oauth/wrong'},{resource:'https://evil.test'},{client_id:oauth.registerClient({redirect_uris:[redirect]}).client_id}])await assert.rejects(exchange(c,bad));
 const tokens=await exchange(c);assert.equal((await oauth.validateAccess(tokens.access_token)).scope,oauth.SCOPE);await assert.rejects(exchange(c));
 const serialized=JSON.stringify([...records.values()]);assert.ok(!serialized.includes(tokens.access_token));assert.ok(!serialized.includes(tokens.refresh_token));assert.ok(!serialized.includes(c));
});
test('concurrent exchanges consume a code once across server instances',async()=>{const {code:c}=await code();const results=await Promise.allSettled([exchange(c),exchange(c)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal([...records.keys()].filter(x=>x.startsWith('oauth/grant-')).length,1);});
test('refresh tokens rotate and replay revokes the entire grant',async()=>{const {code:c}=await code();const first=await exchange(c),second=await refresh(first.refresh_token);assert.equal(await oauth.validateAccess(first.access_token),null);assert.ok(await oauth.validateAccess(second.access_token));await assert.rejects(refresh(first.refresh_token));assert.equal(await oauth.validateAccess(second.access_token),null);await assert.rejects(refresh(second.refresh_token));});
test('revocation invalidates access and refresh tokens',async()=>{const {code:c}=await code();const t=await exchange(c);await oauth.revokeToken({client_id:client.client_id,token:t.refresh_token});assert.equal(await oauth.validateAccess(t.access_token),null);await assert.rejects(refresh(t.refresh_token));});
test('expired tokens and wrong audience or scope fail closed',async()=>{
 const {code:c}=await code();const t=await exchange(c);const key=[...records.keys()].find(x=>x.startsWith('oauth/grant-'));const original=records.get(key);
 for(const patch of [{access_expires:1},{resource:'https://other.test'},{scope:'other'},{revoked:true}]){records.set(key,{...original,body:JSON.stringify({...JSON.parse(original.body),...patch})});assert.equal(await oauth.validateAccess(t.access_token),null);}records.set(key,original);
 assert.equal(await oauth.validateAccess(t.access_token+'tampered'),null);
});
test('expired authorization transactions and codes are rejected',async()=>{
 const {request,code:c}=await code();const key='oauth/request-'+request.id+'.json';const row=records.get(key);records.set(key,{...row,body:JSON.stringify({...JSON.parse(row.body),code_expires:1})});await assert.rejects(exchange(c));
 records.set(key,{...row,body:JSON.stringify({...JSON.parse(row.body),expires:1})});await assert.rejects(oauth.browserRequest(request.id,request.session));
});
test('unauthenticated MCP emits the OAuth challenge; OAuth client discovers the file-enabled tool',async()=>{
 let r=response();await mcp({method:'POST',headers:{},body:{jsonrpc:'2.0',id:1,method:'tools/list'}},r);assert.equal(r.code,401);assert.ok(r.headers['WWW-Authenticate'].includes('resource_metadata='));
 const {code:c}=await code();const t=await exchange(c);r=response();await mcp({method:'POST',headers:{authorization:'Bearer '+t.access_token},body:{jsonrpc:'2.0',id:1,method:'tools/list'}},r);assert.equal(r.code,200);const tool=r.data.result.tools.find(x=>x.name==='publicar_fotografia_en_elah');assert.deepEqual(tool.securitySchemes,[{type:'oauth2',scopes:[oauth.SCOPE]}]);assert.deepEqual(tool._meta['openai/fileParams'],['file']);
});
test('unavailable authorization storage never authorizes publication',async()=>{
 const {code:c}=await code();const t=await exchange(c);storageDown=true;const r=response();await mcp({method:'POST',headers:{authorization:'Bearer '+t.access_token},body:{jsonrpc:'2.0',id:1,method:'tools/call'}},r);assert.equal(r.code,503);
});
test('authorization page escapes metadata, sets secure cookie and never embeds master credential',async()=>{
 client=oauth.registerClient({redirect_uris:[redirect],client_name:'<script>attack()</script>'});const r=response();await endpoint({method:'GET',headers:{},query:{action:'authorize',...query()}},r);
 assert.equal(r.code,200);assert.ok(r.headers['Set-Cookie'].includes('Secure; HttpOnly; SameSite=Lax'));assert.ok(r.headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));assert.ok(!r.html.includes(process.env.ELAH_ADMIN_TOKEN));assert.ok(r.html.includes('&lt;script&gt;attack()'));assert.ok(!r.html.includes('<script>attack()'));
});
test('cross-origin completion, forged approvals and malformed fields cannot authorize',async()=>{
 let r=response();await endpoint({method:'POST',headers:{origin:'https://evil.test'},query:{action:'complete'},body:{request_id:oauth.random()}},r);assert.equal(r.code,403);
 r=response();await endpoint({method:'POST',headers:{},query:{action:'approve'},body:{request_id:oauth.random()}},r);assert.equal(r.code,403);
 r=response();await endpoint({method:'POST',headers:{},query:{action:'token'},body:{client_id:[]}},r);assert.equal(r.code,400);
});

test('approval retry is idempotent and completion redirects to the registered ChatGPT callback',async()=>{
 const request=await oauth.startAuthorization(query());
 await approve(request);await approve(request);
 const r=response();
 await endpoint({method:'POST',headers:{origin:oauth.ISSUER,cookie:'__Host-elah_oauth='+request.session},query:{action:'complete'},body:{request_id:request.id}},r);
 assert.equal(r.code,303);
 const callback=new URL(r.headers.Location);
 assert.equal(callback.origin,'https://chatgpt.com');
 assert.equal(callback.searchParams.get('state'),'test-state');
 assert.ok(callback.searchParams.get('code'));
 assert.ok(r.headers['Set-Cookie'].includes('Max-Age=0'));
 await assert.rejects(approve(request));
});
test('authorization CSP permits the ChatGPT redirect after form completion',async()=>{
 const r=response();await endpoint({method:'GET',headers:{},query:{action:'authorize',...query()}},r);
 assert.ok(r.headers['Content-Security-Policy'].includes("form-action 'self' https://chatgpt.com;"));
});

test('authorization page preserves same-origin POST provenance without leaking callback referrers',async()=>{
 const client=oauth.registerClient({redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect']});
 const r=response();await endpoint({method:'GET',headers:{},query:{action:'authorize',client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:'code',code_challenge_method:'S256',code_challenge:oauth.hash('a'.repeat(43)),resource:oauth.RESOURCE,scope:oauth.SCOPE,state:'browser-policy-test'}},r);
 assert.equal(r.code,200);assert.equal(r.headers['Referrer-Policy'],'same-origin');
});
