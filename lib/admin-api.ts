import {contentSchema} from './content';
import {getCMSActor} from './cms-access';
import {sectionApi} from './section-api';
import {adminManagementApi} from './admin-management-api';
import {readContent} from './storage';
import type {CMSEnv} from './cms-api';
import {readBoundedText,secureHeaders} from './security';
type Workspace={body:string,revision:number,base_revision:number,status:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:secureHeaders({'Cache-Control':'no-store'})});
export async function adminApi(req:Request,env:CMSEnv){
 const route=new URL(req.url).pathname;
 if(route==='/api/admin/sections')return sectionApi(req,env);
 if(['/api/admin/session','/api/admin/users','/api/admin/users/reset','/api/admin/activity','/api/admin/analytics','/api/admin/settings','/api/admin/messages'].includes(route))return adminManagementApi(req,env);
 const actor=await getCMSActor(env.DB,req.headers);if(!actor||actor.role!=='superadmin')return json({error:'Super Admin access required.'},403);
 if(req.method!=='GET'&&req.headers.get('Origin')!==new URL(req.url).origin)return json({error:'Same-origin request required.'},403);
 try{
 const db=env.DB,path=new URL(req.url).pathname;
 const live=await readContent(db);
 const row=await db.prepare('SELECT * FROM admin_workspace WHERE id=1').first<Workspace>();
 if(req.method==='GET'){
  if(path==='/api/admin/history')return json({items:(await db.prepare('SELECT id,revision,action,created_at,created_by FROM admin_history ORDER BY created_at DESC LIMIT 100').all()).results});
  if(path==='/api/admin/media')return json({items:(await db.prepare('SELECT id,filename,type,size,created_at FROM media ORDER BY created_at DESC LIMIT 100').all()).results});
  if(path!=='/api/admin/content')return json({error:'Not found.'},404);
  return json({content:row&&row.status!=='published'?JSON.parse(row.body):live.content,revision:row?.revision??0,status:row?.status??'draft',liveRevision:live.revision,baseRevision:row&&row.status!=='published'?row.base_revision:live.revision});
 }
 if(req.method!=='PUT'&&req.method!=='POST')return json({error:'Method not allowed.'},405);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required.'},415);
 if(Number(req.headers.get('content-length'))>1500000)return json({error:'Content too large.'},413);
 const body=await readBoundedText(req,1500000);if(!body.ok)return json({error:'Content too large.'},413);const raw=body.text;
 const input=JSON.parse(raw),now=new Date().toISOString(),user=actor.id;
 if(!Number.isSafeInteger(input.revision)||input.revision!==(row?.revision??0))return json({error:'Another session changed this draft. Reload before continuing.'},409);
 if(path==='/api/admin/content'&&req.method==='PUT'){
  const parsed=contentSchema.safeParse(input.content);if(!parsed.success)return json({error:parsed.error.issues.map(x=>x.message).join(' ')},400);
  if((!row||row.status==='published')&&input.baseRevision!==live.revision)return json({error:'The live website changed since you opened this form. Download your edits and reload before continuing.'},409);
  const body=JSON.stringify(parsed.data),base=row&&row.status!=='published'?row.base_revision:live.revision;
  const update=row?db.prepare("UPDATE admin_workspace SET body=?,revision=revision+1,status='draft',base_revision=?,updated_at=?,updated_by=? WHERE id=1 AND revision=?").bind(body,base,now,user,input.revision):db.prepare("INSERT OR IGNORE INTO admin_workspace (id,body,revision,base_revision,status,updated_at,updated_by) VALUES (1,?,1,?,'draft',?,?)").bind(body,base,now,user);
  const results=await db.batch([update,db.prepare("INSERT INTO admin_history (id,body,revision,action,created_at,created_by) SELECT ?,body,revision,'Draft saved',?,? FROM admin_workspace WHERE id=1 AND changes()=1").bind(crypto.randomUUID(),now,user)]);
  if(results[0].meta.changes!==1)return json({error:'Draft changed. Reload before saving.'},409);
  return json({revision:input.revision+1});
 }
 if(path!=='/api/admin/status'||req.method!=='POST'||!row)return json({error:'Save a draft first.'},400);
 const next=input.status;
 const allowed:Record<string,string[]>={draft:['qa'],qa:['draft','ready'],ready:['draft','published'],published:[]};
 if(!allowed[row.status]?.includes(next))return json({error:'Follow Draft, QA Review, then Ready to Publish.'},400);
 if(next==='published'){
  const parsed=contentSchema.safeParse(JSON.parse(row.body));if(!parsed.success)return json({error:'Content validation failed.'},400);
  const mediaPaths=Array.from(new Set(row.body.match(/\/media\/[a-f0-9-]+/g)??[]));
  for(const p of mediaPaths)if(!await db.prepare('SELECT id FROM media WHERE id=?').bind(p.slice(7)).first())return json({error:'A referenced image is missing.'},400);
  // One atomic batch: compare live revision, publish, then mark this exact draft published.
  const results=await db.batch([
   db.prepare('INSERT OR IGNORE INTO content_documents (id,body,revision,updated_at,updated_by) VALUES (1,?,0,?,?)').bind(JSON.stringify(live.content),now,user),
   db.prepare("UPDATE content_documents SET body=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=? AND EXISTS (SELECT 1 FROM admin_workspace WHERE id=1 AND revision=? AND status='ready')").bind(row.body,now,user,row.base_revision,row.revision),
   db.prepare("UPDATE admin_workspace SET status='published',revision=revision+1,base_revision=base_revision+1,updated_at=?,updated_by=? WHERE id=1 AND changes()=1").bind(now,user),
   db.prepare("INSERT INTO admin_history (id,body,revision,action,created_at,created_by) SELECT ?,body,revision,'Published',?,? FROM admin_workspace WHERE id=1 AND changes()=1").bind(crypto.randomUUID(),now,user)
  ]);
  if(results[1].meta.changes!==1)return json({error:'Live content or this draft changed. Nothing was published. Reconcile with the legacy editor before publishing.'},409);
 }else{
  const results=await db.batch([
   db.prepare('UPDATE admin_workspace SET status=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=?').bind(next,now,user,row.revision),
   db.prepare('INSERT INTO admin_history (id,body,revision,action,created_at,created_by) SELECT ?,body,revision,?,?,? FROM admin_workspace WHERE id=1 AND changes()=1').bind(crypto.randomUUID(),`Status: ${next}`,now,user)
  ]);
  if(results[0].meta.changes!==1)return json({error:'Draft changed. Reload first.'},409);
 }
 return json({status:next,revision:row.revision+1});
 }catch(e){console.error('Admin workspace unavailable',e);return json({error:'Workspace unavailable. Your unsaved changes remain on screen. Retry shortly.'},503);}
}
