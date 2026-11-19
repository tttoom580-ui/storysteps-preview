import type {Story} from './types';
import topics from '../config/topics.json';

export const genreGroups=topics.map(topic=>({...topic,pattern:new RegExp(topic.keywords.join('|'))}));
export function matchesGenre(story:Story,selection:string){
 if(selection==='全部題材')return true;
 const group=genreGroups.find(group=>group.name===selection);
 return group?group.pattern.test([story.genre,...(story.tags||[])].join(' ')):story.tags?.includes(selection)===true||story.genre===selection;
}
