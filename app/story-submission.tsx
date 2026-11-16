import {useRef,useState,type FormEvent} from 'react';

const endpoint='https://storysteps-submissions.tttoom580-storysteps.workers.dev/submissions';

export default function StorySubmission({onBack}:{onBack:()=>void}){
 const request=useRef<{id:string;draft:string}|null>(null);
 const sending=useRef(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [receipt,setReceipt]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(sending.current)return;
  const form=new FormData(event.currentTarget);
  const payload={
   title:String(form.get('title')||'').trim(),
   author:String(form.get('author')||'').trim(),
   email:String(form.get('email')||'').trim(),
   manuscript:String(form.get('manuscript')||'').trim(),
   consent:form.get('consent')==='on'
  };
  const draft=JSON.stringify(payload);
  if(request.current?.draft!==draft)request.current={draft,id:crypto.randomUUID()};
  const id=request.current.id;
  sending.current=true;
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(!response.ok||result.id!==id)throw Error(result.error||'投稿未取得確認，請稍後重試。');
   setReceipt(id);
  }catch(exception){
   setError(exception instanceof Error&&exception.name==='Error'?exception.message:'投稿未取得確認，請稍後重試。');
  }finally{
   sending.current=false;setBusy(false);
  }
 }
 return <section className="submission-page" aria-labelledby="submit-title">
  <button className="back-link" onClick={onBack}>← 回首頁</button>
  <h1 id="submit-title">投稿小說</h1>
  {receipt?<div className="submission-receipt" role="status">
   <h2>投稿已收到</h2>
   <p>書稿已送交站主審閱。請保留投稿編號，以便日後查詢。</p><code>{receipt}</code>
   <button className="secondary" onClick={()=>{request.current=null;setReceipt('')}}>再投一篇</button>
  </div>:<>
   <p>歡迎投稿英文小說，可以附上繁中翻譯。投整本或先投樣章都可以，書稿僅供站主審閱。</p>
   <form className="submission-form" onSubmit={submit}>
    <label>書名<input name="title" required maxLength={120}/></label>
    <label>筆名<input name="author" required maxLength={60}/></label>
    <label>聯絡 Email（選填）<input name="email" type="email" maxLength={254}/><small>供站主聯絡投稿結果。</small></label>
    <label>小說正文<textarea name="manuscript" minLength={30} maxLength={200000} rows={12} required placeholder="貼上英文正文，有繁中翻譯也可以一起貼。"/></label>
    <label className="submission-consent"><input name="consent" type="checkbox" required/>我擁有這份書稿的投稿權利，並同意交由拾頁站主審閱。</label>
    {error&&<p role="alert" className="error-text">{error}</p>}
    <button className="primary" type="submit" disabled={busy}>{busy?'正在送出…':'送出投稿'}</button>
   </form>
  </>}
 </section>;
}
