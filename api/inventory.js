export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  try{
    const url='https://script.google.com/macros/s/AKfycbz-AzMiXKRmhFVlhWs3CtowNI_bL1T5Oi0VuQNhxMErgOTaP1uS6Sn42SQwvRmwQVCD/exec?_='+Date.now();
    const r=await fetch(url,{redirect:'follow',cache:'no-store'});
    if(!r.ok) return res.status(502).json({ok:false,error:'Google inventory '+r.status});
    const data=await r.json();
    return res.status(200).json(data);
  }catch(e){return res.status(500).json({ok:false,error:String(e.message||e)})}
}
