export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método no permitido'});
 try{
  const url='https://script.google.com/macros/s/AKfycbz-AzMiXKRmhFVlhWs3CtowNI_bL1T5Oi0VuQNhxMErgOTaP1uS6Sn42SQwvRmwQVCD/exec?_='+Date.now();
  const r=await fetch(url,{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)return res.status(502).json({ok:false,error:'Google inventory '+r.status});
  const data=await r.json();
  if(!data.ok||!Array.isArray(data.productos))return res.status(502).json({ok:false,error:'Inventario inválido'});
  // Google Sheets is the authority for stock, sizes and prices. Never override it with stale catalog constants.
  const byRef=new Map();
  for(const p of data.productos){const referencia=String(p.referencia||'').trim().toUpperCase();if(!/^ELAH-[A-Z]{2,5}\d{3,5}$/.test(referencia))continue;if(byRef.has(referencia))return res.status(409).json({ok:false,error:'Referencia duplicada en inventario: '+referencia});byRef.set(referencia,{...p,referencia,imagen:'/api/product-image?ref='+encodeURIComponent(referencia)});}
  return res.status(200).json({...data,productos:[...byRef.values()]});
 }catch{return res.status(502).json({ok:false,error:'No fue posible consultar el inventario maestro'});}
}
