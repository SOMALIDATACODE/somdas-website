import {renderContact} from '../lib/contact-render';
import {contactApi} from '../lib/contact-api';
import {renderSodi,renderProgramIntro} from '../lib/sodi-render';
import {renderAbout} from '../lib/about-render';
import {renderAiResearch} from '../lib/ai-research-render';
import {renderAcademy} from '../lib/academy-render';
import {renderLab,renderSolutions} from '../lib/program-pages-render';
import { cmsApi, serveMedia } from '../lib/cms-api';
import {adminApi} from '../lib/admin-api';
import {runDueSchedules} from '../lib/section-api';
import {maintenanceState} from '../lib/admin-management-api';
import {recordPageView,visitorCookie} from '../lib/analytics';
import { readContent } from '../lib/storage';
import { renderHome, renderCommunity, renderEvent, missing } from '../lib/render';
import { getPublicMemberFromRequest, memberAuthApi } from '../lib/member-auth';
import {renderAuthPage,renderPrivacy,renderTerms} from '../lib/legal-render';
import {renderProfile} from '../lib/profile-render';
import {secureHeaders,secureResponse} from '../lib/security';
import {cmsAuthApi} from '../lib/cms-auth';
import {getCMSActor} from '../lib/cms-access';
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_OTP_SECRET?: string;
  CMS_AUTH_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if(url.pathname==='/favicon.ico')return secureResponse(Response.redirect(new URL('/assets/somdas-mark.png',request.url).href,308));
    if(url.pathname==='/api/session'||url.pathname.startsWith('/api/auth/'))return memberAuthApi(request,env);
    if(url.pathname.startsWith('/api/admin/auth/'))return cmsAuthApi(request,env);
    if(url.pathname==='/api/contact')return contactApi(request,env.DB);
    if(url.pathname==='/sodi')return secureResponse(Response.redirect(new URL('/programs/sodi',request.url).href,308));
    if(url.pathname==='/activities'||url.pathname.startsWith('/activities/'))return secureResponse(Response.redirect(new URL(url.pathname.replace(/^\/activities/,'/community')+url.search,request.url).href,308));
    if(url.pathname.startsWith('/api/editor/')) return cmsApi(request,env);
    if(url.pathname.startsWith('/api/admin/')) {ctx.waitUntil(runDueSchedules(env));return adminApi(request,env);}
    if(url.pathname.startsWith('/media/')) {try{return secureResponse(await serveMedia(request,env));}catch(e){console.error('Media unavailable',e);return new Response('Image unavailable',{status:503,headers:secureHeaders()});}}
    if(url.pathname==='/editor'||url.pathname.startsWith('/editor/'))return secureResponse(Response.redirect(new URL('/admin',request.url).href,308));
    if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')){
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:secureHeaders({'Allow':'GET, HEAD'})});
      if(url.pathname!='/admin/login'&&!await getCMSActor(env.DB,request.headers)){const returnTo=encodeURIComponent(url.pathname+url.search);return secureResponse(Response.redirect(new URL(`/admin/login?returnTo=${returnTo}`,request.url).href,303));}
      return secureResponse(await handler.fetch(request,env,ctx));
    }
    if(url.pathname==='/' || url.pathname==='/about' || url.pathname==='/contact' || url.pathname==='/terms' || url.pathname==='/privacy' || url.pathname==='/login' || url.pathname==='/signup' || url.pathname==='/profile' || url.pathname.startsWith('/programs/') || url.pathname==='/community' || url.pathname.startsWith('/community/')){
      ctx.waitUntil(runDueSchedules(env));
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:secureHeaders({'Allow':'GET, HEAD'})});
      try{
        const cmsActor=await getCMSActor(env.DB,request.headers),maintenance=await maintenanceState(env.DB);if(maintenance.enabled&&!cmsActor)return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Website maintenance | SOMDAS</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#061b3c;color:white;font:16px Inter,Arial,sans-serif"><main style="width:min(620px,86%);text-align:center"><strong style="color:#65b9ff;letter-spacing:.12em">SOMDAS</strong><h1 style="font-size:clamp(2rem,6vw,4rem);margin:22px 0">We’ll be back shortly.</h1><p style="color:#c7d5e8;line-height:1.8">${String(maintenance.message).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}</p></main></body></html>`,{status:503,headers:secureHeaders({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'300'},true)});
        const {content}=await readContent(env.DB);let html:string,status=200;
        const profileMember=url.pathname==='/profile'?await getPublicMemberFromRequest(request,env.DB):null;
        if(url.pathname==='/profile'&&!profileMember)return secureResponse(Response.redirect(new URL('/login?returnTo=%2Fprofile',request.url).href,303));
        if(url.pathname==='/')html=renderHome(content);
        else if(url.pathname==='/programs/sodi')html=renderSodi(content);
        else if(url.pathname==='/programs/ai-research')html=renderAiResearch(content);
        else if(url.pathname==='/programs/academy')html=renderAcademy(content);
        else if(url.pathname==='/programs/innovation-lab')html=renderLab(content);
        else if(url.pathname==='/programs/digital-solutions')html=renderSolutions(content);
        else if(url.pathname.startsWith('/programs/')){const page=renderProgramIntro(content,url.pathname.slice(10));html=page||missing(content);if(!page)status=404;}
        else if(url.pathname==='/contact')html=renderContact(content);
        else if(url.pathname==='/about')html=renderAbout(content);
        else if(url.pathname==='/terms')html=renderTerms(content);
        else if(url.pathname==='/privacy')html=renderPrivacy(content);
        else if(url.pathname==='/login')html=renderAuthPage(content,'login');
        else if(url.pathname==='/signup')html=renderAuthPage(content,'signup');
        else if(url.pathname==='/profile')html=renderProfile(content,profileMember!);
        else if(url.pathname==='/community')html=renderCommunity(content,url);
        else {const id=url.pathname.split('/')[2];const event=content.events.find(e=>e.id===id&&(e.status==='published'||(url.searchParams.get('preview')==='1'&&cmsActor)));html=event?renderEvent(content,event,event.status==='draft'):missing(content);if(!event)status=404;}
        const headers=new Headers(secureHeaders({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},true));if(request.method==='GET'&&status===200&&url.searchParams.get('preview')!=='1'){const visitor=visitorCookie(request);if(visitor.isNew)headers.append('Set-Cookie',visitor.header);ctx.waitUntil(recordPageView(request,env,visitor.id));}return new Response(request.method==='HEAD'?null:html,{status,headers});
      }catch(e){console.error('Public content unavailable',e);return new Response('<!doctype html><title>Temporarily unavailable | SOMDAS</title><h1>Content is temporarily unavailable.</h1>',{status:503,headers:secureHeaders({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},true)});}
    }
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return secureResponse(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths));
    }

    return secureResponse(await handler.fetch(request, env, ctx));
  },
  async scheduled(_controller:unknown,env:Env,ctx:ExecutionContext){ctx.waitUntil(runDueSchedules(env));},
};

export default worker;
