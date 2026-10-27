import {approvalPage} from '../lib/approval-page.js';
import {authorizationMetadata,resourceMetadata,startAuthorization,browserRequest,finishAuthorization,exchangeToken,revokeToken,approveAuthorization,ISSUER,random} from '../lib/oauth.js';
export const config={api:{bodyParser:{sizeLimit:'32kb'}}};

function cookie(req) {
 const values=String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-elah_oauth='));
 return values.length===1?values[0].slice('__Host-elah_oauth='.length):'';
}
function fields(body) {
 const data=typeof body==='string'?Object.fromEntries(new URLSearchParams(body)):body;
 if(!data||Array.isArray(data)||typeof data!=='object'||Object.values(data).some(v=>typeof v!=='string')) {const e=Error('invalid_request');e.status=400;throw e;}
 return data;
}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 const action=req.query?.action;
 if(['resource','metadata','register','token','revoke'].includes(action))res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='OPTIONS'&&['resource','metadata','register','token','revoke'].includes(action)){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');return res.status(204).end();
 }
 try{
  if(req.method==='GET'&&action==='resource')return res.json(resourceMetadata());
  if(req.method==='GET'&&action==='metadata')return res.json(authorizationMetadata());
  if(req.method==='POST'&&action==='register'){
   const {registerClient}=await import('../lib/oauth.js');
   return res.status(201).json(registerClient(req.body));
  }
  if(req.method==='GET'&&action==='authorize'){
   const started=await startAuthorization(fields(Object.fromEntries(Object.entries(req.query).filter(([k])=>k!=='action'))));
   res.setHeader('Set-Cookie',`__Host-elah_oauth=${started.session}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);
   const nonce=random();res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self' https://chatgpt.com; base-uri 'none'; frame-ancestors 'none'`);
   res.setHeader('Content-Type','text/html; charset=utf-8');
   return res.status(200).end(approvalPage({id:started.id,title:'Conectar '+started.client_name+' con ELAH Boutique',nonce,statusPath:'/oauth/status',completePath:'/oauth/complete'}));
  }
  if(req.method==='GET'&&action==='status'){
   const stored=await browserRequest(req.query.request_id,cookie(req));return res.json({approved:stored.value.status==='approved'});
  }
  if(req.method==='POST'&&action==='complete'){
   if(req.headers.origin!==ISSUER)return res.status(403).json({error:'access_denied'});
   const redirect=await finishAuthorization(fields(req.body).request_id,cookie(req));
   res.setHeader('Set-Cookie','__Host-elah_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
   res.setHeader('Location',redirect);return res.status(303).end();
  }
  if(req.method==='POST'&&action==='approve'){
   const jwt=String(req.headers.authorization||'').match(/^Bearer (\S+)$/i)?.[1];
   await approveAuthorization(fields(req.body).request_id,jwt);return res.json({approved:true});
  }
  if(req.method==='POST'&&['token','revoke'].includes(action)){
   if(req.headers.authorization)return res.status(400).json({error:'invalid_client'});
   if(action==='token')return res.json(await exchangeToken(fields(req.body)));
   await revokeToken(fields(req.body));return res.status(200).end();
  }
  return res.status(405).json({error:'method_not_allowed'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'temporarily_unavailable'});}
}
