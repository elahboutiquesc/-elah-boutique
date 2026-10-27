import {authorizationMetadata,resourceMetadata,startAuthorization,browserRequest,finishAuthorization,exchangeToken,revokeToken,approveAuthorization,ISSUER,random} from '../lib/oauth.js';
export const config={api:{bodyParser:{sizeLimit:'32kb'}}};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
   const nonce=random();res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
   res.setHeader('Content-Type','text/html; charset=utf-8');
   return res.status(200).end(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Autorizar ELAH Boutique</title><h1>Conectar ${escape(started.client_name)} con ELAH Boutique</h1><p>Esta conexión permite publicar y recuperar fotografías de productos existentes. No permite modificar existencias.</p><p>Solo un administrador con acceso de escritura al repositorio puede aprobarla. En GitHub, abre <b>Run workflow</b>, selecciona <b>main</b> y pega este identificador en <b>request_id</b>:</p><p><code>${started.id}</code></p><p><a href="https://github.com/elahboutiquesc/-elah-boutique/actions/workflows/autorizar-mcp.yml" target="_blank" rel="noopener noreferrer">Abrir aprobación en GitHub</a></p><p>Revisa la solicitud y su origen antes de aprobar. No compartas claves administrativas. Mantén esta ventana abierta; la solicitud caduca en diez minutos.</p><p id="status" role="status">Esperando aprobación…</p><form id="complete" method="post" action="/oauth/complete"><input type="hidden" name="request_id" value="${started.id}"></form><script nonce="${nonce}">const poll=async()=>{try{const r=await fetch('/oauth/status?request_id=${started.id}',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(d.approved){document.getElementById('complete').submit();return;}setTimeout(poll,3000);}catch{document.getElementById('status').textContent='La solicitud caducó o no está disponible. Inicia la conexión de nuevo.';}};setTimeout(poll,3000);</script></html>`);
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
