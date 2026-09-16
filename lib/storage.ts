import {defaultSodi} from './sodi-content';
import {defaultAbout} from './about-content';
import {defaultAiResearch} from './ai-research-content';
import {defaultAcademy} from './academy-content';
import {defaultLab,defaultSolutions} from './program-pages-content';
import {defaultContactSettings} from './contact-settings';
import {defaultAuthCopy,defaultLegal} from './legal-content';
import { initialContent, normalizePost, type Content } from './content';
export async function readContent(db:D1Database):Promise<{content:Content,revision:number}>{
 if(!db)throw new Error('Content database unavailable');
 const row=await db.prepare('SELECT body, revision FROM content_documents WHERE id = 1').first<{body:string,revision:number}>();
 return row?{content:withAbout(JSON.parse(row.body)),revision:row.revision}:{content:structuredClone(initialContent),revision:0};
}
export async function saveContent(db:D1Database,content:Content,revision:number,user:string){
 const body=JSON.stringify(content),now=new Date().toISOString();
 const result=revision===0?await db.prepare('INSERT OR IGNORE INTO content_documents (id, body, revision, updated_at, updated_by) VALUES (1, ?, 1, ?, ?)').bind(body,now,user).run():await db.prepare('UPDATE content_documents SET body = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = 1 AND revision = ?').bind(body,now,user,revision).run();
 return result.meta.changes===1;
}

export function withAbout(content:Content):Content {const categories=[...(content.categories||[])];for(const name of ['Announcements','Opportunities'])if(!categories.includes(name))categories.push(name);return {...content,home:content.home??structuredClone(initialContent.home),sectionOrder:content.sectionOrder??structuredClone(initialContent.sectionOrder),categories,events:(content.events||[]).map(normalizePost),about:content.about??structuredClone(defaultAbout),sodi:content.sodi??structuredClone(defaultSodi),aiResearch:content.aiResearch??structuredClone(defaultAiResearch),academy:content.academy??structuredClone(defaultAcademy),lab:content.lab??structuredClone(defaultLab),solutions:content.solutions??structuredClone(defaultSolutions),contact:content.contact??structuredClone(defaultContactSettings),auth:{...structuredClone(defaultAuthCopy),...(content.auth||{})},legal:content.legal??structuredClone(defaultLegal)};}
