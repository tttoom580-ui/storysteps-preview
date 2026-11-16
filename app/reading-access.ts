import {isFreeBook, previewChapters} from './offer';
import {stories} from './content';
const key='storysteps-free-access-v1';
export function readGrants(){try{const d=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(d)?d.filter(g=>stories.some(b=>b.id===g.story)&&[6,10,14,18,22].includes(g.start)&&['launch-gift','rewarded-ad'].includes(g.source)):[]}catch{return []}}
export function canRead(story:string,number:number){
 if(!Number.isInteger(number)||number<1||number>25)return false;
 return isFreeBook(story)||number<=previewChapters;
}
