import {z} from 'zod';
const text=(max:number)=>z.string().trim().max(max);
const image=z.string().regex(/^\/(?:assets\/[a-zA-Z0-9._-]+|media\/[a-f0-9-]+)$/).or(z.literal(''));
const statement=z.object({eyebrow:text(80),title:text(180).min(1),lead:text(700),body:text(6000)});
export const aboutSectionNames={hero:'About hero',intro:'Who we are',vision:'Our Vision',mission:'Our Mission',difference:'What makes SOMDAS different',team:'Our Team',join:'Build with us'} as const;
export const aboutSchema=z.object({
 sections:z.object({hero:z.boolean(),intro:z.boolean(),vision:z.boolean(),mission:z.boolean(),difference:z.boolean(),team:z.boolean(),join:z.boolean()}),
 hero:z.object({eyebrow:text(80),title:text(180).min(1),body:text(700)}),
 intro:statement.extend({image,caption:text(250)}),vision:statement,mission:statement,
 difference:z.object({eyebrow:text(80),title:text(180).min(1),body:text(700),items:z.array(z.object({title:text(120).min(1),body:text(800)})).length(5)}),
 teamTitle:text(180).min(1),teamIntro:text(700),
 team:z.array(z.object({id:z.string().uuid(),name:text(120).min(1),role:text(150),bio:text(3000),image,imageAlt:text(250),linkedin:z.string().url().refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&(u.hostname==='linkedin.com'||u.hostname==='www.linkedin.com');}catch{return false;}},'Use a https://www.linkedin.com/ profile URL.').or(z.literal('')),visible:z.boolean()})).max(80),
 join:z.object({eyebrow:text(80),title:text(180).min(1),body:text(700)})
}).superRefine((a,ctx)=>{if(new Set(a.team.map(m=>m.id)).size!==a.team.length)ctx.addIssue({code:'custom',message:'Team profile IDs must be unique.'});});
export type AboutContent=z.infer<typeof aboutSchema>;
export const defaultAbout:AboutContent={
 sections:{hero:true,intro:true,vision:true,mission:true,difference:true,team:true,join:true},
 hero:{eyebrow:'About SOMDAS',title:'Connecting knowledge.\nBuilding Somalia’s future.',body:'A Somali-led community advancing open data, responsible research and practical technology.'},
 intro:{eyebrow:'Who we are',title:'Built around\nSomali priorities.',lead:'The Somali Data & AI Society is a nonprofit based in Mogadishu. We connect people, knowledge and technology to make data more useful for Somalia.',body:'We are working to address two connected challenges: fragmented information about the country and the need to strengthen local data and AI capabilities.',image:'/assets/about-banner.png',caption:'Based in Mogadishu, Somalia'},
 vision:{eyebrow:'Our direction',title:'Our Vision',lead:'A Somalia where trusted data and local expertise support better decisions and inclusive progress.',body:'We envision researchers finding reliable national data, educators using evidence to strengthen learning, and communities benefiting from useful technology.\n\nOur ambition is to make data and AI practical resources for people across Somalia.'},
 mission:{eyebrow:'Our purpose',title:'Our Mission',lead:'Make Somali data accessible, useful and capable of supporting real decisions.',body:'We bring together open data, responsible research, practical learning and technology development around Somali priorities.\n\nOur work connects public value with long-term sustainability, so useful knowledge and local capabilities can continue to grow.'},
 difference:{eyebrow:'One connected mission',title:'What makes SOMDAS different',body:'Connecting knowledge, capability and practical action around Somali priorities.',items:[{title:'Open data',body:'Make Somali information easier to find, understand and reuse.'},{title:'Applied research',body:'Explore evidence and responsible AI around local needs.'},{title:'National capability',body:'Build practical skills and support a growing research community.'},{title:'Innovation into practice',body:'Translate research and ideas into useful tools.'},{title:'Built for the long term',body:'Develop the capacity to sustain work with public value.'}]},
 teamTitle:'The people behind the purpose.',teamIntro:'Meet the people helping shape SOMDAS.',team:[],
 join:{eyebrow:'Build with us',title:'Help shape what comes next.',body:'Bring your curiosity, your knowledge or a challenge worth solving.'}
};
