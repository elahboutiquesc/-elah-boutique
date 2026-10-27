import {test, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
// Synthetic credentials exist only inside this test process.
process.env.ELAH_ADMIN_TOKEN='test-admin';
let calls=[], registryFailure=false, writeFailure=false, cloudId='ELAH-AC034';
await mock.module('@vercel/blob',{namedExports:{
 get:async()=>null,
 list:async()=>{calls.push('registry-read');if(registryFailure)throw Error('Registry unavailable');return {blobs:[]};},
 put:async()=>{calls.push('registry-write');if(writeFailure)throw Error('Registry write failed');}
}});
await mock.module('../api/inventory.js',{defaultExport:async(req,res)=>res.status(200).json({ok:true,productos:[{referencia:'ELAH-AC034'}]})});
const {default:handler}=await import('../api/mcp.js');
beforeEach(()=>{calls=[];registryFailure=false;writeFailure=false;cloudId='ELAH-AC034';process.env.BLOB_READ_WRITE_TOKEN='test-blob';});
async function invoke(reference='ELAH-AC034'){
 const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
 const mocked=mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push('cloud-upload');assert.equal(url,'https://api.cloudinary.com/v1_1/bl7tzrfk/image/upload');
  assert.equal(options.body.get('upload_preset'),'elah_catalogo');assert.equal(options.body.get('public_id'),reference);
  return {ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/bl7tzrfk/image/upload/'+cloudId,public_id:cloudId})};
 });
 try{await handler({method:'POST',headers:{authorization:'Bearer test-admin'},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publicar_fotografia_en_elah',arguments:{reference,image_base64:'YWJj',mime_type:'image/jpeg'}}}},res);return res.data.result;}finally{mocked.mock.restore();}
}
test('missing Blob token prevents any network operation',async()=>{delete process.env.BLOB_READ_WRITE_TOKEN;assert.equal((await invoke()).isError,true);assert.deepEqual(calls,[]);});
test('unavailable registry prevents Cloudinary upload',async()=>{registryFailure=true;assert.equal((await invoke()).isError,true);assert.deepEqual(calls,['registry-read']);});
test('malformed reference prevents any network operation',async()=>{assert.equal((await invoke('invalid')).isError,true);assert.deepEqual(calls,[]);});
test('registry preflight precedes upload and registration',async()=>{const r=await invoke();assert.equal(JSON.parse(r.content[0].text).status,'published');assert.deepEqual(calls,['registry-read','cloud-upload','registry-write']);});
test('unexpected Cloudinary reference is not registered',async()=>{cloudId='ELAH-AC99999';assert.equal((await invoke()).isError,true);assert.deepEqual(calls,['registry-read','cloud-upload']);});
test('write failure never reports publication success',async()=>{writeFailure=true;assert.equal((await invoke()).isError,true);});
test('well-formed but absent inventory reference cannot upload',async()=>{assert.equal((await invoke('ELAH-AC99999')).isError,true);assert.deepEqual(calls,[]);});
