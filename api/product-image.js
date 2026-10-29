import {validImageUrl, validPublicId, referencePattern} from '../lib/image-record.js';
import catalog from '../productos.json' with { type: 'json' };
import inventoryHandler from './inventory.js';
import { get } from '@vercel/blob';

async function inMasterInventory(ref) {
  let status=200, body;
  await inventoryHandler({method:'GET'},{
    setHeader(){},status(code){status=code;return this},
    json(data){body=data;return this}
  });
  if(status!==200||!body?.ok)throw Error('Inventario maestro no disponible');
  return body.productos.filter(p=>p.referencia===ref).length===1;
}
function deliverImage(req,res,reference,url,revision=''){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'&&req.query.resolve==='1')return res.status(200).json({reference,url,revision});
 return res.redirect(307,url);
}
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 const ref=String(req.query.ref||'').trim().toUpperCase();
 if(!/^ELAH-[A-Z]{2,5}[0-9]{3,5}$/.test(ref))return res.status(404).end();
 const product=catalog.find(p=>p.r===ref);
 let exists=Boolean(product);
 if(!exists){
   try{exists=await inMasterInventory(ref);}catch{return res.status(503).end();}
 }
 if(!exists)return res.status(404).end();
 const token=process.env.BLOB_READ_WRITE_TOKEN;
 if(token){
   try{
     const record=await get('image-registry/'+ref+'.json',{access:'private',token,useCache:false});
     if(record?.statusCode===200&&record.stream){
       const data=await new Response(record.stream).json();
       const url=new URL(data.url);
       if(data.reference===ref&&validImageUrl(data.url,ref)&&validPublicId(data.public_id,ref)){
         return deliverImage(req,res,ref,url.toString(),data.updatedAt||'');
       }
     }
   }catch{}
 }
 const cloud='https://res.cloudinary.com/bl7tzrfk/image/upload/'+encodeURIComponent(ref);
 try{
   const r=await fetch(cloud,{method:'HEAD',signal:AbortSignal.timeout(5000)});
   if(r.ok)return deliverImage(req,res,ref,cloud,r.headers?.get('etag')||r.headers?.get('last-modified')||'');
 }catch{}
 if(product?.img && !product.img.startsWith('/api/product-image')){
   return deliverImage(req,res,ref,product.img);
 }
 res.setHeader('Cache-Control','no-store');
 return res.status(404).end();
}
