export type CMSRole='superadmin'|'admin'|'editor';
export type CMSActor={id:string;email:string;name:string;role:CMSRole;owner:boolean};
export const OWNER_EMAIL='yusufabdisalamyusuf@gmail.com';
const encoder=new TextEncoder(),sessionCookie='__Host-somdas_cms_session';
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const cookieValue=(headers:Headers,name:string)=>{for(const item of (headers.get('Cookie')||'').split(';')){const [key,...parts]=item.trim().split('=');if(key===name)return decodeURIComponent(parts.join('='));}return '';};
export async function getCMSActor(db:D1Database,headers:Headers):Promise<CMSActor|null>{
 const token=cookieValue(headers,sessionCookie);if(!token)return null;
 const row=await db.prepare("SELECT u.id,u.email,u.name,u.role,u.status,s.expires_at FROM cms_sessions s JOIN cms_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1").bind(await sha256(token),new Date().toISOString()).first<{id:string;email:string;name:string;role:CMSRole;status:string;expires_at:string}>();
 if(!row||row.status!=='active'||!['superadmin','admin','editor'].includes(row.role))return null;
 return {id:row.id,email:row.email,name:row.name,role:row.role,owner:row.id==='owner'};
}
export const canApprove=(a:CMSActor)=>a.role==='superadmin'||a.role==='admin';
export const canManageAllContent=(a:CMSActor)=>a.role==='superadmin'||a.role==='admin';
export const canManageUsers=(a:CMSActor)=>a.role==='superadmin'||a.role==='admin';
export function activityStatement(db:D1Database,a:CMSActor,action:string,type:string,key:string,label:string){return db.prepare('INSERT INTO cms_activity (id,actor_id,actor_name,actor_role,action,target_type,target_key,target_label,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),a.id,a.name,a.role,action,type,key,label,new Date().toISOString());}
