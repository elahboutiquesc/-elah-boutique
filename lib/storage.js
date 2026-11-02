import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import * as blob from '@vercel/blob';

// Bind D1 per request, never in mutable global state shared by concurrent requests.
const context = new AsyncLocalStorage();
export const withStorage = (db, task) => context.run(db, task);
export const storageAvailable = () => Boolean(context.getStore() || process.env.BLOB_READ_WRITE_TOKEN);
const database = () => context.getStore();
const checkKey = key => {
 if(typeof key!=='string'||!key||key.length>512)throw Error('invalid_storage_key');
 return key;
};
export async function get(key, options={}) {
 const db=database();if(!db)return blob.get(key,options);
 checkKey(key);
 const row=await db.prepare('SELECT value, revision FROM records WHERE key = ?').bind(key).first();
 if(!row)return null;
 return {statusCode:200,stream:new Response(row.value).body,blob:{pathname:key,etag:row.revision}};
}
export async function put(key, value, options={}) {
 const db=database();if(!db)return blob.put(key,value,options);
 checkKey(key);
 if(typeof value!=='string'||Buffer.byteLength(value)>256_000)throw Error('invalid_record_size');
 // Public media stays in Cloudinary. This store only contains JSON records.
 const parsed=JSON.parse(value),revision=randomUUID();
 const expires=key.startsWith('oauth/')&&Number.isFinite(parsed.expires)?parsed.expires+86400:null;
 let statement;
 if(options.ifMatch){
  statement=db.prepare('UPDATE records SET value = ?, revision = ?, expires_at = ? WHERE key = ? AND revision = ?').bind(value,revision,expires,key,options.ifMatch);
 }else if(options.allowOverwrite){
  statement=db.prepare('INSERT INTO records (key,value,revision,expires_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,revision=excluded.revision,expires_at=excluded.expires_at').bind(key,value,revision,expires);
 }else{
  statement=db.prepare('INSERT OR IGNORE INTO records (key,value,revision,expires_at) VALUES (?,?,?,?)').bind(key,value,revision,expires);
 }
 const result=await statement.run();
 if(result.meta.changes!==1)throw Error('storage_precondition_failed');
 return {pathname:key,etag:revision};
}
export async function list(options={}) {
 const db=database();if(!db)return blob.list(options);
 const prefix=options.prefix||'',cursor=options.cursor||'',limit=Math.min(Math.max(Number(options.limit)||1000,1),1000);
 // Indexed range and keyset pagination; OAuth values are never exposed by public routes.
 const {results}=await db.prepare('SELECT key,value FROM records WHERE key >= ? AND key < ? AND key > ? ORDER BY key LIMIT ?').bind(prefix,prefix+'\uffff',cursor,limit+1).all();
 const hasMore=results.length>limit,rows=results.slice(0,limit);
 return {blobs:rows.map(row=>({pathname:row.key,record:JSON.parse(row.value)})),hasMore,cursor:hasMore?rows.at(-1).key:undefined};
}
