import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createProduct,validProduct} from '../lib/create-product.js';
const product={reference:'ELAH-JN055',name:'Jeans azul barrel',category:'Pantalones',size:'3 · 5 · 7 · 9 · 11 · 13',priceUSD:30,stock:6};
test('creation rejects unknown stock, spreadsheet formulas and extra fields before a network call',()=>{
 assert.equal(validProduct(product),true);
 for(const p of [{...product,stock:undefined},{...product,stock:1.5},{...product,name:'=IMPORTXML("x")'},{...product,other:1}])assert.equal(Boolean(validProduct(p)),false);
});
test('creation requires an authenticated, verified Apps Script creation response',async()=>{
 process.env.ELAH_APPS_SCRIPT_WRITE_URL='https://script.google.com/macros/s/test/exec';
 process.env.ELAH_APPS_SCRIPT_WRITE_TOKEN='test-write-token';
 let result={ok:true,verified:true,action:'create_product',reference:product.reference,row:246};
 const m=mock.method(globalThis,'fetch',async(url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.action,'create_product');assert.deepEqual(body.product,product);assert.equal(body.token,'test-write-token');
  return {ok:true,json:async()=>result};
 });
 try{
  assert.equal((await createProduct(product)).verified,true);
  result={ok:true,verified:true,reference:product.reference};await assert.rejects(createProduct(product),/No se confirmó/);
  result={ok:false,error:'REFERENCE_EXISTS'};await assert.rejects(createProduct(product),/ya existe/);
 }finally{m.mock.restore();delete process.env.ELAH_APPS_SCRIPT_WRITE_URL;delete process.env.ELAH_APPS_SCRIPT_WRITE_TOKEN;}
});
function scriptHarness({existing=false,formula=true,authorized=true,busy=false}={}){
 const writes=[];let locked=false;
 const rows=[['ELAH-JN054','Anterior','Pantalones','3',30,99000,5,'DISPONIBLE']];
 if(existing)rows[0][0]=product.reference;
 const formulas={4:formula?'=RC[-1]*R2C2':''};
 const sheet={getLastRow:()=>4,getMaxRows:()=>100,getRange(row,col,count=1,width=1){return {
  getValues:()=>Array.from({length:count},(_,i)=>(rows[row-4+i]||[]).slice(col-1,col-1+width)),
  getFormulasR1C1:()=>Array.from({length:count},(_,i)=>[formulas[row+i]||'']),
  setValues(values){assert.ok(locked);writes.push({row,col,values});for(let i=0;i<values.length;i++){rows[row-4+i]??=[];for(let j=0;j<values[i].length;j++)rows[row-4+i][col-1+j]=values[i][j];}},
  setFormulaR1C1(f){assert.ok(locked);formulas[row]=f;writes.push({row,col,formula:f});}
 };}};
 const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret'})},LockService:{getScriptLock:()=>({tryLock(){locked=!busy;return locked;},releaseLock(){locked=false;}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../integrations/apps-script/elah-writes.gs',import.meta.url),'utf8'),ctx);
 return {run:()=>ctx.doPost({postData:{contents:JSON.stringify({token:authorized?'secret':'wrong',action:'create_product',product})}}),rows,writes,formulas};
}
test('Apps Script authenticates, serializes, preserves existing rows and inherits the COP formula',()=>{
 const h=scriptHarness();const result=h.run();assert.equal(result.verified,true);assert.equal(result.reference,product.reference);assert.equal(result.row,5);
 assert.equal(h.rows[0][0],'ELAH-JN054');assert.equal(h.rows[1][0],product.reference);assert.equal(h.rows[1][6],6);assert.equal(h.formulas[5],'=RC[-1]*R2C2');
});
test('duplicates, unauthorized requests, missing formula and busy lock write nothing',()=>{
 for(const [options,error] of [[{existing:true},'REFERENCE_EXISTS'],[{authorized:false},'UNAUTHORIZED'],[{formula:false},'COP_FORMULA_TEMPLATE_MISSING'],[{busy:true},'BUSY']]){
  const h=scriptHarness(options);assert.equal(h.run().error,error);assert.equal(h.writes.length,0);
 }
});
