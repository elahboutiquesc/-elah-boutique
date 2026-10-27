import {authorizeAdmin} from '../lib/admin-session.js';
import { requireExistingReference } from '../lib/existing-reference.js';
import { put, get, list } from '@vercel/blob';

const refPattern=/^ELAH-[A-Z]{2,3}[0-9]{3,}$/;
const nameFor=ref=>'image-registry/'+ref+'.json';
const validUrl=(url,ref)=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='res.cloudinary.com'&&u.pathname.startsWith('/bl7tzrfk/image/upload/')&&u.pathname.includes(encodeURIComponent(ref))}catch{return false}};
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({error:'Almacenamiento no conectado'});
if(req.method==='GET'){
const ref=String(req.query.ref||'').trim().toUpperCase();
if(ref==='ALL'){try{const rows=[];let cursor;do{const result=await list({prefix:'image-registry/',cursor,limit:1000,token:process.env.BLOB_READ_WRITE_TOKEN});for(const blob of result.blobs){const key=blob.pathname.match(/(ELAH-[A-Z]{2,3}[0-9]{3,})\.json$/)?.[1];if(key)rows.push(key)}cursor=result.hasMore?result.cursor:undefined}while(cursor);return res.status(200).json({references:rows})}catch{return res.status(500).json({error:'No se pudo listar el registro'})}}
if(!refPattern.test(ref))return res.status(400).json({error:'Referencia inválida'});
try{const file=await get(nameFor(ref),{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN});if(!file)return res.status(404).json({error:'Referencia sin fotografía'});if(file.statusCode!==200||!file.stream)throw Error('Registro sin contenido');const obj=await new Response(file.stream).json();if(obj.reference!==ref||!validUrl(obj.url,ref))throw Error('Registro inválido');return res.status(200).json(obj)}catch(e){return res.status(500).json({error:'No se pudo consultar el registro'})}
}
if(req.method==='POST'){
try{if(!await authorizeAdmin(req))return res.status(401).json({error:'Acceso administrativo requerido'});}catch(e){return res.status(e.status||503).json({error:e.status?'Acceso denegado':'Autorización no disponible'});}
const {reference,url,public_id}=req.body||{};const ref=String(reference||'').trim().toUpperCase();
if(!refPattern.test(ref)||!validUrl(url,ref))return res.status(400).json({error:'Referencia o enlace Cloudinary inválido'});
if(typeof public_id!=='string'||!public_id.includes(ref))return res.status(400).json({error:'Identificador Cloudinary no coincide'});
try{await requireExistingReference(ref);const record={reference:ref,url,public_id,updatedAt:new Date().toISOString()};await put(nameFor(ref),JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,token:process.env.BLOB_READ_WRITE_TOKEN});return res.status(200).json(record)}catch(e){return res.status(500).json({error:'No se pudo guardar el registro'})}
}
res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método no permitido'});
}