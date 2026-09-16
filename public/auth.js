// Keep every native modal truly modal: only an explicit close/cancel action may
// dismiss it, and the document behind it must not scroll while it is open.
let modalScrollY=0;
let modalScrollLocked=false;
function syncModalScroll(){
 const hasOpen=document.querySelector('dialog[open]');
 if(hasOpen&&!modalScrollLocked){
  modalScrollY=window.scrollY;
  document.documentElement.style.overflow='hidden';
  document.body.style.position='fixed';
  document.body.style.top=`-${modalScrollY}px`;
  document.body.style.left='0';
  document.body.style.right='0';
  document.body.style.width='100%';
  modalScrollLocked=true;
 }else if(!hasOpen&&modalScrollLocked){
  document.documentElement.style.overflow='';
  document.body.style.position='';
  document.body.style.top='';
  document.body.style.left='';
  document.body.style.right='';
  document.body.style.width='';
  window.scrollTo(0,modalScrollY);
  modalScrollLocked=false;
 }
}
function protectNativeDialog(dialog){
 dialog.addEventListener('cancel',event=>event.preventDefault());
 dialog.addEventListener('close',syncModalScroll);
 dialog.addEventListener('toggle',syncModalScroll);
}
document.querySelectorAll('dialog').forEach(protectNativeDialog);
new MutationObserver(mutations=>{
 mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
  if(node instanceof HTMLDialogElement)protectNativeDialog(node);
  node.querySelectorAll?.('dialog').forEach(protectNativeDialog);
 }));
 syncModalScroll();
}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
syncModalScroll();

function setupPasswordToggles(root=document){
 root.querySelectorAll('input[type="password"]:not([data-password-toggle-ready])').forEach(input=>{
  input.dataset.passwordToggleReady='true';
  const control=document.createElement('span'),button=document.createElement('button');
  control.className='password-control';button.type='button';button.className='password-toggle';button.setAttribute('aria-pressed','false');
  input.before(control);control.append(input,button);
  const render=()=>{const visible=input.type==='text';button.setAttribute('aria-label',visible?'Hide password':'Show password');button.setAttribute('title',visible?'Hide password':'Show password');button.setAttribute('aria-pressed',String(visible));button.innerHTML=visible?'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5.4 9 5.4a14.6 14.6 0 01-2.1 2.7M6.2 6.2C4.1 7.6 3 9.4 3 9.4S6.5 15 12 15c1.2 0 2.3-.3 3.3-.7"/></svg>':'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z"/><circle cx="12" cy="12" r="2.5"/></svg>';};
  button.addEventListener('click',()=>{const start=input.selectionStart,end=input.selectionEnd;input.type=input.type==='password'?'text':'password';input.focus();try{input.setSelectionRange(start,end);}catch{}render();});render();
 });
}
setupPasswordToggles();

const authDialog=document.querySelector('#auth-dialog');
const passwordDialog=document.querySelector('#auth-password-dialog');
const joinActions=document.querySelector('[data-auth-actions]');
const profileButton=document.querySelector('[data-profile]');
const profileMenu=document.querySelector('[data-profile-menu]');
const profileDropdown=document.querySelector('[data-profile-dropdown]');
const mobileProfile=document.querySelector('[data-mobile-profile]');
const statusNode=document.querySelector('[data-auth-status]');
let currentUser=null;

function initials(name){const words=String(name||'').trim().split(/\s+/).filter(Boolean);return (words.length>1?words[0][0]+words.at(-1)[0]:String(name||'SM').slice(0,2)).toUpperCase();}
function showStatus(message='',error=false,target=statusNode){if(!target)return;target.textContent=message;target.dataset.error=String(error);}
function showView(name){document.querySelectorAll('[data-auth-view]').forEach(view=>{view.hidden=view.dataset.authView!==name;});showStatus();setTimeout(()=>document.querySelector(`[data-auth-view="${name}"] input`)?.focus(),30);}
function closeProfileMenu(){profileDropdown?.setAttribute('hidden','');profileButton?.setAttribute('aria-expanded','false');}
function renderSession(user){currentUser=user||null;joinActions?.toggleAttribute('hidden',Boolean(currentUser));profileMenu?.toggleAttribute('hidden',!currentUser);mobileProfile?.toggleAttribute('hidden',!currentUser);document.querySelectorAll('[data-profile-name]').forEach(node=>node.textContent=currentUser?.name||'Member');document.querySelectorAll('[data-profile-initials]').forEach(avatar=>{avatar.textContent=initials(currentUser?.name);avatar.hidden=Boolean(currentUser?.avatarUrl);});document.querySelectorAll('[data-profile-image]').forEach(image=>{if(currentUser?.avatarUrl)image.src=currentUser.avatarUrl;else image.removeAttribute('src');image.hidden=!currentUser?.avatarUrl;});if(!currentUser)closeProfileMenu();}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data;}
function formData(form){return Object.fromEntries(new FormData(form).entries());}
async function submit(form,path,onSuccess,statusTarget=statusNode){const button=form.querySelector('[type="submit"]');button.disabled=true;showStatus('Please wait…',false,statusTarget);try{const data=await api(path,{method:'POST',body:JSON.stringify(formData(form))});await onSuccess(data,form);form.reset();}catch(error){showStatus(error.message,true,statusTarget);}finally{button.disabled=false;}}

