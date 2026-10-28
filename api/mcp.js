import {validImageUrl, validPublicId, referencePattern} from '../lib/image-record.js';
import {validateAccess,challenge,SCOPE} from '../lib/oauth.js';
import { readAttachedImage, validAttachment } from '../lib/attached-image.js';
import { requireExistingReference } from '../lib/existing-reference.js';
// ELAH Boutique: remote MCP connector (Streamable HTTP, JSON-RPC 2.0).
// Uses the existing ELAH_ADMIN_TOKEN and unsigned Cloudinary preset.
import { timingSafeEqual } from 'node:crypto';
import registryHandler from './image-registry.js';
const tool = {
 name: 'publicar_fotografia_en_elah',
 title: 'Publicar fotografía en ELAH',
 description: 'Publica una fotografía adjunta JPG, PNG o WebP (hasta 3,5 MB) en una referencia existente de ELAH. Usa file para archivos de la conversación; no inventes enlaces ni referencias. No modifica existencias. Si falta la referencia, solicítala antes de publicar.',
 inputSchema: {
  type: 'object',
  properties: {
   reference: {type: 'string', description: 'Referencia existente exacta del producto, por ejemplo ELAH-AC034'},
   file: {
    type: 'object',
    description: 'Una fotografía adjunta de la conversación.',
    properties: {
     download_url: {type: 'string'},
     file_id: {type: 'string'},
     mime_type: {type: 'string'},
     file_name: {type: 'string'}
    },
    required: ['download_url', 'file_id'],
    additionalProperties: false
   },
   image_base64: {type: 'string', description: 'Compatibilidad con clientes anteriores: imagen en base64, sin prefijo data:. Usar file para adjuntos de ChatGPT.'},
   mime_type: {type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp']}
  },
  required: ['reference'],
  oneOf: [{required: ['file']}, {required: ['image_base64', 'mime_type']}],
  additionalProperties: false
 },
 annotations: {readOnlyHint: false, destructiveHint: true, openWorldHint: true},
 securitySchemes: [{type:'oauth2',scopes:[SCOPE]}],
 _meta: {'openai/fileParams': ['file'],securitySchemes:[{type:'oauth2',scopes:[SCOPE]}]}
};
const recoveryTool={name:'recuperar_registro_fotografia',description:'Registra de nuevo una URL ya subida a Cloudinary sin volver a cargar la fotografía ni modificar inventario.',inputSchema:{type:'object',properties:{reference:{type:'string'},url:{type:'string'},public_id:{type:'string'}},required:['reference','url','public_id'],additionalProperties:false}};
recoveryTool.securitySchemes=[{type:'oauth2',scopes:[SCOPE]}];
recoveryTool._meta={securitySchemes:recoveryTool.securitySchemes};
const reply=(id,result)=>({jsonrpc:'2.0',id,result});
const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
function validKey(req){const secret=process.env.ELAH_ADMIN_TOKEN||'';const actual=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const a=Buffer.from(actual),b=Buffer.from(secret);return !!secret&&a.length===b.length&&timingSafeEqual(a,b)}
export const config={api:{bodyParser:{sizeLimit:'6mb'}}};
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');
if(req.method==='OPTIONS')return res.status(204).end();
let authorized=validKey(req);
if(!authorized){
 try{authorized=Boolean(await validateAccess(String(req.headers.authorization||'').match(/^Bearer (\S+)$/i)?.[1]));}
 catch{return res.status(503).json({error:'Autorización no disponible'});}
}
if(!authorized){challenge(res);return res.status(401).json({error:'Autorización MCP requerida'});}
if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
const {jsonrpc,id,method,params}=req.body||{};
if(jsonrpc!=='2.0'||typeof method!=='string')return res.status(400).json(error(id??null,-32600,'Invalid Request'));
if(method==='notifications/initialized')return res.status(202).end();
if(method==='initialize')return res.status(200).json(reply(id,{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'elah-boutique',version:'1.0.0'}}));
if(method==='ping')return res.status(200).json(reply(id,{}));
if(method==='tools/list')return res.status(200).json(reply(id,{tools:[tool,recoveryTool]}));
if(method!=='tools/call')return res.status(200).json(error(id,-32601,'Method not found'));
if(params?.name===recoveryTool.name){
let code=200,record;
await registryHandler({...req,headers:{...req.headers,authorization:'Bearer '+process.env.ELAH_ADMIN_TOKEN},body:params.arguments||{}},{setHeader(){},status(n){code=n;return this},json(data){record=data;return this}});
const result=code===200?{status:'registered',...record}:{status:'registration_pending',error:'No fue posible recuperar el registro; conserva el enlace y reintenta.'};
return res.status(200).json(reply(id,{...(code!==200?{isError:true}:{}),content:[{type:'text',text:JSON.stringify(result)}]}));
}
if(params?.name!==tool.name)return res.status(200).json(error(id,-32602,'Unknown tool'));
const {reference,image_base64,mime_type,file}=params.arguments||{};
const attached=file!==undefined;
const validInput=attached ? validAttachment(file)&&image_base64===undefined&&mime_type===undefined : /^image\/(jpeg|png|webp)$/.test(mime_type||'')&&typeof image_base64==='string'&&image_base64.length<=4_700_000&&/^[A-Za-z0-9+/=]+$/.test(image_base64);
if(!referencePattern.test(reference||'')||!validInput)return res.status(200).json(reply(id,{isError:true,content:[{type:'text',text:'Adjunta una fotografía JPG, PNG o WebP y una referencia existente; máximo 3,5 MB. No combines adjunto y base64.'}]}));
try{
await requireExistingReference(reference);
const token=process.env.BLOB_READ_WRITE_TOKEN;
if(!token)throw Error('Falta conexión a Vercel Blob');
const {put,list}=await import('@vercel/blob');
// A configured token alone does not prove the registry is reachable. This read
// must succeed before Cloudinary receives any image data; it creates no blobs.
await list({prefix:'image-registry/',limit:1,token});
const image=attached ? await readAttachedImage(file) : {base64:image_base64,mimeType:mime_type};
const form=new FormData();form.append('file','data:'+image.mimeType+';base64,'+image.base64);form.append('upload_preset','elah_catalogo');form.append('public_id',reference);form.append('context','reference='+reference);
const cloud=await fetch('https://api.cloudinary.com/v1_1/bl7tzrfk/image/upload',{method:'POST',body:form});
const uploaded=await cloud.json();if(!cloud.ok||!uploaded.secure_url)throw Error('Cloudinary: '+(uploaded.error?.message||cloud.status));
if(!validPublicId(uploaded.public_id,reference)||!validImageUrl(uploaded.secure_url,reference))throw Error('Cloudinary devolvió una referencia diferente');
const record={reference,url:uploaded.secure_url,public_id:uploaded.public_id,updatedAt:new Date().toISOString()};
try{
await put('image-registry/'+reference+'.json',JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,token});
}catch{
// The image remains in Cloudinary. Return its recovery data to the authenticated
// caller so a retry only writes the same registry key, never uploads again.
return res.status(200).json(reply(id,{isError:true,content:[{type:'text',text:JSON.stringify({status:'registration_pending',...record,recovery:{tool:recoveryTool.name,arguments:{reference,url:record.url,public_id:record.public_id}}})}]}));
}
return res.status(200).json(reply(id,{content:[{type:'text',text:JSON.stringify({status:uploaded.existing?'existing':'published',existing:Boolean(uploaded.existing),...record})}]}));
}catch(e){return res.status(200).json(reply(id,{isError:true,content:[{type:'text',text:'No se confirmó la publicación: '+e.message}]}))}
}