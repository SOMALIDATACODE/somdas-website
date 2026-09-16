import type {Content} from './content';
import {esc,renderHome} from './render';

function shell(c:Content,title:string,body:string,active?:string){
 let html=renderHome(c)
  .replace(/<main id="main">[\s\S]*?<\/main>/,`<main id="main">${body}</main>`)
  .replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)} | SOMDAS</title>`)
  .replace('class="nav-link active" href="./" aria-current="page"','class="nav-link" href="/"')
  .replace(/href="#(?!main\b)([^\"]+)"/g,'href="/#$1"');
 if(active)html=html.replace(`class="nav-link" href="/${active}"`,`class="nav-link active" href="/${active}" aria-current="page"`);
 return html;
}

export function renderLegal(c:Content,kind:'terms'|'privacy'){
 const doc=c.legal[kind];
 return shell(c,doc.title,`<section class="legal-page"><div class="legal-wrap"><a class="legal-back" href="/" data-history-back>← Back</a><header class="legal-heading"><p class="eyebrow">${esc(doc.eyebrow)}</p><h1>${esc(doc.title)}</h1><p>${esc(doc.intro)}</p><span>Last updated: ${esc(doc.updated)}</span></header><article>${doc.sections.map((section,index)=>`<section id="legal-${index+1}"><h2>${esc(section.title)}</h2>${section.body.split(/\n\s*\n/).map(paragraph=>`<p>${esc(paragraph).replace(/\n/g,'<br>')}</p>`).join('')}</section>`).join('')}<div class="legal-contact"><h2>Questions?</h2><p>Contact SOMDAS at <a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a> or use our <a href="/contact">contact page</a>.</p></div></article></div></section>`);
}

export const renderTerms=(c:Content)=>renderLegal(c,'terms');
export const renderPrivacy=(c:Content)=>renderLegal(c,'privacy');

export function renderAuthPage(c:Content,mode:'login'|'signup'){
 const signup=mode==='signup';
 const form=signup?`<form data-page-auth-form="register"><label>Full name<input name="name" autocomplete="name" minlength="2" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="10" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></label><button class="button auth-submit" type="submit">Create account</button></form><p class="auth-consent">By creating an account, you agree to our <a href="/terms">Terms of Use</a> and acknowledge our <a href="/privacy">Privacy Policy</a>.</p><p class="auth-alternate">Already have an account? <a href="/login">Sign in</a></p>`:`<form data-page-auth-form="login"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><a class="auth-link" href="/login#forgot" data-page-forgot>Forgot your password?</a><button class="button auth-submit" type="submit">Sign in</button></form><p class="auth-alternate">I don’t have an account. <a href="/signup">Create account</a></p>`;
 const forgot=!signup?`<section class="account-card account-forgot" data-page-forgot-panel hidden><div class="account-brand"><img src="/assets/somdas-mark.png" alt="" width="58" height="58"><span>SOMDAS</span></div><p class="eyebrow">${esc(c.auth.forgotEyebrow)}</p><h2>${esc(c.auth.forgotTitle)}</h2><p>${esc(c.auth.forgotIntro)}</p><form data-page-auth-form="forgot"><label>Email<input name="email" type="email" autocomplete="email" required></label><button class="button auth-submit" type="submit">Send OTP</button></form><div class="auth-reset-email" data-page-reset-email-panel hidden><p>We sent the code to <strong data-page-reset-email></strong>.</p><button type="button" class="auth-link" data-page-reset-edit>Email is incorrect? Edit it</button></div><form data-page-auth-form="reset" hidden><div class="otp-boxes" data-page-otp-boxes><input name="otp1" inputmode="numeric" maxlength="1" aria-label="Digit 1" required><input name="otp2" inputmode="numeric" maxlength="1" aria-label="Digit 2" required><input name="otp3" inputmode="numeric" maxlength="1" aria-label="Digit 3" required><input name="otp4" inputmode="numeric" maxlength="1" aria-label="Digit 4" required><input name="otp5" inputmode="numeric" maxlength="1" aria-label="Digit 5" required><input name="otp6" inputmode="numeric" maxlength="1" aria-label="Digit 6" required></div><p class="auth-countdown" data-page-otp-countdown>Resend code in 30 seconds</p><button type="button" class="auth-link" data-page-otp-resend hidden>Resend code</button><p class="auth-reset-message" data-page-reset-message role="status" aria-live="polite"></p><button class="button auth-submit" type="submit">Verify code</button></form><p class="auth-status" data-page-auth-status role="status" aria-live="polite"></p></section>`:'';
 return shell(c,signup?'Create your SOMDAS account':'Sign in to SOMDAS',`<section class="account-page"><div class="account-layout"><section class="account-card" data-page-auth-main><div class="account-brand"><img src="/assets/somdas-mark.png" alt="" width="58" height="58"><span>SOMDAS</span></div><p class="eyebrow">${esc(signup?c.auth.registerEyebrow:c.auth.loginEyebrow)}</p><h1>${esc(signup?c.auth.registerTitle:c.auth.loginTitle)}</h1><p>${esc(signup?c.auth.registerIntro:c.auth.loginIntro)}</p>${form}<p class="auth-status" data-page-auth-status role="status" aria-live="polite"></p></section>${forgot}</div></section>`);
}
