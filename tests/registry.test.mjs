import {test,mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
process.env.ELAH_ADMIN_TOKEN='test-admin';
process.env.BLOB_READ_WRITE_TOKEN='test-blob';
const records=new Map();let failWrite=false,uploads=0;
await mock.module('@vercel/blob',{namedExports:{
 list:async()=>({blobs:[]}),
 put:async(key,value)=>{if(failWrite)throw Error('Offline');records.set(key,value);},
 get:async(key)=>{if(!records.has(key))return null;const bytes=new TextEncoder().encode(records.get(key));return {statusCode:200,stream:new ReadableStream({start(c){for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}})};}
}});
await mock.module('../api/inventory.js',{defaultExport:async(req,res)=>res.status(200).json({ok:true,productos:[{referencia:'ELAH-AC034'}]})});
const {default:registry}=await import('../api/image-registry.js');
const {default:mcp}=await import('../api/mcp.js');
const ref='ELAH-AC034',url='https://res.cloudinary.com/bl7tzrfk/image/upload/'+ref;
const record={reference:ref,url,public_id:ref};
function response(){return {code:200,setHeader(){},status(n){this.code=n;return this},json(data){this.data=data;return this}};}
async function read(){const r=response();await registry({method:'GET',query:{ref}},r);return r;}
async function call(name,args){const r=response();await mcp({method:'POST',headers:{authorization:'Bearer test-admin'},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}},r);return r.data.result;}
beforeEach(()=>{records.clear();failWrite=false;uploads=0;});
test('authenticated registry write and SDK stream read round trip, including split UTF-8',async()=>{
 const r=response();await registry({method:'POST',headers:{authorization:'Bearer test-admin'},body:record},r);assert.equal(r.code,200);
 const saved=JSON.parse(records.get('image-registry/'+ref+'.json'));saved.note='Fotografía ámbar';records.set('image-registry/'+ref+'.json',JSON.stringify(saved));
 const result=await read();assert.equal(result.code,200);assert.equal(result.data.url,url);assert.equal(result.data.note,'Fotografía ámbar');
});
test('missing record is 404; corrupt JSON and mismatched reference fail closed',async()=>{
 assert.equal((await read()).code,404);records.set('image-registry/'+ref+'.json','invalid');assert.equal((await read()).code,500);
 records.set('image-registry/'+ref+'.json',JSON.stringify({...record,reference:'ELAH-AC002'}));assert.equal((await read()).code,500);
});
test('MCP retains recovery data after Blob failure; retry registers and displays without another upload',async()=>{
 const network=mock.method(globalThis,'fetch',async()=>{uploads++;return {ok:true,json:async()=>({secure_url:url,public_id:ref})};});
 let pending;
 try{failWrite=true;const r=await call('publicar_fotografia_en_elah',{reference:ref,image_base64:'YWJj',mime_type:'image/jpeg'});assert.equal(r.isError,true);pending=JSON.parse(r.content[0].text);assert.equal(pending.status,'registration_pending');assert.equal(pending.url,url);assert.equal(uploads,1);
 failWrite=false;const recovered=await call(pending.recovery.tool,pending.recovery.arguments);assert.equal(JSON.parse(recovered.content[0].text).status,'registered');
 await call(pending.recovery.tool,pending.recovery.arguments);assert.equal(records.size,1);assert.equal(uploads,1);
 }finally{network.mock.restore();}
 const loaded=await read();assert.equal(loaded.code,200);
 // Execute the actual frontend resolver and shared-image loader against the
 // recovered API response. It changes the existing image URL, not products.
 let src='old';const image={getAttribute:()=>src,set src(v){src=v;}};
 const card={querySelector:s=>s==='.ref'?{textContent:ref}:image};
 const data=[{r:ref,img:'old',stock:7}];const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const ctx={data,elahImageByRef:new Map(),document:{querySelectorAll:()=>[card]},fetch:async()=>({ok:true,json:async()=>loaded.data})};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function elahResolveImages('),source.indexOf('const elahObserver='))+source.slice(source.indexOf('async function elahLoadSharedImages(){'),source.indexOf('\nelahLoadSharedImages();')),ctx);
 await ctx.elahLoadSharedImages();assert.equal(src,url);assert.equal(data.length,1);assert.equal(data[0].stock,7);
});
test('recovery rejects an unrelated URL without writing',async()=>{const r=await call('recuperar_registro_fotografia',{...record,url:'https://example.com/image.jpg'});assert.equal(r.isError,true);assert.equal(records.size,0);});
test('existing upload API returns recoverable data after registry write failure',async()=>{
 const {default:upload}=await import('../api/upload-product-image.js');
 failWrite=true;const m=mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({secure_url:url,public_id:ref})}));
 const r=response();try{await upload({method:'POST',headers:{authorization:'Bearer test-admin'},body:{reference:ref,image:'YWJj',mime:'image/jpeg'}},r);}finally{m.mock.restore();}
 assert.equal(r.code,503);assert.equal(r.data.status,'registration_pending');assert.equal(r.data.url,url);assert.equal(r.data.recovery.path,'/api/image-registry');
});
