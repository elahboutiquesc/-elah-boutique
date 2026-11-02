// CI only. Never print secret values or subprocess output on failure.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Este paso se ejecuta solo en GitHub Actions.');
const run=(args,input)=>execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:2_000_000});
try{
 const names=new Set(JSON.parse(run(['secret','list','--format','json'])).map(row=>row.name));
 if(!names.has('ELAH_ADMIN_TOKEN')){
  const value=process.env.ELAH_ADMIN_TOKEN||randomBytes(48).toString('base64url');
  console.log('::add-mask::'+value);
  run(['secret','put','ELAH_ADMIN_TOKEN'],value+'\n');
  console.log('Credencial administrativa inicial configurada.');
 }else console.log('Credencial administrativa existente conservada.');
 for(const name of ['ELAH_APPS_SCRIPT_WRITE_URL','ELAH_APPS_SCRIPT_WRITE_TOKEN']){
  if(process.env[name]){run(['secret','put',name],process.env[name]+'\n');console.log(name+' configurado.');}
  else if(!names.has(name))console.log(name+' pendiente: la lectura del inventario sigue disponible.');
 }
}catch{throw Error('No se pudo configurar las credenciales del Worker. Revisa los permisos del token en Cloudflare; no compartas su valor.');}
