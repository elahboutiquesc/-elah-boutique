import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../integrations/apps-script/elah-writes.gs',import.meta.url),'utf8');
const product={reference:'ELAH-JN055',name:'Jean cargo azul',category:'Pantalones',size:'3 · 5',priceUSD:30,stock:2};
function setup(){
 const rows=[['title'],['USD',3300],['Referencia']];let writes=0;
 const sheet={getLastRow:()=>rows.length,getMaxRows:()=>1000,getRange:(start,col,count=1,width=1)=>({getValues:()=>Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>rows[start+i-1]?.[col+j-1]??'')),setValues(values){writes++;values.forEach((r,i)=>{rows[start+i-1]=r.slice()});}})};
 const ctx=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-only'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}});
 vm.runInContext(source,ctx);
 return {call:d=>JSON.parse(JSON.stringify(ctx.doPost({postData:{contents:JSON.stringify(d)}}))),rows,writes:()=>writes};
}
test('authentication and full batch validation happen before any write',()=>{
 const s=setup();assert.equal(s.call({action:'create',product,dryRun:false}).error,'UNAUTHORIZED');
 assert.equal(s.call({token:'test-only',action:'bulk_create',products:[product,product],dryRun:false}).error,'DUPLICATE_BATCH_REFERENCE');
 assert.equal(s.call({token:'test-only',action:'bulk_create',products:[product,{...product,reference:'ELAH-JN056',stock:-1}],dryRun:false}).error,'INVALID_STOCK');
 assert.equal(s.writes(),0);
});
test('dry run defaults to no writes; committed retry does not duplicate products',()=>{
 const s=setup();const payload={token:'test-only',action:'create',product};
 assert.equal(s.call(payload).dryRun,true);assert.equal(s.writes(),0);
 assert.equal(s.call({...payload,dryRun:false}).verified,true);assert.equal(s.writes(),1);
 assert.equal(s.rows[3][5],'=E4*$B$2');assert.equal(s.rows[1][1],3300);
 assert.equal(s.call({...payload,dryRun:false}).createdCount,0);assert.equal(s.writes(),1);
 assert.equal(s.call({...payload,product:{...product,priceUSD:99},dryRun:false}).error,'REFERENCE_ALREADY_EXISTS');assert.equal(s.writes(),1);
});
test('batch creation verifies all new products and rejects formula injection',()=>{
 const s=setup();const payload={token:'test-only',action:'bulk_create',products:[product,{...product,reference:'ELAH-JN056'}],dryRun:false};
 assert.equal(s.call(payload).createdCount,2);assert.equal(s.rows.length,5);
 assert.equal(s.call({...payload,products:[{...product,reference:'ELAH-JN057',name:'=IMPORTXML("x")'}]}).error,'INVALID_NAME');assert.equal(s.writes(),1);
});
