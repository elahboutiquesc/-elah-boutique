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
  if(data.action==='create_product'){
   if(!lock.tryLock(15000))return elahReply_({ok:false,error:'BUSY'});
   return elahReply_(elahCreateProduct_(data.product));
  }
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

// Called only after shared-secret authentication and under the script lock.
function elahCreateProduct_(p){
 const keys=['reference','name','category','size','priceUSD','stock'];
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==6||keys.some(k=>!Object.prototype.hasOwnProperty.call(p,k))||
 !/^ELAH-[A-Z]{2,5}[0-9]{3,5}$/.test(p.reference)||
 ['name','category','size'].some(k=>typeof p[k]!=='string'||!p[k].trim()||p[k].trim()!==p[k]||p[k].length>(k==='size'?60:160)||/^[=+@-]/.test(p[k]))||
 typeof p.priceUSD!=='number'||!isFinite(p.priceUSD)||p.priceUSD<0||p.priceUSD>100000||
 !Number.isInteger(p.stock)||p.stock<0||p.stock>100000)return {ok:false,error:'INVALID_PRODUCT'};
 const sheet=SpreadsheetApp.openById(ELAH_MASTER_SHEET_ID).getSheetByName('Inventario');
 if(!sheet)throw new Error('MASTER_TAB_MISSING');
 const last=sheet.getLastRow();
 const refs=last>=4?sheet.getRange(4,1,last-3,1).getValues():[];
 if(refs.some(r=>String(r[0]).trim().toUpperCase()===p.reference))return {ok:false,error:'REFERENCE_EXISTS',reference:p.reference};
 // Reuse the existing COP formula with relative row references, never a guessed rate.
 const formulas=last>=4?sheet.getRange(4,6,last-3,1).getFormulasR1C1():[];
 const formula=formulas.slice().reverse().find(r=>r[0]&&!/ARRAYFORMULA/i.test(r[0]));
 if(!formula)return {ok:false,error:'COP_FORMULA_TEMPLATE_MISSING'};
 const row=Math.max(last+1,4);
 if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
 sheet.getRange(row,1,1,5).setValues([[p.reference,p.name,p.category,p.size,p.priceUSD]]);
 sheet.getRange(row,6).setFormulaR1C1(formula[0]);
 sheet.getRange(row,7,1,2).setValues([[p.stock,p.stock>0?'DISPONIBLE':'AGOTADO']]);
 SpreadsheetApp.flush();
 const actual=sheet.getRange(row,1,1,8).getValues()[0];
 if(actual[0]!==p.reference||actual[1]!==p.name||actual[2]!==p.category||actual[3]!==p.size||Number(actual[4])!==p.priceUSD||Number(actual[6])!==p.stock||!sheet.getRange(row,6).getFormulasR1C1()[0][0])throw new Error('VERIFY_FAILED');
 return {ok:true,verified:true,action:'create_product',reference:p.reference,row};
}
