import {validImageUrl, validPublicId, referencePattern} from '../lib/image-record.js';
import {authorizeAdmin} from '../lib/admin-session.js';
import { requireExistingReference } from '../lib/existing-reference.js';
import { put, list } from '@vercel/blob';
export const config={api:{bodyParser:{sizeLimit:'6mb'}}};

export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
try{if(!await authorizeAdmin(req))return res.status(401).json({error:'Acceso administrativo requerido'});}catch(e){return res.status(e.status||503).json({error:e.status?'Acceso denegado':'Autorización no disponible'});}
if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({error:'Almacenamiento sin conexión'});
const {reference,image,mime}=req.body||{};const ref=String(reference||'').toUpperCase().trim();
if(!referencePattern.test(ref)||!/^image\/(jpeg|png|webp)$/.test(mime||'')||typeof image!=='string'||image.length>7_000_000||!/^[A-Za-z0-9+/=]+$/.test(image))return res.status(400).json({error:'Referencia o imagen inválida'});
try{
await requireExistingReference(ref);
await list({prefix:'image-registry/',limit:1,token:process.env.BLOB_READ_WRITE_TOKEN});
const form=new FormData();form.append('file','data:'+mime+';base64,'+image);form.append('upload_preset','elah_catalogo');form.append('public_id',ref);form.append('context','reference='+ref);
const response=await fetch('https://api.cloudinary.com/v1_1/bl7tzrfk/image/upload',{method:'POST',body:form});
const data=await response.json();if(!response.ok||!data.secure_url)return res.status(502).json({error:'Cloudinary rechazó la fotografía',detail:data.error?.message||''});
if(!validPublicId(data.public_id,ref)||!validImageUrl(data.secure_url,ref))throw Error('Referencia Cloudinary diferente');
const record={reference:ref,url:data.secure_url,public_id:data.public_id,updatedAt:new Date().toISOString()};
try{
await put('image-registry/'+ref+'.json',JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,token:process.env.BLOB_READ_WRITE_TOKEN});
}catch{return res.status(503).json({status:'registration_pending',...record,recovery:{method:'POST',path:'/api/image-registry',body:{reference:ref,url:record.url,public_id:record.public_id}}});}
return res.status(200).json({...record,status:data.existing?'existing':'published',existing:Boolean(data.existing)});
}catch(e){return res.status(500).json({error:'No se pudo completar la carga y el registro'})}
}