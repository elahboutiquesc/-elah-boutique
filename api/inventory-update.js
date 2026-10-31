import {timingSafeEqual} from 'node:crypto';
import {referencePattern} from '../lib/image-record.js';

export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
function authorized(req) {
 const match=String(req.headers.authorization||'').match(/^Bearer (\S+)$/i);
 const actual=match?.[1],expected=process.env.ELAH_ADMIN_TOKEN;
 if(!actual||!expected)return false;
 const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='PATCH'){res.setHeader('Allow','PATCH');return res.status(405).json({ok:false,error:'Use PATCH'});}
 if(!authorized(req))return res.status(401).json({ok:false,error:'Unauthorized'});
 if(req.headers.origin&&req.headers.origin!=='https://elah-boutique.vercel.app')return res.status(403).json({ok:false,error:'Origin not permitted'});
 const reference=String(req.body?.reference||'').trim().toUpperCase();
 const changes=req.body?.changes;
 if(!referencePattern.test(reference)||!changes||typeof changes!=='object'||Array.isArray(changes))return res.status(400).json({ok:false,error:'Invalid reference or changes'});
 const keys=Object.keys(changes);
 if(!keys.length||keys.some(k=>!['priceUSD','size','stock'].includes(k)))return res.status(400).json({ok:false,error:'Only priceUSD, size and stock are editable'});
 if(Object.hasOwn(changes,'priceUSD')&&(!Number.isFinite(changes.priceUSD)||changes.priceUSD<0||changes.priceUSD>100000))return res.status(400).json({ok:false,error:'Invalid USD price'});
 if(Object.hasOwn(changes,'stock')&&(!Number.isInteger(changes.stock)||changes.stock<0||changes.stock>100000))return res.status(400).json({ok:false,error:'Invalid stock'});
 if(Object.hasOwn(changes,'size')&&(typeof changes.size!=='string'||!changes.size.trim()||changes.size.length>60))return res.status(400).json({ok:false,error:'Invalid size'});
 try{
  const url=process.env.ELAH_APPS_SCRIPT_WRITE_URL;
  const token=process.env.ELAH_APPS_SCRIPT_WRITE_TOKEN;
  if(!url||!token)return res.status(503).json({ok:false,error:'Apps Script write integration not configured'});
  const target=new URL(url);
  if(target.protocol!=='https:'||target.hostname!=='script.google.com'||!target.pathname.startsWith('/macros/s/'))return res.status(503).json({ok:false,error:'Apps Script endpoint is invalid'});
  const expected=req.body?.expected;
  const keys=Object.keys(changes);
  if(!expected||typeof expected!=='object'||Array.isArray(expected)||keys.some(k=>!Object.hasOwn(expected,k)))return res.status(400).json({ok:false,error:'Expected values required for every changed field'});
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token,reference,changes,expected,dryRun:req.body?.dryRun!==false}),redirect:'follow',signal:AbortSignal.timeout(20000)});
  if(!response.ok)return res.status(502).json({ok:false,error:'Apps Script unavailable'});
  const result=await response.json();
  if(!result.ok)return res.status(result.error==='STALE_VALUES'?409:502).json({ok:false,error:result.error||'Apps Script rejected update'});
  return res.status(200).json(result);

 }catch(error){
  const status=[400,401,403,409,502,503].includes(error.status)?error.status:503;
  return res.status(status).json({ok:false,error:status===503?'Google Sheets write credentials or service unavailable':status===409?'Reference not unique in master inventory':'Update or verification unsuccessful'});
 }
}
