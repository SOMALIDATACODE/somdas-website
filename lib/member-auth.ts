import {readBoundedText,secureHeaders} from './security';

interface AuthEnv {
  DB:D1Database;
  BUCKET:R2Bucket;
  RESEND_API_KEY?:string;
  AUTH_EMAIL_FROM?:string;
  AUTH_OTP_SECRET?:string;
}

type Member={id:string;name:string;email:string;password_hash:string;profile_image_key:string|null;created_at:string;updated_at:string};
const encoder=new TextEncoder();
const sessionCookie='__Host-somdas_session';
const sessionDays=30;
const maxAuthBody=16384;
const dummyPasswordHash='pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const jsonHeaders=secureHeaders({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'});

const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,...headers}});
const normalizeEmail=(value:unknown)=>String(value||'').trim().toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
const bytes=(length:number)=>{const out=new Uint8Array(length);crypto.getRandomValues(out);return out;};
const b64=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((value.length+3)%4)),c=>c.charCodeAt(0));
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value),n=>n.toString(16).padStart(2,'0')).join('');
const sha256=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};

async function hashPassword(password:string){
  // Cloudflare Workers WebCrypto currently caps PBKDF2 at 100,000 rounds.
  const iterations=100000,salt=bytes(16);
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(new Uint8Array(result))}`;
}

async function verifyPassword(password:string,stored:string){
  const [method,iterationText,saltText,expected]=stored.split('$');
  if(method!=='pbkdf2'||!iterationText||!saltText||!expected)return false;
  const iterations=Number(iterationText);
  if(!Number.isInteger(iterations)||iterations<100000)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromB64(saltText),iterations},key,256);
  return safeEqual(b64(new Uint8Array(result)),expected);
}

function cookieValue(request:Request,name:string){
  const cookie=request.headers.get('Cookie')||'';
  for(const item of cookie.split(';')){const [key,...parts]=item.trim().split('=');if(key===name)return decodeURIComponent(parts.join('='));}
  return '';
}

function setSessionCookie(token:string,maxAge=sessionDays*86400){return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
function clearSessionCookie(){return `${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}

async function requestBody(request:Request){
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return {response:json({error:'JSON required.'},415)};
  const raw=await readBoundedText(request,maxAuthBody);if(!raw.ok)return {response:json({error:'Request is too large.'},413)};
  try{return {body:JSON.parse(raw.text) as Record<string,unknown>};}catch{return {response:json({error:'Invalid request.'},400)};}
}

function sameOrigin(request:Request){
  const origin=request.headers.get('Origin');
  return origin===new URL(request.url).origin;
}

async function rateLimited(request:Request,db:D1Database,action:string,identity:string,limit:number,windowSeconds:number){
  const ip=(request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0]||'unknown').trim();
  const key=await sha256(`${action}:${identity}:${ip}`),now=Math.floor(Date.now()/1000),resetAt=now+windowSeconds;
  await db.prepare('DELETE FROM auth_rate_limits WHERE reset_at<=?').bind(now).run();
  const row=await db.prepare(`INSERT INTO auth_rate_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.reset_at<=? THEN 1 ELSE auth_rate_limits.attempts+1 END,reset_at=CASE WHEN auth_rate_limits.reset_at<=? THEN excluded.reset_at ELSE auth_rate_limits.reset_at END RETURNING attempts,reset_at`).bind(key,resetAt,now,now).first<{attempts:number;reset_at:number}>();
  return Boolean(row&&row.attempts>limit&&row.reset_at>now);
}

