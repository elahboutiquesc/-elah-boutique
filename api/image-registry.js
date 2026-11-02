import {storageAvailable} from '../lib/storage.js';
import {validImageUrl, validPublicId, referencePattern} from '../lib/image-record.js';
import {authorizeAdmin} from '../lib/admin-session.js';
import { requireExistingReference } from '../lib/existing-reference.js';
import { put, get, list } from '../lib/storage.js';

const refPattern=referencePattern;
const nameFor=ref=>'image-registry/'+ref+'.json';
const validUrl=validImageUrl;
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(!storageAvailable())return res.status(503).json({error:'Almacenamiento no conectado'});
if(req.method==='GET'){
const ref=String(req.query.ref||'').trim().toUpperCase();
if(ref==='ALL'){
 try{
  const references=[],records=[];let cursor;
  do{
   const page=await list({prefix:'image-registry/',cursor,limit:1000,token:process.env.BLOB_READ_WRITE_TOKEN});
   for(const entry of page.blobs){
    const key=entry.pathname.match(/(ELAH-[A-Z]{2,5}[0-9]{3,5})\.json$/)?.[1];if(!key)continue;
    references.push(key);
    if(req.query.records==='1'){
     let row=entry.record;
     if(!row){const saved=await get(entry.pathname,{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN,useCache:false});if(saved?.statusCode===200&&saved.stream)row=await new Response(saved.stream).json();}
     if(row?.reference===key&&validUrl(row.url,key)&&validPublicId(row.public_id,key))records.push({reference:key,url:row.url,public_id:row.public_id,updatedAt:row.updatedAt});
    }
   }
   cursor=page.hasMore?page.cursor:undefined;
  }while(cursor);
  return res.status(200).json({references,...(req.query.records==='1'?{records}:{})});
 }catch{return res.status(503).json({error:'No se pudo listar el registro'});}
}
if(!refPattern.test(ref))return res.status(400).json({error:'Referencia inválida'});
try{const file=await get(nameFor(ref),{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN,useCache:false});if(!file)return res.status(404).json({error:'Referencia sin fotografía'});if(file.statusCode!==200||!file.stream)throw Error('Registro sin contenido');const obj=await new Response(file.stream).json();if(obj.reference!==ref||!validUrl(obj.url,ref))throw Error('Registro inválido');return res.status(200).json(obj)}catch(e){return res.status(500).json({error:'No se pudo consultar el registro'})}
}
if(req.method==='POST'){
try{if(!await authorizeAdmin(req))return res.status(401).json({error:'Acceso administrativo requerido'});}catch(e){return res.status(e.status||503).json({error:e.status?'Acceso denegado':'Autorización no disponible'});}
const {reference,url,public_id}=req.body||{};const ref=String(reference||'').trim().toUpperCase();
if(!refPattern.test(ref)||!validUrl(url,ref))return res.status(400).json({error:'Referencia o enlace Cloudinary inválido'});
if(!validPublicId(public_id,ref))return res.status(400).json({error:'Identificador Cloudinary no coincide'});
try{await requireExistingReference(ref);const record={reference:ref,url,public_id,updatedAt:new Date().toISOString()};await put(nameFor(ref),JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,token:process.env.BLOB_READ_WRITE_TOKEN});return res.status(200).json(record)}catch(e){return res.status(500).json({error:'No se pudo guardar el registro'})}
}
res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método no permitido'});
}