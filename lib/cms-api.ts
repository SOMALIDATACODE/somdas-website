import {contentSchema} from './content';
import {getCMSActor} from './cms-access';
import {readContent,saveContent} from './storage';
import {readBoundedText,secureHeaders} from './security';
export type CMSEnv={DB:D1Database,BUCKET:R2Bucket,CMS_AUTH_SECRET?:string,RESEND_API_KEY?:string,AUTH_EMAIL_FROM?:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:secureHeaders({'Cache-Control':'no-store'})});
export async function cmsApi(req:Request,env:CMSEnv):Promise<Response>{
 const path=new URL(req.url).pathname;
 const actor=await getCMSActor(env.DB,req.headers);
 if(!actor)return json({error:'A valid CMS session is required.'},401);
 if(path!=='/api/editor/upload'&&actor.role!=='superadmin')return json({error:'Super Admin access required.'},403);
 if(req.method!=='GET'&&req.headers.get('Origin')!==new URL(req.url).origin)return json({error:'Please save from the SOMDAS editor.'},403);
 try{
 if(path==='/api/editor/messages'&&req.method==='GET'){const page=Math.max(0,Math.min(100000,Number(new URL(req.url).searchParams.get('page'))||0));const result=await env.DB.prepare('SELECT id,name,email,topic,message,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 51 OFFSET ?').bind(Math.floor(page)*50).all();return json({messages:result.results.slice(0,50),more:result.results.length>50});}
 if(path==='/api/editor/content'&&req.method==='GET')return json(await readContent(env.DB));
 if(path==='/api/editor/content'&&req.method==='PUT'){
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required.'},415);
 if(Number(req.headers.get('content-length'))>1500000)return json({error:'Content is too large.'},413);
 const body=await readBoundedText(req,1500000);if(!body.ok)return json({error:'Content is too large.'},413);const raw=body.text;
 const input=JSON.parse(raw);if(!input.content?.home||!input.content?.about||!input.content?.sodi||!input.content?.aiResearch||!input.content?.academy||!input.content?.lab||!input.content?.solutions||!input.content?.contact)return json({error:"The editor has been updated. Download any unsaved changes, then reload to include the latest page controls before saving."},409);const parsed=contentSchema.safeParse(input.content);
 if(!parsed.success)return json({error:parsed.error.issues.map(i=>i.message).join(' ')},400);
 if(!Number.isSafeInteger(input.revision)||input.revision<0)return json({error:'Invalid content revision.'},400);
 // Only accept uploaded images that exist in this Site's storage.
 const paths=[...Object.values(parsed.data.home).flatMap(fields=>Object.entries(fields).filter(([key])=>key.startsWith('image')).map(([,value])=>value)),parsed.data.about.intro.image,...parsed.data.about.team.map(m=>m.image),...parsed.data.aiResearch.projects.map(p=>p.image),...parsed.data.partners.map(p=>p.logo),...parsed.data.events.flatMap(e=>e.images.map(i=>i.url))];
 for(const path of new Set(paths.filter(p=>p.startsWith('/media/'))))if(!await env.DB.prepare('SELECT id FROM media WHERE id = ?').bind(path.slice(7)).first())return json({error:'An image is missing. Please upload it again.'},400);
 const saved=await saveContent(env.DB,parsed.data,input.revision,actor.id);
 return saved?json({revision:input.revision+1}):json({error:'A newer version was saved in another tab. Download your unsaved copy, then reload before merging your changes.'},409);
 }
 if(path==='/api/editor/upload'&&req.method==='POST'){
 const allowed=['image/jpeg','image/png','image/webp'];const type=req.headers.get('content-type')||'';
 if(!allowed.includes(type))return json({error:'Choose a JPEG, PNG or WebP image.'},415);
 const length=Number(req.headers.get('content-length'));if(length>8388608)return json({error:'Image must be 8 MB or smaller.'},413);
 const reader=req.body?.getReader();if(!reader)return json({error:'Choose an image.'},400);
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8388608){await reader.cancel();return json({error:'Image must be 8 MB or smaller.'},413);}chunks.push(value);}
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 const valid=type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':new TextDecoder().decode(data.slice(0,4))==='RIFF'&&new TextDecoder().decode(data.slice(8,12))==='WEBP';
 if(!valid)return json({error:'The file is not a valid JPEG, PNG or WebP image.'},400);
 const id=crypto.randomUUID();await env.BUCKET.put(id,data,{httpMetadata:{contentType:type}});
 try{await env.DB.prepare('INSERT INTO media (id,filename,type,size,created_at,created_by) VALUES (?,?,?,?,?,?)').bind(id,(req.headers.get('x-filename')||'image').slice(0,250),type,size,new Date().toISOString(),actor!.id).run();}catch(e){await env.BUCKET.delete(id);throw e;}
 return json({url:'/media/'+id},201);
 }
 return json({error:'Route not found.'},404);
 }catch(e){console.error('CMS operation failed',e);return json({error:'Unable to load or save content. Your edits are still here. Please try again.'},e instanceof SyntaxError?400:503);}
}
export async function serveMedia(req:Request,env:CMSEnv){
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:secureHeaders({'Allow':'GET, HEAD'})});
 const id=new URL(req.url).pathname.slice(7);if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
 const url='/media/'+id;const {content}=await readContent(env.DB);
 const visible=Object.entries(content.home||{}).some(([section,fields])=>content.sections[section as keyof typeof content.sections]&&Object.entries(fields).some(([key,value])=>key.startsWith('image')&&value===url))||(content.about.sections.intro&&content.about.intro.image===url)||(content.about.sections.team&&content.about.team.some(m=>m.visible&&m.image===url))||(content.aiResearch.sections.publications&&content.aiResearch.projects.some(p=>p.visible&&p.image===url))||content.events.some(e=>e.status==='published'&&e.images.some(i=>i.url===url))||(content.sections.partners&&content.partners.some(p=>p.logo===url));
 if(!visible&&!await getCMSActor(env.DB,req.headers))return new Response('Not found',{status:404});
 const file=await env.BUCKET.get(id);if(!file)return new Response('Not found',{status:404});
 return new Response(req.method==='HEAD'?null:file.body,{headers:secureHeaders({'Content-Type':file.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-cache'})});
}
