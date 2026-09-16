import {OWNER_EMAIL,type CMSActor} from './cms-access';
import {readBoundedText,secureHeaders} from './security';

export type CMSAuthEnv={DB:D1Database;CMS_AUTH_SECRET?:string;RESEND_API_KEY?:string;AUTH_EMAIL_FROM?:string};
type CMSUser={id:string;platform_id:string|null;name:string;email:string;role:'superadmin'|'admin'|'editor';status:string;password_hash:string|null;two_factor_secret:string|null;two_factor_enabled:number};
type Challenge={token_hash:string;user_id:string;purpose:'login'|'owner-setup'|'password-reset';code_hash:string|null;expires_at:string;attempts:number};
const encoder=new TextEncoder(),cookieName='__Host-somdas_cms_session',maxBody=16384,sessionSeconds=8*60*60,challengeMinutes=10;
const dummyPasswordHash='pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:secureHeaders({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8',...headers})});
const normalizeEmail=(value:unknown)=>String(value||'').trim().toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
const bytes=(length:number)=>{const out=new Uint8Array(length);crypto.getRandomValues(out);return out;};
const b64=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((value.length+3)%4)),c=>c.charCodeAt(0));
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value),n=>n.toString(16).padStart(2,'0')).join('');
const sha256=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
const cookieValue=(request:Request,name:string)=>{for(const item of (request.headers.get('Cookie')||'').split(';')){const [key,...parts]=item.trim().split('=');if(key===name)return decodeURIComponent(parts.join('='));}return '';};
const setCookie=(token:string)=>`${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionSeconds}`;
const clearCookie=()=>`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
const sameOrigin=(request:Request)=>request.headers.get('Origin')===new URL(request.url).origin;
const maskedEmail=(email:string)=>{const [local,domain]=email.split('@');return `${local.slice(0,2)}${'*'.repeat(Math.max(3,local.length-2))}@${domain}`;};

async function body(request:Request){
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return {response:json({error:'JSON required.'},415)};
 const raw=await readBoundedText(request,maxBody);if(!raw.ok)return {response:json({error:'Request is too large.'},413)};
 try{return {value:JSON.parse(raw.text) as Record<string,unknown>};}catch{return {response:json({error:'Invalid request.'},400)};}
}

export async function hashCMSPassword(password:string){
 const salt=bytes(16),iterations=100000,key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
 return `pbkdf2$${iterations}$${b64(salt)}$${b64(new Uint8Array(result))}`;
}
async function verifyPassword(password:string,stored:string){
 const [method,iterationText,saltText,expected]=stored.split('$'),iterations=Number(iterationText);
 if(method!=='pbkdf2'||!Number.isInteger(iterations)||iterations<100000||!saltText||!expected)return false;
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromB64(saltText),iterations},key,256);
 return safeEqual(b64(new Uint8Array(result)),expected);
}
async function codeHash(code:string,secret:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(code)));}
async function limited(request:Request,db:D1Database,action:string,subject:string,max:number,seconds:number){
 const ip=request.headers.get('cf-connecting-ip')||'unknown',key=`cms:${action}:${await sha256(subject+'|'+ip)}`,now=Math.floor(Date.now()/1000),row=await db.prepare('SELECT attempts,reset_at FROM auth_rate_limits WHERE key=?').bind(key).first<{attempts:number;reset_at:number}>();
 if(row&&row.reset_at>now&&row.attempts>=max)return true;
 if(!row||row.reset_at<=now)await db.prepare('INSERT INTO auth_rate_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=1,reset_at=excluded.reset_at').bind(key,now+seconds).run();else await db.prepare('UPDATE auth_rate_limits SET attempts=attempts+1 WHERE key=?').bind(key).run();return false;
}
async function sendCode(request:Request,env:CMSAuthEnv,user:CMSUser,code:string,purpose:Challenge['purpose'],token:string){
 if(!env.RESEND_API_KEY||!env.AUTH_EMAIL_FROM)throw Error('CMS email configuration is unavailable.');
 const title=purpose==='password-reset'?'Reset your SOMDAS CMS password':'Your SOMDAS CMS verification code',intro=purpose==='password-reset'?'Use this code to create a new CMS password.':'Use this code to complete your secure CMS sign-in.';
 const resetLink=purpose==='password-reset'?`${new URL(request.url).origin}/admin/login?reset=1&email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`:'';
 const html=`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#12213f"><h2>${title}</h2><p>Hello ${user.name},</p><p>${intro}</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px 0">${code}</div><p>This code expires in ${challengeMinutes} minutes. Do not share it.</p>${resetLink?`<p><a href="${resetLink}" style="display:inline-block;background:#0a57c8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Reset CMS password</a></p>`:''}<p>If you did not request this, ignore this email.</p></div>`;
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.AUTH_EMAIL_FROM,to:[user.email],subject:title,html})});
 if(!response.ok)throw Error('Unable to send the CMS verification email.');
}
async function createEmailChallenge(request:Request,env:CMSAuthEnv,user:CMSUser,purpose:Challenge['purpose']){
 if(!env.CMS_AUTH_SECRET)throw Error('CMS security configuration is unavailable.');
 if(await limited(request,env.DB,'email-code',user.id,5,900))throw Error('Too many code requests. Wait 15 minutes and try again.');
 const token=b64(bytes(32)),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),now=new Date();
 await env.DB.batch([env.DB.prepare('DELETE FROM cms_auth_challenges WHERE user_id=? OR expires_at<=?').bind(user.id,now.toISOString()),env.DB.prepare('INSERT INTO cms_auth_challenges (token_hash,user_id,purpose,setup_secret,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,NULL,?,?,0,?)').bind(await sha256(token),user.id,purpose,await codeHash(code,env.CMS_AUTH_SECRET),new Date(now.getTime()+challengeMinutes*60000).toISOString(),now.toISOString())]);
 try{await sendCode(request,env,user,code,purpose,token);}catch(error){await env.DB.prepare('DELETE FROM cms_auth_challenges WHERE user_id=?').bind(user.id).run();throw error;}
 return {challengeToken:token,maskedEmail:maskedEmail(user.email)};
}
async function findChallenge(db:D1Database,token:string){if(token.length<32||token.length>200)return null;return db.prepare('SELECT token_hash,user_id,purpose,code_hash,expires_at,attempts FROM cms_auth_challenges WHERE token_hash=? AND expires_at>?').bind(await sha256(token),new Date().toISOString()).first<Challenge>();}
async function verifyCode(env:CMSAuthEnv,challenge:Challenge,code:string){return Boolean(env.CMS_AUTH_SECRET&&/^[0-9]{6}$/.test(code)&&challenge.code_hash&&safeEqual(await codeHash(code,env.CMS_AUTH_SECRET),challenge.code_hash));}
async function createSession(db:D1Database,user:CMSUser){const token=b64(bytes(32)),now=new Date(),expires=new Date(now.getTime()+sessionSeconds*1000).toISOString();await db.batch([db.prepare('DELETE FROM cms_sessions WHERE expires_at<=?').bind(now.toISOString()),db.prepare('INSERT INTO cms_sessions (token_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)').bind(await sha256(token),user.id,expires,now.toISOString(),now.toISOString()),db.prepare('UPDATE cms_users SET last_login_at=?,updated_at=? WHERE id=?').bind(now.toISOString(),now.toISOString(),user.id)]);return token;}

