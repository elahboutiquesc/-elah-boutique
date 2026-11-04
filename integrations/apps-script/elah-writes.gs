/*
 ELAH inventory write extension for the EXISTING Google Apps Script.
 Paste these functions alongside the existing doGet, without deleting doGet.
 Script properties (Project settings > Script properties):
   ELAH_WRITE_TOKEN = long random shared secret (same value stored securely in Vercel)
 Set the web app deployment to execute as the spreadsheet owner.
 Do NOT share script secret in ChatGPT.
*/
const ELAH_MASTER_SHEET_ID='1YqRrJhYFUnqyunE9Cp-qkh1y9HvjVtZsCQ70i7pxBME';
function elahReply_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function elahRow_(sheet,reference){
 const last=sheet.getLastRow();
 if(last<4)return null;
 const refs=sheet.getRange(4,1,last-3,1).getValues();
 const matches=[];
 refs.forEach((r,i)=>{if(String(r[0]).trim().toUpperCase()===reference)matches.push(i+4);});
 if(matches.length!==1)throw new Error('REFERENCE_NOT_UNIQUE');
 return matches[0];
}
function doPost(e){
 const lock=LockService.getScriptLock();
 try{
  const data=JSON.parse(e.postData&&e.postData.contents||'{}');
  const configured=PropertiesService.getScriptProperties().getProperty('ELAH_WRITE_TOKEN');
  if(!configured||typeof data.token!=='string'||data.token!==configured)return elahReply_({ok:false,error:'UNAUTHORIZED'});
  if(data.action==='capabilities')return elahReply_({ok:true,version:2,actions:['update','create','bulk_create'],maxBatch:50});
  if(data.action==='create'||data.action==='bulk_create')return elahCreate_(data,lock);
  if(data.action&&data.action!=='update')return elahReply_({ok:false,error:'INVALID_ACTION'});
  const reference=String(data.reference||'').trim().toUpperCase();
  if(!/^ELAH-[A-Z]{2,5}[0-9]{3,5}$/.test(reference))return elahReply_({ok:false,error:'INVALID_REFERENCE'});
  const changes=data.changes;
  if(!changes||typeof changes!=='object'||Array.isArray(changes))return elahReply_({ok:false,error:'INVALID_CHANGES'});
  const keys=Object.keys(changes);
  if(!keys.length||keys.some(k=>!['priceUSD','size','stock'].includes(k)))return elahReply_({ok:false,error:'INVALID_FIELDS'});
  if('priceUSD' in changes&&!(typeof changes.priceUSD==='number'&&isFinite(changes.priceUSD)&&changes.priceUSD>=0&&changes.priceUSD<=100000))return elahReply_({ok:false,error:'INVALID_PRICE'});
  if('stock' in changes&&!(Number.isInteger(changes.stock)&&changes.stock>=0&&changes.stock<=100000))return elahReply_({ok:false,error:'INVALID_STOCK'});
  if('size' in changes&&!(typeof changes.size==='string'&&changes.size.trim()&&changes.size.length<=60))return elahReply_({ok:false,error:'INVALID_SIZE'});
  if(!lock.tryLock(15000))return elahReply_({ok:false,error:'BUSY'});
  const sheet=SpreadsheetApp.openById(ELAH_MASTER_SHEET_ID).getSheetByName('Inventario');
  if(!sheet)throw new Error('MASTER_TAB_MISSING');
  const row=elahRow_(sheet,reference);
  if(!row)return elahReply_({ok:false,error:'REFERENCE_NOT_FOUND'});
  const old={size:String(sheet.getRange(row,4).getValue()),priceUSD:Number(sheet.getRange(row,5).getValue()),stock:Number(sheet.getRange(row,7).getValue())};
  // Optimistic concurrency: expected state required, even for dry runs.
  const expected=data.expected;
  if(!expected||typeof expected!=='object'||keys.some(k=>String(expected[k])!==String(old[k])))return elahReply_({ok:false,error:'STALE_VALUES',reference,current:old});
  if(data.dryRun!==false)return elahReply_({ok:true,dryRun:true,reference,row,before:old,proposed:changes});
  // Idempotent no-op if values are already identical; avoid touching formulas.
  if('size' in changes&&changes.size!==old.size)sheet.getRange(row,4).setValue(changes.size);
  if('priceUSD' in changes&&changes.priceUSD!==old.priceUSD)sheet.getRange(row,5).setValue(changes.priceUSD);
  if('stock' in changes&&changes.stock!==old.stock)sheet.getRange(row,7).setValue(changes.stock);
  SpreadsheetApp.flush();
  const after={size:String(sheet.getRange(row,4).getValue()),priceUSD:Number(sheet.getRange(row,5).getValue()),stock:Number(sheet.getRange(row,7).getValue())};
  if(keys.some(k=>String(after[k])!==String(changes[k])))throw new Error('VERIFY_FAILED');
  return elahReply_({ok:true,verified:true,reference,row,before:old,after});
 }catch(err){return elahReply_({ok:false,error:String(err.message||'WRITE_FAILED').slice(0,120)});}
 finally{try{lock.releaseLock();}catch(_){}}
}


