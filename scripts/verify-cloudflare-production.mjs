const base='https://elah-boutique.elahboutique-sc.workers.dev';
for(const [path,expected] of [['/',200],['/.well-known/oauth-authorization-server',200],['/admin/session',200],['/admin/login',200],['/api/image-registry?ref=ALL&records=1',200],['/api/mcp',401]]){
 const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 if(r.status!==expected)throw Error(path+' HTTP '+r.status+'; esperado '+expected);
 if(path==='/'){if(!(await r.text()).includes('ELAH Boutique'))throw Error('El catálogo no fue publicado.');}
 if(path.includes('well-known')){if((await r.json()).issuer!==base)throw Error('OAuth usa un origen incorrecto.');}
 if(path==='/admin/login'&&!r.headers.get('set-cookie')?.includes('Secure; HttpOnly'))throw Error('Sesión administrativa no disponible.');
 console.log(path+' HTTP '+r.status+' OK');
}
console.log('Sitio y autorización disponibles. Falta auditoría de registros anteriores y aprobación OAuth del titular; no se cargaron imágenes.');