async function memberFromRequest(request:Request,db:D1Database){
  const token=cookieValue(request,sessionCookie);if(!token)return null;
  const tokenHash=await sha256(token);
  return db.prepare(`SELECT m.id,m.name,m.email,m.password_hash,m.profile_image_key,m.created_at,m.updated_at FROM member_sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(tokenHash,new Date().toISOString()).first<Member>();
}

async function createSession(memberId:string,db:D1Database){
  const token=b64(bytes(32)),tokenHash=await sha256(token),now=new Date(),expires=new Date(now.getTime()+sessionDays*86400000);
  await db.prepare('INSERT INTO member_sessions (token_hash,member_id,expires_at,created_at) VALUES (?,?,?,?)').bind(tokenHash,memberId,expires.toISOString(),now.toISOString()).run();
  return token;
}

function publicMember(member:Member){return {id:member.id,name:member.name,email:member.email,createdAt:member.created_at,avatarUrl:member.profile_image_key?`/api/auth/avatar?v=${encodeURIComponent(member.updated_at)}`:''};}
export async function getPublicMemberFromRequest(request:Request,db:D1Database){const member=await memberFromRequest(request,db);return member?publicMember(member):null;}

async function readImage(request:Request,maxBytes=5242880){
  const allowed=['image/jpeg','image/png','image/webp'],type=request.headers.get('content-type')||'';
  if(!allowed.includes(type))return {response:json({error:'Choose a JPEG, PNG or WebP image.'},415)};
  const advertised=Number(request.headers.get('content-length'));if(Number.isFinite(advertised)&&advertised>maxBytes)return {response:json({error:'Profile image must be 5 MB or smaller.'},413)};
  const reader=request.body?.getReader();if(!reader)return {response:json({error:'Choose an image.'},400)};
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return {response:json({error:'Profile image must be 5 MB or smaller.'},413)};}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  const valid=type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':new TextDecoder().decode(data.slice(0,4))==='RIFF'&&new TextDecoder().decode(data.slice(8,12))==='WEBP';
  return valid?{data,type}:{response:json({error:'The selected file is not a valid image.'},400)};
}

async function otpHash(email:string,code:string,secret:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(`${email}:${code}`)));
}

async function resetProof(email:string,memberId:string,otpId:string,expiresAt:string,secret:string){
  const payload=b64(encoder.encode(JSON.stringify({email,memberId,otpId,expiresAt})));
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return `${payload}.${hex(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)))}`;
}

async function verifyResetProof(token:string,secret:string){
  const [payload,signature]=String(token||'').split('.');
  if(!payload||!signature)return null;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=hex(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)));
  if(!safeEqual(expected,signature))return null;
  try{
    const data=JSON.parse(new TextDecoder().decode(fromB64(payload))) as {email:string;memberId:string;otpId:string;expiresAt:string};
    if(!data.email||!data.memberId||!data.otpId||Date.parse(data.expiresAt)<=Date.now())return null;
    return data;
  }catch{return null;}
}

async function sendOtp(env:AuthEnv,email:string,name:string,code:string){
  if(!env.RESEND_API_KEY||!env.AUTH_EMAIL_FROM||!env.AUTH_OTP_SECRET)throw new Error('Password reset email is not configured');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.AUTH_EMAIL_FROM,to:[email],subject:'Your SOMDAS password reset code',html:`<div style="font-family:Arial,sans-serif;color:#071a3d;line-height:1.6"><h2>SOMDAS password reset</h2><p>Hello ${name.replace(/[<>&"']/g,'')},</p><p>Use this one-time code to reset your password:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`})});
  if(!response.ok)throw new Error(`Email provider returned ${response.status}`);
}

function randomOtp(){
 const values=new Uint32Array(1),ceiling=0x100000000-(0x100000000%1000000);let value:number;
 do{crypto.getRandomValues(values);value=values[0];}while(value>=ceiling);
 return String(value%1000000).padStart(6,'0');
}

export async function memberAuthApi(request:Request,env:AuthEnv){
  const url=new URL(request.url),path=url.pathname;
  if(request.method!=='GET'&&!sameOrigin(request))return json({error:'Request origin is not allowed.'},403);
  try{
    if((path==='/api/session'||path==='/api/auth/session')&&request.method==='GET'){
      const member=await memberFromRequest(request,env.DB);
      return json({authenticated:Boolean(member),user:member?publicMember(member):null});
    }
    if(path==='/api/auth/avatar'&&request.method==='GET'){
      const member=await memberFromRequest(request,env.DB);if(!member)return new Response('Not found',{status:404,headers:secureHeaders({'Cache-Control':'no-store'})});
      if(!member.profile_image_key)return new Response('Not found',{status:404,headers:secureHeaders({'Cache-Control':'no-store'})});
      const file=await env.BUCKET.get(member.profile_image_key);if(!file)return new Response('Not found',{status:404,headers:secureHeaders({'Cache-Control':'no-store'})});
      return new Response(file.body,{headers:secureHeaders({'Content-Type':file.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-cache'})});
    }
    if(path==='/api/auth/avatar'&&request.method==='POST'){
      const member=await memberFromRequest(request,env.DB);if(!member)return json({error:'Sign in is required.'},401);
      if(await rateLimited(request,env.DB,'avatar',member.id,12,3600))return json({error:'Too many image changes. Please wait and try again.'},429);
      const parsed=await readImage(request);if(parsed.response)return parsed.response;
      const key=`member-${member.id}-${crypto.randomUUID()}`,now=new Date().toISOString(),oldKey=member.profile_image_key;
      await env.BUCKET.put(key,parsed.data,{httpMetadata:{contentType:parsed.type}});
      try{await env.DB.prepare('UPDATE members SET profile_image_key=?,updated_at=? WHERE id=?').bind(key,now,member.id).run();}catch(error){await env.BUCKET.delete(key);throw error;}
      if(oldKey)await env.BUCKET.delete(oldKey);
      return json({user:publicMember({...member,profile_image_key:key,updated_at:now})});
    }
    if(path==='/api/auth/avatar'&&request.method==='DELETE'){
      const member=await memberFromRequest(request,env.DB);if(!member)return json({error:'Sign in is required.'},401);
      const now=new Date().toISOString();await env.DB.prepare('UPDATE members SET profile_image_key=NULL,updated_at=? WHERE id=?').bind(now,member.id).run();
      if(member.profile_image_key)await env.BUCKET.delete(member.profile_image_key);
      return json({user:publicMember({...member,profile_image_key:null,updated_at:now})});
    }
    if(path==='/api/auth/register'&&request.method==='POST'){
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const body=parsedBody.body!;
      const name=String(body.name||'').trim(),email=normalizeEmail(body.email),password=String(body.password||''),confirm=String(body.confirmPassword||'');
      if(name.length<2||name.length>80)return json({error:'Enter your full name.'},400);
      if(!validEmail(email))return json({error:'Enter a valid email address.'},400);
      if(await rateLimited(request,env.DB,'register',email,5,600))return json({error:'Too many account attempts. Please wait and try again.'},429);
      if(password.length<10||password.length>128)return json({error:'Password must be 10–128 characters.'},400);
      if(password!==confirm)return json({error:'Passwords do not match.'},400);
      const existing=await env.DB.prepare('SELECT id FROM members WHERE email=? LIMIT 1').bind(email).first();
      if(existing)return json({error:'An account with this email already exists.'},409);
      const id=crypto.randomUUID(),now=new Date().toISOString(),passwordHash=await hashPassword(password);
      await env.DB.prepare('INSERT INTO members (id,name,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id,name,email,passwordHash,now,now).run();
      const token=await createSession(id,env.DB);
      return json({authenticated:true,user:publicMember({id,name,email,password_hash:passwordHash,profile_image_key:null,created_at:now,updated_at:now})},201,{'Set-Cookie':setSessionCookie(token)});
    }
    if(path==='/api/auth/login'&&request.method==='POST'){
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const body=parsedBody.body!;
      const email=normalizeEmail(body.email),password=String(body.password||'');
      if(!validEmail(email)||password.length>128)return json({error:'Email or password is incorrect.'},401);
      if(await rateLimited(request,env.DB,'login',email,10,600))return json({error:'Too many sign-in attempts. Please wait and try again.'},429);
      const member=validEmail(email)?await env.DB.prepare('SELECT * FROM members WHERE email=? LIMIT 1').bind(email).first<Member>():null;
      const passwordOk=await verifyPassword(password,member?.password_hash||dummyPasswordHash);
      if(!member||!passwordOk)return json({error:'Email or password is incorrect.'},401);
      const token=await createSession(member.id,env.DB);
      return json({authenticated:true,user:publicMember(member)},200,{'Set-Cookie':setSessionCookie(token)});
    }
    if(path==='/api/auth/logout'&&request.method==='POST'){
      const token=cookieValue(request,sessionCookie);if(token)await env.DB.prepare('DELETE FROM member_sessions WHERE token_hash=?').bind(await sha256(token)).run();
      return json({authenticated:false},200,{'Set-Cookie':clearSessionCookie()});
    }
    if(path==='/api/auth/profile'&&request.method==='PATCH'){
      const member=await memberFromRequest(request,env.DB);if(!member)return json({error:'Sign in is required.'},401);
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const name=String(parsedBody.body?.name||'').trim();
      if(name.length<2||name.length>80)return json({error:'Enter your full name.'},400);
      const now=new Date().toISOString();await env.DB.prepare('UPDATE members SET name=?,updated_at=? WHERE id=?').bind(name,now,member.id).run();
      return json({user:publicMember({...member,name,updated_at:now})});
    }
    if(path==='/api/auth/password'&&request.method==='POST'){
      const member=await memberFromRequest(request,env.DB);if(!member)return json({error:'Sign in is required.'},401);
      if(await rateLimited(request,env.DB,'password',member.id,5,600))return json({error:'Too many password attempts. Please wait and try again.'},429);
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const body=parsedBody.body!,current=String(body.currentPassword||''),next=String(body.newPassword||''),confirm=String(body.confirmPassword||'');
      if(current.length>128||next.length>128||confirm.length>128)return json({error:'Password must be 10–128 characters.'},400);
      if(!await verifyPassword(current,member.password_hash))return json({error:'Current password is incorrect.'},400);
      if(next.length<10)return json({error:'New password must be 10–128 characters.'},400);
      if(next!==confirm)return json({error:'New passwords do not match.'},400);
      const passwordHash=await hashPassword(next),now=new Date().toISOString();
      await env.DB.batch([env.DB.prepare('UPDATE members SET password_hash=?,updated_at=? WHERE id=?').bind(passwordHash,now,member.id),env.DB.prepare('DELETE FROM member_sessions WHERE member_id=? AND token_hash<>?').bind(member.id,await sha256(cookieValue(request,sessionCookie)))]);
      return json({ok:true});
    }
    if(path==='/api/auth/account'&&request.method==='DELETE'){
      const member=await memberFromRequest(request,env.DB);if(!member)return json({error:'Sign in is required.'},401);
      if(await rateLimited(request,env.DB,'delete-account',member.id,3,3600))return json({error:'Too many deletion attempts. Please wait and try again.'},429);
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const body=parsedBody.body!,password=String(body.currentPassword||''),confirmation=String(body.confirmation||'').trim();
      if(confirmation!=='DELETE')return json({error:'Type DELETE to confirm permanent account deletion.'},400);
      if(password.length>128||!await verifyPassword(password,member.password_hash))return json({error:'Current password is incorrect.'},400);
      await env.DB.batch([env.DB.prepare('DELETE FROM member_sessions WHERE member_id=?').bind(member.id),env.DB.prepare('DELETE FROM password_reset_otps WHERE member_id=?').bind(member.id),env.DB.prepare('DELETE FROM members WHERE id=?').bind(member.id)]);
      if(member.profile_image_key)await env.BUCKET.delete(member.profile_image_key);
      return json({deleted:true},200,{'Set-Cookie':clearSessionCookie()});
    }
    if(path==='/api/auth/reset/request'&&request.method==='POST'){
      if(!env.RESEND_API_KEY||!env.AUTH_EMAIL_FROM||!env.AUTH_OTP_SECRET)return json({error:'Password reset email is not configured yet. Please contact SOMDAS.'},503);
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const email=normalizeEmail(parsedBody.body?.email);if(!validEmail(email))return json({ok:true});
      if(await rateLimited(request,env.DB,'reset-request',email,3,900))return json({ok:true});
      const member=await env.DB.prepare('SELECT * FROM members WHERE email=? LIMIT 1').bind(email).first<Member>();if(!member)return json({ok:true});
      const latest=await env.DB.prepare('SELECT created_at FROM password_reset_otps WHERE member_id=? ORDER BY created_at DESC LIMIT 1').bind(member.id).first<{created_at:string}>();
      if(latest&&Date.now()-new Date(latest.created_at).getTime()<30000)return json({ok:true});
      const code=randomOtp(),now=new Date(),expires=new Date(now.getTime()+600000),id=crypto.randomUUID();
      const codeHash=await otpHash(email,code,env.AUTH_OTP_SECRET);
      await env.DB.prepare('UPDATE password_reset_otps SET used_at=? WHERE member_id=? AND used_at IS NULL').bind(now.toISOString(),member.id).run();
      await env.DB.prepare('INSERT INTO password_reset_otps (id,member_id,code_hash,expires_at,attempts,used_at,created_at) VALUES (?,?,?,?,0,NULL,?)').bind(id,member.id,codeHash,expires.toISOString(),now.toISOString()).run();
      try{await sendOtp(env,email,member.name,code);}catch(error){await env.DB.prepare('DELETE FROM password_reset_otps WHERE id=?').bind(id).run();throw error;}return json({ok:true});
    }
    if(path==='/api/auth/reset/verify'&&request.method==='POST'){
      if(!env.AUTH_OTP_SECRET)return json({error:'Password reset is not configured yet.'},503);
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const body=parsedBody.body!,email=normalizeEmail(body.email),code=String(body.code||'').trim();
      if(!validEmail(email)||!/^[0-9]{6}$/.test(code))return json({error:'Enter the 6-digit code.'},400);
      if(await rateLimited(request,env.DB,'reset-verify',email,8,900))return json({error:'Too many code attempts. Request a new code later.'},429);
      const member=await env.DB.prepare('SELECT * FROM members WHERE email=? LIMIT 1').bind(email).first<Member>();if(!member)return json({error:'The code is incorrect.'},400);
      const otp=await env.DB.prepare('SELECT id,code_hash,expires_at,attempts FROM password_reset_otps WHERE member_id=? AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(member.id,new Date().toISOString()).first<{id:string;code_hash:string;expires_at:string;attempts:number}>();
      if(!otp||otp.attempts>=5)return json({error:'The code is incorrect or expired.'},400);
      const actual=await otpHash(email,code,env.AUTH_OTP_SECRET);
      if(!safeEqual(actual,otp.code_hash)){await env.DB.prepare('UPDATE password_reset_otps SET attempts=attempts+1 WHERE id=?').bind(otp.id).run();return json({error:'The code is incorrect.'},400);}
      return json({ok:true,verificationToken:await resetProof(email,member.id,otp.id,otp.expires_at,env.AUTH_OTP_SECRET)});
    }
    if(path==='/api/auth/reset/confirm'&&request.method==='POST'){
      if(!env.AUTH_OTP_SECRET)return json({error:'Password reset is not configured yet.'},503);
      const parsedBody=await requestBody(request);if(parsedBody.response)return parsedBody.response;const body=parsedBody.body!,email=normalizeEmail(body.email),verificationToken=String(body.verificationToken||''),password=String(body.password||''),confirm=String(body.confirmPassword||'');
      if(!validEmail(email))return json({error:'Enter a valid email address.'},400);
      if(await rateLimited(request,env.DB,'reset-confirm',email,8,900))return json({error:'Too many reset attempts. Request a new code later.'},429);
      if(password.length<8||password.length>128)return json({error:'Password must be 8–128 characters.'},400);
      if(password!==confirm)return json({error:'Passwords do not match.'},400);
      const proof=await verifyResetProof(verificationToken,env.AUTH_OTP_SECRET);
      const member=proof&&proof.email===email?await env.DB.prepare('SELECT * FROM members WHERE id=? AND email=? LIMIT 1').bind(proof.memberId,email).first<Member>():null;
      const otp=proof&&member?await env.DB.prepare('SELECT id FROM password_reset_otps WHERE id=? AND member_id=? AND used_at IS NULL AND expires_at>? LIMIT 1').bind(proof.otpId,member.id,new Date().toISOString()).first<{id:string}>():null;
      if(!proof||!member||!otp)return json({error:'Verify the code before choosing a new password.'},400);
      const passwordHash=await hashPassword(password),now=new Date().toISOString();
      await env.DB.batch([env.DB.prepare('UPDATE members SET password_hash=?,updated_at=? WHERE id=?').bind(passwordHash,now,member.id),env.DB.prepare('UPDATE password_reset_otps SET used_at=? WHERE id=?').bind(now,otp.id),env.DB.prepare('DELETE FROM member_sessions WHERE member_id=?').bind(member.id)]);
      return json({ok:true});
    }
    return json({error:'Not found.'},404);
  }catch(error){console.error('Member auth failed',error);return json({error:'This service is temporarily unavailable.'},503);}
}
