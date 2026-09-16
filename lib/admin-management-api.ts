import {analyticsReport} from './analytics';
import {activityStatement,canManageUsers,getCMSActor,OWNER_EMAIL,type CMSRole} from './cms-access';
import {hashCMSPassword,sendCMSPasswordReset} from './cms-auth';
import type {CMSEnv} from './cms-api';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validEmail=(x:unknown)=>typeof x==='string'&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
export async function adminManagementApi(req:Request,env:CMSEnv){
 const url=new URL(req.url),path=url.pathname,actor=await getCMSActor(env.DB,req.headers);if(!actor)return json({error:'Your account does not have CMS access.'},403);
 if(req.method!=='GET'&&req.headers.get('Origin')!==url.origin)return json({error:'Same-origin request required.'},403);
 if(req.method!=='GET'&&!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'JSON request required.'},415);
 try{
  if(path==='/api/admin/session'&&req.method==='GET')return json({actor,permissions:{manageUsers:canManageUsers(actor),manageAdmins:actor.role==='superadmin',approve:actor.role!=='editor',publish:actor.role!=='editor',editPages:actor.role!=='editor',maintenance:actor.role==='superadmin'}});
  if(path==='/api/admin/messages'&&req.method==='GET'){
   if(actor.role==='editor')return json({error:'Admin access required.'},403);const page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0));const result=await env.DB.prepare('SELECT id,name,email,topic,message,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 51 OFFSET ?').bind(page*50).all();return json({messages:result.results.slice(0,50),more:result.results.length>50});
  }
  if(path==='/api/admin/analytics'&&req.method==='GET'){
   if(actor.role==='editor')return json({error:'Admin access required.'},403);return json(await analyticsReport(env.DB,Number(url.searchParams.get('days'))));
  }
  if(path==='/api/admin/activity'&&req.method==='GET'){
   const limit=Math.max(1,Math.min(200,Number(url.searchParams.get('limit'))||100));const where=actor.role==='editor'?"WHERE actor_role='editor'":'';const rows=await env.DB.prepare(`SELECT id,actor_id,actor_name,actor_role,action,target_type,target_key,target_label,created_at FROM cms_activity ${where} ORDER BY created_at DESC LIMIT ?`).bind(limit).all();return json({items:rows.results});
  }
  if(path==='/api/admin/users/reset'&&req.method==='POST'){
   if(!canManageUsers(actor))return json({error:'Admin access required.'},403);
   const input=await req.json() as {id?:unknown};if(typeof input.id!=='string'||!input.id)return json({error:'Choose a CMS user.'},400);if(input.id===actor.id)return json({error:'Use Forgot password to reset your own password.'},400);
   const target=await env.DB.prepare("SELECT id,name,email,role,status FROM cms_users WHERE id=? AND status='active'").bind(input.id).first<{id:string;name:string;email:string;role:CMSRole;status:string}>();if(!target)return json({error:'Active CMS user not found.'},404);
   if(actor.role==='admin'&&target.role!=='editor')return json({error:'Admins can reset Editor passwords only.'},403);
   const reset=await sendCMSPasswordReset(req,env,target.id);await env.DB.batch([env.DB.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(target.id),activityStatement(env.DB,actor,'Sent password reset email','user',target.id,target.name)]);return json({ok:true,message:`A reset code was sent to ${reset.maskedEmail}. Existing sessions were signed out.`});
  }
  if(path==='/api/admin/settings'){
   if(req.method==='GET'){const row=await env.DB.prepare("SELECT value,updated_at,updated_by FROM cms_settings WHERE key='maintenance'").first<{value:string,updated_at:string,updated_by:string}>();return json({maintenance:row?JSON.parse(row.value):{enabled:false,message:'We are carrying out a scheduled website update. Please check back shortly.'},updatedAt:row?.updated_at??null});}
   if(actor.role!=='superadmin')return json({error:'Only a Super Admin can change Maintenance Mode.'},403);const input=await req.json() as {enabled?:unknown,message?:unknown};if(typeof input.enabled!=='boolean'||typeof input.message!=='string'||input.message.trim().length<10||input.message.length>500)return json({error:'Add a maintenance message between 10 and 500 characters.'},400);const now=new Date().toISOString(),value=JSON.stringify({enabled:input.enabled,message:input.message.trim()});await env.DB.batch([env.DB.prepare("INSERT INTO cms_settings (key,value,updated_at,updated_by) VALUES ('maintenance',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(value,now,actor.id),activityStatement(env.DB,actor,input.enabled?'Enabled Maintenance Mode':'Disabled Maintenance Mode','settings','maintenance','Website maintenance')]);return json({ok:true});
  }
  if(path==='/api/admin/users'){
   if(!canManageUsers(actor))return json({error:'Admin access required.'},403);
   if(req.method==='GET'){const rows=(await env.DB.prepare("SELECT id,name,email,role,status,two_factor_enabled,created_at,updated_at FROM cms_users WHERE id<>'owner' ORDER BY created_at DESC").all()).results;return json({items:[{id:'owner',name:'Yusuf Abdisalam',email:OWNER_EMAIL,role:'superadmin',status:'active',two_factor_enabled:1,immutable:true},...rows]});}
   const input=await req.json() as {id?:unknown,name?:unknown,email?:unknown,role?:unknown,status?:unknown,password?:unknown,confirmPassword?:unknown};
   if(req.method==='POST'){
    const role=input.role as CMSRole,password=String(input.password||''),confirm=String(input.confirmPassword||'');if(typeof input.name!=='string'||input.name.trim().length<2||input.name.length>120||!validEmail(input.email)||!['superadmin','admin','editor'].includes(role))return json({error:'Enter a valid name, email and role.'},400);if(password.length<12||password.length>128)return json({error:'Password must be 12–128 characters.'},400);if(password!==confirm)return json({error:'Passwords do not match.'},400);if(actor.role==='admin'&&role!=='editor')return json({error:'Admins can create Editor accounts only.'},403);if(String(input.email).toLowerCase()===OWNER_EMAIL)return json({error:'That account is already the website owner.'},409);const now=new Date().toISOString(),id=crypto.randomUUID(),passwordHash=await hashCMSPassword(password);try{await env.DB.batch([env.DB.prepare("INSERT INTO cms_users (id,platform_id,name,email,role,status,password_hash,two_factor_secret,two_factor_enabled,created_at,updated_at,created_by) VALUES (?,NULL,?,?,?,'active',?,NULL,0,?,?,?)").bind(id,input.name.trim(),String(input.email).trim().toLowerCase(),role,passwordHash,now,now,actor.id),activityStatement(env.DB,actor,'Created '+role,'user',id,input.name.trim())]);}catch{return json({error:'A CMS account already uses this email.'},409);}return json({id},201);
   }
   if(req.method==='PATCH'){
    if(typeof input.id!=='string'||input.id==='owner')return json({error:'The owner account cannot be changed here.'},400);if(input.id===actor.id)return json({error:'You cannot change or suspend your own account.'},400);const row=await env.DB.prepare('SELECT id,name,role FROM cms_users WHERE id=?').bind(input.id).first<{id:string,name:string,role:CMSRole}>();if(!row)return json({error:'User not found.'},404);if(actor.role==='admin'&&(row.role!=='editor'||input.role&&input.role!=='editor'))return json({error:'Admins can manage Editor accounts only.'},403);const role=(input.role??row.role) as CMSRole,status=input.status;if(!['superadmin','admin','editor'].includes(role)||!['active','suspended'].includes(String(status)))return json({error:'Choose a valid role and status.'},400);await env.DB.batch([env.DB.prepare('UPDATE cms_users SET role=?,status=?,updated_at=? WHERE id=?').bind(role,status,new Date().toISOString(),row.id),status==='suspended'?env.DB.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(row.id):env.DB.prepare('DELETE FROM cms_auth_challenges WHERE user_id=?').bind(row.id),activityStatement(env.DB,actor,`${status==='active'?'Activated':'Suspended'} ${role}`,'user',row.id,row.name)]);return json({ok:true});
   }
  }
  return json({error:'Not found.'},404);
 }catch(e){console.error('Admin management unavailable',e);return json({error:'This CMS service is temporarily unavailable.'},503);}
}
export async function maintenanceState(db:D1Database){try{const row=await db.prepare("SELECT value FROM cms_settings WHERE key='maintenance'").first<{value:string}>();return row?JSON.parse(row.value) as {enabled:boolean,message:string}:{enabled:false,message:''};}catch{return {enabled:false,message:''};}}
