import template from '../content/home.html?raw';
import homeDefaults from './home-defaults.json';
import {initialContent,type Content,type Event,sectionNames} from './content';

export const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(e:Event)=>e.date?new Date(e.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'';
const socialIcons={facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9c0-.7.3-1 1-1Z"/></svg>',twitter:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 16M19 4 5 20"/></svg>',instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',tiktok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v12.2a4.2 4.2 0 1 1-3.4-4.1M14 3c.7 3 2.3 4.6 5 5"/></svg>',linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="4" height="11"/><path d="M6 6v.01M12 20V9h4v2c1-2 5-2 5 2v7"/></svg>'};
export function renderSocialLinks(c:Content,variant='footer-socials'){const labels={facebook:'Facebook',twitter:'X / Twitter',instagram:'Instagram',tiktok:'TikTok',linkedin:'LinkedIn'};const links=(Object.keys(labels) as (keyof typeof labels)[]).filter(key=>c.contact[key]).map(key=>`<a href="${esc(c.contact[key])}" target="_blank" rel="noopener noreferrer" aria-label="${labels[key]}">${socialIcons[key]}</a>`).join('');return links?`<div class="${variant}">${links}</div>`:'';}

function card(e:Event){
 const cover=e.images[e.cover];
 return `<article class="activity-card"><a class="activity-cover" href="/community/${esc(e.id)}">${cover?`<img src="${esc(cover.url)}" alt="${esc(cover.alt)}" loading="lazy">`:`<div class="activity-placeholder" aria-hidden="true"><span>${esc(e.category)}</span>Ideas.<br>People.<br>Possibilities.</div>`}</a><div class="activity-copy"><span class="activity-meta">${esc(e.category)}${e.date?' · '+esc(date(e)):''}</span><h3><a href="/community/${esc(e.id)}">${esc(e.title)}</a></h3><p>${esc(e.summary)}</p><a class="activity-read" href="/community/${esc(e.id)}">View activity <span aria-hidden="true">→</span></a></div></article>`;
}

function mosaicCard(e:Event,index:number){
 const cover=e.images[e.cover],featured=index===0;
 return `<a class="community-mosaic-item${featured?' community-mosaic-lead':''}" href="/community/${esc(e.id)}" aria-label="View activity: ${esc(e.title)}">${cover?`<img src="${esc(cover.url)}" alt="${esc(cover.alt)}" loading="lazy">`:`<span class="community-mosaic-placeholder" aria-hidden="true"><b>${esc(e.category)}</b><i></i><i></i><i></i></span>`}<span class="community-mosaic-shade"></span><span class="community-mosaic-copy"><small>${esc(e.category)}${e.date?' · '+esc(date(e)):''}</small><strong>${esc(e.title)}</strong>${featured?`<span>${esc(e.summary)}</span>`:''}</span><span class="community-mosaic-arrow" aria-hidden="true">↗</span></a>`;
}

export function renderHome(c:Content){
 let html=template;
 html=html.replace(/<(h[1-4]|p|strong|small|a)([^>]*data-home-field="([^.]+)\.([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,(full,tag,attrs,section,key)=>{const value=c.home?.[section]?.[key],original=(homeDefaults as Record<string,Record<string,string>>)[section]?.[key];return value===undefined||value===original?full:`<${tag}${attrs}>${esc(value).replace(/\n/g,'<br>')}</${tag}>`;});
 html=html.replace(/<(h[1-4]|p)([^>]*data-auth-copy="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,(_full,tag,attrs,key)=>`<${tag}${attrs}>${esc(c.auth[key as keyof typeof c.auth])}</${tag}>`);
 for(const attr of ['src','alt','href'])html=html.replace(new RegExp('<(?:img|a)\\b[^>]*data-home-'+attr+'="([^.]+)\\.([^"]+)"[^>]*>','g'),(tag,section,key)=>{const value=c.home?.[section]?.[key];if(value===undefined)return tag;if(attr==='src'&&!/^\/(assets|media)\/[a-zA-Z0-9._-]+$/.test(value))return tag;if(attr==='href'&&!/^(\/(?!\/)|https:\/\/|#)/.test(value))return tag;return tag.replace(new RegExp('(?<![\\w-])'+attr+'="[^"]*"'),`${attr}="${esc(value)}"`);});
 const replace=(id:string,value:string)=>{html=html.replace(new RegExp('<section\\b[^>]*\\bid="'+id+'"[^>]*>[\\s\\S]*?</section>'),value);};
 const partnerLogos=c.partners.filter(partner=>partner.logo);
 replace('partners',c.sections.partners&&partnerLogos.length?`<section class="partners-section" id="partners" aria-labelledby="partners-title"><div class="section-container"><header class="partners-heading"><h2 class="eyebrow" id="partners-title">${esc(c.partnersTitle)}</h2><p class="partners-intro">${esc(c.partnersIntro)}</p></header><ul class="partner-list">${partnerLogos.map(p=>`<li>${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${esc(p.name)}">`:''}<img class="partner-logo" src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy">${p.url?'</a>':''}</li>`).join('')}</ul></div></section>`:'');
 const published=c.events.filter(e=>e.status==='published').sort((a,b)=>b.date.localeCompare(a.date)),featured=c.featured.map(id=>published.find(e=>e.id===id)).filter((e):e is Event=>!!e),events=[...featured,...published.filter(e=>!featured.some(f=>f.id===e.id))].slice(0,4);
 replace('community',c.sections.community?`<section class="community-section lower-section" id="community"><div class="section-container"><header class="lower-heading split-heading"><div><p class="eyebrow">Community & activities</p><h2>${esc(c.communityTitle)}</h2></div><p>${esc(c.communityIntro)}</p></header>${events.length?`<div class="community-mosaic community-mosaic-count-${events.length}">${events.map(mosaicCard).join('')}</div>`:'<div class="community-home-empty"><p>Community stories will appear here soon.</p></div>'}<div class="activity-actions"><a class="button" href="/community#community-stories">View all activities <span aria-hidden="true">→</span></a></div></div></section>`:'');
 for(const id of Object.keys(sectionNames) as (keyof typeof sectionNames)[])if(!c.sections[id])replace(id,'');
 const hidden=Object.entries(c.sections).filter(([,on])=>!on).map(([id])=>id);
 if(!c.sections['our-programs'])hidden.push('sodi','ai-research','academy','lab','digital');
 if(!c.sections['sodi-flagship'])hidden.push('sodi-details');
 for(const id of hidden)html=html.replace(new RegExp('<a\\b[^>]*href="#'+id+'"[^>]*>[\\s\\S]*?</a>','g'),'');
 html=html.replace(/<main id="main">([\s\S]*?)<\/main>/,(_main,body)=>{
  const found=new Map<string,string>();
  for(const match of body.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/section>/g))found.set(match[1],match[0]);
  const order=c.sectionOrder??Object.keys(sectionNames);
  const ordered=order.map(id=>found.get(id)).filter(Boolean).join('\n');
  const extras=[...found.entries()].filter(([id])=>!order.includes(id)).map(([,section])=>section).join('\n');
  return `<main id="main">${ordered}${extras}</main>`;
 });
 html=html.replace('<div class="footer-socials" data-social-links></div>',renderSocialLinks(c)).replace('<a class="footer-email" data-contact-email href="mailto:info@somdas.org">info@somdas.org</a>',`<a class="footer-email" data-contact-email href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a>`);
 return html;
}

function communityShell(c:Content,title:string,body:string){
 return renderHome(c)
  .replace(/<main id="main">[\s\S]*?<\/main>/,()=>`<main id="main" class="community-page">${body}</main>`)
  .replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)} | SOMDAS</title>`)
  .replace('class="nav-link active" href="./" aria-current="page"','class="nav-link" href="/"')
  .replace('class="nav-link" href="/community"','class="nav-link active" href="/community" aria-current="page"')
  .replace(/href="#(?!main\b)([^\"]+)"/g,'href="/#$1"')
  .replace('</body>','<script src="/activities.js" defer></script></body>');
}

export function renderCommunity(c:Content,url:URL){
 const category=url.searchParams.get('category')||'';
 const all=c.events.filter(e=>e.status==='published').sort((a,b)=>b.date.localeCompare(a.date));
 const filtered=category?all.filter(e=>e.category===category):all;
 const page=Math.max(1,Math.min(Math.ceil(filtered.length/9)||1,parseInt(url.searchParams.get('page')||'1')||1));
 const href=(cat:string,p=1)=>'/community'+(cat||p>1?'?'+new URLSearchParams({...cat?{category:cat}:{},...p>1?{page:String(p)}:{}}).toString():'')+'#community-stories';
 const current=filtered.slice((page-1)*9,page*9);
 return communityShell(c,'Community, events & updates',`
 <section class="community-hero"><div class="community-hero-copy"><p class="eyebrow">Community, events &amp; updates</p><h1>Community &amp; activities</h1><p>${esc(c.communityIntro)}</p></div></section>
 <section class="community-directory" id="community-stories"><div class="community-wrap"><header class="community-heading"><div><p class="eyebrow">Explore the community</p><h2>${category?esc(category):'Latest activities and updates'}</h2></div><p>Follow events, learning activities, official announcements, opportunities and stories from across the SOMDAS community.</p></header><nav class="category-filters" aria-label="Community categories">${['',...c.categories].map(cat=>`<a href="${esc(href(cat))}" ${category===cat?'aria-current="page"':''}>${esc(cat||'All updates')} <span>${cat?all.filter(e=>e.category===cat).length:all.length}</span></a>`).join('')}</nav><div class="activity-list-heading"><p>${filtered.length} ${filtered.length===1?'published update':'published updates'}</p><span>Newest first</span></div><div class="activity-grid">${current.map(card).join('')||'<div class="community-empty"><strong>No published stories or updates here yet.</strong><p>New activities and announcements will appear as soon as they are published.</p></div>'}</div>${filtered.length>9?`<nav class="activity-pagination" aria-label="Pages">${page>1?`<a href="${esc(href(category,page-1))}">← Previous</a>`:''}<span>Page ${page} of ${Math.ceil(filtered.length/9)}</span>${page*9<filtered.length?`<a href="${esc(href(category,page+1))}">Next →</a>`:''}</nav>`:''}</div></section>
 <section class="community-join"><div class="community-wrap"><div><p class="eyebrow">Take part</p><h2>Learn, contribute and build with us.</h2><p>Join activities, share useful knowledge or start a conversation around a challenge that matters to Somalia.</p></div><a class="button" href="/contact">Connect with SOMDAS <span aria-hidden="true">→</span></a></div></section>`);
}

export const renderActivities=renderCommunity;

export function renderEvent(cOrEvent:Content|Event,eventOrPreview?:Event|boolean,preview=false){
 const c='events' in cOrEvent?cOrEvent:initialContent;
 const e=('events' in cOrEvent?eventOrPreview:cOrEvent) as Event;
 if(typeof eventOrPreview==='boolean')preview=eventOrPreview;
 const cover=e.images[e.cover];
 return communityShell(c,e.title,`<section class="story-page">${preview?'<aside class="preview-notice">Draft preview — only the editor can see this story.</aside>':''}<a class="activity-back" href="/community">← Community &amp; activities</a><article class="story"><header><p class="eyebrow">${esc(e.category)}</p><h1>${esc(e.title)}</h1><p class="story-meta">${[date(e),e.location].filter(Boolean).map(esc).join(' · ')}</p><p class="story-summary">${esc(e.summary)}</p></header>${cover?`<figure class="story-cover"><img src="${esc(cover.url)}" alt="${esc(cover.alt)}"><figcaption>${esc(cover.alt)}</figcaption></figure>`:''}<div class="story-body">${e.body.split(/\n\s*\n/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('')||'<p>Story text has not been added yet.</p>'}</div>${e.images.length?`<h2 class="gallery-heading">In pictures</h2><div class="story-gallery">${e.images.map(i=>`<figure><button class="gallery-open" data-image="${esc(i.url)}" data-alt="${esc(i.alt)}" aria-label="Enlarge: ${esc(i.alt)}"><img src="${esc(i.url)}" alt="${esc(i.alt)}" loading="lazy"></button><figcaption>${esc(i.alt)}</figcaption></figure>`).join('')}</div><dialog class="image-dialog"><button class="image-close" aria-label="Close image">×</button><img alt=""><p></p></dialog>`:''}</article></section>`);
}

export const unavailable=(c:Content)=>communityShell(c,'Temporarily unavailable','<section class="story-page"><h1>Content is temporarily unavailable.</h1><p>Please try again shortly.</p><a href="/">Try again</a></section>');
export const missing=(c:Content)=>communityShell(c,'Story not found','<section class="story-page"><h1>Story not found.</h1><p>This story is not published or may have moved.</p><a href="/community">Browse community updates →</a></section>');
