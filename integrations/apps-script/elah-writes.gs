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
