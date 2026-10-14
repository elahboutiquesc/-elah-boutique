import catalog from '../productos.json' with { type: 'json' };
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 const ref=String(req.query.ref||'').trim().toUpperCase();
 const product=catalog.find(p=>p.r===ref);
 if(!product)return res.status(404).end();
 const cloud='https://res.cloudinary.com/bl7tzrfk/image/upload/'+encodeURIComponent(ref);
 try{
  const r=await fetch(cloud,{method:'HEAD',signal:AbortSignal.timeout(5000)});
  if(r.ok){res.setHeader('Cache-Control','public, max-age=30, s-maxage=30');return res.redirect(307,cloud);}
 }catch{}
 if(product.img){res.setHeader('Cache-Control','public, max-age=15, s-maxage=15');return res.redirect(307,product.img);}
 res.setHeader('Cache-Control','no-store');return res.status(404).end();
}
