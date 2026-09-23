export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  try{
    const url='https://script.google.com/macros/s/AKfycbz-AzMiXKRmhFVlhWs3CtowNI_bL1T5Oi0VuQNhxMErgOTaP1uS6Sn42SQwvRmwQVCD/exec?_='+Date.now();
    const r=await fetch(url,{redirect:'follow',cache:'no-store'});
    if(!r.ok) return res.status(502).json({ok:false,error:'Google inventory '+r.status});
    const data=await r.json();
    if(data&&Array.isArray(data.productos)){
      const ref='ELAH-JN018';
      const i=data.productos.findIndex(v=>String(v.referencia||'').trim().toUpperCase()===ref);
      const patch={referencia:ref,talla:'5-7-9',stock:4,stockPorTalla:{'5':1,'7':1,'9':2},estado:'DISPONIBLE',precioUSD:28,precioCOP:92400};
      if(i>=0) data.productos[i]={...data.productos[i],...patch};
      else data.productos.push(patch);
    }
    return res.status(200).json(data);
  }catch(e){return res.status(500).json({ok:false,error:String(e.message||e)})}
}
