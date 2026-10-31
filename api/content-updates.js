import {get,put} from '@vercel/blob';
import {timingSafeEqual} from 'node:crypto';
import {referencePattern} from '../lib/image-record.js';
import {requireExistingReference} from '../lib/existing-reference.js';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
const path=ref=>'content-overrides/'+ref+'.json';
const allowed=new Set(['name','description','category']);
function authorized(req){
 const supplied=String(req.headers.authorization||'').match(/^Bearer (\\S+)$/i)?.[1];
 const expected=process.env.ELAH_ADMIN_TOKEN;
 if(!supplied||!expected)return false;
 const a=Buffer.from(supplied),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET'){
  const reference=String(req.query?.reference||'').trim().toUpperCase();
  if(!referencePattern.test(reference))return res.status(400).json({ok:false,error:'Referencia inválida'});
  if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({ok:false,error:'Registro no disponible'});
  try{
   const saved=await get(path(reference),{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN,useCache:false});
   if(!saved)return res.status(200).json({ok:true,reference,changes:{}});
   if(saved.statusCode!==200||!saved.stream)throw Error('invalid-record');
   const row=await new Response(saved.stream).json();
   return res.status(200).json({ok:true,reference,changes:row.changes||{},updatedAt:row.updatedAt});
  }catch{return res.status(503).json({ok:false,error:'No se pudo leer contenido'});}
 }
 if(req.method!=='PATCH')return res.status(405).json({ok:false,error:'Método no permitido'});
 if(!authorized(req))return res.status(401).json({ok:false,error:'Autorización administrativa requerida'});
 if(req.headers.origin&&req.headers.origin!=='https://elah-boutique.vercel.app')return res.status(403).json({ok:false,error:'Origen no autorizado'});
 const reference=String(req.body?.reference||'').trim().toUpperCase();
 const changes=req.body?.changes;
 if(!referencePattern.test(reference)||!changes||typeof changes!=='object'||Array.isArray(changes))return res.status(400).json({ok:false,error:'Referencia o cambios inválidos'});
 const keys=Object.keys(changes);
 if(!keys.length||keys.some(k=>!allowed.has(k))||keys.some(k=>typeof changes[k]!=='string'||!changes[k].trim()||changes[k].length>500))return res.status(400).json({ok:false,error:'Solo se permiten name, description y category; no precios ni existencias'});
 const token=process.env.BLOB_READ_WRITE_TOKEN;
 if(!token)return res.status(503).json({ok:false,error:'Almacenamiento no conectado'});
 try{
  await requireExistingReference(reference);
  const previous=await get(path(reference),{access:'private',token,useCache:false});
  let old={},etag;
  if(previous){if(previous.statusCode!==200||!previous.stream||!previous.blob?.etag)throw Error('invalid-state');const current=await new Response(previous.stream).json();old=current.changes||{};etag=previous.blob.etag;}
  const row={reference,changes:{...old,...Object.fromEntries(keys.map(k=>[k,changes[k].trim()]))},updatedAt:new Date().toISOString()};
  await put(path(reference),JSON.stringify(row),{access:'private',contentType:'application/json',addRandomSuffix:false,token,...(etag?{ifMatch:etag}:{allowOverwrite:false})});
  return res.status(200).json({ok:true,...row});
 }catch{return res.status(409).json({ok:false,error:'No se guardó el cambio. Comprueba inventario, almacenamiento o cambios concurrentes.'});}
}