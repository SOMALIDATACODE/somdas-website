export const baseSecurityHeaders:Record<string,string>={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'X-Frame-Options':'DENY',
 'Cross-Origin-Opener-Policy':'same-origin',
 'Cross-Origin-Resource-Policy':'same-origin',
 'Strict-Transport-Security':'max-age=31536000; includeSubDomains'
};

export const publicContentSecurityPolicy="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'";

export function secureHeaders(extra:Record<string,string>={},contentSecurityPolicy=false){
 return {...baseSecurityHeaders,...extra,...(contentSecurityPolicy?{'Content-Security-Policy':publicContentSecurityPolicy}:{})};
}

export function secureResponse(response:Response,contentSecurityPolicy=false){
 const headers=new Headers(response.headers);
 for(const [key,value] of Object.entries(baseSecurityHeaders))if(!headers.has(key))headers.set(key,value);
 if(contentSecurityPolicy&&!headers.has('Content-Security-Policy'))headers.set('Content-Security-Policy',publicContentSecurityPolicy);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export async function readBoundedText(request:Request,maxBytes:number):Promise<{ok:true;text:string}|{ok:false}>{
 const advertised=Number(request.headers.get('content-length'));
 if(Number.isFinite(advertised)&&advertised>maxBytes)return {ok:false};
 const reader=request.body?.getReader();
 if(!reader)return {ok:true,text:''};
 const decoder=new TextDecoder();let size=0,text='';
 for(;;){
  const {done,value}=await reader.read();if(done)break;
  size+=value.byteLength;if(size>maxBytes){await reader.cancel();return {ok:false};}
  text+=decoder.decode(value,{stream:true});
 }
 return {ok:true,text:text+decoder.decode()};
}
