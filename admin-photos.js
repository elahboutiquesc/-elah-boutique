'use strict';
const records=[],el=id=>document.getElementById(id);
let csrf=null;
async function checkSession(){
 try{
  const r=await fetch('/admin/session',{cache:'no-store'});
  if(!r.ok)throw Error();const session=await r.json();csrf=session.authenticated?session.csrf:null;
  el('upload').disabled=!csrf;el('logout').hidden=!csrf;el('login').hidden=Boolean(csrf);
  el('sessionStatus').textContent=csrf?'Sesión administrativa activa.':'Inicia sesión para publicar fotografías.';
 }catch{csrf=null;el('upload').disabled=true;el('sessionStatus').textContent='No se pudo comprobar el acceso. Recarga la página.';}
}
async function adminWrite(path,body){
 if(!csrf)throw Error('Inicia sesión como administrador.');
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
 const result=await r.json();
 if(r.status===401||r.status===403){csrf=null;await checkSession();throw Error('La sesión caducó o no permite esta operación. Vuelve a iniciar sesión.');}
 return {response:r,data:result};
}
function resultItem(ref,name,url,message){
 const item=document.createElement('div');item.className='item';
 const text=document.createElement('p');text.textContent=ref+' — '+name+': '+message;item.append(text);
 if(url){const link=document.createElement('a');link.href=url;link.textContent='Ver imagen en Cloudinary';link.target='_blank';link.rel='noopener noreferrer';item.append(link);}
 el('results').prepend(item);return item;
}
el('logout').onclick=async()=>{
 try{const r=await adminWrite('/admin/logout',{});if(!r.response.ok)throw Error('No se pudo cerrar la sesión. Reintenta.');csrf=null;await checkSession();}catch(e){el('sessionStatus').textContent=e.message;}
};
el('upload').onclick=async()=>{
 const ref=el('ref').value.trim().toUpperCase(),files=[...el('files').files];
 if(!/^ELAH-[A-Z]{2,3}[0-9]{3,}$/.test(ref)){el('status').textContent='Escribe una referencia existente válida.';return;}
 if(!csrf){el('status').textContent='Inicia sesión como administrador.';return;}
 if(!files.length){el('status').textContent='Selecciona una fotografía.';return;}
 el('upload').disabled=true;el('progress').hidden=false;let success=0;
 try{
  for(let i=0;i<files.length;i++){
   const f=files[i];
   try{
    if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>3_500_000)throw Error('Selecciona JPG, PNG o WebP de hasta 3,5 MB.');
    el('status').textContent='Publicando '+(i+1)+' de '+files.length;
    const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('No se pudo leer la fotografía'));reader.readAsDataURL(f);});
    const {response,data}=await adminWrite('/api/upload-product-image',{reference:ref,image,mime:f.type});
    if(data.status==='registration_pending'&&data.recovery?.body){
     const item=resultItem(ref,f.name,data.url,'La foto está guardada; falta vincularla al catálogo.');
     const retry=document.createElement('button');retry.textContent='Reintentar vinculación';
     retry.onclick=async()=>{retry.disabled=true;try{const recovered=await adminWrite('/api/image-registry',data.recovery.body);if(!recovered.response.ok)throw Error('No se pudo vincular. Reintenta más tarde.');retry.remove();item.querySelector('p').textContent=ref+' — '+f.name+': Fotografía vinculada.';}catch(e){retry.disabled=false;el('status').textContent=e.message;}};item.append(retry);continue;
    }
    if(!response.ok||!data.url)throw Error(data.error||'No se pudo publicar la fotografía.');
    records.push({referencia:ref,archivo:f.name,url:data.url,public_id:data.public_id});success++;
    resultItem(ref,f.name,data.url,'Fotografía vinculada.');
   }catch(e){resultItem(ref,f.name,null,e.message);}
   finally{el('progress').value=Math.round((i+1)*100/files.length);}
  }
  el('status').textContent=success+' de '+files.length+' fotografías vinculadas. Revisa los resultados.';el('export').disabled=!records.length;
 }finally{el('upload').disabled=!csrf;}
};
el('export').onclick=()=>{
 const csv=['referencia,archivo,url,public_id',...records.map(r=>[r.referencia,r.archivo,r.url,r.public_id].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='elah-cloudinary-imagenes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
checkSession();
