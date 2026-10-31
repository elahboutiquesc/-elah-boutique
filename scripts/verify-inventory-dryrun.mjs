// Run with: node --env-file=.env.local scripts/verify-inventory-dryrun.mjs
// .env.local is downloaded via Vercel CLI and MUST NOT be committed.
const base='https://elah-boutique.vercel.app';
const token=process.env.ELAH_ADMIN_TOKEN;
if(!token)throw Error('ELAH_ADMIN_TOKEN missing in local environment');
const reference='ELAH-BL015';
async function read(){
 const res=await fetch(base+'/api/inventory',{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('Inventory GET failed with HTTP '+res.status);
 const data=await res.json();
 if(!data.ok||!Array.isArray(data.productos))throw Error('Inventory payload invalid');
 const found=data.productos.filter(p=>p.referencia===reference);
 if(found.length!==1)throw Error('Reference absent or duplicated');
 const p=found[0];
 return {reference,stock:Number(p.stock),size:String(p.talla),priceUSD:Number(p.precioUSD)};
}
const before=await read();
if(!Number.isInteger(before.stock)||before.stock<0)throw Error('Stock invalid');
const request={reference,changes:{stock:before.stock},expected:{stock:before.stock},dryRun:true};
const response=await fetch(base+'/api/inventory-update',{
 method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify(request),cache:'no-store',signal:AbortSignal.timeout(25000)
});
const payload=await response.json().catch(()=>({}));
if(!response.ok||payload.ok!==true||payload.dryRun!==true||payload.reference!==reference)
 throw Error('Dry run failed: HTTP '+response.status+'; code='+(payload.error||'invalid-response'));
const after=await read();
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Inventory changed unexpectedly!');
console.log('PASS: Authorized dryRun confirmed. Inventory unchanged for '+reference+'.');
