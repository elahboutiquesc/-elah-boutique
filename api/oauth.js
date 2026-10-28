import {approvalPage} from '../lib/approval-page.js';
import {authorizationMetadata,resourceMetadata,startAuthorization,browserRequest,finishAuthorization,exchangeToken,revokeToken,approveAuthorization,approveWithAdminSecret,ISSUER,random} from '../lib/oauth.js';
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
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Content-Type-Options','nosniff');
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
   return res.status(200).end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar ELAH Boutique</title><style>body{font:16px system-ui;max-width:480px;margin:12vh auto;padding:20px;color:#2e2e2e}button{background:#c96a4a;color:white;border:0;padding:14px;border-radius:8px}input{padding:12px;width:95%;margin:10px 0}</style><h1>Conectar ChatGPT con ELAH Boutique</h1><p>Autoriza la publicación de fotografías en referencias existentes. No modifica inventario.</p><form method="post" action="/oauth/consent"><input type="hidden" name="request_id" value="${started.id}"><label>Clave administrativa de ELAH (no es tu contraseña de ChatGPT)<input name="admin_secret" type="password" required autocomplete="off"></label><button type="submit">Autorizar conexión</button></form><p>La autorización caduca en diez minutos. La clave se comprueba en el servidor y no se almacena.</p></html>`);
  }
  if(req.method==='POST'&&action==='consent'){
   if(req.headers.origin!==ISSUER)return res.status(403).json({error:'access_denied'});
   const body=fields(req.body);
   await approveWithAdminSecret(body.request_id,cookie(req),body.admin_secret);
   const redirect=await finishAuthorization(body.request_id,cookie(req));
   res.setHeader('Set-Cookie','__Host-elah_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
   res.setHeader('Location',redirect);return res.status(303).end();
  }
  if(req.method==='GET'&&action==='status'){
   const stored=await browserRequest(req.query.request_id,cookie(req));return res.json({approved:stored.value.status==='approved'});
  }
  if(req.method==='POST'&&action==='complete'){
   const origin=req.headers.origin;
   const referer=req.headers.referer;
   let sameSite=origin===ISSUER;
   if(!origin && referer){try{sameSite=new URL(referer).origin===ISSUER;}catch{sameSite=false;}}
   if(!sameSite)return res.status(403).json({error:'access_denied'});
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
