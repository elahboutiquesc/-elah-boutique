import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
const mf=new Miniflare(convertV4MiniflareOptions({name:"elah",modules:true,scriptPath:'work/cloudflare-build/worker.js',compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat','nodejs_compat_populate_process_env'],d1Databases:['DB'],bindings:{ELAH_PUBLIC_ORIGIN:'https://elah.example',ELAH_ADMIN_TOKEN:'synthetic-only'}}));
try{
 const db=await mf.getD1Database('DB','elah');await db.exec((await readFile('cloudflare/migrations/0001_records.sql','utf8')).replaceAll('\n',' '));
 for(const path of ['/.well-known/oauth-authorization-server','/admin/login','/api/image-registry?ref=ALL&records=1']){
  const r=await mf.dispatchFetch('https://elah.example'+path);const text=await r.text();
  if(r.status!==200)throw Error(path+' HTTP '+r.status);
  console.log(JSON.stringify({path,status:r.status,validOrigin:path.includes('well-known')?JSON.parse(text).issuer==='https://elah.example':undefined,secureCookie:path==='/admin/login'?r.headers.get('set-cookie')?.includes('Secure; HttpOnly'):undefined}));
 }
 // Real workerd + local D1 authorization round trip, using synthetic identity only.
 const jsonHeaders={'Content-Type':'application/json'};
 const redirect='https://chatgpt.com/connector_platform_oauth_redirect';
 const clientResponse=await mf.dispatchFetch('https://elah.example/oauth/register',{method:'POST',headers:jsonHeaders,body:JSON.stringify({redirect_uris:[redirect]})});
 assert.equal(clientResponse.status,201);const client=await clientResponse.json();
 const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const params=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',code_challenge_method:'S256',code_challenge:challenge,resource:'https://elah.example/api/mcp',scope:'elah:photos:write',state:'synthetic-test'});
 const authorization=await mf.dispatchFetch('https://elah.example/oauth/authorize?'+params);assert.equal(authorization.status,200);
 const cookie=authorization.headers.get('set-cookie').split(';')[0];
 const page=await authorization.text(),id=page.match(/<code>([-_A-Za-z0-9]{43})<\/code>/)?.[1];assert.ok(id);
 // Approval fixture is local-only; production still verifies GitHub OIDC.
 await db.prepare("UPDATE records SET value=json_set(value,'$.status','approved','$.subject','synthetic') WHERE key=?").bind('oauth/request-'+id+'.json').run();
 const completed=await mf.dispatchFetch('https://elah.example/oauth/complete',{method:'POST',headers:{...jsonHeaders,Origin:'https://elah.example',Cookie:cookie},body:JSON.stringify({request_id:id}),redirect:'manual'});
 assert.equal(completed.status,303);const code=new URL(completed.headers.get('location')).searchParams.get('code');
 const exchange={grant_type:'authorization_code',client_id:client.client_id,redirect_uri:redirect,code,code_verifier:verifier,resource:'https://elah.example/api/mcp'};
 const tokenRequest=()=>mf.dispatchFetch('https://elah.example/oauth/token',{method:'POST',headers:jsonHeaders,body:JSON.stringify(exchange)});
 const tokenResponse=await tokenRequest();assert.equal(tokenResponse.status,200);const tokens=await tokenResponse.json();assert.equal((await tokenRequest()).status,400);
 const discovery=await mf.dispatchFetch('https://elah.example/api/mcp',{method:'POST',headers:{...jsonHeaders,Authorization:'Bearer '+tokens.access_token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
 assert.equal(discovery.status,200);assert.ok((await discovery.json()).result.tools.some(t=>t.name==='publicar_fotografia_en_elah'));
 console.log(JSON.stringify({authorization:'passed',pkce:'passed',codeReplay:'rejected',authenticatedMcp:'passed',remoteWrites:0}));
}finally{await mf.dispose();}
