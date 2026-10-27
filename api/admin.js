import {startAdminLogin,completeAdminLogin,adminSession,closeAdminSession,adminCookie,readCookie} from '../lib/admin-session.js';
import {browserRequest,ISSUER,random} from '../lib/oauth.js';
import {approvalPage} from '../lib/approval-page.js';
export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 const action=req.query?.action;
 try{
  if(req.method==='GET'&&action==='login'){
   const started=await startAdminLogin(),nonce=random();
   res.setHeader('Set-Cookie',`__Host-elah_admin_pending=${started.session}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);
   res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
   res.setHeader('Content-Type','text/html; charset=utf-8');
   return res.status(200).end(approvalPage({id:started.id,title:'Acceso administrativo de ELAH Boutique',nonce,statusPath:'/admin/status',completePath:'/admin/complete'}));
  }
  if(req.method==='GET'&&action==='status'){
   const stored=await browserRequest(req.query.request_id,readCookie(req,'__Host-elah_admin_pending'));
   if(stored.value.kind!=='browser')return res.status(403).json({error:'access_denied'});
   return res.json({approved:stored.value.status==='approved'});
  }
  if(req.method==='POST'&&action==='complete'){
   if(req.headers.origin!==ISSUER)return res.status(403).json({error:'access_denied'});
   const body=typeof req.body==='string'?Object.fromEntries(new URLSearchParams(req.body)):req.body;
   const token=await completeAdminLogin(body?.request_id,readCookie(req,'__Host-elah_admin_pending'));
   res.setHeader('Set-Cookie',[adminCookie(token),'__Host-elah_admin_pending=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0']);
   res.setHeader('Location','/cargar-fotos.html');return res.status(303).end();
  }
  if(req.method==='GET'&&action==='session'){
   const session=await adminSession(req);
   return res.json(session?{authenticated:true,csrf:session.value.csrf,expires:session.value.expires}:{authenticated:false});
  }
  if(req.method==='POST'&&action==='logout'){
   await closeAdminSession(req);res.setHeader('Set-Cookie',adminCookie(''));return res.json({authenticated:false});
  }
  return res.status(405).json({error:'method_not_allowed'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'temporarily_unavailable'});}
}
