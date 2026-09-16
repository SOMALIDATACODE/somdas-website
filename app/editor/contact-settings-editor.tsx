'use client';
import {Input} from '@/components/ui/input';
import type {ContactSettings} from '@/lib/contact-settings';

const networks=[['facebook','Facebook'],['twitter','X / Twitter'],['instagram','Instagram'],['tiktok','TikTok'],['linkedin','LinkedIn']] as const;

export default function ContactSettingsEditor({value,change}:{value:ContactSettings;change:(fn:(value:ContactSettings)=>ContactSettings)=>void}){
 return <><div className="panel-heading"><div><h2>Contact &amp; social links</h2><p>These official links appear on the Contact page and in the footer.</p></div></div><div className="cms-panel"><label className="editor-field"><span>Public information email</span><Input type="email" value={value.email} placeholder="info@somdas.org" onChange={e=>change(v=>({...v,email:e.target.value}))}/><small>Visitors can open their email application and write directly to this address.</small></label><div className="two-fields">{networks.map(([key,label])=><label className="editor-field" key={key}><span>{label} URL</span><Input type="url" value={value[key]} placeholder="https://…" onChange={e=>change(v=>({...v,[key]:e.target.value}))}/><small>Leave empty until the official account is ready.</small></label>)}</div></div></>;
}
