import {z} from 'zod';

const secureUrl=z.string().trim().max(500).refine(value=>!value||/^https:\/\//.test(value),'Social links must start with https://');

export const contactSettingsSchema=z.object({
 email:z.string().trim().email().max(254),
 facebook:secureUrl,
 twitter:secureUrl,
 instagram:secureUrl,
 tiktok:secureUrl,
 linkedin:secureUrl
});

export type ContactSettings=z.infer<typeof contactSettingsSchema>;

export const defaultContactSettings:ContactSettings={
 email:'info@somdas.org',
 facebook:'',
 twitter:'',
 instagram:'',
 tiktok:'',
 linkedin:''
};
