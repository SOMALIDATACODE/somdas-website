import {z} from 'zod';

const text=(max:number)=>z.string().trim().max(max);
const section=z.object({id:z.string().uuid(),title:text(160).min(1),body:text(12000).min(1)});
const document=z.object({eyebrow:text(80).min(1),title:text(180).min(1),intro:text(1200).min(1),updated:text(80).min(1),sections:z.array(section).min(1).max(20)});

export const legalSchema=z.object({
 terms:document,
 privacy:document
});

export const authCopySchema=z.object({
 loginEyebrow:text(80).min(1),loginTitle:text(180).min(1),loginIntro:text(500).min(1),
 registerEyebrow:text(80).min(1),registerTitle:text(180).min(1),registerIntro:text(500).min(1),
 forgotEyebrow:text(80).min(1),forgotTitle:text(180).min(1),forgotIntro:text(500).min(1),
 profileEyebrow:text(80).min(1),profileTitle:text(180).min(1),profileIntro:text(500).min(1)
});

const item=(id:string,title:string,body:string)=>({id,title,body});

export const defaultLegal={
 terms:{
  eyebrow:'TERMS OF USE',title:'Terms for using SOMDAS.',intro:'These terms explain the rules that apply when you visit the SOMDAS website, create an account, contact us or use material made available through our programs.',updated:'12 September 2026',
  sections:[
   item('61cb53a1-0be1-4e0c-a001-000000000001','1. About these terms','By using this website, you agree to these Terms of Use. If you do not agree, please do not use the website or create an account. “SOMDAS”, “we” and “our” refer to the Somali Data & AI Society.'),
   item('61cb53a1-0be1-4e0c-a001-000000000002','2. Website and program information','We provide information about SOMDAS programs, community activities, research, learning opportunities, data initiatives and digital solutions. Content may be updated, corrected, moved or removed as our work develops.'),
   item('61cb53a1-0be1-4e0c-a001-000000000003','3. Member accounts','You are responsible for providing accurate account information, protecting your password and notifying us if you believe your account has been accessed without permission. You may not impersonate another person or create an account for unlawful or misleading purposes.'),
   item('61cb53a1-0be1-4e0c-a001-000000000004','4. Acceptable use','Do not misuse the website, attempt to bypass its security, disrupt its operation, upload malicious material, collect personal information without permission, or use the service in a way that violates applicable law or the rights of others.'),
   item('61cb53a1-0be1-4e0c-a001-000000000005','5. Content, data and intellectual property','SOMDAS branding, website design and original content remain protected by applicable intellectual-property rules. A dataset, publication or third-party resource may have its own licence or attribution requirements; those specific terms take priority for that item.'),
   item('61cb53a1-0be1-4e0c-a001-000000000006','6. Links and third-party services','The website may link to external platforms and services. SOMDAS does not control their availability, content or privacy practices. Review their terms before using them.'),
   item('61cb53a1-0be1-4e0c-a001-000000000007','7. Availability and responsibility','We work to keep information accurate and the website available, but we cannot guarantee uninterrupted access or that every item is complete or suitable for a particular decision. Use research, data and technical information with appropriate professional judgment.'),
   item('61cb53a1-0be1-4e0c-a001-000000000008','8. Changes and contact','We may update these terms when the website or our services change. The updated date above shows the current version. Questions about these terms can be sent through the Contact page or to the official email shown in the footer.')
  ]
 },
 privacy:{
  eyebrow:'PRIVACY POLICY',title:'How SOMDAS handles your information.',intro:'This policy describes the information collected through the SOMDAS website, why it is used and the choices available to you.',updated:'12 September 2026',
  sections:[
   item('61cb53a1-0be1-4e0c-a002-000000000001','1. Information you provide','When you create an account, we collect your name and email address and store a protected representation of your password. When you contact us, we collect the name, email, topic and message you submit. We also receive information you choose to include in other forms or contributions.'),
   item('61cb53a1-0be1-4e0c-a002-000000000002','2. Information collected automatically','We may record limited technical information needed to operate and understand the website, such as the page visited, date, general device category and referral source. Essential cookies may be used for account sessions, security and anonymous visit measurement.'),
   item('61cb53a1-0be1-4e0c-a002-000000000003','3. How we use information','We use information to provide and secure member accounts, respond to messages, operate the website, understand which pages are useful, prevent abuse and improve SOMDAS programs and communications.'),
   item('61cb53a1-0be1-4e0c-a002-000000000004','4. When information is shared','We do not sell personal information. Information may be shared with service providers that host or support the website, when necessary to protect users or the service, or when required by law. We limit sharing to what is reasonably necessary for that purpose.'),
   item('61cb53a1-0be1-4e0c-a002-000000000005','5. Storage and retention','Website records may be stored using cloud database and file-storage services used by SOMDAS. We retain information for as long as it is needed for the purpose collected, account administration, security, legal obligations or legitimate organizational records, then delete or anonymize it when appropriate.'),
   item('61cb53a1-0be1-4e0c-a002-000000000006','6. Security','We use access controls, encrypted connections, protected password storage and other safeguards designed to reduce risk. No online service can guarantee absolute security, so please use a strong, unique password and contact us if you notice suspicious activity.'),
   item('61cb53a1-0be1-4e0c-a002-000000000007','7. Your choices','You may update your profile and password through your account. You may also ask about, correct or request deletion of personal information by contacting SOMDAS. Some records may need to be retained where required for security, legal or operational reasons.'),
   item('61cb53a1-0be1-4e0c-a002-000000000008','8. Children, updates and contact','The website is not designed to collect account information from children without appropriate permission. We may update this policy as our services change. Privacy questions or requests can be sent through the Contact page or to the official email shown in the footer.')
  ]
 }
};

export const defaultAuthCopy={
 loginEyebrow:'WELCOME BACK',loginTitle:'Sign in to SOMDAS.',loginIntro:'Access your member profile with your email and password.',
 registerEyebrow:'JOIN SOMDAS',registerTitle:'Create your account.',registerIntro:'Use your name and email to become a SOMDAS member.',
 forgotEyebrow:'PASSWORD RESET',forgotTitle:'Get a reset code.',forgotIntro:'Enter your account email. We’ll send a six-digit OTP that expires in 10 minutes.',
 profileEyebrow:'YOUR ACCOUNT',profileTitle:'Profile & security',profileIntro:'Manage your personal details, profile image and account security.'
};

export type LegalContent=z.infer<typeof legalSchema>;
export type AuthCopy=z.infer<typeof authCopySchema>;