export async function sendCMSPasswordReset(request:Request,env:CMSAuthEnv,userId:string){const user=await env.DB.prepare("SELECT * FROM cms_users WHERE id=? AND status='active'").bind(userId).first<CMSUser>();if(!user)throw Error('CMS account is unavailable.');return createEmailChallenge(request,env,user,'password-reset');}

export async function cmsAuthApi(request:Request,env:CMSAuthEnv){
 const path=new URL(request.url).pathname;if(request.method!=='GET'&&!sameOrigin(request))return json({error:'Request origin is not allowed.'},403);
 try{
  if(path==='/api/admin/auth/session'&&request.method==='GET'){const token=cookieValue(request,cookieName);if(!token)return json({authenticated:false});const row=await env.DB.prepare("SELECT u.id,u.name,u.email,u.role,u.status FROM cms_sessions s JOIN cms_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'").bind(await sha256(token),new Date().toISOString()).first<CMSActor&{status:string}>();return json({authenticated:Boolean(row),user:row?{id:row.id,name:row.name,email:row.email,role:row.role}:null});}
  if(path==='/api/admin/auth/bootstrap'&&request.method==='POST'){
   if(!env.CMS_AUTH_SECRET)return json({error:'CMS security configuration is unavailable.'},503);const platformId=request.headers.get('oai-authenticated-user-id'),email=normalizeEmail(request.headers.get('oai-authenticated-user-email'));if(!platformId||email!==OWNER_EMAIL)return json({available:false},403);
   const now=new Date().toISOString();await env.DB.prepare("INSERT INTO cms_users (id,platform_id,name,email,role,status,password_hash,two_factor_secret,two_factor_enabled,created_at,updated_at,created_by) VALUES ('owner',?,'Yusuf Abdisalam',?,'superadmin','active',NULL,NULL,0,?,?,'owner') ON CONFLICT(id) DO UPDATE SET platform_id=excluded.platform_id,email=excluded.email,role='superadmin',status='active',updated_at=excluded.updated_at").bind(platformId,OWNER_EMAIL,now,now).run();
   const user=await env.DB.prepare("SELECT * FROM cms_users WHERE id='owner'").first<CMSUser>();if(!user||user.password_hash)return json({available:false},409);return json({available:true,...await createEmailChallenge(request,env,user,'owner-setup'),email:user.email});
  }
  if(path==='/api/admin/auth/login'&&request.method==='POST'){
   if(!env.CMS_AUTH_SECRET)return json({error:'CMS security configuration is unavailable.'},503);const parsed=await body(request);if(parsed.response)return parsed.response;const email=normalizeEmail(parsed.value?.email),password=String(parsed.value?.password||'');if(!validEmail(email)||password.length>128)return json({error:'Email or password is incorrect.'},401);if(await limited(request,env.DB,'login',email,8,900))return json({error:'Too many sign-in attempts. Wait and try again.'},429);
   const user=await env.DB.prepare("SELECT * FROM cms_users WHERE email=? COLLATE NOCASE AND status='active' LIMIT 1").bind(email).first<CMSUser>(),passwordOk=await verifyPassword(password,user?.password_hash||dummyPasswordHash);if(!user||!passwordOk)return json({error:'Email or password is incorrect.'},401);return json({requiresEmailCode:true,...await createEmailChallenge(request,env,user,'login')});
  }
  if(path==='/api/admin/auth/verify'&&request.method==='POST'){
   const parsed=await body(request);if(parsed.response)return parsed.response;const challengeToken=String(parsed.value?.challengeToken||''),code=String(parsed.value?.code||'').trim(),challenge=await findChallenge(env.DB,challengeToken);if(!challenge||challenge.purpose!=='login'||challenge.attempts>=6)return json({error:'This sign-in has expired. Start again.'},400);if(await limited(request,env.DB,'email-verify',challenge.user_id,10,900))return json({error:'Too many verification attempts. Wait and try again.'},429);
   if(!await verifyCode(env,challenge,code)){await env.DB.prepare('UPDATE cms_auth_challenges SET attempts=attempts+1 WHERE token_hash=?').bind(challenge.token_hash).run();return json({error:'The 6-digit email code is incorrect.'},400);}const user=await env.DB.prepare("SELECT * FROM cms_users WHERE id=? AND status='active'").bind(challenge.user_id).first<CMSUser>();if(!user)return json({error:'CMS account is unavailable.'},403);
   await env.DB.batch([env.DB.prepare('DELETE FROM cms_auth_challenges WHERE user_id=?').bind(user.id),env.DB.prepare('UPDATE cms_users SET two_factor_secret=NULL,two_factor_enabled=1,updated_at=? WHERE id=?').bind(new Date().toISOString(),user.id)]);const token=await createSession(env.DB,user);return json({authenticated:true,user:{id:user.id,name:user.name,email:user.email,role:user.role}},200,{'Set-Cookie':setCookie(token)});
  }
  if(path==='/api/admin/auth/owner-setup'&&request.method==='POST'){
   const parsed=await body(request);if(parsed.response)return parsed.response;const input=parsed.value!,challenge=await findChallenge(env.DB,String(input.challengeToken||'')),code=String(input.code||'').trim(),password=String(input.password||''),confirm=String(input.confirmPassword||'');if(!challenge||challenge.purpose!=='owner-setup'||challenge.attempts>=6)return json({error:'This owner setup has expired. Reload and start again.'},400);if(password.length<12||password.length>128||password!==confirm)return json({error:password!==confirm?'Passwords do not match.':'Password must be 12–128 characters.'},400);
   if(!await verifyCode(env,challenge,code)){await env.DB.prepare('UPDATE cms_auth_challenges SET attempts=attempts+1 WHERE token_hash=?').bind(challenge.token_hash).run();return json({error:'The 6-digit email code is incorrect.'},400);}const user=await env.DB.prepare("SELECT * FROM cms_users WHERE id=? AND status='active'").bind(challenge.user_id).first<CMSUser>();if(!user)return json({error:'CMS account is unavailable.'},403);const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('UPDATE cms_users SET password_hash=?,two_factor_secret=NULL,two_factor_enabled=1,updated_at=? WHERE id=?').bind(await hashCMSPassword(password),now,user.id),env.DB.prepare('DELETE FROM cms_auth_challenges WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(user.id)]);const token=await createSession(env.DB,user);return json({authenticated:true,user:{id:user.id,name:user.name,email:user.email,role:user.role}},200,{'Set-Cookie':setCookie(token)});
  }
  if(path==='/api/admin/auth/reset/request'&&request.method==='POST'){
   const parsed=await body(request);if(parsed.response)return parsed.response;const email=normalizeEmail(parsed.value?.email);if(validEmail(email)&&!await limited(request,env.DB,'reset-request',email,5,900)){const user=await env.DB.prepare("SELECT * FROM cms_users WHERE email=? COLLATE NOCASE AND status='active' LIMIT 1").bind(email).first<CMSUser>();if(user)try{await createEmailChallenge(request,env,user,'password-reset');}catch(error){console.error('CMS reset email unavailable',error);}}return json({ok:true,message:'If an active CMS account uses that email, a reset code has been sent.'});
  }
  if(path==='/api/admin/auth/reset/confirm'&&request.method==='POST'){
   const parsed=await body(request);if(parsed.response)return parsed.response;const input=parsed.value!,challenge=await findChallenge(env.DB,String(input.challengeToken||'')),code=String(input.code||'').trim(),password=String(input.password||''),confirm=String(input.confirmPassword||'');if(!challenge||challenge.purpose!=='password-reset'||challenge.attempts>=6)return json({error:'This reset request has expired. Request a new code.'},400);if(password.length<12||password.length>128||password!==confirm)return json({error:password!==confirm?'Passwords do not match.':'Password must be 12–128 characters.'},400);
   if(!await verifyCode(env,challenge,code)){await env.DB.prepare('UPDATE cms_auth_challenges SET attempts=attempts+1 WHERE token_hash=?').bind(challenge.token_hash).run();return json({error:'The 6-digit email code is incorrect.'},400);}const user=await env.DB.prepare("SELECT * FROM cms_users WHERE id=? AND status='active'").bind(challenge.user_id).first<CMSUser>();if(!user)return json({error:'CMS account is unavailable.'},403);const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('UPDATE cms_users SET password_hash=?,two_factor_secret=NULL,two_factor_enabled=1,updated_at=? WHERE id=?').bind(await hashCMSPassword(password),now,user.id),env.DB.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM cms_auth_challenges WHERE user_id=?').bind(user.id)]);return json({ok:true,message:'Password changed. Sign in with your new password.'});
  }
  if(path==='/api/admin/auth/logout'&&request.method==='POST'){const token=cookieValue(request,cookieName);if(token)await env.DB.prepare('DELETE FROM cms_sessions WHERE token_hash=?').bind(await sha256(token)).run();return json({authenticated:false},200,{'Set-Cookie':clearCookie()});}
  return json({error:'Not found.'},404);
 }catch(error){console.error('CMS authentication unavailable',error);return json({error:error instanceof Error&&/email|code requests/.test(error.message)?error.message:'CMS sign-in is temporarily unavailable.'},503);}
}