// Additive product registration. Existing update requests keep their old contract.
// Photos are uploaded separately through the authenticated ELAH photo connector.
function elahCreate_(data,lock){
 const products=data.action==='create'?[data.product]:data.products;
 if(!Array.isArray(products)||!products.length||products.length>50)throw new Error('INVALID_BATCH');
 const seen={};
 products.forEach(function(p){
  if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('INVALID_PRODUCT');
  if(Object.keys(p).some(function(k){return ['reference','name','category','size','priceUSD','stock'].indexOf(k)<0;}))throw new Error('INVALID_FIELDS');
  if(typeof p.reference!=='string'||!/^ELAH-[A-Z]{2,5}[0-9]{3,5}$/.test(p.reference))throw new Error('INVALID_REFERENCE');
  if(seen[p.reference])throw new Error('DUPLICATE_BATCH_REFERENCE');
  seen[p.reference]=true;
  ['name','category','size'].forEach(function(k){
   if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>(k==='name'?200:60)||/^[=+@-]/.test(p[k].trim()))throw new Error('INVALID_'+k.toUpperCase());
  });
  if(typeof p.priceUSD!=='number'||!isFinite(p.priceUSD)||p.priceUSD<0||p.priceUSD>100000)throw new Error('INVALID_PRICE');
  if(!Number.isInteger(p.stock)||p.stock<0||p.stock>100000)throw new Error('INVALID_STOCK');
 });
 if(!lock.tryLock(15000))return elahReply_({ok:false,error:'BUSY'});
 const sheet=SpreadsheetApp.openById(ELAH_MASTER_SHEET_ID).getSheetByName('Inventario');
 if(!sheet)throw new Error('MASTER_TAB_MISSING');
 const last=sheet.getLastRow();
 const values=last>=4?sheet.getRange(4,1,last-3,9).getValues():[];
 const existing={};
 values.forEach(function(row,i){
  const ref=String(row[0]).trim().toUpperCase();
  if(!ref)return;
  if(existing[ref])throw new Error('REFERENCE_NOT_UNIQUE');
  existing[ref]={row:i+4,values:row};
 });
 const pending=[];const results=[];
 products.forEach(function(p){
  const ex=existing[p.reference];
  if(ex){
   const r=ex.values;
   if(String(r[1])!==p.name||String(r[2])!==p.category||String(r[3])!==p.size||Number(r[4])!==p.priceUSD||Number(r[6])!==p.stock)throw new Error('REFERENCE_ALREADY_EXISTS');
   results.push({reference:p.reference,row:ex.row,status:'already_exists'});
  }else pending.push(p);
 });
 if(data.dryRun!==false)return elahReply_({ok:true,dryRun:true,createCount:pending.length,existingCount:results.length,products:products});
 // Append after every occupied row. Never overwrite an existing cell or formula.
 const start=Math.max(4,last+1);
 if(pending.length){
  const end=start+pending.length-1;
  if(end>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),end-sheet.getMaxRows());
  const rows=pending.map(function(p,i){
   const row=start+i;
   return [p.reference,p.name,p.category,p.size,p.priceUSD,'=E'+row+'*$B$2',p.stock,'=IF(G'+row+'>0,"DISPONIBLE","AGOTADO")','https://elah-boutique.vercel.app/api/product-image?ref='+encodeURIComponent(p.reference)];
  });
  sheet.getRange(start,1,rows.length,9).setValues(rows);
  SpreadsheetApp.flush();
  const readback=sheet.getRange(start,1,rows.length,9).getValues();
  pending.forEach(function(p,i){
   const r=readback[i];
   if(r[0]!==p.reference||r[1]!==p.name||r[2]!==p.category||r[3]!==p.size||Number(r[4])!==p.priceUSD||Number(r[6])!==p.stock)throw new Error('VERIFY_FAILED');
   results.push({reference:p.reference,row:start+i,status:'created'});
  });
 }
 return elahReply_({ok:true,verified:true,dryRun:false,createdCount:pending.length,products:results});
}
