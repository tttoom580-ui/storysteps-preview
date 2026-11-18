import {useEffect,useRef,useState} from 'react';
import {premiumRequest,savePremiumKey} from './premium';

type GoogleIdentity = {
 initialize(options:{client_id:string;nonce:string;callback:(result:{credential?:string})=>void}):void;
 renderButton(container:HTMLElement,options:{type:'standard';theme:'outline';size:'large';text:'signin_with';locale:'zh-TW'}):void;
 disableAutoSelect():void;
};
const identity=()=> (window as Window & {google?:{accounts?:{id?:GoogleIdentity}}}).google?.accounts?.id;
let loading:Promise<GoogleIdentity>|undefined;
function loadIdentity(){
 const ready=identity();
 if(ready)return Promise.resolve(ready);
 loading??=new Promise<GoogleIdentity>((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://accounts.google.com/gsi/client';
  script.async=true;
  script.onload=()=>{const api=identity();if(api)resolve(api);else reject(Error('Google 登入暫時無法載入。'));};
  script.onerror=()=>reject(Error('Google 登入暫時無法載入。'));
  document.head.append(script);
 }).catch(error=>{loading=undefined;throw error;});
 return loading;
}

export function stopGoogleAutoSelect(){
 identity()?.disableAutoSelect();
}

export default function GoogleSignIn({clientId,onChange}:{clientId:string;onChange:()=>void}){
 const button=useRef<HTMLDivElement>(null);
 const changed=useRef(onChange);
 changed.current=onChange;
 const [retry,setRetry]=useState(0);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  const container=button.current!;
  setError('');
  setBusy(true);
  Promise.all([loadIdentity(),premiumRequest('google/challenge','',{})]).then(([api,challenge])=>{
   if(!active)return;
   api.initialize({client_id:clientId,nonce:challenge.nonce,callback:async({credential})=>{
    if(!active)return;
    setBusy(true);
    setError('');
    try{
     if(!credential)throw Error('Google 登入未完成。');
     const {token}=await premiumRequest('google/login','',{credential,proof:challenge.proof});
     if(!/^ssg_[a-f0-9]{64}$/.test(token||''))throw Error('登入資料不完整。');
     if(active){savePremiumKey(token);changed.current();}
    }catch(error){if(active)setError(error instanceof Error?error.message:'Google 登入未完成。');}
    finally{if(active)setBusy(false);}
   }});
   api.renderButton(container,{type:'standard',theme:'outline',size:'large',text:'signin_with',locale:'zh-TW'});
  }).catch(error=>{if(active)setError(error instanceof Error?error.message:'Google 登入暫時無法使用。');})
   .finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;container.replaceChildren();};
 },[clientId,retry]);
 return <div>
  <div ref={button} aria-busy={busy} hidden={!!error}/>
  {busy&&<p role="status">請稍候…</p>}
  {error&&<><p role="status">{error}</p><button className="secondary" onClick={()=>setRetry(value=>value+1)}>重試 Google 登入</button></>}
 </div>;
}
