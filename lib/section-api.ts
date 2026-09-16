import {contentSchema,normalizePost,postTypes,type PostType} from './content';
import {readContent} from './storage';
import {catalog,extract,merge,type Section} from './section-catalog';
import {renderHome,renderCommunity,renderEvent,esc} from './render';
import {renderAbout} from './about-render';
import {renderSodi} from './sodi-render';
import {renderAiResearch} from './ai-research-render';
import {renderAcademy} from './academy-render';
import {renderLab,renderSolutions} from './program-pages-render';
import {renderContact} from './contact-render';
import {renderAuthPage,renderPrivacy,renderTerms} from './legal-render';
import {activityStatement,canApprove,getCMSActor,type CMSActor} from './cms-access';
import type {CMSEnv} from './cms-api';
import {readBoundedText,secureHeaders} from './security';

export type SectionRow={key:string;body:string;base_body:string;revision:number;status:string;updated_at:string;updated_by:string;owner_id:string|null;assigned_to:string|null;scheduled_at:string|null;publish_error:string|null};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:secureHeaders({'Cache-Control':'no-store'})});
const postSection=(row:SectionRow):Section|null=>{if(!row.key.startsWith('post:'))return null;try{const post=JSON.parse(row.body)['@'+row.key.slice(5)];return post?{key:row.key,page:'posts',title:post.title,paths:['@'+row.key.slice(5)]}:null;}catch{return null;}};
const allowed=(actor:CMSActor,section:Section,row?:SectionRow|null)=>actor.role!=='editor'||section.page==='posts'&&(row?.owner_id===actor.id||row?.assigned_to===actor.id);
const hydrateSectionData=(section:Section,current:Record<string,unknown>,data:Record<string,unknown>)=>{
 if(section.key.startsWith('post:')){const field='@'+section.key.slice(5);return field in data?{...data,[field]:normalizePost(data[field])}:data;}
 if(section.key!=='account:copy')return data;
 const currentAuth=current.auth&&typeof current.auth==='object'?current.auth as Record<string,unknown>:{};
 const savedAuth=data.auth&&typeof data.auth==='object'?data.auth as Record<string,unknown>:{};
 return {...data,auth:{...currentAuth,...savedAuth}};
};

async function publishRow(db:D1Database,row:SectionRow,actor:CMSActor,scheduled=false){
 const live=await readContent(db),sections=catalog(live.content),section=sections.find(s=>s.key===row.key)??postSection(row);if(!section)return {ok:false,error:'Section no longer exists.'};
 const current=extract(live.content,section),base=hydrateSectionData(section,current,JSON.parse(row.base_body));if(JSON.stringify(current)!==JSON.stringify(base))return {ok:false,error:'The live section changed after this version was reviewed.'};
 const data=hydrateSectionData(section,current,JSON.parse(row.body));if(row.key.startsWith('post:')){const field='@'+row.key.slice(5);data[field]={...normalizePost(data[field]),status:'published'};}
 const parsed=contentSchema.safeParse(merge(live.content,section,data));if(!parsed.success)return {ok:false,error:parsed.error.issues.map(i=>i.message).join(' ')};
 for(const path of new Set(row.body.match(/\/media\/[a-f0-9-]+/g)??[]))if(!await db.prepare('SELECT id FROM media WHERE id=?').bind(path.slice(7)).first())return {ok:false,error:'A referenced image is missing.'};
 const now=new Date().toISOString(),results=await db.batch([
  db.prepare('INSERT OR IGNORE INTO content_documents (id,body,revision,updated_at,updated_by) VALUES (1,?,0,?,?)').bind(JSON.stringify(live.content),now,actor.id),
  db.prepare("UPDATE content_documents SET body=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=? AND EXISTS(SELECT 1 FROM section_drafts WHERE key=? AND revision=? AND status=?)").bind(JSON.stringify(parsed.data),now,actor.id,live.revision,row.key,row.revision,scheduled?'scheduled':'ready'),
  db.prepare("UPDATE section_drafts SET status='published',revision=revision+1,base_body=?,scheduled_at=NULL,publish_error=NULL,updated_at=?,updated_by=? WHERE key=? AND changes()=1").bind(JSON.stringify(extract(parsed.data,section)),now,actor.id,row.key),
  db.prepare("INSERT INTO section_history SELECT ?,key,body,revision,?,?,? FROM section_drafts WHERE key=? AND changes()=1").bind(crypto.randomUUID(),scheduled?'Published by schedule':'Published',now,actor.id,row.key),
  activityStatement(db,actor,scheduled?'Published scheduled content':'Published',section.page==='posts'?'post':'section',section.key,section.title)
 ]);
 return results[1].meta.changes===1?{ok:true}:{ok:false,error:'Content changed during publication. Reload and review it again.'};
}

