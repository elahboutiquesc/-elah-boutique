import {timingSafeEqual} from 'node:crypto';

// New inventory references must be allocated atomically by the authoritative
// Google Apps Script, never inferred or written to a local/static catalog.
export const config={api:{bodyParser:{sizeLimit:'12kb'}}};
const prefix={Pantalones:'JN',Blusas:'BL',Accesorios:'AC',Chaquetas:'CH',Pijamas:'PJ',Vestidos:'VE','Ropa deportiva':'RD',Esmaltes:'ES','Trajes de baño':'TB'};
function authorized(req){
 const raw=String(req.headers.authorization||'').match(/^Bearer (\S+)$/i)?.[1]||'';
 const expected=process.env.ELAH_ADMIN_TOKEN||'';
 const a=Buffer.from(raw),b=Buffer.from(expected);
 return !!expected&&a.length===b.length&&timingSafeEqual(a,b);
}
export async function createProduct(product){
 const url=process.env.ELAH_APPS_SCRIPT_CREATE_URL;
 const token=process.env.ELAH_APPS_SCRIPT_CREATE_TOKEN;
 if(!url||!token)throw Object.assign(Error('Alta de productos sin configurar en Apps Script'),{status:503});
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||endpoint.hostname!=='script.google.com'||!endpoint.pathname.startsWith('/macros/s/'))throw Object.assign(Error('Endpoint de alta inválido'),{status:503});
 const category=String(product?.category||'').trim(), description=String(product?.description||'').trim();
 const sizes=product?.sizes, priceUSD=product?.priceUSD;
 if(!prefix[category]||description.length<3||description.length>180||!Array.isArray(sizes)||sizes.length<1||sizes.length>30||sizes.some(s=>typeof s!=='string'||!s.trim()||s.length>20)||new Set(sizes.map(s=>s.trim())).size!==sizes.length||!Number.isFinite(priceUSD)||priceUSD<0||priceUSD>100000)throw Object.assign(Error('Datos del producto inválidos'),{status:400});
 const normalized={category,description,sizes:sizes.map(s=>s.trim()),priceUSD,stock:sizes.length,referencePrefix:prefix[category],state:'DISPONIBLE'};
 // Only the server-side Apps Script may reserve/allocate the next unused reference
 // with LockService and insert exactly once in master + category tabs.
 // The write contract requires idempotency and formula-safe insertion.
 const requestId=String(product.requestId||'');
 if(!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))throw Object.assign(Error('Se requiere requestId estable para evitar duplicados'),{status:400});
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'create_product',token,requestId,product:normalized}),redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Object.assign(Error('Servicio de alta de Google Sheets no disponible'),{status:502});
 const result=await response.json();
 if(!result?.ok||result?.verified!==true||!result?.created||!new RegExp('^ELAH-'+prefix[category]+'[0-9]{3,5}$').test(result.reference||'')||result.stock!==sizes.length)throw Object.assign(Error('El alta no está confirmada; revisar el estado del requestId antes de reintentar'),{status:502});
 return {reference:result.reference,category,description,sizes,priceUSD,stock:sizes.length,verified:true};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'Use POST'});
 if(!authorized(req))return res.status(401).json({ok:false,error:'Unauthorized'});
 if(req.headers.origin&&req.headers.origin!=='https://elah-boutique.vercel.app')return res.status(403).json({ok:false,error:'Origin not permitted'});
 try{return res.status(201).json({ok:true,...await createProduct(req.body)});}
 catch(e){return res.status(e.status||503).json({ok:false,error:e.message});}
}
