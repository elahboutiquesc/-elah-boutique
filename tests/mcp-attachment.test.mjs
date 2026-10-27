import {test,mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
process.env.ELAH_ADMIN_TOKEN='test-admin';process.env.BLOB_READ_WRITE_TOKEN='test-blob';
let writes=[],events=[],offline=false;
await mock.module('@vercel/blob',{namedExports:{get:async()=>null,list:async()=>{events.push('registry-check');if(offline)throw Error('offline');return {blobs:[]}},put:async(key,value)=>writes.push({key,record:JSON.parse(value)})}});
await mock.module('../api/inventory.js',{defaultExport:async(req,res)=>res.status(200).json({ok:true,productos:[{referencia:'ELAH-AC034',stock:1}]})});
const {default:handler}=await import('../api/mcp.js');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const file={download_url:'https://files.oaiusercontent.com/test?sig=private-test',file_id:'file-test',mime_type:'image/png',file_name:'foto.png'};
beforeEach(()=>{writes=[];events=[];offline=false;});
async function call(method,args){const r={setHeader(){},status(){return this},json(data){this.data=data;return this}};await handler({method:'POST',headers:{authorization:'Bearer test-admin'},body:{jsonrpc:'2.0',id:1,method,params:args}},r);return r.data.result;}
async function publish(args){return call('tools/call',{name:'publicar_fotografia_en_elah',arguments:{reference:'ELAH-AC034',file,...args}});}
test('tool discovery declares the complete ChatGPT file schema on the existing action',async()=>{
 const tools=(await call('tools/list')).tools;const tool=tools.find(t=>t.name==='publicar_fotografia_en_elah');assert.deepEqual(tool._meta['openai/fileParams'],['file']);
 assert.deepEqual(Object.keys(tool.inputSchema.properties.file.properties).sort(),['download_url','file_id','file_name','mime_type']);
 assert.deepEqual(tool.inputSchema.properties.file.required,['download_url','file_id']);assert.equal(tools.filter(t=>t.name==='publicar_fotografia_en_elah').length,1);
});
test('attached image downloads only after preflight and registers under the existing product',async()=>{
 const m=mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).startsWith('https://files.oaiusercontent.com/')){events.push('download');return new Response(Buffer.from(png,'base64'));}
  events.push('upload');assert.equal(options.body.get('file'),'data:image/png;base64,'+png);assert.equal(options.body.get('upload_preset'),'elah_catalogo');assert.equal(options.body.get('public_id'),'ELAH-AC034');return {ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/bl7tzrfk/image/upload/ELAH-AC034',public_id:'ELAH-AC034'})};
 });
 try{const r=await publish();assert.equal(JSON.parse(r.content[0].text).status,'published');assert.deepEqual(events,['registry-check','download','upload']);assert.equal(writes.length,1);assert.equal(writes[0].key,'image-registry/ELAH-AC034.json');assert.ok(!JSON.stringify(writes).includes('private-test'));}finally{m.mock.restore();}
});
test('unknown product, mixed inputs and registry outage cannot download or upload attachments',async()=>{
 const m=mock.method(globalThis,'fetch',async()=>{throw Error('must not fetch')});
 try{for(const args of [{reference:'ELAH-AC99999'},{image_base64:png,mime_type:'image/png'}])assert.equal((await publish(args)).isError,true);
 offline=true;assert.equal((await publish()).isError,true);assert.equal(m.mock.callCount(),0);assert.equal(writes.length,0);}finally{m.mock.restore();}
});
test('expired attachment stops before Cloudinary and Blob writes',async()=>{
 const m=mock.method(globalThis,'fetch',async()=>new Response('',{status:403}));try{const r=await publish();assert.equal(r.isError,true);assert.equal(m.mock.callCount(),1);assert.equal(writes.length,0);assert.ok(!JSON.stringify(r).includes('private-test'));}finally{m.mock.restore();}
});
