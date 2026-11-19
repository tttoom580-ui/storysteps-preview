import {useState} from 'react';
import type {FormEvent} from 'react';
import GoogleSignIn,{stopGoogleAutoSelect} from './google-sign-in';
import {previewChapters} from './offer';
import {newPremiumKey,premiumRequest,savedPremiumKey,savePremiumKey} from './premium';

export default function PremiumAccount({checkout,connected,active,googleClientId,googleSignedIn,onChange,onContinue}:{
 checkout:boolean;connected:boolean;active:boolean;googleClientId:string;googleSignedIn:boolean;onChange:()=>void;onContinue?:()=>void;
}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[showKey,setShowKey]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>,mode:'pay'|'redeem'|'login'){
  event.preventDefault();
  const fields=new FormData(event.currentTarget);
  setBusy(true);setNotice('');
  try{
   if(mode==='pay'){
    const result=await premiumRequest('checkout',googleSignedIn?undefined:'',googleSignedIn?{}:{email:String(fields.get('email')||'')});
    if(!['https://core.newebpay.com/MPG/mpg_gateway','https://ccore.newebpay.com/MPG/mpg_gateway'].includes(result.url))
     throw Error('付款頁連結無效。');
    const form=document.createElement('form');
    form.action=result.url;form.method='post';
    for(const name of ['MerchantID','TradeInfo','TradeSha','Version']){
     if(typeof result.fields?.[name]!=='string')throw Error('付款資料不完整。');
     const input=document.createElement('input'); input.type='hidden';input.name=name;input.value=result.fields[name];form.append(input);
    }
    document.body.append(form);form.submit();
   }else if(mode==='redeem'){
    const key=savedPremiumKey()||newPremiumKey();
    await premiumRequest('redeem',key,{order:String(fields.get('order')||'').trim(),code:String(fields.get('code')||'').trim()});
    savePremiumKey(key);
    setNotice('已開通。請保存登入金鑰，以便在其他裝置繼續閱讀。');
    setShowKey(true);onChange();
   }else{
    const key=String(fields.get('key')||'').trim();
    const result=await premiumRequest('status',key);
    if(!result.booksOwned?.length)throw Error('登入金鑰無效，或此帳號未開通。');
    savePremiumKey(key);setNotice('已登入閱讀通行證。');onChange();
   }
  }catch(error){setNotice(error instanceof Error?error.message:'操作失敗，請稍後再試。')}
  finally{setBusy(false)}
 }
 async function logout(){
  setBusy(true);
  try{
   await premiumRequest('google/logout',undefined,{});
   stopGoogleAutoSelect();
   savePremiumKey('');
   setNotice('已登出此裝置。');
   onChange();
  }catch(error){setNotice(error instanceof Error?error.message:'登出失敗，請重試。');}
  finally{setBusy(false);}
 }
 return <div className="premium-account">
  {googleClientId&&!googleSignedIn&&!active&&<GoogleSignIn clientId={googleClientId} onChange={onChange}/>}
  {googleSignedIn&&<p>已用 Google 登入。<button className="text-link" disabled={busy} onClick={logout}>登出</button></p>}
  {checkout&&!active&&(!googleClientId||googleSignedIn)&&<form onSubmit={event=>submit(event,'pay')}>
   {!googleSignedIn&&<label>接收開通碼的 Email<input name="email" type="email" autoComplete="email" maxLength={80} required/></label>}
   <button className="primary" disabled={busy}>前往藍新付款</button>
  </form>}
  {active&&onContinue&&<button className="primary" onClick={onContinue}>繼續讀第 {previewChapters+1} 章</button>}
  {!checkout&&!active&&<button className="primary" disabled>付款尚未開通</button>}
  {connected&&!googleSignedIn&&<details><summary>{active?'通行證帳號與跨裝置登入':'已有開通碼或登入金鑰？'}</summary>
   {active?<div className="premium-key-actions">
    <button className="secondary" onClick={()=>setShowKey(!showKey)}>{showKey?'隱藏':'顯示'}登入金鑰</button>
    <button className="secondary" onClick={()=>{savePremiumKey('');setShowKey(false);setNotice('已登出此裝置。');onChange()}}>登出</button>
   </div>:<>
    <form onSubmit={event=>submit(event,'redeem')}>
     <label>訂單編號<input name="order" autoCapitalize="off" spellCheck={false} required/></label>
     <label>一次性開通碼<input name="code" autoCapitalize="off" spellCheck={false} required/></label>
     <button className="secondary" disabled={busy}>開通通行證</button>
    </form>
    <form onSubmit={event=>submit(event,'login')}>
     <label>跨裝置登入金鑰<input name="key" type="password" autoComplete="current-password" required/></label>
     <button className="secondary" disabled={busy}>登入通行證</button>
    </form>
   </>}
  </details>}
  {showKey&&savedPremiumKey()&&<label>登入金鑰（請私下保存）<input readOnly value={savedPremiumKey()} onFocus={event=>event.target.select()}/></label>}
  {notice&&<p role="status">{notice}</p>}
 </div>;
}
