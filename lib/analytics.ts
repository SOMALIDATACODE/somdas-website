type AnalyticsEnv={DB:D1Database};
const cookieName='somdas_visitor';
const dateString=(d=new Date())=>d.toISOString().slice(0,10);
async function digest(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function visitorCookie(req:Request){const found=req.headers.get('cookie')?.match(new RegExp('(?:^|;\\s*)'+cookieName+'=([a-f0-9-]{36})'));const id=found?.[1]||crypto.randomUUID();return {id,isNew:!found,header:`${cookieName}=${id}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`};}
export async function recordPageView(req:Request,env:AnalyticsEnv,visitorId:string){try{
 const url=new URL(req.url),date=dateString(),visitorHash=await digest(visitorId),ua=req.headers.get('user-agent')||'',device=/tablet|ipad/i.test(ua)?'Tablet':/mobile|android|iphone/i.test(ua)?'Mobile':'Desktop';let referrer='Direct';
 const raw=req.headers.get('referer');if(raw)try{const host=new URL(raw).hostname;referrer=host===url.hostname?'Internal':host.slice(0,120);}catch{}
 const statement=env.DB.prepare('INSERT INTO analytics_events (id,date,path,visitor_hash,referrer,device,created_at) VALUES (?,?,?,?,?,?,?)');if(typeof statement.bind!=='function')return;await env.DB.batch([statement.bind(crypto.randomUUID(),date,url.pathname.slice(0,300),visitorHash,referrer,device,new Date().toISOString()),env.DB.prepare("DELETE FROM analytics_events WHERE date < date('now','-400 days')")]);
 }catch(e){console.error('Analytics event unavailable',e);}}
export async function analyticsReport(db:D1Database,days:number){
 const safe=[7,30,90].includes(days)?days:30,start=new Date(Date.now()-(safe-1)*86400000).toISOString().slice(0,10),previous=new Date(Date.now()-(safe*2-1)*86400000).toISOString().slice(0,10),previousEnd=new Date(Date.now()-safe*86400000).toISOString().slice(0,10);
 const [summary,prior,trend,pages,referrers,devices]=await Promise.all([
  db.prepare('SELECT COUNT(*) views,COUNT(DISTINCT visitor_hash) visitors FROM analytics_events WHERE date>=?').bind(start).first<{views:number,visitors:number}>(),
  db.prepare('SELECT COUNT(*) views,COUNT(DISTINCT visitor_hash) visitors FROM analytics_events WHERE date BETWEEN ? AND ?').bind(previous,previousEnd).first<{views:number,visitors:number}>(),
  db.prepare('SELECT date,COUNT(*) views,COUNT(DISTINCT visitor_hash) visitors FROM analytics_events WHERE date>=? GROUP BY date ORDER BY date').bind(start).all(),
  db.prepare('SELECT path,COUNT(*) views,COUNT(DISTINCT visitor_hash) visitors FROM analytics_events WHERE date>=? GROUP BY path ORDER BY views DESC LIMIT 15').bind(start).all(),
  db.prepare("SELECT referrer,COUNT(*) views FROM analytics_events WHERE date>=? AND referrer!='Internal' GROUP BY referrer ORDER BY views DESC LIMIT 10").bind(start).all(),
  db.prepare('SELECT device,COUNT(*) views FROM analytics_events WHERE date>=? GROUP BY device ORDER BY views DESC').bind(start).all()
 ]);
 return {days:safe,summary:summary??{views:0,visitors:0},prior:prior??{views:0,visitors:0},trend:trend.results,pages:pages.results,referrers:referrers.results,devices:devices.results};
}
