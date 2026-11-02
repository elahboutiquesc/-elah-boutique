// Create SQL only: no uploads, no remote writes and no credentials.
// Optionally pass a verified export {images:[...],content:[...]} as argv[2].
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {validImageUrl,validPublicId,referencePattern} from '../lib/image-record.js';
const root=new URL('../',import.meta.url);
const overrides=JSON.parse(await readFile(new URL('image-overrides.json',root),'utf8'));
const exported=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):{};
const images=new Map(Object.entries(overrides).map(([reference,value])=>[reference,{...value,reference}]));
for(const row of exported.images||[])images.set(row.reference,row);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const statements=[];
function insert(key,value){statements.push(`INSERT OR IGNORE INTO records(key,value,revision) VALUES (${quote(key)},${quote(JSON.stringify(value))},${quote(randomUUID())});`);}
for(const [reference,row] of images){
 if(!referencePattern.test(reference)||!validImageUrl(row.url,reference)||!validPublicId(row.public_id,reference))throw Error('Invalid photo record: '+reference);
 insert('image-registry/'+reference+'.json',row);
}
for(const row of exported.content||[]){
 if(!referencePattern.test(row.reference)||!row.changes||Object.keys(row.changes).some(k=>!['name','description','category'].includes(k))||Object.values(row.changes).some(v=>typeof v!=='string'||v.length>500))throw Error('Invalid editorial record');
 insert('content-overrides/'+row.reference+'.json',row);
}
await mkdir(new URL('work/',root),{recursive:true});
await writeFile(new URL('work/cloudflare-records.sql',root),statements.join('\n')+'\n');
console.log(JSON.stringify({images:images.size,editorial:(exported.content||[]).length,output:'work/cloudflare-records.sql',completeExportProvided:Boolean(process.argv[2]),note:'Existing OAuth sessions are deliberately not migrated; reconnect on the new origin.'}));
