import {createHash, createHmac, timingSafeEqual, randomBytes, createPublicKey, verify} from 'node:crypto';
import {readState, writeState} from './oauth-store.js';

export const ISSUER = 'https://elah-boutique.vercel.app';
export const RESOURCE = `${ISSUER}/api/mcp`;
export const SCOPE = 'elah:photos:write';
export const APPROVAL_AUDIENCE = `${ISSUER}/oauth/approve`;
const now = () => Math.floor(Date.now()/1000);
export const random = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('base64url');
export function equal(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x=Buffer.from(a), y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
export function fail(error, status=400) { const e=Error(error); e.status=status; throw e; }
function key() { if (!process.env.ELAH_ADMIN_TOKEN) fail('temporarily_unavailable',503); return process.env.ELAH_ADMIN_TOKEN; }
function signature(value) { return createHmac('sha256',key()).update('elah-oauth-client-v1:'+value).digest('base64url'); }
export function allowedRedirect(value) {
  try {
    const u=new URL(value);
    return u.origin==='https://chatgpt.com' && !u.hash && !u.search &&
      (u.pathname==='/connector_platform_oauth_redirect' || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname));
  } catch { return false; }
}
function clientMetadata(input) {
  if (!input || !Array.isArray(input.redirect_uris) || !input.redirect_uris.length || input.redirect_uris.length>5 || !input.redirect_uris.every(allowedRedirect)) fail('invalid_redirect_uri');
  if (input.token_endpoint_auth_method && input.token_endpoint_auth_method!=='none') fail('invalid_client_metadata');
  if (input.grant_types && (!Array.isArray(input.grant_types)||input.grant_types.some(x=>!['authorization_code','refresh_token'].includes(x)))) fail('invalid_client_metadata');
  if (input.response_types && (!Array.isArray(input.response_types)||input.response_types.some(x=>x!=='code'))) fail('invalid_client_metadata');
  return {redirect_uris:[...new Set(input.redirect_uris)],client_name:typeof input.client_name==='string'?input.client_name.slice(0,100):'ChatGPT',token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']};
}
export function registerClient(input) {
  const metadata=clientMetadata(input);
  const value=Buffer.from(JSON.stringify({...metadata,nonce:random()})).toString('base64url');
  return {...metadata,client_id:`elah_client.${value}.${signature(value)}`};
}
export async function resolveClient(id) {
  if (typeof id!=='string'||id.length>8000) fail('invalid_client');
  if (/^https:\/\/chatgpt\.com\/oauth\/(?:[A-Za-z0-9_-]+\/)?client\.json$/.test(id)) {
    let r;
    try { r=await fetch(id,{redirect:'error',signal:AbortSignal.timeout(5000)}); } catch { fail('invalid_client'); }
    if (!r.ok || Number(r.headers.get('content-length'))>65536) fail('invalid_client');
    const reader=r.body.getReader();let bytes=0;const chunks=[];
    try { while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536){await reader.cancel();fail('invalid_client');}chunks.push(Buffer.from(value));} } finally { reader.releaseLock(); }
    let metadata;try{metadata=JSON.parse(Buffer.concat(chunks).toString());}catch{fail('invalid_client');}
    if (metadata.client_id!==id) fail('invalid_client');
    return clientMetadata(metadata);
  }
  const [prefix,value,sig,...extra]=id.split('.');
  if(prefix!=='elah_client'||!value||extra.length||!equal(sig,signature(value)))fail('invalid_client');
  try { return clientMetadata(JSON.parse(Buffer.from(value,'base64url'))); } catch { fail('invalid_client'); }
}
export function authorizationMetadata() {
  return {issuer:ISSUER,authorization_endpoint:`${ISSUER}/oauth/authorize`,token_endpoint:`${ISSUER}/oauth/token`,registration_endpoint:`${ISSUER}/oauth/register`,revocation_endpoint:`${ISSUER}/oauth/revoke`,response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:[SCOPE],authorization_response_iss_parameter_supported:true,client_id_metadata_document_supported:true};
}
export function resourceMetadata() { return {resource:RESOURCE,authorization_servers:[ISSUER],scopes_supported:[SCOPE],bearer_methods_supported:['header']}; }
export function challenge(res) {
  res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource/api/mcp", scope="${SCOPE}"`);
}
export async function startAuthorization(q) {
  const client=await resolveClient(q.client_id);
  if(!client.redirect_uris.includes(q.redirect_uri))fail('invalid_redirect_uri');
  if(q.response_type!=='code'||q.code_challenge_method!=='S256'||!/^[-_A-Za-z0-9]{43}$/.test(q.code_challenge||''))fail('invalid_request');
  if(q.resource!==RESOURCE)fail('invalid_target');
  if(q.scope!==SCOPE)fail('invalid_scope');
  if(typeof q.state!=='string'||!q.state||q.state.length>2048)fail('invalid_request');
  const id=random(),session=random();
  await writeState(`request-${id}`,{kind:'oauth',status:'pending',client_id:q.client_id,client_name:client.client_name,redirect_uri:q.redirect_uri,state:q.state,challenge:q.code_challenge,resource:RESOURCE,scope:SCOPE,session:hash(session),expires:now()+600});
  return {id,session,client_name:client.client_name};
}
export async function browserRequest(id, session) {
  if(!/^[-_A-Za-z0-9]{43}$/.test(id||'')||typeof session!=='string')fail('invalid_request');
  const stored=await readState(`request-${id}`);
  if(!stored||stored.value.expires<=now()||!equal(stored.value.session,hash(session)))fail('access_denied',403);
  return stored;
}
export async function finishAuthorization(id,session) {
  const stored=await browserRequest(id,session);
  if(stored.value.kind!=='oauth'||stored.value.status!=='approved')fail('access_denied',403);
  const code=`elah_code.${id}.${random()}`;
  await writeState(`request-${id}`,{...stored.value,status:'issued',code_hash:hash(code),code_expires:now()+120},stored.etag);
  const redirect=new URL(stored.value.redirect_uri);
  redirect.searchParams.set('code',code);redirect.searchParams.set('state',stored.value.state);redirect.searchParams.set('iss',ISSUER);
  return redirect.href;
}
function parseToken(token,prefix) {
  if(typeof token!=='string'||token.length>300)fail('invalid_grant');
  const [type,id,secret,...extra]=token.split('.');
  if(type!==prefix||!/^[-_A-Za-z0-9]{43}$/.test(id||'')||!/^[-_A-Za-z0-9]{43}$/.test(secret||'')||extra.length)fail('invalid_grant');
  return id;
}
function credentials(id) { return {access_token:`elah_at.${id}.${random()}`,refresh_token:`elah_rt.${id}.${random()}`,token_type:'Bearer',expires_in:900,scope:SCOPE}; }
export async function exchangeToken(body) {
  await resolveClient(body.client_id);
  if(body.resource!==RESOURCE)fail('invalid_target');
  if(body.grant_type==='authorization_code') {
    const id=parseToken(body.code,'elah_code'),stored=await readState(`request-${id}`),v=stored?.value;
    if(!v||v.kind!=='oauth'||v.status!=='issued'||v.expires<=now()||v.code_expires<=now()||v.client_id!==body.client_id||v.redirect_uri!==body.redirect_uri||!equal(v.code_hash,hash(body.code)))fail('invalid_grant');
    if(!/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier||'')||!equal(hash(body.code_verifier),v.challenge))fail('invalid_grant');
    // CAS makes the code single-use across concurrent Vercel instances.
    try{await writeState(`request-${id}`,{...v,status:'consumed'},stored.etag);}catch{fail('invalid_grant');}
    const grant=random(),tokens=credentials(grant);
    await writeState(`grant-${grant}`,{client_id:v.client_id,resource:RESOURCE,scope:SCOPE,subject:v.subject,access_hash:hash(tokens.access_token),access_expires:now()+900,refresh_hash:hash(tokens.refresh_token),used_refresh:[],expires:now()+30*86400,revoked:false});
    return tokens;
  }
  if(body.grant_type==='refresh_token') {
    const id=parseToken(body.refresh_token,'elah_rt'),stored=await readState(`grant-${id}`),v=stored?.value;
    if(!v||v.revoked||v.expires<=now()||v.client_id!==body.client_id)fail('invalid_grant');
    const incoming=hash(body.refresh_token);
    if(v.used_refresh.includes(incoming)) {
      try{await writeState(`grant-${id}`,{...v,revoked:true},stored.etag);}catch{}
      fail('invalid_grant');
    }
    if(!equal(v.refresh_hash,incoming)||v.used_refresh.length>=3000)fail('invalid_grant');
    if(body.scope && body.scope!==SCOPE)fail('invalid_scope');
    const tokens=credentials(id);
    try{await writeState(`grant-${id}`,{...v,access_hash:hash(tokens.access_token),access_expires:now()+900,refresh_hash:hash(tokens.refresh_token),used_refresh:[...v.used_refresh,v.refresh_hash]},stored.etag);}catch{fail('invalid_grant');}
    return tokens;
  }
  fail('unsupported_grant_type');
}
export async function validateAccess(token) {
  let id;try{id=parseToken(token,'elah_at');}catch{return null;}
  const v=(await readState(`grant-${id}`))?.value;
  if(!v||v.revoked||v.expires<=now()||v.access_expires<=now()||v.resource!==RESOURCE||v.scope!==SCOPE||!equal(v.access_hash,hash(token)))return null;
  return {subject:v.subject,client_id:v.client_id,scope:v.scope};
}
export async function revokeToken(body) {
  await resolveClient(body.client_id);
  let id;try{id=parseToken(body.token,body.token?.startsWith('elah_rt.')?'elah_rt':'elah_at');}catch{return;}
  const stored=await readState(`grant-${id}`),v=stored?.value;
  if(!v||v.client_id!==body.client_id)return;
  const h=hash(body.token);
  if(![v.access_hash,v.refresh_hash,...v.used_refresh].includes(h))return;
  try{await writeState(`grant-${id}`,{...v,revoked:true},stored.etag);}catch{fail('temporarily_unavailable',503);}
}
let githubKeys;
export async function verifyGitHubApproval(jwt) {
  if(typeof jwt!=='string'||jwt.length>20000)fail('access_denied',403);
  let header,claims,parts;
  try{parts=jwt.split('.');if(parts.length!==3)throw Error();header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{fail('access_denied',403);}
  if(header.alg!=='RS256'||typeof header.kid!=='string')fail('access_denied',403);
  if(!githubKeys||githubKeys.expires<now()||!githubKeys.keys.some(k=>k.kid===header.kid)) {
    const r=await fetch('https://token.actions.githubusercontent.com/.well-known/jwks',{signal:AbortSignal.timeout(5000),redirect:'error'});
    if(!r.ok)fail('temporarily_unavailable',503);
    githubKeys={keys:(await r.json()).keys,expires:now()+300};
  }
  const jwk=githubKeys.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig');
  if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))fail('access_denied',403);
  if(claims.iss!=='https://token.actions.githubusercontent.com'||claims.aud!==APPROVAL_AUDIENCE||!Number.isInteger(claims.exp)||claims.exp<=now()||claims.exp>now()+900||!Number.isInteger(claims.iat)||claims.iat>now()+30||claims.iat<now()-900|| (claims.nbf && claims.nbf>now()+30))fail('access_denied',403);
  if(claims.repository_id!=='1373614442'||claims.repository!=='elahboutiquesc/-elah-boutique'||claims.ref!=='refs/heads/main'||claims.event_name!=='workflow_dispatch'||claims.workflow_ref!=='elahboutiquesc/-elah-boutique/.github/workflows/autorizar-mcp.yml@refs/heads/main'||!/^\d+$/.test(claims.actor_id||''))fail('access_denied',403);
  return {subject:`github:${claims.actor_id}`};
}
export async function approveAuthorization(id,jwt) {
  const identity=await verifyGitHubApproval(jwt);
  if(!/^[-_A-Za-z0-9]{43}$/.test(id||''))fail('invalid_request');
  const stored=await readState(`request-${id}`);
  if(!stored||stored.value.expires<=now()||stored.value.status!=='pending')fail('invalid_request');
  await writeState(`request-${id}`,{...stored.value,status:'approved',subject:identity.subject},stored.etag);
}
