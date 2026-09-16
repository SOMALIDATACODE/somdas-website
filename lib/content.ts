import {sodiSchema,defaultSodi} from './sodi-content';
import {aboutSchema,defaultAbout} from './about-content';
import {aiResearchSchema,defaultAiResearch} from './ai-research-content';
import {academySchema,defaultAcademy} from './academy-content';
import {programPageSchema,defaultLab,defaultSolutions} from './program-pages-content';
import {contactSettingsSchema,defaultContactSettings} from './contact-settings';
import {authCopySchema,defaultAuthCopy,defaultLegal,legalSchema} from './legal-content';
import { z } from 'zod';
import homeDefaults from './home-defaults.json';
export const sectionNames = {hero:'Hero',partners:'Partners','our-programs':'Our programs','sodi-flagship':'SODI flagship',about:'Five connected moves',focus:'Focus areas',community:'Community & activities','get-involved':'Get involved'} as const;
export const defaultSectionOrder=Object.keys(sectionNames);
const text = (n:number) => z.string().trim().max(n);
const imagePath = z.string().regex(/^\/(?:assets\/[a-zA-Z0-9._-]+|media\/[a-f0-9-]+)$/).or(z.literal(''));
const image = z.object({url:imagePath,alt:text(250)});
export const postTypes=['event','announcement','opportunity','story'] as const;
export type PostType=(typeof postTypes)[number];
const safePostUrl=z.string().url().refine(x=>/^https:\/\//.test(x),{message:'Use an HTTPS link.'}).or(z.literal(''));
export const postDefaults={
 postType:'event' as PostType,author:'',publishDate:'',endDate:'',time:'',eventFormat:'',registrationUrl:'',organizer:'',capacity:'',
 announcementDate:'',priority:'normal' as const,expiryDate:'',attachmentUrl:'',deadline:'',eligibility:'',opportunityType:'',applicationUrl:'',organization:'',
 contributors:'',publicationDate:'',documentUrl:'',externalUrl:'',readingTime:''
};
export const contentSchema = z.object({
 home:z.record(z.string(),z.record(z.string(),z.string().max(6000))).default(homeDefaults).superRefine((home,ctx)=>{for(const [section,fields] of Object.entries(home))for(const [key,value] of Object.entries(fields)){if(key.startsWith('image')&&!/^\/(assets|media)\/[a-zA-Z0-9._-]+$/.test(value))ctx.addIssue({code:'custom',path:[section,key],message:'Choose an uploaded image or an existing asset.'});if(key.startsWith('link')&&!/^(\/(?!\/)|https:\/\/|#)/.test(value))ctx.addIssue({code:'custom',path:[section,key],message:'Use a local path, anchor, or HTTPS link.'});}}),
 about:aboutSchema,
 sodi:sodiSchema,
 aiResearch:aiResearchSchema,
 academy:academySchema,
 lab:programPageSchema,
 solutions:programPageSchema,
 contact:contactSettingsSchema,
 auth:authCopySchema,
 legal:legalSchema,
 sections:z.object(Object.fromEntries(Object.keys(sectionNames).map(k=>[k,z.boolean()])) as Record<keyof typeof sectionNames,z.ZodBoolean>),
 sectionOrder:z.array(z.string()).default(defaultSectionOrder),
 partnersTitle:text(120).min(1), partnersIntro:text(500),
 partners:z.array(z.object({id:z.string().uuid(),name:text(120).min(1),logo:imagePath,url:z.string().url().refine(x=>/^https:\/\//.test(x)).or(z.literal(''))})).max(60),
 communityTitle:text(150).min(1),communityIntro:text(600),
 categories:z.array(text(60).min(1)).max(30),
 featured:z.array(text(100).min(1)).max(3),
 events:z.array(z.object({id:text(100).regex(/^[a-z0-9-]+$/),postType:z.enum(postTypes).default('event'),title:text(180).min(1),summary:text(500),body:text(30000),author:text(150).default(''),publishDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),time:text(80).default(''),location:text(150),eventFormat:text(80).default(''),registrationUrl:safePostUrl.default(''),organizer:text(150).default(''),capacity:text(40).default(''),announcementDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),priority:z.enum(['normal','important','urgent']).default('normal'),expiryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),attachmentUrl:safePostUrl.default(''),deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),eligibility:text(3000).default(''),opportunityType:text(100).default(''),applicationUrl:safePostUrl.default(''),organization:text(150).default(''),contributors:text(500).default(''),publicationDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),documentUrl:safePostUrl.default(''),externalUrl:safePostUrl.default(''),readingTime:text(40).default(''),category:text(60).min(1),status:z.enum(['draft','published']),images:z.array(image).max(20),cover:z.number().int().min(0).max(19)})).max(300)
}).superRefine((v,ctx)=>{
 const err=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(new Set(v.categories).size!==v.categories.length)err('Category names must be unique.');
 if(new Set(v.events.map(e=>e.id)).size!==v.events.length)err('Event IDs must be unique.');
 if(new Set(v.partners.map(e=>e.id)).size!==v.partners.length)err('Partner IDs must be unique.');
 if(new Set(v.featured).size!==v.featured.length)err('Choose each homepage event only once.');
 if(v.sectionOrder.length!==defaultSectionOrder.length||new Set(v.sectionOrder).size!==defaultSectionOrder.length||defaultSectionOrder.some(id=>!v.sectionOrder.includes(id)))err('Homepage section order must include every section exactly once.');
 for(const id of v.featured)if(!v.events.some(e=>e.id===id&&e.status==='published'))err('Homepage picks must be published events.');
 for(const e of v.events){if(!v.categories.includes(e.category))err('Every event needs an existing category.');if(e.images.length&&e.cover>=e.images.length)err('Choose an available cover image.');if(e.status==='published'&&(!e.summary||!e.body))err('Published events need a summary and story.');if(e.images.some(i=>!i.url||!i.alt))err('Every image needs a file and description.');}
});
export type Content = z.infer<typeof contentSchema>;
export type Event = Content['events'][number];
export const initialContent:Content = {
 home:structuredClone(homeDefaults),
 about:structuredClone(defaultAbout),
 sodi:structuredClone(defaultSodi),
 aiResearch:structuredClone(defaultAiResearch),
 academy:structuredClone(defaultAcademy),
 lab:structuredClone(defaultLab),
 solutions:structuredClone(defaultSolutions),
 contact:structuredClone(defaultContactSettings),
 auth:structuredClone(defaultAuthCopy),
 legal:structuredClone(defaultLegal),
 sections:{hero:true,partners:false,'our-programs':true,'sodi-flagship':true,about:true,focus:true,community:true,'get-involved':true},
 sectionOrder:structuredClone(defaultSectionOrder),
 partnersTitle:'Our partners',partnersIntro:'Working together to advance Somalia’s data future.',partners:[],
 communityTitle:'Good ideas grow when people connect.',communityIntro:'Stories, research and shared learning from our community.',
 categories:['Conferences','Workshops & training','Community','Announcements','Opportunities'],featured:['telecom-hackathon-2026'],
 events:[
 {id:'humc-2026',...postDefaults,postType:'event',title:'Research conversations at HUMC',summary:'Research presentations and conversations at the Hormuud University conference.',body:'',date:'2026-07-18',location:'Jazeera Palace Hotel, Mogadishu, Somalia',category:'Conferences',status:'draft',cover:0,images:[{url:'/assets/humc-discussion.jpg',alt:'Participants discussing a research poster at HUMC'},{url:'/assets/humc-presentation.jpg',alt:'A presenter explaining a research poster at HUMC'},{url:'/assets/humc-group.jpg',alt:'Five participants standing beside a research poster at HUMC'}]},
 {id:'indaba-research',...postDefaults,postType:'story',title:'Research exchange at Deep Learning Indaba',summary:'Sharing research and connecting with the African machine learning community.',body:'',date:'',location:'',category:'Conferences',status:'draft',cover:0,images:[{url:'/assets/indaba-discussion.jpg',alt:'Participants exchanging ideas beside a research poster at Indaba'},{url:'/assets/indaba-poster.jpg',alt:'Two participants beside a poster on rainfall variability in Somalia'}]},
 {id:'telecom-hackathon-2026',...postDefaults,postType:'event',title:'AI for Telecom Network Fault Detection',summary:'A hackathon showcase connecting real telecom challenges with AI, teamwork and practical problem-solving.',body:'National Training Week — a virtual session on 3 September 2026.\n\nSpeaker: Omar Jibril Hassan.\n\nExploring what hackathons involve, how AI can address real problems, and how collaborative projects help build skills and portfolios.',date:'2026-09-03',location:'Virtual session',category:'Workshops & training',status:'published',cover:0,images:[]}
 ]
};
export function normalizePost(post:any):Content['events'][number]{
 const inferred:PostType=post?.postType??(post?.category==='Announcements'?'announcement':post?.category==='Opportunities'?'opportunity':'event');
 return {...postDefaults,...post,postType:inferred};
}
export function publicContent(c:Content):Content{return {...c,events:c.events.filter(e=>e.status==='published')};}
export function isEditor(h:Headers){return Boolean(h.get('oai-authenticated-user-id')) && h.get('oai-authenticated-user-email')?.toLowerCase()==='yusufabdisalamyusuf@gmail.com';}
