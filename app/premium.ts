import {useEffect,useState} from 'react';
import {readerOffer,premiumPriceTwd} from './offer';
import {stories} from './content';

const storageKey='storysteps-premium-key';
const tokenPattern=/^(?:ss2_|ssg_)[a-f0-9]{64}$/;
const endpoint=readerOffer.premium.serviceUrl;
export const premiumBookCount=stories.length-readerOffer.freeBookIds.length;
export const premiumDescription=`NT$${premiumPriceTwd} 一次付費，解鎖目前 ${premiumBookCount} 本試讀小說的後續章節。`;

export function savedPremiumKey(){
 try { return localStorage.getItem(storageKey)||''; } catch { return ''; }
}

export function savePremiumKey(key:string){
 localStorage.setItem(storageKey,key);
}

export function newPremiumKey(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return 'ss2_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

export async function premiumFetch(path:string,key=savedPremiumKey(),data?:object){
 if(!endpoint)throw Error('閱讀通行證服務尚未開通。');
 const headers=new Headers();
 if(tokenPattern.test(key))headers.set('Authorization','Bearer '+key);
 if(data)headers.set('Content-Type','application/json');
 return fetch(new URL('/api/premium/'+path,endpoint),{method:data?'POST':'GET',headers,
  body:data?JSON.stringify(data):undefined,cache:'no-store'});
}

export async function premiumRequest(path:string,key?:string,data?:object){
 const response=await premiumFetch(path,key,data);
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'通行證服務暫時無法使用。');
 return result;
}

export function usePremium(){
 const [state,setState]=useState<{checkout:boolean;booksOwned:string[];googleClientId:string;googleSignedIn:boolean}>({checkout:false,booksOwned:[],googleClientId:'',googleSignedIn:false});
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let current=true;
  if(endpoint)premiumRequest('status').then(result=>{
   if(current)setState({checkout:result.checkout===true&&result.amount===premiumPriceTwd&&result.books===premiumBookCount,
    googleClientId:typeof result.googleClientId==='string'?result.googleClientId:'',
    googleSignedIn:result.googleSignedIn===true,booksOwned:Array.isArray(result.booksOwned)?result.booksOwned:[]});
  }).catch(()=>{if(current)setState({checkout:false,booksOwned:[],googleClientId:'',googleSignedIn:false})});
  return ()=>{current=false};
 },[revision]);
 return {...state,connected:Boolean(endpoint),refresh:()=>setRevision(value=>value+1)};
}
