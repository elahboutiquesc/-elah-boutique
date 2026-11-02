import {get,put,list} from '@vercel/blob';
import {referencePattern,validImageUrl} from '../lib/image-record.js';
import {requireExistingReference} from '../lib/existing-reference.js';
import {readAttachedImage} from '../lib/attached-image.js';
import {validateAccess,challenge,SCOPE} from '../lib/oauth.js';
import {timingSafeEqual} from 'node:crypto';

const name='publicar_fotografia_cloudflare';
export const tool={name,title:'Publicar fotografía en Cloudflare',
 description:'Carga una imagen real JPG/PNG/WebP en Cloudflare Images, para una referencia existente, sin duplicar ni modificar inventario. Requiere que el administrador configure Cloudflare Images en Vercel.',
 inputSchema:{type:'object',properties:{
 reference:{type:'string'},file:{type:'object',properties:{download_url:{type:'string'},file_id:{type:'string'},mime_type:{type:'string'},file_name:{type:'string'}},required:['download_url','file_id'],additionalProperties:false},
 image_base64:{type:'string'},mime_type:{type:'string',enum:['image/jpeg','image/png','image/webp']}
 },required:['reference'],oneOf:[{required:['file']},{required:['image_base64','mime_type']}],additionalProperties:false},
 securitySchemes:[{type:'oauth2',scopes:[SCOPE]}],_meta:{'openai/fileParams':['file'],securitySchemes:[{type:'oauth2',scopes:[SCOPE]}]}};
export const config={api:{bodyParser:{sizeLimit:'6mb'}}};
const json=(id,data,failed=false)=>({jsonrpc:'2.0',id,result:{...(failed?{isError:true}:{}),content:[{type:'text',text:JSON.stringify(data)}]}});
function admin(req){const a=Buffer.from(String(req.headers.authorization||'').replace(/^Bearer\\s+/i,'')),b=Buffer.from(process.env.ELAH_ADMIN_TOKEN||'');return b.length>0&&a.length===b.length&&timingSafeEqual(a,b);}
function magic(bytes){return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;}
async function run(args){
 const reference=String(args?.reference||'').trim().toUpperCase();
 if(!referencePattern.test(reference))throw Error('Referencia inválida');
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,secret=process.env.CLOUDFLARE_IMAGES_API_TOKEN,blobToken=process.env.BLOB_READ_WRITE_TOKEN;
 if(!account||!secret||!blobToken)throw Error('Falta configurar Cloudflare Images y el registro');
 await requireExistingReference(reference);
 const key='image-registry/'+reference+'.json';
 await list({prefix:'image-registry/',limit:1,token:blobToken});
 const existing=await get(key,{access:'private',token:blobToken,useCache:false});
 if(existing?.statusCode===200){return {status:'already_registered',reference,message:'Ya existe registro; no se subió otra imagen'};}
 let bytes,mime;
 if(args.file!==undefined){
  if(args.image_base64!==undefined)throw Error('Usa archivo o base64, no ambos');
  const attached=await readAttachedImage(args.file);bytes=Buffer.from(attached.base64,'base64');mime=attached.mimeType;
 }else{
  if(typeof args.image_base64!=='string'||args.image_base64.length>4_700_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(args.image_base64))throw Error('Base64 inválido');
  bytes=Buffer.from(args.image_base64,'base64');mime=args.mime_type;
  if(bytes.toString('base64')!==args.image_base64)throw Error('Base64 inválido');
 }
 if(bytes.length===0||bytes.length>3_500_000||magic(bytes)!==mime)throw Error('Imagen real inválida o supera 3,5 MB');
 const cloudApi='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/images/v1';
 // Cloudflare Images supports custom IDs and rejects collisions at the storage layer.
 const verify=await fetch(cloudApi+'/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(12000)});
 if(verify.ok)return {status:'already_in_cloudflare',reference,message:'Cloudflare ya contiene esta referencia. No se sobrescribió.'};
 if(verify.status!==404)throw Error('No se pudo verificar la referencia en Cloudflare (HTTP '+verify.status+')');
 const form=new FormData();form.append('file',new Blob([bytes],{type:mime}),reference+(mime==='image/png'?'.png':mime==='image/webp'?'.webp':'.jpg'));
 form.append('id',reference);form.append('requireSignedURLs','false');form.append('metadata',JSON.stringify({reference}));
 const response=await fetch(cloudApi,{method:'POST',headers:{Authorization:'Bearer '+secret},body:form,signal:AbortSignal.timeout(25000)});
 const parsed=await response.json().catch(()=>null),asset=parsed?.result;
 if(!response.ok||!parsed?.success||asset?.id!==reference)throw Error('Cloudflare rechazó la imagen (HTTP '+response.status+')');
 const url=asset.variants?.find(u=>{try{const p=new URL(u);return p.protocol==='https:'&&p.hostname==='imagedelivery.net'&&p.pathname.split('/')[2]===reference;}catch{return false;}});
 if(!url||!validImageUrl(url,reference))throw Error('Cloudflare respondió sin una URL de imagen válida');
 const record={reference,url,public_id:reference,provider:'cloudflare-images',updatedAt:new Date().toISOString()};
 try{await put(key,JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false,token:blobToken});}
 catch{return {status:'registration_pending',...record,message:'Imagen cargada; recupera el registro sin volver a subir'};}
 return {status:'published',...record};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 let auth=admin(req);
 if(!auth){try{auth=Boolean(await validateAccess(String(req.headers.authorization||'').match(/^Bearer (\\S+)$/i)?.[1]));}catch{return res.status(503).json({error:'OAuth unavailable'});}}
 if(!auth){challenge(res);return res.status(401).json({error:'OAuth required'});}
 const {jsonrpc,id,method,params}=req.body||{};
 if(jsonrpc!=='2.0')return res.status(400).json({error:'Invalid JSON-RPC'});
 if(method==='initialize')return res.status(200).json({jsonrpc:'2.0',id,result:{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'elah-cloudflare',version:'1.0.0'}}});
 if(method==='tools/list')return res.status(200).json({jsonrpc:'2.0',id,result:{tools:[tool]}});
 if(method!=='tools/call'||params?.name!==name)return res.status(200).json({jsonrpc:'2.0',id,error:{code:-32601,message:'Unknown method'}});
 try{return res.status(200).json(json(id,await run(params.arguments||{})));}
 catch(e){return res.status(200).json(json(id,{status:'error',message:e.message},true));}
}
