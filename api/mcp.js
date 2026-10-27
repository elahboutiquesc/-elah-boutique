// ELAH Boutique: remote MCP connector (Streamable HTTP, JSON-RPC 2.0).
// Configure ELAH_MCP_KEY separately from ELAH_ADMIN_TOKEN in Vercel.
import { timingSafeEqual } from 'node:crypto';
const tool={name:'publicar_fotografia_en_elah',title:'Publicar fotografía en ELAH',description:'Recibe una fotografía en base64 y la referencia ELAH, la publica en Cloudinary y confirma su registro en el catálogo.',inputSchema:{type:'object',properties:{reference:{type:'string',description:'Referencia, por ejemplo ELAH-AC044'},image_base64:{type:'string',description:'Contenido binario de la fotografía codificado en base64, sin prefijo data:'},mime_type:{type:'string',enum:['image/jpeg','image/png','image/webp']}},required:['reference','image_base64','mime_type'],additionalProperties:false}};
const reply=(id,result)=>({jsonrpc:'2.0',id,result});
const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
function validKey(req){const secret=process.env.ELAH_MCP_KEY||'';const actual=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const a=Buffer.from(actual),b=Buffer.from(secret);return !!secret&&a.length===b.length&&timingSafeEqual(a,b)}
export const config={api:{bodyParser:{sizeLimit:'6mb'}}};
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');
if(req.method==='OPTIONS')return res.status(204).end();
if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
if(!validKey(req))return res.status(401).json({error:'Autorización MCP requerida'});
const {jsonrpc,id,method,params}=req.body||{};
if(jsonrpc!=='2.0'||typeof method!=='string')return res.status(400).json(error(id??null,-32600,'Invalid Request'));
if(method==='notifications/initialized')return res.status(202).end();
if(method==='initialize')return res.status(200).json(reply(id,{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'elah-boutique',version:'1.0.0'}}));
if(method==='ping')return res.status(200).json(reply(id,{}));
if(method==='tools/list')return res.status(200).json(reply(id,{tools:[tool]}));
if(method!=='tools/call')return res.status(200).json(error(id,-32601,'Method not found'));
if(params?.name!==tool.name)return res.status(200).json(error(id,-32602,'Unknown tool'));
const {reference,image_base64,mime_type}=params.arguments||{};
if(!/^ELAH-[A-Z]{2,3}[0-9]{3,}$/.test(reference||'')||!/^image\/(jpeg|png|webp)$/.test(mime_type||'')||typeof image_base64!=='string'||image_base64.length>4_700_000||!/^[A-Za-z0-9+/=]+$/.test(image_base64))return res.status(200).json(reply(id,{isError:true,content:[{type:'text',text:'Imagen o referencia inválida; máximo aproximado 3,5 MB.'}]}));
try{
const form=new FormData();form.append('file','data:'+mime_type+';base64,'+image_base64);form.append('upload_preset','elah_catalogo');form.append('public_id',reference);form.append('context','reference='+reference);
const cloud=await fetch('https://api.cloudinary.com/v1_1/bl7tzrfk/image/upload',{method:'POST',body:form});
const uploaded=await cloud.json();if(!cloud.ok||!uploaded.secure_url)throw Error('Cloudinary: '+(uploaded.error?.message||cloud.status));
const {put}=await import('@vercel/blob');if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('Falta conexión a Vercel Blob');
const record={reference,url:uploaded.secure_url,public_id:uploaded.public_id,updatedAt:new Date().toISOString()};
await put('image-registry/'+reference+'.json',JSON.stringify(record),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,token:process.env.BLOB_READ_WRITE_TOKEN});
return res.status(200).json(reply(id,{content:[{type:'text',text:JSON.stringify({status:'published',...record})}]}));
}catch(e){return res.status(200).json(reply(id,{isError:true,content:[{type:'text',text:'No se confirmó la publicación: '+e.message}]}))}
}