document.querySelectorAll('[data-auth-open]').forEach(button=>button.addEventListener('click',()=>{showView('login');authDialog?.showModal();}));
profileButton?.addEventListener('click',()=>{const open=profileButton.getAttribute('aria-expanded')!=='true';closeProfileMenu();if(open){profileDropdown?.removeAttribute('hidden');profileButton.setAttribute('aria-expanded','true');}});
document.querySelectorAll('[data-auth-logout]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('/api/auth/logout',{method:'POST',body:'{}'});renderSession(null);location.assign('/');}catch{button.disabled=false;}}));
document.addEventListener('click',event=>{if(profileMenu&&!profileMenu.contains(event.target))closeProfileMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeProfileMenu();});
document.querySelectorAll('[data-auth-switch]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.authSwitch)));
authDialog?.querySelector('.auth-close')?.addEventListener('click',()=>authDialog.close());

document.querySelector('[data-auth-form="login"]')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,'/api/auth/login',async data=>{renderSession(data.user);if(authDialog?.open)authDialog.close();},event.currentTarget.querySelector('[data-auth-inline-status]'));});
document.querySelector('[data-auth-form="register"]')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,'/api/auth/register',async data=>{renderSession(data.user);if(authDialog?.open)authDialog.close();});});

let otpTimer=0,otpVerificationToken='';
const resetEmailPanel=document.querySelector('[data-reset-email-panel]'),resetEmailLabel=document.querySelector('[data-reset-email]'),resetForm=document.querySelector('[data-auth-form="reset"]'),newPasswordForm=document.querySelector('[data-auth-form="new-password"]'),otpMessage=document.querySelector('[data-reset-message]');
const otpInputs=[...(resetForm?.querySelectorAll('input[name^="otp"]')||[])];
function clearOtpTimer(){if(otpTimer){clearInterval(otpTimer);otpTimer=0;}}
function otpValue(){return otpInputs.map(input=>input.value).join('');}
function startOtpTimer(){clearOtpTimer();let remaining=30;const countdown=document.querySelector('[data-otp-countdown]'),resend=document.querySelector('[data-otp-resend]');if(resend)resend.hidden=true;if(countdown)countdown.textContent=`Resend code in ${remaining} seconds`;otpTimer=window.setInterval(()=>{remaining-=1;if(countdown)countdown.textContent=remaining?`Resend code in ${remaining} seconds`:'If you didn’t receive the email, resend it.';if(!remaining){clearOtpTimer();if(resend)resend.hidden=false;}},1000);}
function resetOtpInputs(){otpInputs.forEach(input=>input.value='');otpInputs[0]?.focus();}
function resetForgotState(){clearOtpTimer();if(resetEmailPanel)resetEmailPanel.hidden=true;resetForm?.setAttribute('hidden','');newPasswordForm?.setAttribute('hidden','');otpVerificationToken='';}
function showResetOtp(email){showView('reset');if(resetEmailPanel)resetEmailPanel.hidden=false;if(resetEmailLabel)resetEmailLabel.textContent=email;resetForm?.removeAttribute('hidden');newPasswordForm?.setAttribute('hidden','');resetOtpInputs();if(otpMessage)showStatus('A six-digit code was sent to this email.',false,otpMessage);startOtpTimer();}
function editResetEmail(){clearOtpTimer();if(resetEmailPanel)resetEmailPanel.hidden=true;resetForm?.setAttribute('hidden','');newPasswordForm?.setAttribute('hidden','');const form=document.querySelector('[data-auth-form="forgot"]');showView('forgot');if(form)form.elements.email.value=resetEmailLabel?.textContent||'';form?.elements.email.focus();}
async function requestReset(form){const button=form.querySelector('[type="submit"]');button.disabled=true;showStatus('Please wait…');try{const email=String(form.elements.email.value).trim().toLowerCase();await api('/api/auth/reset/request',{method:'POST',body:JSON.stringify({email})});showResetOtp(email);}catch(error){showStatus(error.message,true);}finally{button.disabled=false;}}
document.querySelector('[data-auth-form="forgot"]')?.addEventListener('submit',event=>{event.preventDefault();requestReset(event.currentTarget);});
document.querySelector('[data-reset-edit]')?.addEventListener('click',editResetEmail);
document.querySelector('[data-otp-resend]')?.addEventListener('click',()=>{const form=document.querySelector('[data-auth-form="forgot"]');if(form)requestReset(form);});
otpInputs.forEach((input,index)=>{input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(-1);if(input.value)otpInputs[index+1]?.focus();});input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!input.value)otpInputs[index-1]?.focus();});input.addEventListener('paste',event=>{event.preventDefault();const code=(event.clipboardData?.getData('text')||'').replace(/\D/g,'').slice(0,6);code.split('').forEach((digit,i)=>{if(otpInputs[i])otpInputs[i].value=digit;});otpInputs[Math.min(code.length,6)-1]?.focus();});});
resetForm?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;try{const email=resetEmailLabel?.textContent||'',data=await api('/api/auth/reset/verify',{method:'POST',body:JSON.stringify({email,code:otpValue()})});otpVerificationToken=data.verificationToken;newPasswordForm.elements.email.value=email;newPasswordForm.elements.verificationToken.value=otpVerificationToken;form.hidden=true;resetEmailPanel.hidden=true;clearOtpTimer();authDialog?.close();passwordDialog?.showModal();newPasswordForm.hidden=false;newPasswordForm.querySelector('[name="password"]')?.focus();}catch(error){showStatus(error.message,true,otpMessage);}finally{button.disabled=false;}});
newPasswordForm?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,'/api/auth/reset/confirm',async()=>{passwordDialog?.close();authDialog?.showModal();showView('login');showStatus('Password reset. You can now sign in.');otpVerificationToken='';});});
passwordDialog?.querySelector('[data-password-close]')?.addEventListener('click',()=>passwordDialog.close());
document.addEventListener('somdas:forgot-password',()=>{resetForgotState();showView('forgot');authDialog?.showModal();});

