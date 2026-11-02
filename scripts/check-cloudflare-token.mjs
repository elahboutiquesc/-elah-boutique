import {appendFileSync} from 'node:fs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Solo GitHub Actions.');
const token=process.env.CLOUDFLARE_API_TOKEN?.trim();
if(token==='15ec841931f6312fb82fdf863bb10d9a')throw Error('El secreto contiene el ACCOUNT ID, no el API token. Copia el valor del token desde Cloudflare y actualiza este secreto.');
if(!token||!/^[A-Za-z0-9_-]{20,512}$/.test(token))throw Error('Actualiza CLOUDFLARE_API_TOKEN en GitHub con solo el token de Cloudflare, sin nombre, comillas ni comandos. No compartas su valor.');
console.log('::add-mask::'+token);
appendFileSync(process.env.GITHUB_ENV,'CLOUDFLARE_API_TOKEN='+token+'\n');
console.log('Formato de credencial válido; se retiraron espacios exteriores si existían.');