export async function runDueSchedules(env:Pick<CMSEnv,'DB'>){
 try{const statement=env.DB.prepare("SELECT * FROM section_drafts WHERE status='scheduled' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 20");if(typeof statement.bind!=='function')return;const due=(await statement.bind(new Date().toISOString()).all<SectionRow>()).results;
  for(const row of due){const actor:CMSActor={id:row.updated_by,email:'',name:'Schedule',role:'admin',owner:false},result=await publishRow(env.DB,row,actor,true);if(!result.ok)await env.DB.batch([env.DB.prepare("UPDATE section_drafts SET status='draft',scheduled_at=NULL,publish_error=?,revision=revision+1,updated_at=? WHERE key=? AND revision=?").bind(result.error,new Date().toISOString(),row.key,row.revision),activityStatement(env.DB,actor,'Schedule failed','section',row.key,row.key)]);}
 }catch(e){console.error('Scheduled publishing unavailable',e);}
}

export async function sectionApi(req:Request,env:CMSEnv){
 const url=new URL(req.url),db=env.DB,actor=await getCMSActor(db,req.headers);if(!actor)return json({error:'Your account does not have CMS access.'},403);
 if(req.method!=='GET'&&req.headers.get('Origin')!==url.origin)return json({error:'Same-origin request required.'},403);
 try{
  const live=await readContent(db),sections=catalog(live.content),drafts=(await db.prepare('SELECT * FROM section_drafts').all<SectionRow>()).results;
  for(const draft of drafts){const section=postSection(draft);if(section&&!sections.some(s=>s.key===draft.key))sections.push(section);}
  if(req.method==='GET'&&!url.searchParams.has('key')){
   const visibleSections=sections.filter(s=>allowed(actor,s,drafts.find(d=>d.key===s.key))),visibleKeys=new Set(visibleSections.map(s=>s.key)),users=actor.role==='editor'?[]:(await db.prepare("SELECT id,name,email,role,status FROM cms_users WHERE role='editor' ORDER BY name").all()).results;
   const safeContent=actor.role==='editor'?{...live.content,events:live.content.events.filter(e=>e.status==='published'||visibleKeys.has('post:'+e.id))}:live.content;
   const names=new Map<string,string>((await db.prepare('SELECT id,name FROM cms_users').all<{id:string;name:string}>()).results.map(user=>[user.id,user.name]));names.set(actor.id,actor.name);
   return json({actor,permissions:{approve:canApprove(actor),publish:canApprove(actor),editPages:actor.role!=='editor',manageUsers:actor.role!=='editor',maintenance:actor.role==='superadmin'},sections:visibleSections,content:safeContent,users,drafts:drafts.filter(d=>visibleKeys.has(d.key)).map(({body,base_body,...metadata})=>({...metadata,updated_by_name:names.get(metadata.updated_by)??'Website owner'}))});
  }
  if(req.method==='POST'&&url.searchParams.get('new')==='post'){
   if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'Choose a post type first.'},415);
   const inputText=await readBoundedText(req,2000);if(!inputText.ok)return json({error:'Request is too large.'},413);let input;try{input=JSON.parse(inputText.text);}catch{return json({error:'Invalid post type.'},400);}
   const postType=input?.postType as PostType;if(!postTypes.includes(postType))return json({error:'Choose Event, Announcement, Opportunity, or Story / Publication.'},400);
   const category=postType==='announcement'?'Announcements':postType==='opportunity'?'Opportunities':live.content.categories[0]||'Community';
   const labels:Record<PostType,string>={event:'Untitled event',announcement:'Untitled announcement',opportunity:'Untitled opportunity',story:'Untitled story / publication'};
   const id=crypto.randomUUID(),key='post:'+id,now=new Date().toISOString(),event=normalizePost({id,postType,title:labels[postType],summary:'',body:'',date:'',location:'',category,status:'draft',images:[],cover:0}),body=JSON.stringify({['@'+id]:event});
   await db.batch([db.prepare("INSERT INTO section_drafts (key,body,base_body,revision,status,updated_at,updated_by,owner_id,assigned_to,scheduled_at,publish_error) VALUES (?,?,'{}',1,'draft',?,?,?,?,NULL,NULL)").bind(key,body,now,actor.id,actor.id,actor.role==='editor'?actor.id:null),db.prepare("INSERT INTO section_history VALUES (?,?,?,1,'Post created',?,?)").bind(crypto.randomUUID(),key,body,now,actor.id),activityStatement(db,actor,'Created draft','post',key,labels[postType])]);return json({key},201);
  }
  const key=url.searchParams.get('key')!,section=sections.find(s=>s.key===key),row=await db.prepare('SELECT * FROM section_drafts WHERE key=?').bind(key).first<SectionRow>();if(!section||!allowed(actor,section,row))return json({error:'Section not found or not assigned to you.'},404);
  const current=extract(live.content,section),saved=row&&row.status!=='published'?hydrateSectionData(section,current,JSON.parse(row.body)):current;
  if(req.method==='GET'){
   if(url.searchParams.get('preview')==='1'){
    const c=merge(live.content,section,saved),renderers={home:renderHome,about:renderAbout,sodi:renderSodi,aiResearch:renderAiResearch,academy:renderAcademy,lab:renderLab,solutions:renderSolutions,contact:renderContact,account:(value:typeof c)=>renderAuthPage(value,'login'),legal:(value:typeof c)=>key==='legal:terms'?renderTerms(value):renderPrivacy(value)};
    const html=section.page==='posts'?renderEvent(c,c.events.find(e=>e.id===key.slice(5))!,true):section.page==='community'?renderCommunity(c,url):renderers[section.page as keyof typeof renderers](c),preview=html.replace('</body>',`<aside style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;background:#142b4b;color:white;padding:12px 22px;border-radius:8px;font:13px Arial,sans-serif;box-shadow:0 4px 24px #0004">Saved draft preview · ${esc(section.title)} · Not published</aside></body>`);
    return new Response(preview,{headers:secureHeaders({'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin'},true)});
   }
   const history=(await db.prepare('SELECT id,revision,action,created_at,created_by FROM section_history WHERE key=? ORDER BY created_at DESC LIMIT 30').bind(key).all()).results;
   return json({data:saved,base:current,revision:row?.revision??0,status:row?.status??'published',scheduledAt:row?.scheduled_at??null,publishError:row?.publish_error??null,assignedTo:row?.assigned_to??null,history});
  }
  if(!['PUT','POST'].includes(req.method))return json({error:'Method not allowed.'},405);if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required.'},415);const body=await readBoundedText(req,1000000);if(!body.ok)return json({error:'Section is too large.'},413);let input;try{input=JSON.parse(body.text);}catch{return json({error:'Invalid JSON.'},400);}if(input.revision!==(row?.revision??0))return json({error:'This section changed in another session. Reload before continuing.'},409);
  const now=new Date().toISOString(),revision=input.revision;
  if(input.assignTo!==undefined){if(!canApprove(actor)||section.page!=='posts'||!row)return json({error:'Admin access is required to assign posts.'},403);if(input.assignTo!==null){const editor=await db.prepare("SELECT id FROM cms_users WHERE id=? AND role='editor' AND status='active'").bind(input.assignTo).first();if(!editor)return json({error:'Choose an active Editor.'},400);}const results=await db.batch([db.prepare('UPDATE section_drafts SET assigned_to=?,revision=revision+1,updated_at=?,updated_by=? WHERE key=? AND revision=?').bind(input.assignTo,now,actor.id,key,revision),activityStatement(db,actor,'Changed assignment','post',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'Post changed.'},409);}
  if(key.startsWith('post:')&&(input.trash||input.restoreTrash)){
   if(input.restoreTrash){if(row?.status!=='trashed')return json({error:'This post is not in Trash.'},400);const results=await db.batch([db.prepare("UPDATE section_drafts SET status='draft',base_body='{}',revision=revision+1,scheduled_at=NULL,publish_error=NULL,updated_at=?,updated_by=? WHERE key=? AND revision=?").bind(now,actor.id,key,revision),db.prepare("INSERT INTO section_history SELECT ?,key,body,revision,'Restored from Trash',?,? FROM section_drafts WHERE key=? AND changes()=1").bind(crypto.randomUUID(),now,actor.id,key),activityStatement(db,actor,'Restored from Trash','post',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'Post changed. Reload first.'},409);}
   if(row?.status==='trashed')return json({error:'Post is already in Trash.'},400);if(JSON.stringify(input.base)!==JSON.stringify(current))return json({error:'Live post changed. Reload before moving to Trash.'},409);
   const id=key.slice(5),next={...live.content,events:live.content.events.filter(e=>e.id!==id),featured:live.content.featured.filter(x=>x!==id)},body=JSON.stringify(saved),update=row?db.prepare("UPDATE section_drafts SET status='trashed',body=?,revision=revision+1,scheduled_at=NULL,publish_error=NULL,updated_at=?,updated_by=? WHERE key=? AND revision=? AND changes()=1").bind(body,now,actor.id,key,revision):db.prepare("INSERT INTO section_drafts (key,body,base_body,revision,status,updated_at,updated_by,owner_id) SELECT ?,?,?,1,'trashed',?,?,? WHERE changes()=1").bind(key,body,JSON.stringify(current),now,actor.id,actor.id);
   const results=await db.batch([db.prepare('INSERT OR IGNORE INTO content_documents (id,body,revision,updated_at,updated_by) VALUES (1,?,0,?,?)').bind(JSON.stringify(live.content),now,actor.id),db.prepare('UPDATE content_documents SET body=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=?').bind(JSON.stringify(next),now,actor.id,live.revision),update,db.prepare("INSERT INTO section_history SELECT ?,key,body,revision,'Moved to Trash',?,? FROM section_drafts WHERE key=? AND changes()=1").bind(crypto.randomUUID(),now,actor.id,key),activityStatement(db,actor,'Moved to Trash','post',key,section.title)]);return results[1].meta.changes===1?json({ok:true}):json({error:'Post changed. Reload first.'},409);
  }
  if(row?.status==='trashed')return json({error:'Restore this post from Trash before editing.'},400);
  if(input.reset&&row){if(key.startsWith('post:')&&!live.content.events.some(e=>e.id===key.slice(5)))return json({error:'This post has no live version. Restore a saved draft from history.'},400);const results=await db.batch([db.prepare("UPDATE section_drafts SET body=?,base_body=?,status='published',revision=revision+1,scheduled_at=NULL,publish_error=NULL,updated_at=?,updated_by=? WHERE key=? AND revision=?").bind(JSON.stringify(current),JSON.stringify(current),now,actor.id,key,revision),db.prepare("INSERT INTO section_history SELECT ?,key,body,revision,'Reset to live',?,? FROM section_drafts WHERE key=? AND changes()=1").bind(crypto.randomUUID(),now,actor.id,key),activityStatement(db,actor,'Reset to live','section',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'Section changed. Reload first.'},409);}
  if(req.method==='PUT'||input.restore){
   let data=input.data;if(input.restore){const snapshot=await db.prepare('SELECT body FROM section_history WHERE id=? AND key=?').bind(input.restore,key).first<{body:string}>();if(!snapshot)return json({error:'Snapshot not found.'},404);data=JSON.parse(snapshot.body);}if(!data||typeof data!=='object')return json({error:'Section data required.'},400);data=hydrateSectionData(section,current,data);if(key.startsWith('post:')){const field='@'+key.slice(5),nextPost=data[field];if(nextPost?.id!==key.slice(5))return json({error:'Post identity cannot be changed.'},400);if(row&&!input.restore){const previous=normalizePost(JSON.parse(row.body)[field]);if(previous.postType!==nextPost?.postType)return json({error:'Post type cannot be changed after creation.'},400);}}
   if(actor.role==='admin'&&section.paths.some(path=>path.includes('sections.'))&&!['home:partners','home:community'].includes(key)){const visibility=section.paths.find(path=>path.includes('sections.'))!;if(JSON.stringify(data[visibility])!==JSON.stringify((row&&row.status!=='published'?JSON.parse(row.body):current)[visibility]))return json({error:'Only a Super Admin can change this section visibility.'},403);}
   let parsed;try{parsed=contentSchema.safeParse(merge(live.content,section,data));}catch{return json({error:'Incomplete section.'},400);}if(!parsed.success)return json({error:parsed.error.issues.map(i=>i.path.join('.')+': '+i.message).join('\n')},400);if((!row||row.status==='published')&&JSON.stringify(input.base)!==JSON.stringify(current))return json({error:'Live section changed. Reload before saving.'},409);
   const body=JSON.stringify(extract(parsed.data,section)),base=row&&row.status!=='published'?JSON.stringify(hydrateSectionData(section,current,JSON.parse(row.base_body))):JSON.stringify(current),update=row?db.prepare("UPDATE section_drafts SET body=?,base_body=?,revision=revision+1,status='draft',scheduled_at=NULL,publish_error=NULL,updated_at=?,updated_by=? WHERE key=? AND revision=?").bind(body,base,now,actor.id,key,revision):db.prepare("INSERT OR IGNORE INTO section_drafts (key,body,base_body,revision,status,updated_at,updated_by,owner_id) VALUES (?,?,?,1,'draft',?,?,?)").bind(key,body,base,now,actor.id,actor.id),baseline=(!row||row.status==='published')?[db.prepare("INSERT INTO section_history SELECT ?,key,?,revision,'Previous live version',?,? FROM section_drafts WHERE key=? AND changes()=1").bind(crypto.randomUUID(),JSON.stringify(current),now,actor.id,key)]:[];
   const results=await db.batch([update,...baseline,db.prepare('INSERT INTO section_history SELECT ?,key,body,revision,?,?,? FROM section_drafts WHERE key=? AND changes()=1').bind(crypto.randomUUID(),input.restore?'Restored to draft':'Draft saved',now,actor.id,key),activityStatement(db,actor,input.restore?'Restored version':'Saved draft',section.page==='posts'?'post':'section',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'Section changed. Reload first.'},409);
  }
  if(!row)return json({error:'Save a draft first.'},400);const next=input.status;
  if(next==='scheduled'){
   if(!canApprove(actor)||row.status!=='ready')return json({error:'An Admin must approve this exact version before scheduling.'},403);const publishAt=new Date(input.publishAt);if(!Number.isFinite(publishAt.getTime())||publishAt.getTime()<Date.now()+60000||publishAt.getTime()>Date.now()+366*86400000)return json({error:'Choose a time from one minute to one year in the future.'},400);const results=await db.batch([db.prepare("UPDATE section_drafts SET status='scheduled',scheduled_at=?,publish_error=NULL,revision=revision+1,updated_at=?,updated_by=? WHERE key=? AND revision=? AND status='ready'").bind(publishAt.toISOString(),now,actor.id,key,revision),db.prepare("INSERT INTO section_history SELECT ?,key,body,revision,'Scheduled',?,? FROM section_drafts WHERE key=? AND changes()=1").bind(crypto.randomUUID(),now,actor.id,key),activityStatement(db,actor,'Scheduled publication','section',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'The approved version changed.'},409);
  }
  if(row.status==='scheduled'&&next==='draft'){if(!canApprove(actor))return json({error:'Admin access required.'},403);const results=await db.batch([db.prepare("UPDATE section_drafts SET status='draft',scheduled_at=NULL,revision=revision+1,updated_at=?,updated_by=? WHERE key=? AND revision=?").bind(now,actor.id,key,revision),activityStatement(db,actor,'Cancelled schedule','section',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'Schedule changed.'},409);}
  const transitions:Record<string,string[]>=actor.role==='editor'?{draft:['qa'],qa:['draft']}:{draft:['qa'],qa:['draft','ready'],ready:['draft','published']};if(!transitions[row.status]?.includes(next))return json({error:'Follow Draft → QA Review → Ready to Publish.'},400);
  if(next==='published'){const result=await publishRow(db,row,actor);return result.ok?json({ok:true}):json({error:result.error},409);}
  const results=await db.batch([db.prepare('UPDATE section_drafts SET status=?,revision=revision+1,scheduled_at=NULL,publish_error=NULL,updated_at=?,updated_by=? WHERE key=? AND revision=?').bind(next,now,actor.id,key,revision),db.prepare('INSERT INTO section_history SELECT ?,key,body,revision,?,?,? FROM section_drafts WHERE key=? AND changes()=1').bind(crypto.randomUUID(),'Status: '+next,now,actor.id,key),activityStatement(db,actor,next==='qa'?'Submitted for QA':next==='ready'?'Approved for publication':'Returned to Draft',section.page==='posts'?'post':'section',key,section.title)]);return results[0].meta.changes===1?json({ok:true}):json({error:'Draft changed. Reload first.'},409);
 }catch(e){console.error('Section workspace',e);return json({error:'Unable to load or save this content. Your unsaved text remains on screen.'},503);}
}