function showPageStatus(form,message='',error=false){const node=form?.closest('.account-card')?.querySelector('[data-page-auth-status]');if(!node)return;node.textContent=message;node.dataset.error=String(error);}
async function submitPage(form,path,onSuccess){const button=form.querySelector('[type="submit"]');button.disabled=true;showPageStatus(form,'Please wait…');try{const data=await api(path,{method:'POST',body:JSON.stringify(formData(form))});await onSuccess(data,form);}catch(error){showPageStatus(form,error.message,true);}finally{button.disabled=false;}}
const requestedReturn=new URLSearchParams(location.search).get('returnTo');
const returnTo=requestedReturn?.startsWith('/')&&!requestedReturn.startsWith('//')?requestedReturn:'/';
if(returnTo!=='/')document.querySelectorAll('.auth-alternate a[href="/login"],.auth-alternate a[href="/signup"]').forEach(link=>{const url=new URL(link.href);url.searchParams.set('returnTo',returnTo);link.href=url.pathname+url.search;});
document.querySelector('[data-page-auth-form="login"]')?.addEventListener('submit',event=>{event.preventDefault();submitPage(event.currentTarget,'/api/auth/login',async(_data,form)=>{showPageStatus(form,'Signed in. Opening your account…');location.assign(returnTo);});});
document.querySelector('[data-page-auth-form="register"]')?.addEventListener('submit',event=>{event.preventDefault();submitPage(event.currentTarget,'/api/auth/register',async(_data,form)=>{showPageStatus(form,'Account created. Opening your account…');location.assign(returnTo);});});
const forgotPanel=document.querySelector('[data-page-forgot-panel]'),mainPanel=document.querySelector('[data-page-auth-main]');
let pageOtpTimer=0,pageVerificationToken='';
function openForgot(){if(!forgotPanel)return;forgotPanel.hidden=false;if(mainPanel)mainPanel.hidden=true;forgotPanel.querySelector('[data-page-auth-form="forgot"] input')?.focus();}
document.querySelector('[data-page-forgot]')?.addEventListener('click',event=>{event.preventDefault();history.replaceState(null,'','#forgot');openForgot();});
if(location.hash==='#forgot')openForgot();
function setupPageReset(){if(!forgotPanel)return;const requestForm=forgotPanel.querySelector('[data-page-auth-form="forgot"]'),otpForm=forgotPanel.querySelector('[data-page-auth-form="reset"]'),passwordForm=newPasswordForm,emailPanel=forgotPanel.querySelector('[data-page-reset-email-panel]'),emailLabel=forgotPanel.querySelector('[data-page-reset-email]'),inputs=[...forgotPanel.querySelectorAll('[data-page-otp-boxes] input')],countdown=forgotPanel.querySelector('[data-page-otp-countdown]'),resend=forgotPanel.querySelector('[data-page-otp-resend]');
 const stop=()=>{if(pageOtpTimer){clearInterval(pageOtpTimer);pageOtpTimer=0;}};
 const start=()=>{stop();let left=30;if(resend)resend.hidden=true;if(countdown)countdown.textContent=`Resend code in ${left} seconds`;pageOtpTimer=window.setInterval(()=>{left-=1;if(countdown)countdown.textContent=left?`Resend code in ${left} seconds`:'If you didn’t receive the email, resend it.';if(!left){stop();if(resend)resend.hidden=false;}},1000);};
 const request=async()=>{const button=requestForm.querySelector('[type="submit"]');button.disabled=true;showPageStatus(requestForm,'Please wait…');try{const email=String(requestForm.elements.email.value).trim().toLowerCase();await api('/api/auth/reset/request',{method:'POST',body:JSON.stringify({email})});emailLabel.textContent=email;emailPanel.hidden=false;requestForm.hidden=true;otpForm.hidden=false;passwordForm.hidden=true;inputs.forEach(input=>input.value='');inputs[0]?.focus();showPageStatus(otpForm,'A six-digit code was sent to this email.');start();}catch(error){showPageStatus(requestForm,error.message,true);}finally{button.disabled=false;}};
 requestForm?.addEventListener('submit',event=>{event.preventDefault();request();});
 forgotPanel.querySelector('[data-page-reset-edit]')?.addEventListener('click',()=>{stop();emailPanel.hidden=true;otpForm.hidden=true;passwordForm.hidden=true;requestForm.hidden=false;requestForm.elements.email.value=emailLabel.textContent||'';requestForm.elements.email.focus();});
 resend?.addEventListener('click',request);
 inputs.forEach((input,index)=>{input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(-1);if(input.value)inputs[index+1]?.focus();});input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!input.value)inputs[index-1]?.focus();});input.addEventListener('paste',event=>{event.preventDefault();const code=(event.clipboardData?.getData('text')||'').replace(/\D/g,'').slice(0,6);code.split('').forEach((digit,i)=>{if(inputs[i])inputs[i].value=digit;});inputs[Math.min(code.length,6)-1]?.focus();});});
 otpForm?.addEventListener('submit',async event=>{event.preventDefault();const button=otpForm.querySelector('[type="submit"]');button.disabled=true;try{const email=emailLabel.textContent||'',code=inputs.map(input=>input.value).join(''),data=await api('/api/auth/reset/verify',{method:'POST',body:JSON.stringify({email,code})});pageVerificationToken=data.verificationToken;passwordForm.elements.email.value=email;passwordForm.elements.verificationToken.value=pageVerificationToken;otpForm.hidden=true;emailPanel.hidden=true;stop();passwordDialog?.showModal();passwordForm.hidden=false;passwordForm.querySelector('[name="password"]')?.focus();}catch(error){showPageStatus(otpForm,error.message,true);}finally{button.disabled=false;}});
}
setupPageReset();

fetch('/api/auth/session',{headers:{Accept:'application/json'}}).then(response=>response.ok?response.json():null).then(session=>renderSession(session?.authenticated?session.user:null)).catch(()=>renderSession(null));
