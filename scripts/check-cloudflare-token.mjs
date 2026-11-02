import {appendFileSync} from 'node:fs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Solo GitHub Actions.');
const token=process.env.CLOUDFLARE_API_TOKEN?.trim();
if(!token||!/^[A-Za-z0-9_-]{20,512}$/.test(token))throw Error('Actualiza CLOUDFLARE_API_TOKEN en GitHub con solo el token de Cloudflare, sin nombre, comillas ni comandos. No compartas su valor.');
console.log('::add-mask::'+token);
appendFileSync(process.env.GITHUB_ENV,'CLOUDFLARE_API_TOKEN='+token+'\n');
console.log('Formato de credencial válido; se retiraron espacios exteriores si existían.');
