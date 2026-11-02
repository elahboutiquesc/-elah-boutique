import {mkdir,rm,copyFile,cp,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('work/cloudflare-public/',root);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
// Explicit allowlist: never publish API source, secrets, tests or repository metadata.
for(const name of ['index.html','admin-photos.js','cargar-fotos.html','cargar-fotografia.html','cargar-imagenes.html'])await copyFile(new URL(name,root),new URL(name,out));
await cp(new URL('images/',root),new URL('images/',out),{recursive:true});
await writeFile(new URL('_headers',out),`/cargar-fotos.html\n  Cache-Control: no-store\n  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n`);
