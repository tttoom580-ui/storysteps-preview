export const plans=[
 {id:'four',price:100,books:4,name:'輕讀四本'},
 {id:'seven',price:150,books:7,name:'沉浸七本'},
 {id:'ten',price:200,books:10,name:'收藏十本'},
];
export const isStoreOwner=(user:string|null,config:any)=>!!user&&!!config.TEST_READER_ID&&user===config.TEST_READER_ID;
export async function hashCode(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.trim().toUpperCase())))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export function newCode(){const bytes=crypto.getRandomValues(new Uint8Array(20));return Array.from(bytes,x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('').match(/.{1,5}/g)!.join('-')}
