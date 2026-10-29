import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await mock.module('@vercel/blob',{namedExports:{get:async()=>null}});
const {default:handler}=await import('../api/product-image.js');
test('photo metadata resolves the current Cloudinary image without caching a stale redirect',async()=>{
 const fetchMock=mock.method(globalThis,'fetch',async()=>({ok:true,headers:new Headers({etag:'new-photo'})}));
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.data=v},redirect(){throw Error('Metadata must not redirect');}};
 try{await handler({method:'GET',query:{ref:'ELAH-AC014',resolve:'1'}},res);}finally{fetchMock.mock.restore();}
 assert.equal(res.code,200);assert.equal(res.data.reference,'ELAH-AC014');assert.equal(res.data.revision,'new-photo');assert.equal(res.headers['Cache-Control'],'no-store');
});
test('a visible card keeps its old image until the new photo loads, then swaps it in place',async()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const source=html.slice(html.indexOf('const elahPhotoChecks='),html.indexOf('let elahPhotoScrollTimer;'));
 let src='https://old.example/photo.jpg';const image={getAttribute:()=>src,set src(v){src=v;}};
 const card={isConnected:true,getBoundingClientRect:()=>({top:100,bottom:300}),querySelector:selector=>selector==='.ref'?{textContent:'ELAH-AC014'}:image};
 const preloads=[];let requests=0;
 const ctx={document:{visibilityState:'visible',querySelectorAll:()=>[card]},window:{innerHeight:800},location:{origin:'https://elah-boutique.vercel.app'},URL,Image:class{constructor(){preloads.push(this)}},data:[{r:'ELAH-AC014'}],elahImageByRef:new Map(),fetch:async()=>{requests++;return {ok:true,json:async()=>({reference:'ELAH-AC014',url:'https://res.cloudinary.com/bl7tzrfk/image/upload/ELAH-AC014',revision:'new'})};}};
 vm.createContext(ctx);vm.runInContext(source,ctx);ctx.refreshProductPhotos();await new Promise(setImmediate);
 assert.equal(src,'https://old.example/photo.jpg');assert.equal(preloads.length,1);preloads[0].onload();
 assert.ok(src.includes('ELAH-AC014'));assert.ok(src.includes('elah_v=new'));assert.equal(card.querySelector('img.productPhoto'),image);
 ctx.refreshProductPhotos();assert.equal(requests,1);
});
