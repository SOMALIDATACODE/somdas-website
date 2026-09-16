'use client';
import {FormEvent,useEffect,useState} from 'react';
import {KeyRound,LoaderCircle,LockKeyhole,MailCheck,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {PasswordInput} from '@/components/ui/password-input';
import '../login.css';

type Step='login'|'email-code'|'owner-setup'|'forgot'|'reset'|'reset-sent'|'reset-done';
type AuthReply={error?:string;message?:string;requiresEmailCode?:boolean;challengeToken?:string;maskedEmail?:string;authenticated?:boolean};
async function request(path:string,data:Record<string,string>={}){const response=await fetch(path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),result=await response.json() as AuthReply;if(!response.ok)throw Error(result.error||'Request failed.');return result;}
const safeReturn=()=>{const value=new URLSearchParams(location.search).get('returnTo')||'/admin';return value.startsWith('/')&&!value.startsWith('//')?value:'/admin';};

export default function CMSLogin(){
 const [step,setStep]=useState<Step>('login'),[email,setEmail]=useState(''),[maskedEmail,setMaskedEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[code,setCode]=useState(''),[challengeToken,setChallengeToken]=useState(''),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{
  const params=new URLSearchParams(location.search),resetToken=params.get('token');if(params.get('reset')==='1'&&resetToken){setStep('reset');setChallengeToken(resetToken);setEmail(params.get('email')||'');return;}
  const session=await fetch('/api/admin/auth/session',{cache:'no-store'}).then(r=>r.json()) as AuthReply;if(session.authenticated){location.replace(safeReturn());return;}
  const result=await request('/api/admin/auth/bootstrap');if(active&&result.challengeToken){setStep('owner-setup');setEmail('yusufabdisalamyusuf@gmail.com');setMaskedEmail(result.maskedEmail||'your Gmail');setChallengeToken(result.challengeToken);}
 }catch{}finally{if(active)setChecking(false);}})();return()=>{active=false;};},[]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
  if(step==='login'){const result=await request('/api/admin/auth/login',{email,password});setChallengeToken(result.challengeToken||'');setMaskedEmail(result.maskedEmail||email);setCode('');setStep('email-code');return;}
  if(step==='email-code'){await request('/api/admin/auth/verify',{challengeToken,code});location.replace(safeReturn());return;}
  if(step==='owner-setup'){await request('/api/admin/auth/owner-setup',{challengeToken,code,password,confirmPassword});location.replace(safeReturn());return;}
  if(step==='forgot'){await request('/api/admin/auth/reset/request',{email});setStep('reset-sent');return;}
  if(step==='reset'){await request('/api/admin/auth/reset/confirm',{challengeToken,code,password,confirmPassword});setPassword('');setConfirmPassword('');setCode('');setStep('reset-done');}
 }catch(value){setError(value instanceof Error?value.message:'Request failed.');}finally{setBusy(false);}}
 function restart(){setStep('login');setPassword('');setConfirmPassword('');setCode('');setChallengeToken('');setMaskedEmail('');setError('');history.replaceState({},'',location.pathname);}
 const verifyStep=step==='email-code'||step==='owner-setup'||step==='reset';
 const title=step==='login'?'Sign in to SOMDAS CMS':step==='email-code'?'Enter the code sent to your email':step==='owner-setup'?'Secure the Super Admin account':step==='forgot'?'Reset your CMS password':step==='reset'?'Create a new CMS password':step==='reset-sent'?'Check your email':'Password reset complete';
 const description=step==='login'?'Enter your CMS email and password. We will then send a one-time code to your email.':step==='email-code'||step==='owner-setup'?`Enter the 6-digit code sent to ${maskedEmail}.`:step==='forgot'?'Enter your CMS email address. A secure code and reset link will be emailed to you.':step==='reset'?'Enter the email code and choose a new password. All previous CMS sessions will be signed out.':step==='reset-sent'?'If the address belongs to an active CMS account, it now has a code and reset link.':'You can now sign in using your new password.';
 return <main className="cms-login-page"><section className="cms-login-panel" aria-labelledby="cms-login-title"><a className="cms-login-brand" href="/" aria-label="SOMDAS home"><img src="/assets/somdas-logo.png" alt="SOMDAS"/></a>{checking?<div className="cms-login-check"><LoaderCircle className="cms-spin"/><p>Checking secure access…</p></div>:<><div className="cms-login-heading">{step==='login'?<LockKeyhole/>:step==='reset-sent'||step==='reset-done'?<MailCheck/>:<ShieldCheck/>}<p>{step==='login'?'SECURE CONTENT MANAGEMENT':'EMAIL VERIFICATION'}</p><h1 id="cms-login-title">{title}</h1><span>{description}</span></div>
 {(step==='reset-sent'||step==='reset-done')?<div className="cms-login-form"><Button size="lg" onClick={restart}><KeyRound/>{step==='reset-done'?'Sign in':'Back to sign in'}</Button></div>:<form onSubmit={submit} className="cms-login-form">
  {(step==='login'||step==='forgot')&&<label>Email address<Input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
  {step==='login'&&<><label>Password<PasswordInput autoComplete="current-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="button" className="cms-login-back" onClick={()=>{setStep('forgot');setPassword('');setError('');}}>Forgot password?</button></>}
  {(step==='owner-setup'||step==='reset')&&<><label>New password<PasswordInput autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<PasswordInput autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label></>}
  {verifyStep&&<label>6-digit email code<Input className="cms-code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>}
  {error&&<p className="cms-login-error" role="alert">{error}</p>}<Button type="submit" size="lg" disabled={busy}>{busy?<><LoaderCircle className="cms-spin"/>Please wait</>:step==='login'?<><KeyRound/>Continue</>:step==='forgot'?'Send reset code':step==='email-code'?'Verify and sign in':step==='owner-setup'?'Create password and sign in':'Reset password'}</Button>{step!=='login'&&step!=='owner-setup'&&<button type="button" className="cms-login-back" onClick={restart}>Back to sign in</button>}
 </form>}<p className="cms-login-footnote">CMS pages remain locked until email, password and email verification are complete.</p></>}</section></main>;
}
