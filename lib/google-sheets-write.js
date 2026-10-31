import {createSign} from 'node:crypto';
const SHEET_ID='1YqRrJhYFUnqyunE9Cp-qkh1y9HvjVtZsCQ70i7pxBME';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
function encode(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}
async function accessToken(){
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!email||!key){const e=Error('Google Sheets write credentials not configured');e.status=503;throw e;}
 const now=Math.floor(Date.now()/1000);
 const claim={iss:email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:GOOGLE_TOKEN,iat:now,exp:now+3600};
 const raw=encode({alg:'RS256',typ:'JWT'})+'.'+encode(claim);
 const signer=createSign('RSA-SHA256');signer.update(raw);signer.end();
 const assertion=raw+'.'+signer.sign(key).toString('base64url');
 const response=await fetch(GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Object.assign(Error('Google OAuth token unavailable'),{status:503});
 const payload=await response.json();
 if(!payload.access_token)throw Object.assign(Error('Google OAuth token missing'),{status:503});
 return payload.access_token;
}
async function google(token,method,range,body){
 const url='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'/values/'+encodeURIComponent(range)+(method==='GET'?'?valueRenderOption=UNFORMATTED_VALUE':'?valueInputOption=USER_ENTERED');
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Object.assign(Error('Google Sheets request rejected: '+r.status),{status:r.status===403?503:502});
 return r.json();
}
export async function updateMasterStock(reference,changes){
 const token=await accessToken();
 const sheet=await google(token,'GET',"'Inventario'!A4:H992");
 const matches=[];
 for(let i=0;i<(sheet.values||[]).length;i++)if(String(sheet.values[i]?.[0]||'').trim().toUpperCase()===reference)matches.push(i+4);
 if(matches.length!==1)throw Object.assign(Error('Reference not found uniquely in master inventory'),{status:409});
 const row=matches[0],updates=[];
 if(Object.hasOwn(changes,'size'))updates.push({range:"'Inventario'!D"+row,values:[[changes.size]]});
 if(Object.hasOwn(changes,'priceUSD'))updates.push({range:"'Inventario'!E"+row,values:[[changes.priceUSD]]});
 if(Object.hasOwn(changes,'stock'))updates.push({range:"'Inventario'!G"+row,values:[[changes.stock]]});
 const endpoint='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'/values:batchUpdate';
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'USER_ENTERED',data:updates}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Object.assign(Error('Google Sheets write failed: '+response.status),{status:502});
 const result=await response.json();
 if(result.totalUpdatedCells!==updates.length)throw Object.assign(Error('Unexpected updated cell count'),{status:502});
 const verify=await google(token,'GET',"'Inventario'!A"+row+":H"+row);
 const values=verify.values?.[0];
 if(!values||String(values[0]).trim().toUpperCase()!==reference)throw Object.assign(Error('Post-write verification failed'),{status:502});
 if(Object.hasOwn(changes,'size')&&String(values[3])!==changes.size||Object.hasOwn(changes,'priceUSD')&&Number(values[4])!==changes.priceUSD||Object.hasOwn(changes,'stock')&&Number(values[6])!==changes.stock)throw Object.assign(Error('Post-write values differ'),{status:502});
 return {reference,row,changes,verified:true};
}
