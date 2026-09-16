import {z} from 'zod';
import {secureHeaders} from './security';
const schema=z.object({name:z.string().trim().min(1).max(100),email:z.string().trim().email().max(254),topic:z.enum(['General enquiry','Data contribution','Research & collaboration','Learning & community','Digital solutions']),message:z.string().trim().min(10).max(5000),website:z.string().max(100).optional()});
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:secureHeaders({'Cache-Control':'no-store'})});
export async function contactApi(req:Request,db:D1Database){
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Please send from the contact page.'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required.'},415);
 try{
 const reader=req.body?.getReader();if(!reader)return json({error:'Please fill in the form.'},400);
 let bytes=0,raw='';const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>24000){await reader.cancel();return json({error:'Your message is too long.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
 const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Please check your name, email, topic and message (10–5,000 characters).'},400);
 const d=parsed.data;if(d.website)return json({error:'Please try again without filling the website field.'},400);
 const now=new Date().toISOString(),since=new Date(Date.now()-60000).toISOString();
 const result=await db.prepare('INSERT INTO contact_messages (id,name,email,topic,message,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM contact_messages WHERE email = ? AND created_at > ?) < 3').bind(crypto.randomUUID(),d.name,d.email.toLowerCase(),d.topic,d.message,now,d.email.toLowerCase(),since).run();
 return result.meta.changes===1?json({ok:true},201):json({error:'Please wait a minute before sending another message.'},429);
 }catch(error){console.error('Contact submission failed',error);return json({error:'Your message was not sent. Please try again.'},error instanceof SyntaxError?400:503);}
}
