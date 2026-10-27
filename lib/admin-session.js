import {random,hash,equal,fail,browserRequest,ISSUER} from './oauth.js';
import {readState,writeState} from './oauth-store.js';
const COOKIE='__Host-elah_admin';
export function readCookie(req,name) {
 const matches=String(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
 return matches.length===1?matches[0].slice(name.length+1):'';
}
export async function startAdminLogin() {
 const id=random(),session=random();
 await writeState(`request-${id}`,{kind:'browser',status:'pending',session:hash(session),expires:Math.floor(Date.now()/1000)+600});
 return {id,session};
}
export async function completeAdminLogin(id,pending) {
 const stored=await browserRequest(id,pending);
 if(stored.value.kind!=='browser'||stored.value.status!=='approved')fail('access_denied',403);
 await writeState(`request-${id}`,{...stored.value,status:'consumed'},stored.etag);
 const sessionId=random(),secret=random(),csrf=random();
 await writeState(`admin-${sessionId}`,{secret:hash(secret),csrf,subject:stored.value.subject,expires:Math.floor(Date.now()/1000)+3600,revoked:false});
 return `elah_admin.${sessionId}.${secret}`;
}
export async function adminSession(req) {
 const token=readCookie(req,COOKIE),[type,id,secret,...extra]=token.split('.');
 if(type!=='elah_admin'||extra.length||!/^[-_A-Za-z0-9]{43}$/.test(id||'')||!/^[-_A-Za-z0-9]{43}$/.test(secret||''))return null;
 const stored=await readState(`admin-${id}`);
 if(!stored||stored.value.revoked||stored.value.expires<=Math.floor(Date.now()/1000)||!equal(stored.value.secret,hash(secret)))return null;
 return {id,...stored};
}
export function checkBrowserWrite(req,session) {
 if(req.headers.origin!==ISSUER||!equal(req.headers['x-csrf-token'],session.value.csrf))fail('access_denied',403);
}
export async function authorizeAdmin(req) {
 // Existing server-to-server credentials remain supported; cookie credentials
 // cannot silently take over when an invalid Authorization header is supplied.
 if(req.headers.authorization!==undefined) {
  const supplied=String(req.headers.authorization).match(/^Bearer (\S+)$/i)?.[1];
  if(!process.env.ELAH_ADMIN_TOKEN||!equal(supplied,process.env.ELAH_ADMIN_TOKEN))return false;
  return true;
 }
 const session=await adminSession(req);
 if(!session)return false;
 checkBrowserWrite(req,session);
 return true;
}
export async function closeAdminSession(req) {
 const session=await adminSession(req);
 if(!session)fail('access_denied',401);
 checkBrowserWrite(req,session);
 await writeState(`admin-${session.id}`,{...session.value,revoked:true},session.etag);
}
export const adminCookie=token=>`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${token?3600:0}`;
