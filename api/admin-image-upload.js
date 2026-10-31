import {timingSafeEqual} from 'node:crypto';
import {get, put, list} from '@vercel/blob';
import {referencePattern, validImageUrl, validPublicId} from '../lib/image-record.js';
import {requireExistingReference} from '../lib/existing-reference.js';

export const config = {api:{bodyParser:false}};
const LIMIT=3_500_000;
function sameSecret(given, expected) {
  if (!given || !expected) return false;
  const a=Buffer.from(given),b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function readImage(req) {
  const chunks=[];let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>LIMIT){const e=new Error('La imagen supera 3,5 MB');e.status=413;throw e;}
    chunks.push(chunk);
  }
  const image=Buffer.concat(chunks);
  const png=image.length>=8&&image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=image.length>=3&&image[0]===255&&image[1]===216&&image[2]===255;
  const webp=image.length>=12&&image.toString('ascii',0,4)==='RIFF'&&image.toString('ascii',8,12)==='WEBP';
  const detected=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null;
  if(!detected||detected!==req.headers['content-type']){const e=new Error('Formato real inválido: usa JPG, PNG o WebP');e.status=415;throw e;}
  return {image,mime:detected};
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Método no permitido'});}
  const supplied=String(req.headers.authorization||'').match(/^Bearer (\S+)$/i)?.[1];
  if(!sameSecret(supplied,process.env.ELAH_ADMIN_TOKEN))return res.status(401).json({ok:false,error:'Clave administrativa inválida'});
  const origin=req.headers.origin;
  if(origin&&origin!=='https://elah-boutique.vercel.app')return res.status(403).json({ok:false,error:'Origen no permitido'});
  const reference=String(req.query?.reference||'').trim().toUpperCase();
  if(!referencePattern.test(reference))return res.status(400).json({ok:false,error:'Referencia inválida'});
  if(Number(req.headers['content-length'])>LIMIT)return res.status(413).json({ok:false,error:'La imagen supera 3,5 MB'});
  const token=process.env.BLOB_READ_WRITE_TOKEN;
  if(!token)return res.status(503).json({ok:false,error:'Vercel Blob no configurado'});
  try {
    await requireExistingReference(reference);
    const key='image-registry/'+reference+'.json';
    const prior=await get(key,{access:'private',token,useCache:false});
    if(prior?.statusCode===200&&prior.stream){
      const saved=await new Response(prior.stream).json();
      if(saved.reference===reference&&validImageUrl(saved.url,reference)&&validPublicId(saved.public_id,reference)){
        return res.status(409).json({ok:false,error:'La referencia ya tiene una imagen registrada. No se sobrescribió para evitar duplicados.',existingUrl:saved.url});
      }
    }
    // Confirm storage availability before uploading externally.
    await list({prefix:'image-registry/',limit:1,token});
    const {image,mime}=await readImage(req);
    const form=new FormData();
    form.append('file',new Blob([image],{type:mime}),reference+(mime==='image/png'?'.png':mime==='image/webp'?'.webp':'.jpg'));
    form.append('upload_preset','elah_catalogo');
    form.append('public_id',reference);
    form.append('context','reference='+reference);
    const cloud=await fetch('https://api.cloudinary.com/v1_1/bl7tzrfk/image/upload',{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
    const uploaded=await cloud.json().catch(()=>({}));
    if(!cloud.ok||!validImageUrl(uploaded.secure_url,reference)||!validPublicId(uploaded.public_id,reference))
      return res.status(502).json({ok:false,error:'Cloudinary rechazó la fotografía o su referencia'});
    const record={reference,url:uploaded.secure_url,public_id:uploaded.public_id,updatedAt:new Date().toISOString()};
    try {await put(key,JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false,token});}
    catch {return res.status(502).json({ok:false,error:'Imagen subida a Cloudinary pero registro pendiente. No repitas la subida; conserva los datos de recuperación.',recovery:record});}
    return res.status(201).json({ok:true,reference,url:record.url,message:'Fotografía guardada y registrada. Inventario sin cambios.'});
  } catch(e) {
    const status=Number.isInteger(e.status)?e.status:502;
    return res.status(status).json({ok:false,error:status===413||status===415?e.message:'No se confirmó la publicación. Revisa que la referencia exista y el servicio esté disponible.'});
  }
}
